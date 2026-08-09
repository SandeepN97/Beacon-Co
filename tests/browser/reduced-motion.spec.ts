import { expect, test } from "@playwright/test";

test("reduced motion has no prohibited motion and reaches the final information state", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator("#auditNum")).toHaveText("90/100");
  await expect(page.locator("#auditNum")).toBeVisible();
  await expect(page.locator("#auditFill")).toHaveCSS("width", /.+px/);
  await expect(page.locator(".svc-row").first()).toBeVisible();
  await expect(page.locator(".price-col").first()).toBeVisible();
  await expect(page.locator(".proc-step").first()).toBeVisible();

  const state = await page.evaluate(() => {
    const auditFill = document.getElementById("auditFill");
    const auditBar = auditFill?.parentElement;
    const animated = [...document.querySelectorAll<HTMLElement>("*")].filter((element) => {
      const style = getComputedStyle(element);
      return (
        style.animationName !== "none" ||
        style.transitionDuration.split(",").some((value) => parseFloat(value) > 0)
      );
    });
    return {
      runningAnimations: document
        .getAnimations()
        .filter((animation) => animation.playState === "running").length,
      elementsWithMotion: animated.length,
      auditRatio:
        auditFill && auditBar
          ? auditFill.getBoundingClientRect().width / auditBar.getBoundingClientRect().width
          : 0,
      revealStates: [
        ...document.querySelectorAll<HTMLElement>(".svc-row,.price-col,.proc-step"),
      ].map((element) => ({
        opacity: getComputedStyle(element).opacity,
        transform: getComputedStyle(element).transform,
      })),
    };
  });
  expect(state.runningAnimations).toBe(0);
  expect(state.elementsWithMotion).toBe(0);
  expect(state.auditRatio).toBeCloseTo(0.9, 2);
  expect(state.revealStates.every(({ opacity }) => opacity === "1")).toBe(true);
  expect(state.revealStates.every(({ transform }) => transform === "none")).toBe(true);
});

test("normal motion remains enabled and still resolves to the final Hero state", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const normalMotion = await page.evaluate(() => {
    const eyebrow = document.querySelector<HTMLElement>(".hero-eyebrow");
    const auditFill = document.getElementById("auditFill");
    return {
      heroAnimationName: eyebrow ? getComputedStyle(eyebrow).animationName : "none",
      auditTransitionDuration: auditFill ? getComputedStyle(auditFill).transitionDuration : "0s",
    };
  });
  expect(normalMotion.heroAnimationName).toContain("hero-up");
  expect(parseFloat(normalMotion.auditTransitionDuration)).toBeGreaterThan(0);
  await page.locator("#auditNum").scrollIntoViewIfNeeded();
  await expect(page.locator("#auditNum")).toHaveText("90/100", { timeout: 3_000 });
  await expect(page.locator("#auditFill")).toHaveAttribute("style", /width:\s*90%/);
});
