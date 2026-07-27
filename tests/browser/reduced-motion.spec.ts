import { expect, test } from "@playwright/test";

test("marketing motion stops when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const runningAnimations = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((animation) => animation.playState === "running")
        .map((animation) => (animation.effect as KeyframeEffect | null)?.target)
        .filter(Boolean).length,
  );

  expect(runningAnimations).toBe(0);
});
