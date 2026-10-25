/** Deployment configuration that would fail silently if it drifted. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROOT, readJson } from "./helpers";

interface VercelConfig {
  rewrites: { source: string; destination: string }[];
  headers: { source: string; headers: { key: string; value: string }[] }[];
}
const cfg = readJson<VercelConfig>(`${ROOT}vercel.json`);
const csp = cfg.headers.find((h) => h.source === "/(.*)")!.headers.find((h) => h.key === "Content-Security-Policy")!.value;

describe("vercel.json", () => {
  it("allows exactly the inline script in index.html (theme switch) through the CSP", () => {
    const html = readFileSync(`${ROOT}index.html`, "utf-8");
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts).toHaveLength(1);
    const hash = `'sha256-${createHash("sha256").update(scripts[0], "utf8").digest("base64")}'`;
    expect(csp).toContain(hash);
  });

  it("blocks plugins, framing and foreign scripts", () => {
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toMatch(/script-src 'self' 'sha256-[^']+';/);
    expect(csp).not.toContain("unsafe-eval");
  });

  it("serves the app for page routes but real 404s for missing data", () => {
    const re = new RegExp(`^${cfg.rewrites[0].source}$`);
    for (const page of ["/", "/discover", "/lab", "/methods", "/report", "/no-such-page"]) expect(re.test(page)).toBe(true);
    for (const file of ["/data/grid.bin", "/assets/index-abc.js", "/textures/earth_day_1k.webp", "/og.jpg"]) expect(re.test(file)).toBe(false);
  });
});
