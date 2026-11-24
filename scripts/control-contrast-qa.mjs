import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  }),
  results = [],
  folder = "docs/refinements/controls";
mkdirSync(folder, { recursive: true });
try {
  await page.goto("http://127.0.0.1:3000");
  await page.evaluate(() => {
    const host = document.createElement("section");
    host.id = "control-qa";
    host.className = "admin-app";
    host.style.cssText =
      "position:fixed;inset:110px 20px auto;z-index:99999;padding:32px;border-radius:20px;background:var(--surface)";
    host.innerHTML =
      '<h2>Control contrast verification</h2><div class="a-button-row" style="margin:20px 0"><button id="primary" class="a-button">Save changes</button><button id="secondary" class="a-button secondary">Cancel</button><div class="theme-scope-switch"><button id="selected" class="a-button secondary" aria-pressed="true">Public website</button></div><button id="disabled" class="a-button" disabled>Disabled</button><button id="danger" class="a-button danger-button">Delete</button><button id="soft-danger" class="a-button danger">Remove</button></div><label class="a-field">Name<input id="field" value="Clear field text"/></label><label class="a-field">Search<input id="placeholder" placeholder="Search anything…"/></label><div class="final-cta" style="padding:20px;margin-top:20px;background:var(--navy-900)"><a id="inverse" class="button" href="#">Book a call</a><a id="outline-dark" class="button secondary" href="#">Explore options</a></div>';
    document.body.append(host);
  });
  const sample = async (id, pseudo) =>
    page.locator("#" + id).evaluate((el, pseudo) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d");
      function rgb(c) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data];
      }
      function lum(c) {
        return c
          .slice(0, 3)
          .map((n) => {
            n /= 255;
            return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
          })
          .reduce((a, n, i) => a + n * [0.2126, 0.7152, 0.0722][i], 0);
      }
      const style = getComputedStyle(el, pseudo || null);
      const layers = [];
      let node = el;
      while (node) {
        layers.push(rgb(getComputedStyle(node).backgroundColor));
        node = node.parentElement;
      }
      const blend = (top, bottom) =>
        top
          .slice(0, 3)
          .map((v, i) => (v * top[3]) / 255 + bottom[i] * (1 - top[3] / 255));
      let bg = [255, 255, 255];
      for (const layer of layers.reverse()) bg = blend(layer, bg);
      const a = lum(blend(rgb(style.color), bg)),
        b = lum(bg);
      return {
        color: style.color,
        background: bg,
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    }, pseudo);
  for (const mode of ["light", "dark"])
    for (const color of [
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
    ]) {
      await page.evaluate(
        ({ mode, color }) =>
          window.dispatchEvent(
            new window.CustomEvent("site-theme-updated", {
              detail: { websiteThemeMode: mode, websiteThemeAccent: color },
            }),
          ),
        { mode, color },
      );
      await expect(page.locator("html")).toHaveAttribute(
        "data-color-mode",
        mode,
      );
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme-accent",
        color,
      );
      for (const id of [
        "primary",
        "secondary",
        "selected",
        "disabled",
        "danger",
        "soft-danger",
        "inverse",
        "outline-dark",
        "field",
        "placeholder",
      ]) {
        if (["selected", "inverse"].includes(id)) {
          await page.mouse.move(1400, 900);
          const normal = await sample(id);
          assert.ok(
            normal.ratio >= 4.5,
            `${mode}/${color}/${id}/normal: ${normal.ratio}`,
          );
          results.push({
            mode,
            color,
            control: id,
            state: "normal",
            contrast: normal.ratio,
            result: "passed",
          });
        }
        if (id !== "disabled") await page.locator("#" + id).hover();
        const value = await sample(
          id,
          id === "placeholder" ? "::placeholder" : undefined,
        );
        assert.ok(
          value.ratio >= 4.5,
          `${mode}/${color}/${id}: ${value.ratio.toFixed(2)} (${value.color} on ${value.background})`,
        );
        results.push({
          mode,
          color,
          control: id,
          contrast: value.ratio,
          result: "passed",
        });
      }
      if (color === "teal") {
        await page.screenshot({ path: folder + "/" + mode + ".png" });
      }
    }
  console.log(
    `PASS: ${results.length} control contrast checks across all palettes and both modes, including selected-button hover, inputs, placeholders and disabled states.`,
  );
} finally {
  writeFileSync(folder + "/RESULTS.json", JSON.stringify(results, null, 2));
  await browser.close();
}
