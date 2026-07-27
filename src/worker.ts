/// <reference types="@cloudflare/workers-types" />

const MAX_REQUEST_BYTES = 32 * 1024;
const DUPLICATE_WINDOW_MS = 60_000;
const DUPLICATE_CACHE_LIMIT = 500;
const TURNSTILE_TIMEOUT_MS = 5_000;
const EMAIL_TIMEOUT_MS = 8_000;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

const INDUSTRIES = new Set([
  "",
  "Restaurant / Food & Beverage",
  "Retail Shop / Boutique",
  "Hair / Beauty / Wellness",
  "Auto Repair / Services",
  "Professional Services",
  "Other",
]);
const GAPS = new Set([
  "",
  "I don't have a website",
  "My Google listing is incomplete",
  "I have no social media presence",
  "I need more reviews",
  "All of the above",
  "Not sure — just audit me",
]);

const duplicateRequests = new Map<string, number>();

interface RateLimitBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  ASSETS: Fetcher;
  CONTACT_TO_EMAIL: string;
  ALLOWED_ORIGIN: string;
  TURNSTILE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  CONTACT_RATE_LIMITER?: RateLimitBinding;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const requestId = request.headers.get("CF-Ray") ?? crypto.randomUUID();

    if (url.pathname === "/api/contact") {
      if (request.method === "OPTIONS") {
        return withSecurityHeaders(handlePreflight(request, env), request, env, requestId);
      }
      if (request.method !== "POST") {
        return withSecurityHeaders(
          json({ ok: false, error: "Method not allowed." }, 405, {
            Allow: "POST, OPTIONS",
          }),
          request,
          env,
          requestId,
        );
      }
      const response = await handleContact(request, env, requestId);
      return withSecurityHeaders(response, request, env, requestId);
    }

    const response = await env.ASSETS.fetch(request);
    return withSecurityHeaders(response, request, env, requestId);
  },
};

export async function handleContact(
  request: Request,
  env: Env,
  requestId: string = crypto.randomUUID(),
): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin !== env.ALLOWED_ORIGIN) {
    audit("contact_rejected", requestId, { reason: "origin", status: 403 });
    return json({ ok: false, error: "Forbidden." }, 403);
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (
    !contentType.startsWith("multipart/form-data") &&
    !contentType.startsWith("application/x-www-form-urlencoded")
  ) {
    return json({ ok: false, error: "Invalid form submission." }, 415);
  }

  const statedSize = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(statedSize) && statedSize > MAX_REQUEST_BYTES) {
    audit("contact_rejected", requestId, { reason: "request_size", status: 413 });
    return json({ ok: false, error: "Submission is too large." }, 413);
  }

  let form: FormData;
  try {
    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_REQUEST_BYTES) {
      audit("contact_rejected", requestId, { reason: "request_size", status: 413 });
      return json({ ok: false, error: "Submission is too large." }, 413);
    }
    form = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    }).formData();
  } catch {
    return json({ ok: false, error: "Invalid form submission." }, 400);
  }

  const fields = {
    name: field(form, "name"),
    business: field(form, "business"),
    email: field(form, "email").toLowerCase(),
    phone: field(form, "phone"),
    industry: field(form, "industry"),
    gap: field(form, "gap"),
  };
  const website = field(form, "website");
  const turnstileToken = field(form, "cf-turnstile-response");

  if (website) {
    audit("contact_accepted", requestId, { reason: "honeypot", status: 200 });
    return json({ ok: true });
  }
  if (!validText(fields.name, 2, 120)) {
    return json({ ok: false, error: "Please enter a valid name." }, 400);
  }
  if (!validText(fields.business, 2, 160)) {
    return json({ ok: false, error: "Please enter a valid business name." }, 400);
  }
  if (!isValidEmail(fields.email)) {
    return json({ ok: false, error: "Please enter a valid email address." }, 400);
  }
  if (!validOptionalText(fields.phone, 40) || !/^[+\d().\s-]*$/.test(fields.phone)) {
    return json({ ok: false, error: "Please enter a valid phone number." }, 400);
  }
  if (!INDUSTRIES.has(fields.industry) || !GAPS.has(fields.gap)) {
    return json({ ok: false, error: "Please choose a valid form option." }, 400);
  }
  if (!turnstileToken || turnstileToken.length > 2_048 || CONTROL_CHARACTERS.test(turnstileToken)) {
    return json({ ok: false, error: "Verification failed. Please try again." }, 400);
  }

  const clientKey = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (env.CONTACT_RATE_LIMITER) {
    try {
      const decision = await env.CONTACT_RATE_LIMITER.limit({ key: clientKey });
      if (!decision.success) {
        audit("contact_rejected", requestId, { reason: "rate_limit", status: 429 });
        return json({ ok: false, error: "Please wait before trying again." }, 429, {
          "Retry-After": "60",
        });
      }
    } catch {
      audit("contact_control_error", requestId, { reason: "rate_limiter_unavailable", status: 0 });
    }
  }

  const duplicateKey = await digest(`${clientKey}\n${fields.email}\n${fields.business}`);
  if (isDuplicate(duplicateKey)) {
    audit("contact_rejected", requestId, { reason: "duplicate", status: 429 });
    return json({ ok: false, error: "Please wait before trying again." }, 429, {
      "Retry-After": "60",
    });
  }

  const verified = await verifyTurnstile(
    turnstileToken,
    request.headers.get("CF-Connecting-IP"),
    env.TURNSTILE_SECRET_KEY,
  );
  if (!verified) {
    audit("contact_rejected", requestId, { reason: "turnstile", status: 400 });
    return json({ ok: false, error: "Verification failed. Please try again." }, 400);
  }

  const sent = await sendContactEmail(env, fields);
  if (!sent) {
    audit("contact_delivery_failed", requestId, { reason: "email_provider", status: 502 });
    return json(
      {
        ok: false,
        error:
          "Something went wrong sending your message. Please call or text (540) 942-0000 instead.",
      },
      502,
    );
  }

  rememberDuplicate(duplicateKey);
  audit("contact_delivered", requestId, { status: 200 });
  return json({ ok: true });
}

