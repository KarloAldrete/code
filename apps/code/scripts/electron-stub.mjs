// Stub module returned in place of `electron` when the scaffold script runs
// outside of Electron. The router walk only needs the procedures' input
// schemas — none of the methods on `app`, `BrowserWindow`, etc. are actually
// called at import time, so a no-op object suffices.
//
// Used by scaffold-mcp-tools-preload.mjs via a Node loader hook.
const noop = () => {};
const emptyObj = new Proxy(
  {},
  {
    get() {
      return noop;
    },
  },
);

const stub = new Proxy(
  {
    app: emptyObj,
    BrowserWindow: () => emptyObj,
    ipcMain: emptyObj,
    ipcRenderer: emptyObj,
    Menu: emptyObj,
    MenuItem: emptyObj,
    dialog: emptyObj,
    shell: emptyObj,
    nativeImage: emptyObj,
    clipboard: emptyObj,
    safeStorage: emptyObj,
    powerMonitor: emptyObj,
    powerSaveBlocker: emptyObj,
    autoUpdater: emptyObj,
    crashReporter: emptyObj,
    Notification: () => emptyObj,
    Tray: () => emptyObj,
    nativeTheme: emptyObj,
    session: emptyObj,
    screen: emptyObj,
    protocol: emptyObj,
    webContents: emptyObj,
    systemPreferences: emptyObj,
    contextBridge: emptyObj,
  },
  {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      }
      return noop;
    },
  },
);

export default stub;
export const app = stub.app;
export const BrowserWindow = stub.BrowserWindow;
export const ipcMain = stub.ipcMain;
export const ipcRenderer = stub.ipcRenderer;
export const Menu = stub.Menu;
export const MenuItem = stub.MenuItem;
export const dialog = stub.dialog;
export const shell = stub.shell;
export const nativeImage = stub.nativeImage;
export const clipboard = stub.clipboard;
export const safeStorage = stub.safeStorage;
export const powerMonitor = stub.powerMonitor;
export const powerSaveBlocker = stub.powerSaveBlocker;
export const autoUpdater = stub.autoUpdater;
export const crashReporter = stub.crashReporter;
export const Notification = stub.Notification;
export const Tray = stub.Tray;
export const nativeTheme = stub.nativeTheme;
export const session = stub.session;
export const screen = stub.screen;
export const protocol = stub.protocol;
export const webContents = stub.webContents;
export const systemPreferences = stub.systemPreferences;
export const contextBridge = stub.contextBridge;
