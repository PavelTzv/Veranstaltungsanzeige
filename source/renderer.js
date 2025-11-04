window.windowDataAPI.onWindowData((data) => {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };
  set('window-id', data.windowId);
  set('display-id', data.displayId);
  set('show-label', data.label);
});

window.vorlesungenDataAPI.onVorlesungenData(async (data) => {
  const MAX_VISIBLE_ROWS = await window.windowDataAPI.getMaxVisRows(); // Maximale sichtbare Zeilen

  const rowsPerPage = Number.isFinite(Number(MAX_VISIBLE_ROWS)) && Number(MAX_VISIBLE_ROWS) > 0
    ? Number(MAX_VISIBLE_ROWS)
    : 10; // Fallback

  const container = document.getElementById("table-container");
  if (!container) {
    console.warn('[renderer] #table-container nicht gefunden – Abbruch des Renderns');
    return;
  }

  const datumEl = document.getElementById('datum');
  if (datumEl) datumEl.innerText = `${data.wochentag}, ${data.datum}`;

  if (data.vorlesungen.length > 0) {
    
    // =========================
    // Anzeige-Logik: Filter & Paging
    // =========================
    // Stellschrauben
    const FILTER_GRACE_MIN = 5;          // Nachlaufzeit in Minuten nach "Bis"
    const ROTATE_PAGES = true;           // true = Seiten rotieren, false = nur 1. Seite
    const ROTATE_INTERVAL_MS = 13000;    // 15 Sekunden pro Seite

    // Anzeigeformat: Excel-Zeit (Tagesbruchteil / Zahl / "HH:MM[:SS]") -> "HH.MM"
    function excelTimeToHHMM(value) {
      if (value === null || value === undefined || value === "") return "";
      // Strings wie "08:45:00" oder "08:45"
      if (typeof value === "string") {
        const s = value.trim();
        const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (m) {
          const h = String(Number(m[1])).padStart(2, "0");
          const min = String(Number(m[2])).padStart(2, "0");
          return `${h}.${min}`;
        }
        // Komma zu Punkt normalisieren und als Zahl versuchen
        const n = Number(s.replace(",", "."));
        if (!Number.isNaN(n)) value = n; else return String(value);
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        const frac = ((value % 1) + 1) % 1; // Uhrzeitanteil
        const totalMinutes = Math.round(frac * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const pad = (n) => String(n).padStart(2, "0");
        return `${pad(hours)}.${pad(minutes)}`;
      }
      return String(value);
    }

    // Parser: Excel-Zeit (Bruchteil/Serial/"HH:MM") -> Minuten seit Mitternacht
    function excelTimeToMinutes(value) {
      if (value === null || value === undefined || value === "") return null;

      // Strings erlauben: "0,5", "0.5", "08:30"
      if (typeof value === "string") {
        const s = value.trim().replace(",", ".");
        const m = s.match(/^(\d{1,2}):(\d{2})/);
        if (m) {
          const h = Number(m[1]);
          const min = Number(m[2]);
          if (Number.isFinite(h) && Number.isFinite(min)) return h * 60 + min;
        }
        const n = Number(s);
        if (!Number.isNaN(n)) value = n; else return null;
      }

      // Zahlen (Excel-Serial oder Tagesbruchteil)
      if (typeof value === "number" && Number.isFinite(value)) {
        // Nur Uhrzeit-Bruchteil extrahieren, Datum ignorieren
        const frac = ((value % 1) + 1) % 1;
        return Math.round(frac * 24 * 60);
      }
      return null;
    }

    // Originaldaten puffern, damit Timer-Render konsistent ist
    const originalVorlesungen = [...data.vorlesungen];

    function getFilteredVorlesungen() {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const cutoff = nowMin - FILTER_GRACE_MIN;
      return originalVorlesungen.filter(v => {
        const endMin = excelTimeToMinutes(v.end);
        // Wenn Endzeit nicht parsebar ist, sicherheitshalber anzeigen (nicht wegfiltern)
        if (endMin === null) return true;
        return endMin >= cutoff;
      });
    }

    // Paging-Status
    let pageIndex = 0;

    function pageSlice(list, page, pageSize) {
      const start = page * pageSize;
      return list.slice(start, start + pageSize);
    }

    function render() {
      // Container komplett neu aufbauen (kein Full-Reload nötig)
      container.innerHTML = "";

      const containerDiv = document.createElement("div");
      containerDiv.className = "schedule-container";

      const table = document.createElement("table");
      table.innerHTML = `
        <colgroup>
          <col>
          <col>
          <col>
          <col>
          <col>
          <col>
        </colgroup>
        <thead>
          <tr>
            <th>Zeit</th>
            <th>Raum</th>
            <th>Veranstaltung/Studiengang</th>
            <th>Thema</th>
            <th>Dozent:in</th>
            <th>Gruppe</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector("tbody");

      // Filtern nach Endzeit
      const filtered = getFilteredVorlesungen();

      // Paging berechnen
      const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
      if (pageIndex >= totalPages) pageIndex = 0;

      const rowsToRender = ROTATE_PAGES
        ? pageSlice(filtered, pageIndex, rowsPerPage)
        : filtered.slice(0, rowsPerPage);

      // Rows bauen
      rowsToRender.forEach(vorlesung => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${excelTimeToHHMM(vorlesung.start)} - ${excelTimeToHHMM(vorlesung.end)} Uhr</td>
          <td>${vorlesung.room}</td>
          <td>${vorlesung.event}</td>
          <td>${vorlesung.topic}</td>
          <td>${vorlesung.lecturer}</td>
          <td>${vorlesung.group}</td>
        `;
        tbody.appendChild(row);
      });

      containerDiv.appendChild(table);
      container.appendChild(containerDiv);

      // Hinweiszeile bei mehreren Seiten
      if (filtered.length > rowsPerPage) {
        const more = document.createElement("div");
        more.id = "more-entries";
        more.innerText = `Es finden heute ${filtered.length} Veranstaltungen statt. (Seite ${pageIndex + 1} / ${totalPages})`;
        more.style.fontStyle = "italic";
        more.style.textAlign = "center";
        more.style.marginTop = "15px";
        more.style.color = "grey";
        container.appendChild(more);
      }

      // Aktuelle MAX_VISIBLE_ROWS anzeigen (falls Element vorhanden)
      const maxVisibleRowsDis = document.getElementById('aktuelleRows');
      if (maxVisibleRowsDis) {
        maxVisibleRowsDis.textContent = rowsPerPage;
      }
    }

    // Initial rendern
    render();

    // Vorherige Timer bereinigen, falls neue Daten mehrmals ankommen
    if (window.__rotationTimer) { clearInterval(window.__rotationTimer); window.__rotationTimer = null; }
    if (window.__refreshTimer) { clearInterval(window.__refreshTimer); window.__refreshTimer = null; }

    // Seitenrotation (falls aktiviert)
    if (ROTATE_PAGES) {
      window.__rotationTimer = setInterval(() => {
        pageIndex += 1;
        render();
      }, ROTATE_INTERVAL_MS);
    }

    // Periodisch neu filtern/anzeigen, damit abgelaufene Vorlesungen automatisch verschwinden
    window.__refreshTimer = setInterval(() => {
      render();
    }, 60000); // jede Minute neu rendern

  }
});

