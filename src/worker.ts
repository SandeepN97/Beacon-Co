/// <reference types="@cloudflare/workers-types" />

export interface Env {
	ASSETS: Fetcher;
	CONTACT_TO_EMAIL: string;
	ALLOWED_ORIGIN: string;
	TURNSTILE_SECRET_KEY: string;
	RESEND_API_KEY: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === "/api/contact" && request.method === "POST") {
			return handleContact(request, env);
		}
		return env.ASSETS.fetch(request);
	},
};

async function handleContact(request: Request, env: Env): Promise<Response> {
	const origin = request.headers.get("Origin");
	if (origin !== env.ALLOWED_ORIGIN) {
		return json({ ok: false, error: "Forbidden." }, 403);
	}

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json({ ok: false, error: "Invalid form submission." }, 400);
	}

	const name = String(form.get("name") ?? "").trim();
	const business = String(form.get("business") ?? "").trim();
	const email = String(form.get("email") ?? "").trim();
	const phone = String(form.get("phone") ?? "").trim();
	const industry = String(form.get("industry") ?? "").trim();
	const gap = String(form.get("gap") ?? "").trim();
	const turnstileToken = String(form.get("cf-turnstile-response") ?? "").trim();

	if (!name || name.length > 200) {
		return json({ ok: false, error: "Please enter a valid name." }, 400);
	}
	if (!business || business.length > 200) {
		return json({ ok: false, error: "Please enter a valid business name." }, 400);
	}
	if (!isValidEmail(email)) {
		return json({ ok: false, error: "Please enter a valid email address." }, 400);
	}
	if (phone.length > 40) {
		return json({ ok: false, error: "Phone number is too long." }, 400);
	}
	if (!turnstileToken) {
		return json({ ok: false, error: "Verification failed. Please try again." }, 400);
	}

	const verified = await verifyTurnstile(turnstileToken, request.headers.get("CF-Connecting-IP"), env.TURNSTILE_SECRET_KEY);
	if (!verified) {
		return json({ ok: false, error: "Verification failed. Please try again." }, 400);
	}

	const sent = await sendContactEmail(env, { name, business, email, phone, industry, gap });
	if (!sent) {
		return json(
			{ ok: false, error: "Something went wrong sending your message. Please call or text (540) 942-0000 instead." },
			502
		);
	}

	return json({ ok: true });
}

async function verifyTurnstile(token: string, ip: string | null, secretKey: string): Promise<boolean> {
	const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ secret: secretKey, response: token, remoteip: ip ?? undefined }),
	});
	if (!res.ok) return false;
	const data = (await res.json()) as { success: boolean };
	return data.success === true;
}

async function sendContactEmail(
	env: Env,
	fields: { name: string; business: string; email: string; phone: string; industry: string; gap: string }
): Promise<boolean> {
	const res = await fetch("https://api.resend.com/emails", {
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
	});
	if (!res.ok) {
		console.error("Resend error:", await res.text());
		return false;
	}
	return true;
}

function isValidEmail(email: string): boolean {
	return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