function handlePreflight(request: Request, env: Env): Response {
  if (request.headers.get("Origin") !== env.ALLOWED_ORIGIN) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "600",
    },
  });
}

async function verifyTurnstile(
  token: string,
  ip: string | null,
  secretKey: string,
): Promise<boolean> {
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: secretKey, response: token, remoteip: ip ?? undefined }),
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

async function sendContactEmail(
  env: Env,
  fields: {
    name: string;
    business: string;
    email: string;
    phone: string;
    industry: string;
    gap: string;
  },
): Promise<boolean> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Beacon & Co. website <onboarding@resend.dev>",
        to: [env.CONTACT_TO_EMAIL],
        reply_to: fields.email,
        subject: `New audit request from ${fields.business}`,
        text: [
          `Name: ${fields.name}`,
          `Business: ${fields.business}`,
          `Email: ${fields.email}`,
          `Phone: ${fields.phone || "(not provided)"}`,
          `Industry: ${fields.industry || "(not selected)"}`,
          `Biggest gap: ${fields.gap || "(not selected)"}`,
        ].join("\n"),
      }),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function withSecurityHeaders(
  response: Response,
  request: Request,
  env: Env,
  requestId: string,
): Response {
  const headers = new Headers(response.headers);
  const path = new URL(request.url).pathname;
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self' https://challenges.cloudflare.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "frame-src https://challenges.cloudflare.com",
      "img-src 'self' data:",
      "object-src 'none'",
      "script-src 'self' https://challenges.cloudflare.com",
      "script-src-attr 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "upgrade-insecure-requests",
    ].join("; "),
  );
  headers.set("Strict-Transport-Security", "max-age=31536000");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Request-ID", requestId);

  if (path.startsWith("/api/")) {
    headers.set("Cache-Control", "no-store");
    headers.set("Vary", "Origin");
    if (request.headers.get("Origin") === env.ALLOWED_ORIGIN) {
      headers.set("Access-Control-Allow-Origin", env.ALLOWED_ORIGIN);
    }
  } else if (path.startsWith("/_astro/")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (headers.get("Content-Type")?.includes("text/html")) {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function validText(value: string, minimum: number, maximum: number): boolean {
  return value.length >= minimum && value.length <= maximum && !CONTROL_CHARACTERS.test(value);
}

function validOptionalText(value: string, maximum: number): boolean {
  return value.length <= maximum && !CONTROL_CHARACTERS.test(value);
}

function isValidEmail(email: string): boolean {
  return (
    email.length <= 254 &&
    !CONTROL_CHARACTERS.test(email) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isDuplicate(key: string): boolean {
  const seenAt = duplicateRequests.get(key);
  return seenAt !== undefined && Date.now() - seenAt < DUPLICATE_WINDOW_MS;
}

function rememberDuplicate(key: string): void {
  const now = Date.now();
  duplicateRequests.set(key, now);
  if (duplicateRequests.size <= DUPLICATE_CACHE_LIMIT) return;
  for (const [candidate, seenAt] of duplicateRequests) {
    if (now - seenAt >= DUPLICATE_WINDOW_MS || duplicateRequests.size > DUPLICATE_CACHE_LIMIT) {
      duplicateRequests.delete(candidate);
    }
  }
}

function audit(
  event: string,
  requestId: string,
  detail: { reason?: string; status: number },
): void {
  console.warn(JSON.stringify({ event, requestId, ...detail }));
}

function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...Object.fromEntries(new Headers(extraHeaders)),
    },
  });
}

export function resetContactDedupeForTests(): void {
  duplicateRequests.clear();
}
