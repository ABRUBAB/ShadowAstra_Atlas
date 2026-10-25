/** The demo a judge would do: pick a mission, get new sites, read a report, print it, compare in 3D. */
import { expect, test } from "./fixtures";

test("mission builder to report to compare", async ({ page, consoleErrors }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Practise for other");
  await page.getByRole("link", { name: /Find new test sites/ }).first().click();
  await expect(page).toHaveURL(/\/discover/);

  // a ready-made mission
  await page.getByText("Search for life", { exact: false }).first().click();
  await expect(page).toHaveURL(/step=needs/);
  await page.getByRole("button", { name: /Search the whole Earth/ }).click();
  await expect(page).toHaveURL(/step=results/);
  const results = page.locator("li button.surface");
  await expect(results).toHaveCount(10, { timeout: 45_000 });

  // open the best place: a full, honest report
  const name = (await results.first().locator("span.font-medium").first().innerText()).trim();
  await results.first().click();
  await expect(page).toHaveURL(/at=-?\d+\.\d+(,|%2C)-?\d+\.\d+/);
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  await expect(page.getByText("The four challenge factors, side by side")).toBeVisible();
  await expect(page.getByText("Learned model").first()).toBeVisible();
  await expect(page.getByText(/Minerals from orbit/)).toBeVisible();
  await expect(page.getByText(/Earth can't copy/).first()).toBeVisible();
  // the best 10 km spot: computed from terrain tiles, with its tested verdict
  await expect(page.getByText(/Of the \d+ pieces of 10 km inside this place/)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/Tested on 66 real field sites/).first()).toBeVisible();

  // the printable report for the same place
  await page.getByRole("link", { name: /Site report/ }).click();
  await expect(page).toHaveURL(/\/report\?/);
  await expect(page.getByText("Analog site report")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await expect(page.getByText(/NASA EMIT|no clear EMIT view/).first()).toBeVisible();
  await expect(page.getByText(/Best 10 km spot/)).toBeVisible();
  await page.goBack();

  // compare the same place in 3D
  await page.getByRole("link", { name: /Compare in 3D/ }).click();
  await expect(page).toHaveURL(/\/lab\?earth=%40|\/lab\?earth=@/);
  await expect(page.getByText(/MATCH/i).first()).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("a shared mission link opens the same results", async ({ page, consoleErrors }) => {
  await page.goto("/discover?step=results&target=shackleton&task=polar&km=8000");
  const results = page.locator("li button.surface");
  await expect(results).toHaveCount(10, { timeout: 45_000 });
  await expect(page.getByText(/8,000 km from Dhaka|km from Dhaka/).first()).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
