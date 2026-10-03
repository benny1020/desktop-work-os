import {test,expect} from '@playwright/test';
import {installConnected} from './fixtures/connected.mjs';

test('Workflow guide starts real issue and review journeys without changing data',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Explore workflows',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Less switching. More understanding.');
  await page.getByRole('button',{name:/Follow the work, not the tabs/}).click();
  await expect(page.getByRole('complementary',{name:'Detail inspector'})).toContainText('PAY-382');
  await expect(page.getByRole('heading',{name:'Good morning, Alex.'})).toBeVisible();
  await page.getByLabel('Close inspector').click();
  await page.getByRole('button',{name:'Product guide',exact:true}).click();
  await page.getByRole('button',{name:/See the change before the code/}).click();
  await expect(page.getByRole('img',{name:'Dependency flow diagram'})).toBeVisible();
  await expect(page.getByRole('heading',{name:/Payment retry/})).toBeVisible();
  await expect(page.getByRole('button',{name:'Approve MR',exact:true})).toBeEnabled();
});

test('Home work trail opens the exact linked object while retaining Home',async({page})=>{
  await page.goto('/');
  for (const [label,title] of [
    ['Open linked pipeline #482','Pipeline #482'],
    ['Open linked payment policy','Payment Retry Policy'],
  ]) {
    await page.getByLabel(label,{exact:true}).click();
    await expect(page.getByRole('complementary',{name:'Detail inspector'}).getByRole('heading',{name:title,exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Good morning, Alex.'})).toBeVisible();
    await page.getByLabel('Close inspector').click();
  }
});

test('Connected workspace settings do not invent a demo organization',async({page})=>{
  await installConnected(page);
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.locator('.tabs').getByRole('button',{name:'Workspace',exact:true}).click();
  await expect(page.getByRole('heading',{name:'My workspace',exact:true})).toBeVisible();
  await expect(page.locator('.main-content')).not.toContainText('Acme Engineering');
  await expect(page.getByRole('button',{name:'Reset sample data',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Manage integrations',exact:true}).click();
  await expect(page.getByLabel('Service URL')).toBeVisible();
});

test('App typography is available without third-party font requests',async({page})=>{
  const externalFonts=[];
  page.on('request',r=>{if(/fonts\.(googleapis|gstatic)\.com/.test(r.url()))externalFonts.push(r.url());});
  await page.goto('/');
  await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>document.fonts.check('500 13px "DM Sans"'))).toBe(true);
  expect(externalFonts).toEqual([]);
});
