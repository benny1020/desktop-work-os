import {test,expect} from '@playwright/test';
import {installConnected} from './fixtures/connected.mjs';

for (const fail of [false,true]) test(`Standalone review keeps one submitted request mounted until ${fail?'failure':'success'}`,async({page})=>{
  await installConnected(page);
  await page.locator('nav .nav-item[aria-label="Code"]').click();
  await page.locator('.connected-content button').filter({hasText:'PAY-382 Payment retry review'}).click();
  await page.getByRole('button',{name:'Select new line 2',exact:true}).click();
  await page.getByLabel('Diagram review comment').fill('Only one review request may be in flight.');
  await page.evaluate(fail=>{const original=window.orbit.invoke;window.__attempts=0;window.orbit.invoke=async(action,args)=>{
    if(action==='gitlab.comment'){window.__attempts++;await new Promise(resolve=>window.finishComment=resolve);if(fail)throw Error('Temporary posting failure');}
    return original(action,args);
  };},fail);
  await page.getByRole('button',{name:'Post to GitLab',exact:true}).click();
  await expect(page.getByLabel('Workspace data mode')).toBeDisabled();
  await page.locator('nav .nav-item[aria-label="Home"]').click();
  await page.getByLabel('Go back',{exact:true}).click();
  await page.getByLabel('Global search',{exact:true}).click();
  await page.getByLabel('Quick create',{exact:true}).click();
  await page.keyboard.press('Meta+k');await page.keyboard.press('Meta+n');await page.keyboard.press('Escape');
  await expect(page.getByRole('img',{name:'Dependency flow diagram'})).toBeVisible();
  await expect(page.getByLabel('Connected global search')).toHaveCount(0);
  await expect(page.getByLabel('New work title')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__attempts)).toBe(1);
  await page.evaluate(()=>window.finishComment());
  await expect(page.getByLabel('Workspace data mode')).toBeEnabled();
  if(fail) await expect(page.getByLabel('Diagram review comment')).toHaveValue('Only one review request may be in flight.');
  else {await expect(page.locator('.component-comment')).toContainText('Only one review request');await expect(page.getByLabel('Diagram review comment')).toHaveValue('');}
  await page.locator('nav .nav-item[aria-label="Home"]').click();
  await expect(page.getByLabel('Quick add personal work')).toBeVisible();
});
