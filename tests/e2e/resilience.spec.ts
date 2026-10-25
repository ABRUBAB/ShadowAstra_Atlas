/** What happens when the network or the data fails, or the address is broken. */
import { expect, test } from "./fixtures";

test("the global data fails once, then a retry works", async ({ page }) => {
  let fail = true;
  await page.route("**/data/grid.bin", (r) => (fail ? r.fulfill({ status: 503, body: "" }) : r.continue()));
  await page.goto("/discover?step=results&target=gale&task=astrobio");
  const retry = page.getByRole("button", { name: /Try again/ });
  await expect(retry).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/could not be loaded/i)).toBeVisible();
  fail = false;
  await retry.click();
  await expect(page.locator("li button.surface")).toHaveCount(10, { timeout: 45_000 });
});

test("a page file that cannot be downloaded shows a clear message", async ({ page }) => {
  await page.route(/\/assets\/Methods-.*\.js$/, (r) => r.abort());
  await page.goto("/methods");
  await expect(page.getByText("This page could not be downloaded.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Reload/ })).toBeVisible();
});

test("broken mission links fall back to safe defaults", async ({ page, consoleErrors }) => {
  await page.goto("/discover?step=results&target=zzz&task=nope&km=-5&month=99&at=999,abc&mix=7");
  await expect(page.locator("li button.surface")).toHaveCount(10, { timeout: 45_000 });
  await expect(page).toHaveURL(/target=jezero/);
  expect(consoleErrors).toEqual([]);
});

test("a slow network still shows progress, then results", async ({ page }) => {
  await page.route("**/data/grid.bin", async (r) => {
    await new Promise((res) => setTimeout(res, 2500));
    await r.continue();
  });
  await page.goto("/discover?step=results&target=jezero&task=astrobio");
  await expect(page.getByRole("status").filter({ hasText: /Loading the planet/i })).toBeVisible();
  await expect(page.locator("li button.surface")).toHaveCount(10, { timeout: 45_000 });
});

test("a lost graphics context shows a still image and can start again", async ({ page }) => {
  await page.goto("/atlas");
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  // what a GPU driver reset looks like to the page
  await page.evaluate(() => {
    const c = document.querySelector("canvas")!;
    const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext;
    gl.getExtension("WEBGL_lose_context")!.loseContext();
  });
  const again = page.getByRole("button", { name: /3D paused after a graphics reset/ });
  await expect(again).toBeVisible();
  await expect(page.getByRole("img", { name: /still image/ }).first()).toBeVisible();
  await again.click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
  await expect(again).toBeHidden();
});
