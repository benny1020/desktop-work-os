import { openReviewComposer } from "./fixtures/review-composer.mjs";
import { test, expect } from '@playwright/test';
import { installConnected } from './fixtures/connected.mjs';

test('Deleted-file source follows a refreshed base commit even when the MR head stays the same', async ({page}) => {
  await installConnected(page);
  await page.evaluate(()=>{
    const original=window.orbit.invoke;window.baseRevision='base-one';
    window.orbit.invoke=async(action,args)=>{
      if(action==='gitlab.code') {window.__fixture.calls.push({action,args});return{content:`// ${args.ref}\nexport const removed = true;`};}
      const result=await original(action,args);
      if(action==='gitlab.mr'){
        result.mr.diff_refs.base_sha=window.baseRevision;
        result.files[0].deleted_file=true;
        result.files[0].rows=[{kind:'removed',text:'export const removed = true;',oldLine:2,newLine:null}];
      }
      return result;
    };
  });
  await page.locator('nav .nav-item[aria-label="Code"]').click();
  await page.getByRole('button',{name:/PAY-382 Payment retry review/}).click();
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await expect(page.getByLabel('Component code')).toContainText('base-one');
  await expect(page.locator('.code-provenance')).not.toContainText('Selected');
  await page.evaluate(()=>window.baseRevision='base-two');
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(page.locator('.code-provenance')).toContainText('base base-two');
  await expect(page.getByLabel('Component code')).toContainText('base-two');
  await expect(page.getByLabel('Component code')).not.toContainText('base-one');
  await page.keyboard.press('Meta+j');
  await page.getByLabel('Ask Claude').fill('Check this deleted implementation');
  await page.getByRole('button',{name:'Send to Claude',exact:true}).click();
  await expect(page.locator('.live-chat-message.assistant')).toBeVisible();
  const context=await page.evaluate(()=>JSON.parse(JSON.parse(window.__fixture.calls.filter(c=>c.action==='claude.chat').at(-1).args.context).selected));
  expect(context.source.ref).toBe('base-two');
  expect(context.source.excerpt).toContain('base-two');
  expect(context.source.excerpt).not.toContain('base-one');
});

test('Removed diff rows are not shown as selected before the reviewer chooses a line', async ({page}) => {
  await installConnected(page);
  await page.evaluate(()=>{
    const original=window.orbit.invoke;
    window.orbit.invoke=async(action,args)=>{
      const result=await original(action,args);
      if(action==='gitlab.mr')result.files[0].rows.unshift({kind:'removed',text:'old value',oldLine:90,newLine:null});
      return result;
    };
  });
  await page.locator('.attention-row').getByRole('button',{name:/Payment retry review/}).click();
  await expect(page.locator('.visual-code-line.selected')).toHaveCount(0);
  await page.getByRole('button',{name:'Select old line 90',exact:true}).click();
  await expect(page.locator('.visual-code-line.selected')).toHaveCount(1);
});

test('Failed source request retries in place and retains the review comment draft', async ({page}) => {
  await installConnected(page);
  await page.evaluate(()=>window.__fixture.setFailure('gitlab.code'));
  await page.locator('.attention-row').getByRole('button',{name:/Payment retry review/}).click();
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('Verify retry invariants.');
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry source',exact:true})).toBeVisible();
  await page.evaluate(()=>window.__fixture.setFailure(''));
  await page.getByRole('button',{name:'Retry source',exact:true}).click();
  await expect(page.getByLabel('Component code')).toContainText('PaymentController');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Verify retry invariants.');
});

test('Late comment success does not discard new text typed during the request, and it survives reopening', async ({page}) => {
  await installConnected(page);
  await page.evaluate(()=>{
    const original=window.orbit.invoke;
    window.orbit.invoke=async(action,args)=>{
      if(action==='gitlab.comment')await new Promise(resolve=>window.completeComment=resolve);
      return original(action,args);
    };
  });
  await page.locator('.attention-row').getByRole('button',{name:/Payment retry review/}).click();
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('First comment.');
  await page.getByRole('button',{name:'Post to GitLab',exact:true}).click();
  await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill('Next comment draft.');
  await page.evaluate(()=>window.completeComment());
  await expect(page.locator('.component-comment')).toContainText('First comment.');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Next comment draft.');
  await page.getByLabel('Close context preview').click();
  await page.locator('.attention-row').getByRole('button',{name:/Payment retry review/}).click();
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Next comment draft.');
});

test('An approval already being sent cannot present a misleading cancel action', async ({page}) => {
  await installConnected(page);
  await page.evaluate(()=>{
    const original=window.orbit.invoke;
    window.orbit.invoke=async(action,args)=>{
      if(action==='gitlab.approve')await new Promise(resolve=>window.completeApproval=resolve);
      return original(action,args);
    };
  });
  await page.locator('.attention-row').getByRole('button',{name:/Payment retry review/}).click();
  await page.getByRole('button',{name:'Approve MR',exact:true}).click();
  await page.getByRole('button',{name:'Confirm approval',exact:true}).click();
  await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeDisabled();
  await page.evaluate(()=>window.completeApproval());
  await expect(page.getByRole('button',{name:'Approved',exact:true})).toBeDisabled();
});

test('Graph keyboard traversal and source review remain usable on narrow light and dark screens', async ({page}) => {
  await page.setViewportSize({width:1000,height:650});
  await installConnected(page);
  for(const theme of ['light','dark']) {
    if(theme==='dark')await page.getByLabel('Toggle theme').click();
    await page.locator('.attention-row').getByRole('button',{name:/Payment retry review/}).click();
    const svg=page.getByRole('group',{name:'Dependency flow diagram',exact:true});
    const nodes=svg.locator('[role="button"]');
    await nodes.first().focus();await page.keyboard.press('End');
    await expect(nodes.last()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.diagram-node.selected')).toHaveAttribute('aria-label',await nodes.last().getAttribute('aria-label'));
    await openReviewComposer(page);
    await expect(page.getByLabel('Diagram review comment')).toBeVisible();
    await page.getByRole('tab',{name:'Dependency flow',exact:true}).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab',{name:'Sequence',exact:true})).toBeFocused();
    await expect(page.getByRole('tab',{name:'Sequence',exact:true})).toHaveAttribute('aria-selected','true');
    await page.getByRole('button',{name:'Source',exact:true}).click();
    await expect(page.getByLabel('Component code')).not.toContainText('Loading source');
    await openReviewComposer(page);
  await page.getByLabel('Diagram review comment').fill(`Draft in ${theme}`);
    await page.getByLabel('Diagram review comment').scrollIntoViewIfNeeded();
    await expect(page.getByLabel('Diagram review comment')).toBeInViewport();
    await page.getByRole('button',{name:'Post to GitLab',exact:true}).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button',{name:'Post to GitLab',exact:true})).toBeInViewport();
    await page.screenshot({path:`artifacts/review-independent-${theme}.png`});
    await page.getByLabel('Close context preview').click();
  }
});
