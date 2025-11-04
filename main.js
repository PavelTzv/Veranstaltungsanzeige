const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron/main');
const fs = require('fs');
const path = require('path');

function getConfigPath() {
  try {
    const base = app.isPackaged ? app.getPath('userData') : __dirname;
    return path.join(base, 'config.json');
  } catch (e) {
    return path.join(__dirname, 'config.json');
  }
}

let configPath = getConfigPath();
function readConfig() {
  try {
    configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
      return {};
    }
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Fehler beim Lesen der Konfigurationsdatei:", error);
    return {};
  }
}

function writeConfig(data) {
  try {
    configPath = getConfigPath();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error("Fehler beim Speichern der Konfigurationsdatei:", error);
  }
}

const config = readConfig(); 
const targetHour = Number(config.relounchHour);
const targetMinute = Number(config.relounchMinute);

ipcMain.handle('get-displays', () => {
  const displays = screen.getAllDisplays();
  return displays;
});

ipcMain.handle('get-selected-display', () => {
  const config = readConfig();
  return config.selectedDisplay || null;
});

ipcMain.handle('set-selected-display', (_, displayId) => {
  let config = readConfig();
  config.selectedDisplay = displayId;
  writeConfig(config);
});

ipcMain.handle('set-max-visible-rows', (_, pRows) => {
  if(pRows !== "") {
    let config = readConfig();
    config.maxVisibleRows = pRows;
    writeConfig(config);
  }
});

ipcMain.handle('set-relounch-hour', (_, pRelHour) => {
  if(pRelHour !== "") {
    let config = readConfig();
    config.relounchHour = pRelHour;
    writeConfig(config);
  }
  
});

ipcMain.handle('set-relounch-minute', (_, pRelMinute) => {
  if(pRelMinute !== "") {
    let config = readConfig();
    config.relounchMinute = pRelMinute;
    writeConfig(config);
  }
});

ipcMain.handle('get-max-visible-rows', () => {
  const config = readConfig();
  return config.maxVisibleRows || 6;
});

ipcMain.handle('get-rel-hour', () => {
  const config = readConfig();
  return config.relounchHour;
});

ipcMain.handle('get-rel-min', () => {
  const config = readConfig();
  return config.relounchMinute;
});

ipcMain.handle('get-path', () => {
  const config = readConfig();
  return config.selectedFilePath || " ";
});

ipcMain.handle('reload-window', () => {
  app.relaunch();
  app.exit();
  console.log("-----------------------------RELAUNCH-----------------------------")
});

async function handleFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog();
  if (!canceled && filePaths.length > 0) {
    let config = readConfig();
    config.selectedFilePath = filePaths[0];
    writeConfig(config);
    console.log("Gewählte Datei:", filePaths[0]);
    return config.selectedFilePath;
  }
  return null;
}

const createWindows = () => {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  let config = readConfig();
  let selectedDisplays = displays.filter(display => display.id === Number(config.selectedDisplay));
  let savedFilePath = config.selectedFilePath || null;
  createPrimaryWindow(primaryDisplay);
  if (selectedDisplays.length > 0) {
    anzeigeVeranstaltungenWindow(selectedDisplays, savedFilePath);
  } else {
    anzeigeVeranstaltungenWindow(displays, savedFilePath);
  }
};

function scheduleDailyReload() {
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === targetHour && now.getMinutes() === targetMinute) {
      app.relaunch();
      app.exit();
      console.log("-----------------------------RELAUNCH-----------------------------")
  }
  }, 60000);
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    try {
      const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar', 'source', 'icon.png')
        : path.join(__dirname, 'source', 'icon.png');
      app.dock.setIcon(iconPath);
    } catch (e) {
      console.warn('Konnte Dock-Icon nicht setzen:', e);
    }
  }
  ipcMain.handle('dialog:openFile', handleFileOpen);
  createWindows();
  scheduleDailyReload();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindows();
      scheduleDailyReload();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

exports.readConfig = readConfig;
exports.writeConfig = writeConfig;

const { createPrimaryWindow, anzeigeVeranstaltungenWindow } = require('./source/displayManager');