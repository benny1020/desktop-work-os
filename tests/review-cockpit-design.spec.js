import { test, expect } from '@playwright/test';
import { installConnected, snapshot } from './fixtures/connected.mjs';
import { openComplexReview, chooseComplexFlow } from './fixtures/complex-demo.mjs';

async function open(page, theme="light") {
  await installConnected(page);
  if(theme==='dark') await page.getByLabel('Toggle theme',{exact:true}).click();
  await page.getByRole('button', {name:'Review changes',exact:true}).click();
}
for (const width of [1440,980]) for (const theme of ['light','dark']) {
  test(`Reading cockpit starts with source and readable flow at ${width}px ${theme}`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await open(page,theme);
    await expect(page.getByLabel('Expand AI review',{exact:true})).toBeVisible();
    await expect(page.locator('.ai-review-guide')).toBeHidden();
    await expect(page.getByLabel('Diagram review comment')).toHaveCount(0);
    const geometry=await page.locator('.review-workbench').evaluate(root=>{
      const box=s=>root.querySelector(s).getBoundingClientRect();
      const label=root.querySelector('.diagram-node .node-label');
      return {header:box('.visual-review-heading').height,codeWidth:box('.visual-code-panel').width/root.clientWidth,
        firstLine:box('.visual-code-line').y,codeHeight:box('.visual-code-scroll').height,
        canvasHeight:box('.diagram-scroll').height,
        font:parseFloat(getComputedStyle(root.querySelector('.visual-code-line')).fontSize),
        lineHeight:parseFloat(getComputedStyle(root.querySelector('.visual-code-line')).lineHeight),
        nodeFont:parseFloat(getComputedStyle(label).fontSize)*label.getScreenCTM().a};
    });
    expect(geometry.header).toBeLessThanOrEqual(150);
    expect(geometry.codeWidth).toBeGreaterThanOrEqual(.55);
    expect(geometry.firstLine).toBeLessThanOrEqual(320);
    expect(geometry.codeHeight).toBeGreaterThanOrEqual(350);
    expect(geometry.canvasHeight).toBeGreaterThanOrEqual(350);
    expect(geometry.font).toBeGreaterThanOrEqual(13);
    expect(geometry.lineHeight).toBeGreaterThanOrEqual(19);
    expect(geometry.nodeFont).toBeGreaterThanOrEqual(12);
    await expect(page.getByLabel('Verified import reading path')).toContainText('PaymentController');
    if(width===1440) for(const name of ['PaymentController.ts','PaymentService.ts','RetryQueue.ts'])
      await expect(page.getByRole('button',{name:`Open component ${name}`,exact:true})).toBeInViewport({ratio:1});
    await page.screenshot({path:`/tmp/worklane-fresh-ux/cockpit-final-${width}-${theme}.png`});
    expect(await page.evaluate(()=>window.__fixture.calls.some(c=>['claude.review','gitlab.comment','gitlab.approve'].includes(c.action)))).toBe(false);
  });
}

test('Native file navigation and layout switches preserve exact source and private draft',async({page})=>{
  await open(page);
  const files=page.getByLabel('Browse all review files',{exact:true});
  await files.focus(); await page.keyboard.press('Enter');
  await expect(page.getByLabel('Find review file',{exact:true})).toBeFocused();
  await page.getByLabel('Find review file',{exact:true}).fill('PaymentService');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(files).toBeFocused();
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await page.getByRole('button',{name:'Select source line 6',exact:true}).click();
  await page.getByLabel('Diagram review comment').fill('Inspect retry transaction ownership.');
  await page.getByRole('button',{name:'Code focus',exact:true}).click();
  await expect(page.locator('.visual-map-panel')).toBeHidden();
  await page.getByRole('button',{name:'Split view',exact:true}).click();
  await expect(page.locator('.visual-code-line.selected')).toHaveAttribute('data-code-line','new-6');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Inspect retry transaction ownership.');
  await files.focus();await page.keyboard.press('Enter');await page.keyboard.press('Escape');
  await expect(files).toBeFocused();await expect(page.locator('.review-all-files')).not.toHaveAttribute('open','');
  await page.setViewportSize({width:980,height:760});
  await page.getByLabel('Expand AI review',{exact:true}).click();
  await expect(page.locator('.ai-review-guide')).toBeVisible();
  await page.getByLabel('Collapse AI review',{exact:true}).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Expand AI review',{exact:true})).toBeFocused();
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Inspect retry transaction ownership.');
  expect(await page.evaluate(()=>window.__fixture.calls.some(c=>['claude.review','gitlab.comment','gitlab.approve'].includes(c.action)))).toBe(false);
});

test('Context round trip restores Code focus, AI visibility, exact line and canonical draft',async({page})=>{
  await open(page);
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await page.getByRole('button',{name:'Select source line 6',exact:true}).click();
  await page.getByLabel('Diagram review comment').fill('Keep the idempotency key.');
  await page.getByRole('button',{name:'Code focus',exact:true}).click();
  await page.getByLabel('Expand AI review',{exact:true}).click();
  await page.getByRole('button',{name:'Pipeline',exact:true}).click();
  await page.getByRole('button',{name:'#482 · success',exact:true}).click();
  await page.getByLabel('Back in context',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Code focus',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.visual-map-panel')).toBeHidden();
  await expect(page.locator('.visual-code-line.selected')).toHaveAttribute('data-code-line','new-6');
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Keep the idempotency key.');
  await expect(page.locator('.ai-review-guide')).toBeVisible();
  await expect(page.locator('.visual-code-heading')).toContainText(snapshot.files[0].path);
});

// A newly opened single interaction must show its callsite, rather than an
// unrelated first file in the scope. A later deliberate source choice remains valid.
test('First step-by-step interaction opens its exact callsite and keeps the previous file draft',async({page})=>{
  await openComplexReview(page);
  await chooseComplexFlow(page,'webhooks');
  await expect(page.locator('.visual-code-heading')).toContainText('PaymentEvent.ts');
  await page.getByLabel('Expand review composer',{exact:true}).click();
  await page.getByLabel('Diagram review comment').fill('Check the webhook event schema.');
  await page.getByRole('tab',{name:'Sequence',exact:true}).click();
  await expect(page.getByLabel('Sequence interaction',{exact:true})).toHaveValue('0');
  await expect(page.locator('.visual-code-heading')).toContainText('PaymentWebhookController.ts');
  await expect(page.locator('.visual-code-line.selected')).toHaveAttribute('data-code-line','new-11');
  await expect(page.locator('.code-provenance')).toContainText('Selected new line 11');
  await page.setViewportSize({width:980,height:720});
  await page.getByLabel('Browse all review files',{exact:true}).click();
  await page.getByLabel('Find review file',{exact:true}).fill('PaymentEvent');
  const menu = await page.locator('.review-all-file-menu').boundingBox();
  const workspace = await page.locator('.review-workbench').boundingBox();
  expect(menu.x).toBeGreaterThanOrEqual(workspace.x);
  expect(menu.x+menu.width).toBeLessThanOrEqual(workspace.x+workspace.width);
  await page.getByRole('button',{name:'Open review file src/webhooks/PaymentEvent.ts',exact:true}).click();
  await expect(page.getByLabel('Diagram review comment')).toHaveValue('Check the webhook event schema.');
  await page.getByRole('button',{name:'Code focus',exact:true}).click();
  await page.getByRole('button',{name:'Split view',exact:true}).click();
  await expect(page.locator('.visual-code-heading')).toContainText('PaymentEvent.ts');
  await expect(page.getByLabel('Sequence interaction',{exact:true})).toHaveValue('0');
});
