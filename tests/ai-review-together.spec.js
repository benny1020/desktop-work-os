import { test, expect } from '@playwright/test';
import { installConnected, snapshot } from './fixtures/connected.mjs';

const [first, second] = snapshot.demoGuide.findings;
const open = page => page.locator('.attention-row').getByRole('button', {name:/Payment retry review/}).click();
const generate = page => page.getByRole('button',{name:'Generate AI guide',exact:true}).click();
const checkpoint = (page, title) => page.locator('.ai-checkpoint').filter({has:page.getByRole('button',{name:`Draft comment for ${title}`,exact:true})});

test('AI evidence and own draft share one flow without automatic posting', async ({page}) => {
  await installConnected(page); await open(page);
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>c.action==='claude.review').length)).toBe(0);
  await generate(page);
  await expect(page.getByRole('img',{name:'Dependency flow diagram'})).toBeVisible();
  await expect(page.getByLabel('AI review alongside code')).toBeVisible();
  await checkpoint(page,first.title).locator('.guide-finding').click();
  await expect(page.locator('.visual-code-heading')).toContainText(first.path);
  await expect(page.locator('.code-provenance')).toContainText(`Selected new line ${first.line}`);
  await expect(page.getByRole('button',{name:`Open component ${first.path.split('/').at(-1)}`,exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByLabel('Diagram review comment').fill('My independent observation.');
  await checkpoint(page,second.title).locator('.guide-finding').click();
  await page.getByRole('button',{name:`Draft comment for ${first.title}`,exact:true}).click();
  await expect(page.getByLabel('Diagram review comment')).toHaveValue(`My independent observation.\n\n${first.title}\n${first.reason}`);
  await expect(page.getByLabel('Diagram review comment')).toBeFocused();
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>['gitlab.comment','gitlab.approve'].includes(c.action)).length)).toBe(0);
  await page.getByLabel('Diagram review comment').fill('My verified review after checking the evidence.');
  await page.getByRole('button',{name:'Post to GitLab',exact:true}).click();
  const posted = await page.evaluate(()=>window.__fixture.calls.find(c=>c.action==='gitlab.comment'));
  expect(posted.args).toMatchObject({path:first.path,line:first.line,body:'My verified review after checking the evidence.'});
});

test('Local checkpoint decisions survive reopening and reorder, remain reversible and reset for new refs', async ({page}) => {
  await installConnected(page); await open(page); await generate(page);
  await page.getByLabel(`Your assessment of ${first.title}`).selectOption('checked');
  await page.getByLabel(`Your assessment of ${second.title}`).selectOption('dismissed');
  await expect(page.getByRole('status').filter({hasText:'files viewed'})).toContainText('0 /');
  await page.reload(); await open(page);
  await page.evaluate(()=>{
    const original=window.orbit.invoke;
    window.orbit.invoke=async(action,args)=>{
      const result=await original(action,args);
      if(action==='claude.review') result.findings.reverse();
      return result;
    };
  });
  await generate(page);
  await expect(page.getByLabel(`Your assessment of ${first.title}`)).toHaveValue('checked');
  await expect(page.getByLabel(`Your assessment of ${second.title}`)).toHaveValue('dismissed');
  await page.getByLabel(`Your assessment of ${first.title}`).selectOption('open');
  await expect(page.getByLabel(`Your assessment of ${first.title}`)).toHaveValue('open');
  await page.evaluate(()=>{
    const original=window.orbit.invoke;
    window.orbit.invoke=async(action,args)=>{
      const result=await original(action,args);
      if(action==='gitlab.mr') result.mr.diff_refs.base_sha='different-base';
      return result;
    };
  });
  await page.getByRole('button',{name:'Refresh',exact:true}).click(); await generate(page);
  await expect(page.getByLabel(`Your assessment of ${second.title}`)).toHaveValue('open');
  expect(await page.evaluate(()=>window.__fixture.calls.filter(c=>['gitlab.comment','gitlab.approve'].includes(c.action)).length)).toBe(0);
});

