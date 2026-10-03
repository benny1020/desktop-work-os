const { app, BrowserWindow, ipcMain, safeStorage, net, Notification, powerMonitor } = require("electron");
const path = require("node:path");
// Keep the original profile directory so renaming preserves encrypted tokens,
// drafts and Chromium localStorage. ORBIT_USER_DATA_DIR remains a test alias.
app.setPath("userData", path.resolve(
  process.env.WORKLANE_USER_DATA_DIR || process.env.ORBIT_USER_DATA_DIR ||
  path.join(app.getPath("appData"), "desktop-work-os"),
));
app.setName("Worklane");
const { createVault, createIntegrationService } = require("./integrations.cjs");
const { createAssistantMemoryStore, createReminderScheduler } = require("./assistant-memory.cjs");
let integrationService;
let reminderTimer;
function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 650,
    title: "Worklane — Your workday, connected",
    backgroundColor: "#f7f8fa",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 19, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.loadFile(path.join(__dirname, "../dist/index.html"));
}
app.whenReady().then(() => {
  const vault = createVault(app.getPath("userData"), safeStorage);
  const assistantMemory = createAssistantMemoryStore({ directory: app.getPath("userData"), safeStorage, getConfigs: () => vault.read() });
  integrationService = createIntegrationService({
    fetchImpl: (url, options) => net.fetch(url, options),
    vault,
    assistantMemory,
  });
  ipcMain.handle("orbit:integration", async (event, action, args) => {
    const allowed = require("node:url").pathToFileURL(
      path.join(__dirname, "../dist/index.html"),
    ).href;
    if (
      event.senderFrame !== event.sender.mainFrame ||
      event.senderFrame.url.split("#")[0] !== allowed
    )
      return { ok: false, error: "Untrusted application frame." };
    try {
      return { ok: true, data: await integrationService.invoke(action, args) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  createWindow();
  const scheduler = createReminderScheduler({ store: assistantMemory, notify: (reminder) => new Promise((resolve) => {
    if (!Notification.isSupported()) { resolve(false); return; }
    const notification = new Notification({ title: "Worklane reminder", body: reminder.text });
    const timeout = setTimeout(() => resolve(false), 10000);
    notification.once("show", () => { clearTimeout(timeout); resolve(true); });
    notification.once("failed", () => { clearTimeout(timeout); resolve(false); });
    notification.on("click", () => {
      const window = BrowserWindow.getAllWindows()[0];
      if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
      else createWindow();
    });
    notification.show();
  }) });
  scheduler.tick();
  reminderTimer = setInterval(() => scheduler.tick(), 30000);
  powerMonitor.on("resume", () => scheduler.tick());
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => clearInterval(reminderTimer));
