// Actual browser UI with synthetic service responses; no organization credentials.
import {chromium, expect} from '@playwright/test';
import {installConnected} from '../tests/fixtures/connected.mjs';
import fs from 'node:fs/promises';
const root = new URL('..', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({baseURL:'http://127.0.0.1:5178',viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.clock.setFixedTime(new Date('2026-10-03T09:30:00+09:00'));
await installConnected(page);
await page.evaluate(async()=>{await document.fonts.ready;});
async function capture(name){await page.screenshot({path:`${root}/docs/media/${name}.png`,animations:'disabled'});}
for(const title of ['Review retry contract 2026-10-02','Document gateway timeout behavior 2026-10-01','Prepare rollout checklist today 11am']) {
  await page.getByLabel('Quick add personal work').fill(title);await page.getByRole('button',{name:'Add to plan',exact:true}).click();
}
await expect(page.getByRole('region',{name:'Unfinished from earlier days'})).toBeVisible();
await capture('daily-carryover');
await page.locator('.live-inbox').getByRole('button',{name:/PAY-382 Payment retry implementation/}).click();
await expect(page.getByLabel('Related work preview').getByRole('button',{name:/Payment Retry Policy/})).toBeVisible();
await capture('issue-related-work');
await page.evaluate(()=>{const original=window.orbit.invoke;window.orbit.invoke=async(action,args)=>{
  const result=await original(action,args);
  if(action==='confluence.page')result.body.storage.value='<h2>Retry contract</h2><p>PAY-382 defines retries for transient payment failures. Every retry preserves the original idempotency key.</p><h2>Bounded retries</h2><p>Retry at most three times with exponential backoff. Return the existing capture when the gateway has already processed the request.</p><h2>Failure handling</h2><p>Do not retry validation errors or declined payments. Record the gateway request ID and queue attempt for investigation.</p><h2>Rollout checklist</h2><ul><li>Verify concurrent retries cannot create duplicate captures.</li><li>Check queue latency and exhausted retry counts.</li><li>Link production findings to OPS-91.</li></ul>';
  return result;
};});
await page.getByLabel('Related work preview').getByRole('button',{name:/Payment Retry Policy/}).click();
await expect(page.getByRole('navigation',{name:'Document outline'})).toBeVisible();
await capture('wiki-reading-context');
await page.getByLabel('Close context preview').click();
await page.evaluate(()=>window.__fixture.setFailure('confluence.search'));
await page.keyboard.press('Meta+k');await page.getByLabel('Connected global search').fill('PAY-382');
await expect(page.getByRole('button',{name:'Retry Wiki',exact:true})).toBeVisible();
await capture('search-progressive');
await fs.mkdir(`${root}/artifacts/convenience`,{recursive:true});
await fs.writeFile(`${root}/artifacts/convenience/capture.json`,JSON.stringify({syntheticData:true,errors},null,2));
await browser.close();
if(errors.length)throw Error(errors.join('\n'));