test('Pending and failed AI leave code usable; a checkpoint recovers from failed Source', async ({page}) => {
  await installConnected(page); await open(page);
  await page.evaluate(()=>{
    const original=window.orbit.invoke;
    window.orbit.invoke=async(action,args)=>{
      if(action==='claude.review') await new Promise(resolve=>window.finishGuide=resolve);
      return original(action,args);
    };
  });
  await generate(page);
  await expect(page.getByText('Reviewing this diff… Keep exploring the code.')).toBeVisible();
  await page.getByRole('button',{name:'Open component PaymentService.ts',exact:true}).click();
  await page.getByLabel('Diagram review comment').fill('Draft while AI runs.');
  await page.evaluate(()=>window.finishGuide());
  await expect(checkpoint(page,first.title)).toBeVisible();
  await page.evaluate(()=>{window.__fixture.setFailure('claude.review');delete window.finishGuide;});
  await generate(page);
  await page.evaluate(()=>window.finishGuide());
  await expect(page.getByRole('alert')).toContainText('Fixture service unavailable');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Draft while AI runs.');
  await page.evaluate(()=>window.__fixture.setFailure('gitlab.code'));
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry source',exact:true})).toBeVisible();
  await checkpoint(page,first.title).locator('.guide-finding').click();
  await expect(page.getByRole('button',{name:`Select new line ${first.line}`,exact:true})).toBeVisible();
  await expect(page.locator('.visual-code-line.selected')).toHaveCount(1);
});

for(const width of [1440,980]) test(`Diagram, code and AI remain accessible together at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:width===980?650:900});
  await installConnected(page); await open(page); await generate(page);
  const boxes=await Promise.all(['.visual-map-panel','.visual-code-panel','.ai-review-rail'].map(s=>page.locator(s).boundingBox()));
  for(const box of boxes){expect(box.width).toBeGreaterThan(180);expect(box.height).toBeGreaterThan(120);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);}
  const [map,code,ai]=boxes;
  expect(code.x).toBeGreaterThanOrEqual(map.x+map.width-1);
  if(width===1440) expect(ai.x).toBeGreaterThanOrEqual(code.x+code.width-1);
  else {expect(ai.y).toBeGreaterThanOrEqual(map.y+map.height-1);expect(code.y).toBeLessThan(ai.y);}
  await page.getByRole('button',{name:`Draft comment for ${first.title}`,exact:true}).click();
  await expect(page.getByLabel('Diagram review comment')).toBeFocused();
  await expect.poll(async()=>page.evaluate(()=>{
    const map=document.querySelector('.visual-map-panel').getBoundingClientRect();
    const node=document.querySelector('.diagram-node.selected').getBoundingClientRect();
    return Math.max(0,Math.min(map.bottom,node.bottom)-Math.max(map.top,node.top));
  })).toBeGreaterThan(20);
  const header=await page.locator('.visual-review-heading').boundingBox();
  const codeHeading=await page.locator('.visual-code-heading').boundingBox();
  expect(codeHeading.y).toBeGreaterThanOrEqual(header.y+header.height-1);
  expect(codeHeading.y+codeHeading.height).toBeLessThanOrEqual(width===980?650:900);
  await page.getByLabel('Diagram review comment').fill('Review remains reachable.');
  await page.getByRole('button',{name:'Post to GitLab',exact:true}).click();
  await expect(page.locator('.component-comment')).toContainText('Review remains reachable.');
});

test('Resizing a drafted desktop checkpoint keeps its diagram and AI evidence visible without posting', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await installConnected(page); await open(page); await generate(page);
  await page.getByRole('button',{name:`Draft comment for ${first.title}`,exact:true}).click();
  await expect(page.getByLabel('Diagram review comment')).toHaveValue(`${first.title}\n${first.reason}`);
  await page.setViewportSize({width:980,height:650});
  for(const [panelSelector,itemSelector] of [
    ['.visual-map-panel','.diagram-node.selected'],
    ['.ai-review-guide','.ai-checkpoint.active'],
  ]) {
    await expect.poll(()=>page.evaluate(([panelSelector,itemSelector])=>{
      const panel=document.querySelector(panelSelector).getBoundingClientRect();
      const item=document.querySelector(itemSelector).getBoundingClientRect();
      return Math.max(0,Math.min(panel.bottom,item.bottom,innerHeight)-Math.max(panel.top,item.top,0));
    },[panelSelector,itemSelector])).toBeGreaterThan(20);
  }
  await expect(page.locator('.visual-code-heading')).toContainText(first.path);
  await expect(page.getByLabel('Diagram review comment')).toHaveValue(`${first.title}\n${first.reason}`);
  expect(await page.evaluate(()=>window.__fixture.calls.filter(call=>
    ['gitlab.comment','gitlab.approve','jira.update','jira.create','confluence.create'].includes(call.action)
  ).length)).toBe(0);
});
