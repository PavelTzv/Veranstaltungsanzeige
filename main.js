const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron/main');
//const { createPrimaryWindow, createSecondaryWindows, anzeigeVeranstaltungenWindow } = require('./source/displayManager');
const fs = require('fs');
const path = require('path');

// Robust: verwende im Dev das Projektverzeichnis, im Package den userData-Ordner
function getConfigPath() {
  try {
    // In der gepackten App: userData ist beschreibbar; im Dev: __dirname
    const base = app.isPackaged ? app.getPath('userData') : __dirname;
    return path.join(base, 'config.json');
  } catch (e) {
    // Fallback (sollte praktisch nie passieren)
    return path.join(__dirname, 'config.json');
  }
}
let configPath = getConfigPath();

// Funktion zum Laden der Konfigurationswerte aus der JSON-Datei
function readConfig() {
    try {
        configPath = getConfigPath();
        if (!fs.existsSync(configPath)) {
            return {}; // Falls die Datei nicht existiert, leere Einstellungen zurückgeben
        }
        const data = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Fehler beim Lesen der Konfigurationsdatei:", error);
        return {}; // Fehlerhandling: Gibt ein leeres Objekt zurück
    }
}

// Funktion zum Speichern der Werte in die JSON-Datei
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
  const targetHour = Number(config.relounchHour);  // Set the hour (24-hour format) -> e.g., 3 AM
  const targetMinute = Number(config.relounchMinute); // Set the minute
  //const targetHour = 18;  // Set the hour (24-hour format) -> e.g., 3 AM
  //const targetMinute = 9; // Set the minute
  console.log("Target Time:", targetHour, ":", targetMinute)


  // Liefert alle Displays
  ipcMain.handle('get-displays', () => {
    const displays = screen.getAllDisplays();
    console.log('Bildschirme gefunden:', displays);
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
      console.log("Rows geändert!")
      let config = readConfig();
      config.maxVisibleRows = pRows;
      writeConfig(config);
    }
  });

  ipcMain.handle('set-relounch-hour', (_, pRelHour) => {
    if(pRelHour !== "") {
      console.log("RelHour geändert!")
      let config = readConfig();
      config.relounchHour = pRelHour;
      writeConfig(config);
    }
    
  });

  ipcMain.handle('set-relounch-minute', (_, pRelMinute) => {
    if(pRelMinute !== "") {
      console.log("RelMinute geändert!")
      let config = readConfig();
      config.relounchMinute = pRelMinute;
      writeConfig(config);
    }
  });

  ipcMain.handle('get-max-visible-rows', () => {
    const config = readConfig();
    console.log("max-visible-rows triggered")
    console.log("Max visible Rows:", config.maxVisibleRows)
    return config.maxVisibleRows || 6;
  });

  ipcMain.handle('get-rel-hour', () => {
    const config = readConfig();
    console.log("Relounch Hour:", config.relounchHour)
    return config.relounchHour;
  });

  ipcMain.handle('get-rel-min', () => {
    const config = readConfig();
    console.log("Relounch Minute:", config.relounchMinute)
    return config.relounchMinute;
  });

  ipcMain.handle('get-path', () => {
    const config = readConfig();
    console.log("get-path triggered")
    console.log("Get Path:", config.selectedFilePath)
    return config.selectedFilePath || " ";
  });

  ipcMain.handle('reload-window', () => {
    app.relaunch();
    app.exit();
    console.log("-----------------------------RELAUNCH-----------------------------")
  });

  //File Upload Beginn
  async function handleFileOpen() {
    const { canceled, filePaths } = await dialog.showOpenDialog();
    if (!canceled && filePaths.length > 0) {
        let config = readConfig(); // Lade die aktuelle Konfiguration
        config.selectedFilePath = filePaths[0]; // Speichere den neuen Dateipfad
        writeConfig(config); // Speichere die aktualisierte Konfiguration in der JSON-Datei
        
        console.log("Gewählte Datei:", filePaths[0]);
        return config.selectedFilePath;
    }
    return null;
}
  //File Upload Ende

  //Fenstererstellung Beginn
  const createWindows = () => {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    const secondaryDisplays = displays.filter(display => display.id !== primaryDisplay.id);

    let config = readConfig();
    let selectedDisplays = displays.filter(display => display.id === Number(config.selectedDisplay));
    let savedFilePath = config.selectedFilePath || null;

    console.log('Alle Bildschirme:', displays);
    createPrimaryWindow(primaryDisplay);
    //createSecondaryWindows(selectedDisplays);

    if (selectedDisplays.length > 0) {
        anzeigeVeranstaltungenWindow(selectedDisplays, savedFilePath);
        console.log("--------------------Veranstaltungen auf Selected Display. Config (.selectedDisplay):" + config.selectedDisplay)
    } else {
        anzeigeVeranstaltungenWindow(displays, savedFilePath);
        console.log("--------------------Veranstaltungen auf Primary Display--------------------")
    }
  };
  //Fenstererstellung Ende

  function scheduleDailyReload() {
    setInterval(() => {
        const now = new Date();

        console.log("Check for reload, time:", now.getHours(), ":", now.getMinutes());
        if (now.getHours() === targetHour && now.getMinutes() === targetMinute) {
            console.log("🔄 Reloading window...");
            app.relaunch();
            app.exit();
            console.log("-----------------------------RELAUNCH-----------------------------")
        }
    }, 60000); // Check every minute
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