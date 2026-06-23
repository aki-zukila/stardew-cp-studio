# Stardew CP Studio

Local web workspace for building Stardew Valley Content Patcher content packs.

## What it does

- Saves projects as a single `.cpgen` package.
- Embeds imported assets inside the project package.
- Generates an installable Content Patcher content pack with:
  - `manifest.json`
  - `content.json`
  - `i18n/default.json`
  - `assets/`
- Provides both form-driven editors and advanced JSON fields.
- Validates hard errors separately from warnings, so experienced authors can still export.

## Run

Install dependencies once:

```powershell
cd path\to\stardew-cp-studio
.\setup.ps1
```

On this Codex desktop, the script can reuse an existing shared Vite/React dependency folder if pnpm cannot create its store. On a normal machine, it installs the frontend dependencies from `frontend/package.json`.

Start the app:

```powershell
.\run_app.ps1
```

Then open the local page launched by the script. It prefers `http://127.0.0.1:8877/`, automatically picks the next free port if that one is already occupied, and writes the exact URL to `current-url.txt`.

For normal use on Windows, double-click `run_app.bat`. Keep the console window open while using the tool; closing it stops the local server.

## Project Format

`.cpgen` files are zip packages containing:

- `project.json`
- `ruleset.json`
- `assets/...`

## Notes

The initial ruleset targets Content Patcher format `2.9.0`. The ruleset is intentionally stored as data so later versions can be added without rewriting editor logic.
