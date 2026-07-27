import { expect, test } from "@playwright/test";

test("marketing site and handbook routes render", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("#contactForm")).toBeAttached();

  await page.goto("/docs/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/workspace/");
  await expect(page.getByRole("main")).toBeVisible();
});
