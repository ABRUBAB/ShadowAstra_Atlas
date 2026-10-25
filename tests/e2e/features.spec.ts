/** Maps (AI twins), How it works (drag, charts, scroll), Learn and the 404 page. */
import { expect, test } from "./fixtures";

test("Earth twins of Jezero, by formula and by the terrain AI", async ({ page, consoleErrors }) => {
  await page.goto("/atlas?body=mars&spot=18.40,77.60");
  await expect(page.getByRole("heading", { name: "Earth twins" })).toBeVisible();
  const rows = page.locator("aside ol li");
  await expect(rows).toHaveCount(8, { timeout: 45_000 });
  await page.getByRole("button", { name: /AI match/ }).click();
  await expect(rows).toHaveCount(8);
  await expect(rows.first()).toContainText(/agree/i);
  // the spot is in the address, so it can be shared
  await expect(page).toHaveURL(/spot=18\.40(,|%2C)77\.60/);
  expect(consoleErrors).toEqual([]);
});

test("How it works: the globe can be dragged and the charts load", async ({ page, consoleErrors }) => {
  await page.goto("/methods");
  // nothing covers the hero globe any more
  const globe = page.locator("canvas").first();
  await expect(globe).toBeVisible({ timeout: 30_000 });
  const box = (await globe.boundingBox())!;
  const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, [box.x + box.width * 0.6, box.y + box.height * 0.5]);
  expect(top).toBe("CANVAS");
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6 - 160, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();

  await page.getByRole("heading", { name: /We tested it on places/ }).scrollIntoViewIfNeeded();
  await expect(page.getByText("Nine models, one honest test")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("A terrain AI that reads the ground")).toBeVisible();
  await expect(page.getByText("The best 10 km spot inside each place")).toBeVisible();
  await expect(page.getByRole("img", { name: /Rank of the window holding each of 66 field sites/ })).toBeVisible();
  await expect(page.getByText("A geologist checks our top picks")).toBeVisible();
  await expect(page.getByRole("region", { name: "Moon measurements" })).toContainText("Mare Tranquillitatis pit");

  // hover effects pause while scrolling, then come back
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("is-scrolling"))).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("is-scrolling")), { timeout: 5000 }).toBe(false);

  // a click straight after scrolling still lands: the pause ends as soon as the mouse moves
  const toggle = page.getByRole("button", { name: /Switch to (light|dark) mode/ });
  const tb = (await toggle.boundingBox())!;
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme ?? "dark");
  const before = await theme();
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("is-scrolling"))).toBe(true);
  await page.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await expect.poll(theme).not.toBe(before);
  expect(consoleErrors).toEqual([]);
});

test("Learn works in Bangla and Spanish", async ({ page, consoleErrors }) => {
  await page.goto("/learn?lang=bn");
  await expect(page.locator("html")).toBeVisible();
  await expect(page.getByText(/পৃথিবী/).first()).toBeVisible();
  await page.goto("/learn?lang=es");
  await expect(page.getByText(/Tierra/).first()).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("an unknown address shows a 404 page with a way back", async ({ page }) => {
  await page.goto("/this-is-not-a-page");
  await expect(page.getByText("No place like this one.")).toBeVisible();
  await page.getByRole("link", { name: /Find new sites/ }).last().click();
  await expect(page).toHaveURL(/\/discover/);
});

test("Pause motion stops looping animation, follows the system setting and is remembered", async ({ page, consoleErrors }) => {
  await page.goto("/");
  const pause = page.getByRole("button", { name: "Pause motion" });
  await pause.scrollIntoViewIfNeeded();
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveClass(/reduce-motion/);
  // CSS loops (marquee, Astra) collapse to a single near-instant run
  const loops = await page.evaluate(() => [...document.querySelectorAll("*")].filter((e) => getComputedStyle(e).animationIterationCount === "infinite").length);
  expect(loops).toBe(0);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/reduce-motion/);
  await page.getByRole("button", { name: "Pause motion" }).click();
  await expect(page.locator("html")).not.toHaveClass(/reduce-motion/);

  // the system "reduce motion" setting does the same without the switch
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveClass(/reduce-motion/);
  await expect(page.getByText("Motion reduced by your system setting")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
