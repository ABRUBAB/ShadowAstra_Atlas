import { test as base, expect } from "@playwright/test";

/**
 * Every test starts like a returning visitor (no intro splash, no Ask Astra nudge): an automatic
 * fixture, so it applies even to tests that do not ask for it. Tests that ask for `consoleErrors`
 * also get every page error and console error collected, to assert none happened.
 */
export const test = base.extend<{ returningVisitor: void; consoleErrors: string[] }>({
  returningVisitor: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem("sa-splash", "seen");
          localStorage.setItem("sa-nudged", "1");
        } catch {
          /* ignore */
        }
      });
      await use();
    },
    { auto: true },
  ],
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !/WebGL|THREE\.WebGLRenderer|Failed to load resource/.test(m.text())) errors.push(m.text());
    });
    await use(errors);
  },
});

export { expect };
