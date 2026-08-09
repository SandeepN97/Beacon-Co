import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import worker, { type Env } from "../../src/worker";

describe("response header policy", () => {
  it("routes static assets through the Worker before serving them", async () => {
    const config = JSON.parse(await readFile("wrangler.jsonc", "utf8")) as {
      assets?: { binding?: string; run_worker_first?: boolean };
    };

    expect(config.assets).toMatchObject({ binding: "ASSETS", run_worker_first: true });
  });

  it("matches every required machine-readable header assertion", async () => {
    const policy = parse(await readFile("security/headers-policy.yml", "utf8"));
    const env: Env = {
      ALLOWED_ORIGIN: "https://beacon.example",
      ASSETS: {
        fetch: vi.fn(
          async () => new Response("<h1>Beacon</h1>", { headers: { "Content-Type": "text/html" } }),
        ),
      } as unknown as Fetcher,
      CONTACT_TO_EMAIL: "owner@example.com",
      RESEND_API_KEY: "test-only",
      TURNSTILE_SECRET_KEY: "test-only",
    };

    const response = await worker.fetch(new Request("https://beacon.example/"), env);

    for (const [name, assertion] of Object.entries(
      policy.required as Record<string, { value?: string; contains?: string[] }>,
    )) {
      const actual = response.headers.get(name);
      expect(actual, `${name} is missing`).not.toBeNull();
      if (assertion.value) expect(actual).toBe(assertion.value);
      for (const fragment of assertion.contains ?? []) expect(actual).toContain(fragment);
    }
  });
});
