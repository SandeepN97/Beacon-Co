import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const path of ["/", "/docs/", "/docs/architecture/diagrams/"]) {
  test(`${path} has no serious or critical automated accessibility violations`, async ({
    page,
  }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const severe = results.violations.filter(({ impact }) =>
      ["serious", "critical"].includes(impact ?? ""),
    );

    expect(severe).toEqual([]);
  });
}
