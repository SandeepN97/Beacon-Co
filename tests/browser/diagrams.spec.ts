import { expect, test } from "@playwright/test";

test("diagram catalog renders every Excalidraw and Mermaid source", async ({ page }) => {
  await page.goto("/docs/architecture/diagrams/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Diagram catalog");
  await expect(page.locator("[data-architecture-diagram]")).toHaveCount(7);
  await expect(page.locator("[data-mermaid-diagram]")).toHaveCount(6);
  await expect(page.locator("[data-mermaid-render] svg")).toHaveCount(6, {
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Play animation" })).toHaveCount(6);
  await expect(page.getByText("Canonical editable source in this Decision System:")).toHaveCount(7);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const animationButtons = page.locator("[data-diagram-animation]");
  const animationButtonCount = await animationButtons.count();
  expect(animationButtonCount).toBe(6);
  const firstAnimationButton = animationButtons.nth(0);
  await firstAnimationButton.click();
  await expect(firstAnimationButton).toHaveAttribute("aria-pressed", "true");
  await expect(firstAnimationButton).toHaveText("Show static");
});

test("diagram animation controls honor reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/docs/architecture/diagrams/");

  const disabledAnimationButtons = page.getByRole("button", {
    name: "Animation disabled",
  });
  await expect(disabledAnimationButtons).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) {
    await expect(disabledAnimationButtons.nth(index)).toBeDisabled();
  }
});