document.addEventListener('DOMContentLoaded', async () => {
  // Uhrzeit oben rechts laufend aktualisieren
  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const el = document.getElementById('Uhrzeit');
    if (el) el.innerText = `${hh}:${mm}`;
    requestAnimationFrame(updateClock);
  }
  updateClock();

  // Controls/Dropdowns
  const displaySelect = document.getElementById('display-select');
  const maxVisibleRowsInput = document.getElementById('rows');
  const relounchHour = document.getElementById('relHour');
  const relounchMinute = document.getElementById('relMinute');

  async function loadDisplays() {
    try {
      if (!window.electronAPI?.getDisplays || !displaySelect) return;
      const displays = await window.electronAPI.getDisplays();
      const selectedId = await window.electronAPI.getSelectedDisplay?.();
      displaySelect.innerHTML = '';
      displays.forEach((display, index) => {
        const option = document.createElement('option');
        option.value = display.id;
        option.textContent = `Display ${index + 1} (ID: ${display.id})`;
        if (Number(display.id) === Number(selectedId)) option.selected = true;
        displaySelect.appendChild(option);
      });
    } catch (e) {
      console.warn('loadDisplays fehlgeschlagen:', e);
    }
  }

  const btn2 = document.getElementById('btn2');
  if (btn2) {
    btn2.addEventListener('click', async () => {
      try {
        if (displaySelect && window.electronAPI?.setSelectedDisplay) {
          await window.electronAPI.setSelectedDisplay(displaySelect.value);
        }
        if (maxVisibleRowsInput && window.electronAPI?.setMaxVisibleRows) {
          await window.electronAPI.setMaxVisibleRows(maxVisibleRowsInput.value);
        }
        if (relounchHour && window.electronAPI?.setRelounchHour) {
          await window.electronAPI.setRelounchHour(relounchHour.value);
        }
        if (relounchMinute && window.electronAPI?.setRelounchMinute) {
          await window.electronAPI.setRelounchMinute(relounchMinute.value);
        }
        alert('Änderungen gespeichert!');
        if (window.electronAPI?.reloadWindows) window.electronAPI.reloadWindows();
      } catch (e) {
        console.warn('Fehler beim Speichern der Einstellungen:', e);
      }
    });
  }

  await loadDisplays();

  // Config-Pfad anzeigen
  try {
    const configPath = await window.windowDataAPI?.getPath?.();
    const filePathElement = document.getElementById('filePath');
    if (configPath && filePathElement) filePathElement.innerText = 'Quelldatei: ' + configPath;
  } catch (e) {
    console.warn('Config-Pfad konnte nicht geladen werden:', e);
  }

  // Aktuelle Einstellungen anzeigen (mit Fallback auf beide Bridges)
  const aktuelleRows = document.getElementById('aktuelleRows');
  const aktuelleRelHour = document.getElementById('aktuelleRelHour');
  const aktuelleRelMin = document.getElementById('aktuelleRelMin');

  try {
    let rows = null;
    if (window.electronAPI?.getMaxVisibleRows) rows = await window.electronAPI.getMaxVisibleRows();
    else if (window.windowDataAPI?.getMaxVisRows) rows = await window.windowDataAPI.getMaxVisRows();
    if (aktuelleRows && rows != null) aktuelleRows.textContent = rows;
  } catch (e) { console.warn('aktuelleRows holen fehlgeschlagen:', e); }

  try {
    const h = await window.electronAPI?.getRelounchHour?.();
    if (aktuelleRelHour && h != null) aktuelleRelHour.textContent = h;
  } catch (e) { console.warn('aktuelleRelHour holen fehlgeschlagen:', e); }

  try {
    const m = await window.electronAPI?.getRelounchMinute?.();
    if (aktuelleRelMin && m != null) aktuelleRelMin.textContent = m;
  } catch (e) { console.warn('aktuelleRelMin holen fehlgeschlagen:', e); }

  // Datei wählen Button
  const btn = document.getElementById('btn');
  const filePathElement2 = document.getElementById('filePath');
  if (btn && window.electronAPI?.openFile) {
    btn.addEventListener('click', async () => {
      try {
        const filePath = await window.electronAPI.openFile();
        if (filePathElement2 && filePath) {
          filePathElement2.innerText = 'Neue Quelldatei: ' + filePath;
        }
      } catch (e) {
        console.warn('openFile fehlgeschlagen:', e);
      }
    });
  }
});
