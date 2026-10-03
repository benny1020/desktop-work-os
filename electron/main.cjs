const { app, BrowserWindow, ipcMain, safeStorage, net } = require("electron");
const path = require("node:path");
if (process.env.ORBIT_USER_DATA_DIR)
  app.setPath("userData", path.resolve(process.env.ORBIT_USER_DATA_DIR));
const { createVault, createIntegrationService } = require("./integrations.cjs");
let integrationService;
function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 650,
    title: "Orbit — Desktop Work OS",
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
  integrationService = createIntegrationService({
    fetchImpl: (url, options) => net.fetch(url, options),
    vault: createVault(app.getPath("userData"), safeStorage),
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
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
