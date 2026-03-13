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
  const MAX_VISIBLE_ROWS = await window.windowDataAPI.getMaxVisRows(); 
  const configuredRowsPerPage = Number.isFinite(Number(MAX_VISIBLE_ROWS)) && Number(MAX_VISIBLE_ROWS) > 0
    ? Number(MAX_VISIBLE_ROWS)
    : 10;
  const container = document.getElementById("table-container");
  const noEventsMessageEl = document.getElementById('no-events-message');
  if (!container) {
    console.warn('[renderer] #table-container nicht gefunden – Abbruch des Renderns');
    return;
  }
  const datumEl = document.getElementById('datum');
  let currentData = data;
  let originalVorlesungen = Array.isArray(data.vorlesungen) ? [...data.vorlesungen] : [];
  let currentPageIndex = 0;
  let lastTotalPages = 1;
  if (datumEl) datumEl.innerText = `${currentData.wochentag}, ${currentData.datum}`;

  const stopRotationTimer = () => {
    if (window.__rotationTimer) { clearInterval(window.__rotationTimer); window.__rotationTimer = null; }
  };

  const stopRefreshTimer = () => {
    if (window.__refreshTimer) { clearInterval(window.__refreshTimer); window.__refreshTimer = null; }
  };

  const setNoEventsMode = (on) => {
    document.body.classList.toggle('no-events', on);
    if (!on) return;

    if (noEventsMessageEl) {
      noEventsMessageEl.innerText = 'Aktuell keine Lehrveranstaltungen';
    }
    stopRotationTimer();
  };

  const FILTER_GRACE_MIN = 5;
  const ROTATE_PAGES = true;
  const ROTATE_INTERVAL_MS = 13000;

  function updateHeader(nextData) {
    if (!datumEl) return;
    if (!nextData?.wochentag || !nextData?.datum) {
      datumEl.innerText = '';
      return;
    }
    datumEl.innerText = `${nextData.wochentag}, ${nextData.datum}`;
  }

  function excelTimeToHHMM(value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "string") {
      const s = value.trim();
      const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (m) {
        const h = String(Number(m[1])).padStart(2, "0");
        const min = String(Number(m[2])).padStart(2, "0");
        return `${h}.${min}`;
      }
      const n = Number(s.replace(",", "."));
      if (!Number.isNaN(n)) value = n; else return String(value);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      const frac = ((value % 1) + 1) % 1;
      const totalMinutes = Math.round(frac * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(hours)}.${pad(minutes)}`;
    }
    return String(value);
  }

  function excelTimeToMinutes(value) {
    if (value === null || value === undefined || value === "") return null;
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
    if (typeof value === "number" && Number.isFinite(value)) {
      const frac = ((value % 1) + 1) % 1;
      return Math.round(frac * 24 * 60);
    }
    return null;
  }

  function formatDisplayedTime(startValue, endValue) {
    const start = excelTimeToHHMM(startValue);
    const end = excelTimeToHHMM(endValue);

    if (!start && !end) return "";
    if (start && end) return `${start} - ${end} Uhr`;
    if (start) return `ab ${start} Uhr`;
    return `bis ${end} Uhr`;
  }

  function formatCellContent(value) {
    if (value === null || value === undefined || value === "") return "";
    return String(value);
  }

  function getFilteredVorlesungen() {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const cutoff = nowMin - FILTER_GRACE_MIN;
    return originalVorlesungen.filter(v => {
      const endMin = excelTimeToMinutes(v.end);
      if (endMin === null) return true;
      return endMin >= cutoff;
    });
  }

  function getViewportBottomPadding() {
    return 24;
  }

  function fitsOnScreen(containerDiv) {
    const rect = containerDiv.getBoundingClientRect();
    return rect.bottom <= window.innerHeight - getViewportBottomPadding();
  }

  function buildTableShell() {
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
    containerDiv.appendChild(table);
    return { containerDiv, tbody };
  }

  function appendRow(tbody, vorlesung) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="cell-text">${formatCellContent(formatDisplayedTime(vorlesung.start, vorlesung.end))}</span></td>
      <td><span class="cell-text">${formatCellContent(vorlesung.room)}</span></td>
      <td><span class="cell-text">${formatCellContent(vorlesung.event)}</span></td>
      <td><span class="cell-text">${formatCellContent(vorlesung.topic)}</span></td>
      <td><span class="cell-text">${formatCellContent(vorlesung.lecturer)}</span></td>
      <td><span class="cell-text">${formatCellContent(vorlesung.group)}</span></td>
    `;
    tbody.appendChild(row);
  }

  function getFittingRowsCount(list, startIndex) {
    const maxCandidateRows = Math.max(configuredRowsPerPage, list.length - startIndex);
    const { containerDiv, tbody } = buildTableShell();
    container.appendChild(containerDiv);

    let rowsThatFit = 0;
    for (let offset = 0; offset < maxCandidateRows; offset += 1) {
      const vorlesung = list[startIndex + offset];
      if (!vorlesung) break;
      appendRow(tbody, vorlesung);
      if (!fitsOnScreen(containerDiv)) {
        tbody.removeChild(tbody.lastElementChild);
        break;
      }
      rowsThatFit += 1;
    }

    container.removeChild(containerDiv);
    return Math.max(1, rowsThatFit);
  }

  function buildPageLayout(list) {
    const pages = [];
    let startIndex = 0;

    while (startIndex < list.length) {
      const rowsShown = getFittingRowsCount(list, startIndex);
      pages.push({ startIndex, rowsShown });
      startIndex += rowsShown;
    }

    return pages;
  }

  function render() {
    container.innerHTML = "";
    const filtered = getFilteredVorlesungen();

    if (!filtered || filtered.length === 0) {
      container.innerHTML = '';
      setNoEventsMode(true);
      return false;
    }

    setNoEventsMode(false);

    const pages = buildPageLayout(filtered);
    if (currentPageIndex >= pages.length) currentPageIndex = 0;

    const currentPage = pages[currentPageIndex];
    const rowsToRender = filtered.slice(currentPage.startIndex, currentPage.startIndex + currentPage.rowsShown);
    const { containerDiv, tbody } = buildTableShell();
    rowsToRender.forEach(vorlesung => appendRow(tbody, vorlesung));
    container.appendChild(containerDiv);
    if (pages.length > 1) {
      const more = document.createElement("div");
      more.id = "more-entries";
      more.innerText = `Es finden heute ${filtered.length} Veranstaltungen statt. (${currentPageIndex + 1}/${pages.length})`;
      more.style.fontStyle = "italic";
      more.style.textAlign = "center";
      more.style.marginTop = "15px";
      more.style.color = "grey";
      container.appendChild(more);
    }
    const maxVisibleRowsDis = document.getElementById('aktuelleRows');
    if (maxVisibleRowsDis) {
      maxVisibleRowsDis.textContent = currentPage.rowsShown;
    }
    lastTotalPages = pages.length;
    return { hasVisibleEntries: true, totalPages: pages.length };
  }

  function restartRotationTimer() {
    stopRotationTimer();
    if (!ROTATE_PAGES) return;
    window.__rotationTimer = setInterval(() => {
      currentPageIndex += 1;
      if (currentPageIndex >= lastTotalPages) currentPageIndex = 0;
      render();
    }, ROTATE_INTERVAL_MS);
  }

  async function refreshVorlesungen() {
    if (!window.electronAPI?.loadVorlesungen) return;
    try {
      const freshData = await window.electronAPI.loadVorlesungen();
      currentData = freshData || {};
      originalVorlesungen = Array.isArray(currentData.vorlesungen) ? [...currentData.vorlesungen] : [];
      currentPageIndex = 0;
      lastTotalPages = 1;
      updateHeader(currentData);
      const result = render();
      if (result?.hasVisibleEntries) restartRotationTimer();
    } catch (error) {
      console.warn('Aktualisierung der Veranstaltungen fehlgeschlagen:', error);
    }
  }

  updateHeader(currentData);
  const initialRender = render();

  stopRotationTimer();
  stopRefreshTimer();
  if (initialRender?.hasVisibleEntries) restartRotationTimer();
  window.__refreshTimer = setInterval(() => {
    refreshVorlesungen();
  }, 60000);
});

document.addEventListener('DOMContentLoaded', async () => {
  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const el = document.getElementById('Uhrzeit');
    if (el) el.innerText = `${hh}:${mm}`;
    requestAnimationFrame(updateClock);
  }
  updateClock();
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
  try {
    const configPath = await window.windowDataAPI?.getPath?.();
    const filePathElement = document.getElementById('filePath');
    if (configPath && filePathElement) filePathElement.innerText = 'Quelldatei: ' + configPath;
  } catch (e) {
    console.warn('Config-Pfad konnte nicht geladen werden:', e);
  }
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
