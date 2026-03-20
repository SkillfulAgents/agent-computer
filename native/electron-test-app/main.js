const { app, BrowserWindow } = require('electron');
const path = require('path');

// Ensure AX tree is always available (Chromium only exposes it when screen reader detected otherwise)
app.commandLine.appendSwitch('force-renderer-accessibility');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 500,
    title: 'AC Electron Test App',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Allow Node.js APIs (fs) in preload script
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
