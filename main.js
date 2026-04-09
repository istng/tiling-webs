'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs   = require('fs');

// Pick the right icon format per platform (used in dev; packaged builds
// use the icon from the build/ resources directory automatically)
function devIcon() {
  const ext = process.platform === 'darwin' ? 'icns'
             : process.platform === 'win32'  ? 'ico'
             : 'png';
  const p = path.join(__dirname, 'build', `icon.${ext}`);
  return fs.existsSync(p) ? p : undefined;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0d1117',
    icon: devIcon(),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,          // enable <webview> in the renderer
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
