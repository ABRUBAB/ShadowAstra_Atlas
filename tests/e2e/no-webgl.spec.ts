/** Browsers without WebGL (locked-down or remote machines) still get a working site. */
import { expect, test } from "./fixtures";

test("Home, How it works and Maps work without WebGL", async ({ page, consoleErrors }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Practise for other");
  // the hero picture is decorative (hidden from screen readers), so look for it directly
  await expect(page.locator('[aria-label="Earth, still image"]').first()).toBeVisible();

  await page.goto("/methods");
  await expect(page.getByRole("img", { name: /Earth, still image/ }).first()).toBeVisible();
  await expect(page.getByText("Every place below is real NASA data.")).toBeVisible();

  await page.goto("/atlas");
  await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 30_000 });

  await page.goto("/discover?step=results&target=jezero&task=astrobio");
  await expect(page.locator("li button.surface")).toHaveCount(10, { timeout: 45_000 });
  expect(consoleErrors).toEqual([]);
});
