// core/platform.js
import { launcher } from "../platform/launcher-web.js";

// мост из preload (exposeInMainWorld)
const bridge = globalThis.desktop;
export const isElectron = !!bridge;

export const platform = {
  env() {
    return isElectron ? "electron" : "browser";
  },

  // В браузере вернуть null (storage сам читает localStorage).
  async loadAppState() {
    if (isElectron && bridge.platform?.loadAppState) {
      try {
        return await bridge.platform.loadAppState();
      } catch {}
    }
    return null;
  },

  async saveAppState(jsonText) {
    if (isElectron && bridge.platform?.saveAppState) {
      try {
        await bridge.platform.saveAppState(String(jsonText ?? ""));
        return;
      } catch {}
    }
    // в вебе сохранение делает storage.save() -> localStorage
  },

  openExternal(url) {
    if (isElectron && bridge.platform?.openExternal) {
      return bridge.platform.openExternal(String(url));
    }
    return launcher.openUrl(String(url));
  },

  async detectInstalledBrowsers() {
    return launcher.detectInstalledBrowsers();
  },

  async getUserDataPath() {
    return null;
  },
};
