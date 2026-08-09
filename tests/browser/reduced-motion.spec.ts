import { expect, test } from "@playwright/test";

test("marketing motion stops when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter((animation) => animation.playState === "running")
              .map((animation) => (animation.effect as KeyframeEffect | null)?.target)
              .filter(Boolean).length,
        ),
      { timeout: 1_000 },
    )
    .toBe(0);
});
