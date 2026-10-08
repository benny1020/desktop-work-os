// Isolated app pixels + optional axe checks. No personal browser or company data.
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installConnected } from '../tests/fixtures/connected.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.resolve(root, 'artifacts/design-quality');
const media = path.resolve(root, 'docs/media');
await fs.mkdir(out,{recursive:true}); await fs.mkdir(media,{recursive:true});
const server = await createServer({root, logLevel:'warn', server:{host:'127.0.0.1',port:0}});
let browser;
const reports=[];
try {
  await server.listen();
  browser=await chromium.launch();
  const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.httpServer.address().port}`,viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  async function capture(id, publish=false) {
    await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'});
    await page.evaluate(()=>document.fonts.ready);
    let violations=null;
    if(process.env.AXE_SCRIPT_PATH){
      await page.addScriptTag({path:process.env.AXE_SCRIPT_PATH});
      violations=await page.evaluate(async()=>{const result=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});
    }
    const output=path.join(out,`${id}.png`);
    await page.screenshot({path:output,animations:'disabled'});
    if(publish)await fs.copyFile(output,path.join(media,`release-${id}.png`));
    reports.push({id,violations});
    await fs.writeFile(path.join(out,'report.json'),JSON.stringify({reports,pageErrors:errors},null,2));
    console.log(`${id}: ${violations===null?'capture only':`${violations.length} automated violations`}`);
  }
  await page.goto('/');await capture('demo-home-light');
  await page.getByRole('button',{name:'Explore workflows',exact:true}).click();await capture('first-use-guide');
  await page.getByLabel('Close product guide').click();await page.getByLabel('Toggle theme').click();await capture('demo-home-dark');
  await installConnected(page);await expect(page.locator('.inbox-work').first()).toBeVisible();
  if(await page.locator('html').getAttribute('data-theme')==='dark')await page.getByLabel('Toggle theme').click();
  await capture('home-light',true);
  await page.setViewportSize({width:980,height:720});await capture('home-narrow',true);
  await page.locator('nav .nav-item[aria-label="Code"]').click();
  await page.getByRole('button',{name:/PAY-382 Payment retry review/}).first().click();
  await page.getByRole('button',{name:'Generate AI guide',exact:true}).click();
  await expect(page.locator('.ai-review-guide .ai-summary')).toBeVisible();
  await page.getByRole('button',{name:'Source',exact:true}).click();await page.getByLabel('Select source line 5',{exact:true}).click();
  await page.getByLabel('Diagram review comment').fill('Verify retries preserve the idempotency key before approving.');
  await page.setViewportSize({width:1440,height:900});await capture('review-together',true);
  await page.getByLabel('Toggle theme').click();await capture('review-dark',true);
  await page.setViewportSize({width:980,height:720});await page.getByLabel('Fit diagram to panel').click();await page.waitForTimeout(1000);await capture('review-narrow-fit',true);
  await page.getByLabel('Toggle theme').click();await page.setViewportSize({width:860,height:760});
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:/Jira Cloud/}).click();await capture('connections-narrow',true);
  await page.setViewportSize({width:1440,height:900});
  await page.locator('nav .nav-item[aria-label="Projects"]').click();await page.getByRole('button',{name:'Issues',exact:true}).click();
  await page.getByRole('button',{name:'PAY-382',exact:true}).click();await capture('issue-inspector',true);
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({reports,pageErrors:errors},null,2));
  if(errors.length||reports.some(r=>r.violations?.length))process.exitCode=1;
} finally { await browser?.close(); await server.close(); }
