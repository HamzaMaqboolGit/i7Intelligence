import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true});
try {
 const page = await browser.newPage();
 await page.goto('http://127.0.0.1:3000/contact');
 await page.evaluate(() => {
  const fixture = document.createElement('section');
  fixture.style.cssText='position:fixed;top:150px;left:20px;z-index:99999;background:var(--surface);padding:20px';
  fixture.innerHTML = '<label class="a-field"><input id="restored-field" value="Client name"></label><div class="a-select-menu"><div id="dropdown-choice" class="a-select-option" role="option" tabindex="0">Dropdown choice</div></div>';
  document.body.append(fixture);
 });
 for (const mode of ['light','dark']) {
  await page.evaluate(mode => window.dispatchEvent(new window.CustomEvent('site-theme-updated',{detail:{websiteThemeMode:mode}})),mode);
  const option = page.locator('#dropdown-choice');
  for (const state of ['hover','focus','click']) {
   if (state==='hover') await option.hover();
   if (state==='focus') await option.focus();
   if (state==='click') await option.click();
   await page.waitForTimeout(350);
   const style=await option.evaluate(el=>{const s=getComputedStyle(el);return {borders:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],outline:s.outlineStyle,shadow:s.boxShadow};});
   assert(style.borders.every(v=>v==='0px'));
   assert.equal(style.outline,'none');
   assert.equal(style.shadow,'none');
  }
  assert.equal(await page.locator('#restored-field').evaluate(el=>getComputedStyle(el).borderTopWidth),'1px');
 }
 console.log('PASS: field borders restored; dropdown choices have no hover, focus or click borders in both modes.');
} finally {await browser.close();}
