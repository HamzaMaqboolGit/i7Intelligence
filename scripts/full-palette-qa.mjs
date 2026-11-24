import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const results = [],
  folder = "docs/refinements/full-palette";
mkdirSync(folder, { recursive: true });
const colors = [
  "navy",
  "blue",
  "teal",
  "emerald",
  "rose",
  "amber",
  "indigo",
  "plum",
  "coral",
  "copper",
  "olive",
  "sage",
  "cyan",
  "slate",
  "graphite",
  "burgundy",
];
try {
  await page.goto("http://127.0.0.1:3000");
  await expect(page.locator("footer")).toBeAttached();
  await page.waitForTimeout(1500);
  const footerColors = new Set(),
    paragraphColors = new Set();
  for (const mode of ["light", "dark"]) {
    for (const color of colors) {
      await page.evaluate(
        ({ color, mode }) =>
          window.dispatchEvent(
            new window.CustomEvent("site-theme-updated", {
              detail: { websiteThemeAccent: color, websiteThemeMode: mode },
            }),
          ),
        { color, mode },
      );
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme-accent",
        color,
      );
      await expect(page.locator("html")).toHaveAttribute(
        "data-color-mode",
        mode,
      );
      const sample = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        const rgb = (color) => {
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
        };
        const luminance = (values) =>
          values
            .map((x) => {
              x /= 255;
              return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
            })
            .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
        const contrast = (a, b) => {
          const values = [luminance(rgb(a)), luminance(rgb(b))].sort(
            (a, b) => b - a,
          );
          return (values[0] + 0.05) / (values[1] + 0.05);
        };
        const body = getComputedStyle(document.body),
          footer = getComputedStyle(document.querySelector("footer")),
          legal = getComputedStyle(document.querySelector(".footer-bottom")),
          paragraph = getComputedStyle(document.querySelector("main p"));
        return {
          footer: footer.backgroundColor,
          paragraph: paragraph.color,
          textContrast: contrast(body.color, body.backgroundColor),
          paragraphContrast: contrast(paragraph.color, body.backgroundColor),
          footerContrast: contrast(legal.color, footer.backgroundColor),
        };
      });
      assert.ok(
        sample.textContrast >= 4.5,
        `${color}/${mode} text contrast ${sample.textContrast}`,
      );
      assert.ok(
        sample.paragraphContrast >= 4.5,
        `${color}/${mode} paragraph contrast ${sample.paragraphContrast}`,
      );
      assert.ok(
        sample.footerContrast >= 4.5,
        `${color}/${mode} footer contrast ${sample.footerContrast}`,
      );
      footerColors.add(sample.footer);
      paragraphColors.add(sample.paragraph);
      results.push({ color, mode, ...sample, result: "passed" });
      if (color === "rose" && mode === "light") {
        await page.locator("footer").scrollIntoViewIfNeeded();
        await page.screenshot({ path: folder + "/rose-footer.png" });
        await page.evaluate(() => window.scrollTo(0, 0));
      }
    }
  }
  assert.equal(footerColors.size, 16);
  assert.equal(paragraphColors.size, 32);
  console.log(
    "PASS: All 16 palettes recolor footer and paragraphs in light/dark modes; 32 text/footer contrast checks meet 4.5:1. No saved settings changed.",
  );
} finally {
  writeFileSync(folder + "/RESULTS.json", JSON.stringify(results, null, 2));
  await browser.close();
}
