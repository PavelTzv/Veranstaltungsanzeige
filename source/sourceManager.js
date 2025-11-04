const fs = require('fs');
const xlsx = require('xlsx');
const { dialog, BrowserWindow } = require('electron');
let chosenPath = null;
const { readConfig, writeConfig } = require('../main.js');

function showError(message) {
  const choice = dialog.showMessageBoxSync(BrowserWindow.getFocusedWindow(), {
    type: 'error',
    title: 'Fehlermeldung',
    message,
    buttons: ['Datei ändern', 'Ignorieren'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });

  if (choice === 0) {
    chooseFile();
  }
}

async function chooseFile() {
    const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'] // oder ['openDirectory'] etc.
    });
    chosenPath = canceled ? null : filePaths?.[0] ?? null;
    let config = readConfig();
    config.selectedFilePath = chosenPath;
    writeConfig(config)
    console.log('Über Error gewählt:', chosenPath);
}

function getVorlesungen(datum, filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
        console.error("❌ Fehler: Keine gültige Datei angegeben.");
        showError("Keine gültige Datei angegeben.")
        return [];
    }

    if (!fs.statSync(filePath).isFile()) {
        showError(`Der übergebene Pfad ist kein gültiges Excel-Dokument (${filePath}).`)
        console.error(`❌ Fehler: Der übergebene Pfad ist kein gültiges Excel-Dokument (${filePath}).`);
        return [];
    }

    try {
        // Excel-Datei laden
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // Erstes Tabellenblatt wählen
        const sheet = workbook.Sheets[sheetName];

        // Excel-Daten in JSON umwandeln
        const jsonData = xlsx.utils.sheet_to_json(sheet);

        // Liste der Vorlesungen formatieren
        console.log("getVorlseungen triggered!!!")
        console.log(datum)
        return jsonData
            .filter(row => row["Datum"] === datum) // Only keep rows where "Datum" matches
            .map(row => ({
                datum: row["Datum"] || "",
                start: row["Von"] || "",
                end: row["Bis"] || "",
                room: row["Raum"] || "",
                event: row["Veranstaltung"] || "",
                topic: row["Thema"] || "",
                lecturer: row["Dozent:in"] || "",
                group: row["Gruppe"] || "",
            }));

        

    } catch (error) {
        console.error("❌ Fehler beim Lesen der Excel-Datei:", error);
        alert("❌ Fehler beim Lesen der Excel-Datei:", error)
        return [];
    }
}

module.exports = { getVorlesungen };