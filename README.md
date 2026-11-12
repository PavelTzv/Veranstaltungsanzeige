# Veranstaltungsanzeige

A Windows desktop app (Electron) that shows the current day's lectures and meetings full-screen on a display, for example in an institute's entrance hall. I built it as a student assistant at University Medicine Greifswald, as the sole developer from requirements to rollout. It is in daily use there.

## What it does

- Reads the schedule from an Excel file (`.xlsx`) and shows only today's entries: time, room, event, topic and lecturer.
- Runs full-screen in kiosk mode on a display you choose, so it works on multi-monitor setups with a separate control window.
- Pages through the list automatically when there are more events than fit on screen. The number of visible rows is configurable.
- Restarts itself every day at a configurable time, so it picks up the new day and any changes to the file without manual action.
- Shows a clear error dialog with a "change file" option if the Excel file is missing or invalid.

## Excel format

The first sheet needs these column headers:

| Datum | Von | Bis | Raum | Veranstaltung | Thema | Dozent:in |
|---|---|---|---|---|---|---|

## Tech

- Electron with a main/renderer split and a preload script for IPC
- [`xlsx`](https://www.npmjs.com/package/xlsx) for reading the schedule
- `electron-builder` for the Windows installer (NSIS)
- GitHub Actions: pushing a tag `v*` builds the Windows `.exe` and publishes a release

## Run locally

```bash
npm install
npm start          # start in development
npm run dist:win   # build the Windows installer
```

## License

Apache-2.0
