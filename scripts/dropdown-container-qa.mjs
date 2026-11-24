import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:3000/contact');
 for(const mode of ['light','dark']) {
  await page.evaluate(mode=>window.dispatchEvent(new window.CustomEvent('site-theme-updated',{detail:{websiteThemeMode:mode}})),mode);
  const trigger=page.locator('button.a-select').first();
  await trigger.click();
  const menu=page.locator('.a-select-menu');
  await expect(menu).toBeVisible();
  await menu.focus();
  const style=await menu.evaluate(el=>{const s=getComputedStyle(el);return {outline:s.outlineStyle,border:s.borderTopWidth};});
  assert.equal(style.outline,'none');assert.equal(style.border,'0px');
  const option=page.getByRole('option',{name:'Brand design',exact:true});
  await option.hover();
  await option.click();
  await expect(menu).toBeHidden();
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
 }
 console.log('PASS: real service dropdown has no container border/outline in both modes; mouse selection and keyboard open/Escape work.');
} finally {await browser.close();}
