const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("orbit", {
  invoke: async (action, args = {}) => {
    const result = await ipcRenderer.invoke("orbit:integration", action, args);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  },
});
