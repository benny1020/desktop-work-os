import {test,expect} from '@playwright/test';
import {installConnected} from './fixtures/connected.mjs';
const nav=(page,name)=>page.locator('nav').getByRole('button',{name,exact:true}).click();

test('Utility popovers focus their content, dismiss outside and restore trigger on Escape',async({page})=>{
  await page.goto('/');
  const trigger=page.getByLabel('Notifications',{exact:true});
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded','true');
  await expect(page.getByLabel('Close notifications')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded','false');
  await page.getByLabel('Recently viewed',{exact:true}).click();
  await expect(page.locator('.recent-popover')).toBeFocused();
  await page.getByRole('heading',{name:'Your day',exact:false}).click();
  await expect(page.locator('.recent-popover')).toHaveCount(0);
  await page.getByLabel('Workspace switcher').click();
  await expect(page.getByRole('button',{name:'Workspace settings',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Workspace switcher')).toBeFocused();
});

test('Navigation shortcuts cannot change the workspace behind a modal',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Explore workflows',exact:true}).click();
  await page.keyboard.press('g');await page.keyboard.press('p');
  await expect(page.locator('.breadcrumb')).toContainText('Home');
  await page.keyboard.press('Control+n');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('g');await page.keyboard.press('p');
  await expect(page.getByRole('heading',{name:'Project issues',exact:true})).toBeVisible();
});

test('History restores the exact reviewed MR and ignores duplicate route clicks',async({page})=>{
  await page.goto('/');
  await nav(page,'Home');
  await expect(page.getByLabel('Go back',{exact:true})).toBeDisabled();
  await page.getByRole('button',{name:/Review changes/}).click();
  await expect(page.getByRole('heading',{name:'Fix order status mapping',exact:true})).toBeVisible();
  await nav(page,'Home');
  await page.getByRole('button',{name:'Explore workflows',exact:true}).click();
  await page.getByRole('button',{name:/See the change before the code/}).click();
  await expect(page.getByRole('heading',{name:'Payment retry handling',exact:true})).toBeVisible();
  await page.getByLabel('Go back',{exact:true}).click();
  await page.getByLabel('Go back',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'Fix order status mapping',exact:true})).toBeVisible();
  await page.getByLabel('Go forward',{exact:true}).click();
  await page.getByLabel('Go forward',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'Payment retry handling',exact:true})).toBeVisible();
});

test('Attention failures and disconnected services never imply an all-clear',async({page})=>{
  await installConnected(page);
  await page.evaluate(()=>window.__fixture.setFailure('jira.issues'));
  await page.getByLabel('Notifications',{exact:true}).click();
  const center=page.getByLabel('Connected attention center');
  await expect(center).toContainText('Results may be incomplete');
  await expect(center).not.toContainText('No urgent work');
  await page.getByLabel('Close attention').click();
  await page.evaluate(()=>{window.__fixture.setFailure('');window.__fixture.configs.jira.tokenConfigured=false;window.__fixture.configs.gitlab.tokenConfigured=false;});
  await page.getByLabel('Notifications',{exact:true}).click();
  await expect(center.getByRole('button',{name:'Connect tools'})).toBeVisible();
  await expect(center).not.toContainText('No urgent work');
  await center.getByRole('button',{name:'Connect tools'}).click();
  await expect(page.getByLabel('Service URL')).toBeVisible();
});
