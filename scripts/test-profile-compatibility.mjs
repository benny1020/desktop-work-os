// Reproduce an upgrade from the original package/name without touching a real profile.
import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'worklane-profile-upgrade-'));
const legacyDir = path.join(temp, 'legacy-app');
const profile = path.join(temp, 'profile');
await fs.mkdir(legacyDir);
await fs.writeFile(path.join(legacyDir,'package.json'), JSON.stringify({name:'desktop-work-os',version:'1.0.0',main:'main.cjs'}));
await fs.writeFile(path.join(legacyDir,'main.cjs'), `
const {app,BrowserWindow,safeStorage}=require('electron');
app.setPath('userData',${JSON.stringify(profile)});
app.whenReady().then(()=>{
  globalThis.legacyVault=require(${JSON.stringify(path.join(root,'electron/integrations.cjs'))}).createVault(app.getPath('userData'),safeStorage);
  new BrowserWindow({webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}}).loadFile(${JSON.stringify(path.join(root,'dist/index.html'))});
});`);
let legacy, renamed;
try {
  legacy = await electron.launch({args:[legacyDir]});
  const oldPage = await legacy.firstWindow();
  await expect(oldPage.getByLabel('Workspace data mode')).toBeVisible();
  if (await legacy.evaluate(({app})=>app.getName()) !== 'desktop-work-os') throw Error('Legacy name mismatch');
  await legacy.evaluate(() => globalThis.legacyVault.write({gitlab:{url:'https://gitlab.fixture.invalid',token:'upgrade-fixture-token-not-real'}}));
  await oldPage.evaluate(() => {
    localStorage.setItem('orbit-theme', JSON.stringify('dark'));
    localStorage.setItem('orbit-workspaceMode', JSON.stringify('connected'));
    localStorage.setItem('orbit.connected.plan.v1', JSON.stringify({tasks:[{id:'legacy-task',title:'Existing plan survives rename',kind:'task',date:'',time:'',done:false}],recent:[],favorites:[],activity:[]}));
  });
  await legacy.evaluate(({session})=>session.defaultSession.flushStorageData());
  await legacy.close(); legacy=null;
  renamed = await electron.launch({args:[root], env:{...process.env,WORKLANE_USER_DATA_DIR:profile}});
  const page = await renamed.firstWindow();
  await expect(page.getByLabel('Workspace data mode')).toHaveValue('connected');
  const config = await page.evaluate(()=>window.orbit.invoke('config.list'));
  if(!config.gitlab?.tokenConfigured || config.gitlab.token) throw Error('Encrypted legacy token not readable or exposed');
  await renamed.evaluate(({protocol})=>protocol.handle('https', request=> {
    if(new URL(request.url).hostname==='gitlab.fixture.invalid' && request.headers.get('private-token')==='upgrade-fixture-token-not-real')
      return new Response(JSON.stringify(new URL(request.url).pathname.endsWith('/user') ? {id:3,name:'Upgrade fixture'} : []),{headers:{'content-type':'application/json'}});
    return new Response('',{status:401});
  }));
  await page.evaluate(()=>window.orbit.invoke('config.test',{service:'gitlab'}));
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.getByRole('button',{name:'Backlog',exact:true}).first().click();
  await expect(page.locator('.plan-task')).toContainText('Existing plan survives rename');
  const evidence={scope:'Isolated old-name to Worklane upgrade',encryptedToken:true,authenticatedFixtureRequest:true,plan:true,theme:true,workspaceMode:true,externalServicesTested:false};
  await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
  await fs.writeFile(path.join(root,'artifacts/profile-upgrade.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
} finally {
  if(legacy) await legacy.close();
  if(renamed) await renamed.close();
  await fs.rm(temp,{recursive:true,force:true});
}
