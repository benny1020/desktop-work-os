import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const root = new URL('../', import.meta.url).pathname;
const output = root + 'artifacts/screenshots/';
const browser = await chromium.launch();
const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const captures=[];
await page.goto('http://127.0.0.1:5178/');
await page.evaluate(()=>document.fonts.ready);
async function capture(id,title,group='Core'){
 await page.locator('.main-content').evaluate(el=>el.scrollTop=0);
 await page.mouse.move(1428,889);
 await page.screenshot({path:output+id+'.png',animations:'disabled'});
 captures.push({id,title,group,file:id+'.png'});
 console.log(id+' '+title);
}
async function section(name,view){
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 if(name==='Settings')await page.getByRole('button',{name:'Settings',exact:true}).click();
 else await page.locator(`nav .nav-item[aria-label="${name}"]`).click();
 if(view)await page.locator(name==='Settings'?'.tabs':'.subnav').getByRole('button',{name:view,exact:true}).click();
}
await capture('01-home','Home · Daily Command Center');
await section('My Work','Today');await capture('02-today','My Work · Today');
await section('My Work','This Week');await capture('03-week','My Work · This Week');
await section('My Work','Calendar');await capture('04-calendar','Calendar · Week');
await section('Projects','Issues');await capture('05-issues','Projects · Issues');
await section('Projects','Board');await capture('06-board','Projects · Sprint Board');
await section('Projects','Issues');await page.getByRole('button',{name:'PAY-382',exact:true}).click();await capture('07-issue-inspector','Issue Inspector · PAY-382');
await section('Code','Merge Requests');await capture('08-merge-requests','Code · Merge Requests');
await section('Code','My Reviews');await capture('09-my-reviews','Code · My Reviews');
await page.locator('tbody tr').filter({hasText:'Fix order status mapping'}).getByRole('button',{name:'Review',exact:false}).last().click();
await capture('10-mr-review','MR Review · Dependency flow & code');
await section('Observe','Logs');await capture('11-logs','Observe · Log Explorer');
await section('Observe','Alerts');await capture('12-alerts','Observe · Alerts');
await section('Docs','Home');await capture('13-document','Docs · Payment Retry Policy');
await section('Home');await page.keyboard.press('Control+k');await page.getByLabel('Global search input').fill('PAY-382');await capture('15-search','Global Search · Cross-tool results');
await page.keyboard.press('Escape');await page.keyboard.press('Control+j');await capture('16-assistant','Assistant · Context-aware side panel');
await section('My Work','Inbox');await capture('17-brief','Assistant Brief · Smart Inbox');

await section('My Work','Backlog');await capture('18-backlog','My Work · Backlog','Planning');
await section('My Work','My Activity');await capture('19-my-activity','My Work · Activity','Planning');
await section('My Work','Calendar');await page.getByRole('button',{name:'Day',exact:true}).click();await capture('20-calendar-day','Calendar · Day','Planning');
await page.getByRole('button',{name:'Month',exact:true}).click();await capture('21-calendar-month','Calendar · Month','Planning');
await page.getByRole('button',{name:'Week',exact:true}).click();
for(const [id,view] of [['22-project-overview','Overview'],['23-sprint','Sprint'],['24-roadmap','Roadmap']]){await section('Projects',view);await capture(id,'Projects · '+view,'Projects');}
for(const [id,view] of [['25-repositories','Repositories'],['26-pipelines','Pipelines'],['27-architecture','Architecture']]){await section('Code',view);await capture(id,'Code · '+view,'Code');}
await section('Home');await page.getByRole('button',{name:/Review changes/}).click();await page.getByRole('button',{name:'Review overview',exact:true}).click();
for(const [id,tab] of [['28-mr-overview','Overview'],['29-mr-commits','Commits'],['30-mr-pipeline','Pipeline'],['31-mr-discussion','Discussion']]){await page.locator('.review-tabs').getByRole('button',{name:tab,exact:true}).click();await capture(id,'MR Review · '+tab,'Code');}
for(const [id,view] of [['32-observe-overview','Overview'],['33-dashboards','Dashboards']]){await section('Observe',view);await capture(id,'Observe · '+view,'Observe');}
await section('Observe','Logs');await page.getByLabel('Log level',{exact:true}).selectOption('ERROR');await page.locator('.log-table tbody tr').first().click();await capture('34-log-inspector','Log Inspector · Trace & deployment','Observe');
await section('Observe','Alerts');await page.getByRole('button',{name:/Payment API error rate elevated/}).click();await capture('35-alert-detail','Alert · Connected timeline','Observe');
await page.getByRole('complementary',{name:'Detail inspector'}).getByRole('button',{name:'Create incident',exact:true}).click();await capture('36-incident-detail','Incident · Evidence & next action','Observe');
await section('Observe','Incidents');await capture('37-incidents','Observe · Incidents','Observe');
for(const [id,view] of [['38-doc-spaces','Spaces'],['39-doc-recent','Recent'],['40-doc-favorites','Favorites']]){await section('Docs',view);await capture(id,'Docs · '+view,'Docs');}
for(const [id,view] of [['44-integrations','Integrations'],['45-notifications-settings','Notifications'],['46-workspace-settings','Workspace'],['47-preferences','Preferences']]){await section('Settings',view);await capture(id,'Settings · '+view,'System');}
await section('Home');await page.keyboard.press('Control+n');await page.getByLabel('New item title').fill('Review payment retries tomorrow 2pm');await capture('48-quick-create','Quick Create · Task, Issue, Document, Incident','System');
await page.keyboard.press('Escape');await page.getByLabel('Notifications',{exact:true}).click();await capture('49-notification-center','Notifications · Prioritized attention','System');
await page.keyboard.press('Escape');await page.getByRole('button',{name:/PAY-382 Payment retry implementation/}).click();await page.keyboard.press('Control+j');await page.getByRole('button',{name:'Move this issue to tomorrow',exact:true}).click();await capture('50-assistant-confirm','Assistant · Confirm before execution','System');
await section('Home');await page.getByLabel('Toggle theme').click();await capture('51-home-dark','Home · Dark mode','Dark mode');
await section('Observe','Logs');await capture('52-logs-dark','Log Explorer · Dark mode','Dark mode');
await section('Home');await page.getByRole('button',{name:/Review changes/}).click();await capture('53-review-dark','MR Review · Dark mode','Dark mode');
await page.getByLabel('Toggle theme').click();await section('Home');await page.getByLabel('Collapse sidebar').click();await capture('54-collapsed','App Shell · Collapsed sidebar','System');
await fs.writeFile(output+'manifest.json',JSON.stringify({viewport:'1440 × 900',screens:captures,errors},null,2));
await browser.close();
if(errors.length)throw new Error(errors.join('\n'));
console.log(`Captured ${captures.length} screens.`);
