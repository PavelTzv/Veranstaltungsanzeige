const { BrowserWindow, screen } = require('electron');
const { getVorlesungen } = require('./sourceManager')
const path = require('node:path')

function createPrimaryWindow(pirmaryDisplay) {
  const { x, y, width, height } = pirmaryDisplay.bounds
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    icon: path.join(__dirname, 'icon.ico'),
    fullscreen: false, 
    kiosk: false,      
    frame: true,
    show: false,      
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),    
      nodeIntegration: true,
      contextIsolation: true,
    }
  });
  win.loadFile('source/primary.html');
  win.customLabel = 'not defined'
  win.mode = 'config'
  win.webContents.on('did-finish-load', () => {
    const windowBounds = win.getBounds();
    const currentDisplay = screen.getDisplayMatching(windowBounds);
    win.webContents.send('window-data', {
      windowId: win.id,
      displayId: currentDisplay.id,
      label: currentDisplay.label || 'No label available',
    })
  })
  win.once('ready-to-show', () => {
    win.minimize();
  });
}

function anzeigeVeranstaltungenWindow(selectedDisplays, filePaths) {
  selectedDisplays.forEach((display) => {
    const { x, y, width, height } = display.bounds;
    const win = new BrowserWindow({
      x,
      y,
      width,
      height,
      icon: path.join(__dirname, 'icon.ico'),
      fullscreen: true, 
      kiosk: true,      
      frame: false,  
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    win.loadFile('source/anzeigeVeranstaltungen.html');
    win.webContents.on('did-finish-load', () => {
      win.webContents.send('vorlesungen-data', {
        wochentag: new Date().toLocaleString('de-DE', { weekday: 'long' }),
        datum: new Date().toLocaleDateString('de-DE'),
        vorlesungen: getVorlesungen(getExcelSerialDate(), filePaths),
      });
    });    
  })
}

function getExcelSerialDate(date = new Date()) {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const diffInMs = date.getTime() - excelEpoch.getTime();
  return Math.floor(diffInMs / (1000 * 60 * 60 * 24));
}

module.exports = { createPrimaryWindow, anzeigeVeranstaltungenWindow };