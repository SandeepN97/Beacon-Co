import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { resetContactDedupeForTests, type Env } from "../../src/worker";

const allowedOrigin = "https://beacon.example";

function environment(overrides: Partial<Env> = {}): Env {
  return {
    ALLOWED_ORIGIN: allowedOrigin,
    ASSETS: {
      fetch: vi.fn(
        async () => new Response("<h1>Beacon</h1>", { headers: { "Content-Type": "text/html" } }),
      ),
    } as unknown as Fetcher,
    CONTACT_TO_EMAIL: "owner@example.com",
    RESEND_API_KEY: "test-resend-key",
    TURNSTILE_SECRET_KEY: "test-turnstile-key",
    ...overrides,
  };
}

function contactRequest(
  overrides: Record<string, string> = {},
  requestOverrides: RequestInit = {},
): Request {
  const body = new URLSearchParams({
    name: "Jane Smith",
    business: "Smith Bakery",
    email: "jane@example.com",
    phone: "(540) 555-0100",
    industry: "Restaurant / Food & Beverage",
    gap: "I don't have a website",
    website: "",
    "cf-turnstile-response": "valid-token",
    ...overrides,
  });
  return new Request(`${allowedOrigin}/api/contact`, {
    ...requestOverrides,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: allowedOrigin,
      "CF-Connecting-IP": "203.0.113.10",
      ...requestOverrides.headers,
    },
    body,
  });
}

function successfulProviders() {
  return vi
    .fn()
    .mockResolvedValueOnce(Response.json({ success: true }))
    .mockResolvedValueOnce(Response.json({ id: "message-id" }));
}

beforeEach(() => {
  resetContactDedupeForTests();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("contact Worker", () => {
  it("rejects requests from an unapproved origin", async () => {
    const request = contactRequest({}, { headers: { Origin: "https://attacker.example" } });
    const response = await worker.fetch(request, environment());

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("rejects oversized requests before parsing", async () => {
    const request = contactRequest({}, { headers: { "Content-Length": "40000" } });
    const response = await worker.fetch(request, environment());

    expect(response.status).toBe(413);
  });

  it("rejects invalid enumerated fields and control characters", async () => {
    const badIndustry = await worker.fetch(
      contactRequest({ industry: "Injected category" }),
      environment(),
    );
    const badName = await worker.fetch(contactRequest({ name: "Jane\u0000Smith" }), environment());

    expect(badIndustry.status).toBe(400);
    expect(badName.status).toBe(400);
  });

  it("silently accepts honeypot submissions without calling providers", async () => {
    const providerFetch = vi.fn();
    vi.stubGlobal("fetch", providerFetch);
    const response = await worker.fetch(
      contactRequest({ website: "https://spam.example" }),
      environment(),
    );

    expect(response.status).toBe(200);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("fails closed when Turnstile is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timed out", "AbortError")));
    const response = await worker.fetch(contactRequest(), environment());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: "Verification failed. Please try again.",
    });
  });

  it("returns a safe fallback when the email provider fails", async () => {
    const providerFetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ success: true }))
      .mockRejectedValueOnce(new DOMException("timed out", "AbortError"));
    vi.stubGlobal("fetch", providerFetch);

    const response = await worker.fetch(contactRequest(), environment());
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).not.toContain("test-resend-key");
    expect(text).not.toContain("jane@example.com");
  });

  it("delivers a valid request, applies headers, and damps a duplicate", async () => {
    const providerFetch = successfulProviders();
    vi.stubGlobal("fetch", providerFetch);
    const env = environment();

    const first = await worker.fetch(contactRequest(), env);
    const second = await worker.fetch(contactRequest(), env);

    expect(first.status).toBe(200);
    expect(first.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(first.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(first.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
    expect(second.status).toBe(429);
    expect(providerFetch).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("jane@example.com");
  });

  it("honors a configured Cloudflare rate-limit binding", async () => {
    const response = await worker.fetch(
      contactRequest(),
      environment({
        CONTACT_RATE_LIMITER: {
          limit: vi.fn(async () => ({ success: false })),
        },
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("adds hardened headers and immutable caching to built assets", async () => {
    const response = await worker.fetch(
      new Request(`${allowedOrigin}/_astro/app.abc123.js`),
      environment(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("Permissions-Policy")).toContain("geolocation=()");
    expect(response.headers.get("Strict-Transport-Security")).toBe("max-age=31536000");
  });
});
