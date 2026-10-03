import {test,expect} from '@playwright/test';
import {installConnected} from './fixtures/connected.mjs';

test('Failed create retains exact text through close, retry and account switches',async({page})=>{
  await installConnected(page);await page.keyboard.press('Meta+n');
  await page.getByRole('button',{name:'Jira issue',exact:true}).click();
  await page.getByLabel('New work title').fill('Investigate retry budget');
  await page.getByLabel('New work body').fill('Keep request id and failure evidence.\nSecond paragraph.');
  await page.getByLabel('New issue project').selectOption('PAY');await page.getByLabel('New issue type').selectOption('3');
  await page.evaluate(()=>window.__fixture.setFailure('jira.create'));
  await page.getByRole('button',{name:'Create in Jira',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Draft retained');
  await page.keyboard.press('Escape');await page.keyboard.press('Meta+n');
  await expect(page.getByLabel('New work title')).toHaveValue('Investigate retry budget');
  await expect(page.getByLabel('New work body')).toHaveValue('Keep request id and failure evidence.\nSecond paragraph.');
  await page.keyboard.press('Escape');await page.evaluate(()=>window.__fixture.configs.jira.email='other@example.test');await page.keyboard.press('Meta+n');
  await expect(page.getByLabel('New work title')).toHaveValue('');await expect(page.getByLabel('New work body')).toHaveValue('');
  await page.keyboard.press('Escape');await page.evaluate(()=>{window.__fixture.configs.jira.email='reviewer@example.test';window.__fixture.setFailure('');});await page.keyboard.press('Meta+n');
  await expect(page.getByLabel('New work title')).toHaveValue('Investigate retry budget');
  await page.getByLabel('New issue project').selectOption('PAY');await page.getByLabel('New issue type').selectOption('3');await page.getByRole('button',{name:'Create in Jira',exact:true}).click();
  await expect(page.getByLabel('Live issue inspector')).toBeVisible();
  const calls=await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='jira.create'));
  expect(calls).toHaveLength(2);expect(calls[1].args).toEqual(calls[0].args);
});

test('An old retry error cannot replace a newer search result or service state',async({page})=>{
  await installConnected(page);await page.evaluate(()=>window.__fixture.setFailure('jira.issues'));
  await page.keyboard.press('Meta+k');await page.getByLabel('Connected global search').fill('OLD-1');
  await page.getByRole('button',{name:'Retry Jira',exact:true}).waitFor();
  await page.evaluate(()=>{window.__fixture.setFailure('');const original=window.orbit.invoke;window.orbit.invoke=async(action,args)=>{if(action==='jira.issues'&&args.jql.includes('OLD-1')){await new Promise(resolve=>window.finishRetry=resolve);throw Error('Old retry failed');}return original(action,args);};});
  await page.getByRole('button',{name:'Retry Jira',exact:true}).click();
  await page.getByLabel('Connected global search').fill('PAY-382');
  await expect(page.locator('[cmdk-item]').filter({hasText:'PAY-382 Payment retry implementation'})).toBeVisible();
  await page.evaluate(()=>window.finishRetry());
  await expect(page.getByLabel('Search service status')).toContainText('Jira · 1 found');
  await expect(page.getByRole('alert').filter({hasText:'Old retry failed'})).toHaveCount(0);
});

test('Create footer remains clickable above long text in light desktop and dark narrow views',async({page})=>{
  await installConnected(page);
  for(const [width,height,dark]of [[1440,900,false],[980,650,true]]){
    await page.setViewportSize({width,height});if(dark)await page.getByLabel('Toggle theme').click();
    await page.keyboard.press('Meta+n');await page.getByRole('button',{name:'Wiki document',exact:true}).click();
    await page.getByLabel('New work title').fill('Retry behavior and incident response');
    await page.getByLabel('New work body').fill('Policy and implementation evidence.\n'.repeat(80));
    await page.getByLabel('New document space').selectOption('s1');
    const submit=page.getByRole('button',{name:'Publish to Confluence',exact:true});
    await expect(submit).toBeEnabled();
    expect(await submit.evaluate(el=>{const b=el.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight&&el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));})).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({animations:'disabled',path:`artifacts/command-independent-create-${width}.png`});
    await page.keyboard.press('Escape');
  }
});
