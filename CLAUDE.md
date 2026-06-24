# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running locally

Because the app uses ES modules, you must serve it through a local HTTP server — `file://` URLs won't work:

```bash
python -m http.server 8080
# then open http://localhost:8080
```

There is no build step, no package manager, and no test suite. All JS runs directly in the browser as native ES modules.

## Architecture

This is a vanilla JS Progressive Web App (PWA) deployed to GitHub Pages at `/kids-baseball-app/`. It hits the public MLB Stats API (`statsapi.mlb.com`) directly from the browser — there is no backend.

**Routing** — `js/main.js` is the entry point. It implements a minimal hash router (`#/scores`, `#/standings`, `#/team/:id`) and renders into `<div id="view">`. All navigation is hash-based; `hashchange` triggers re-render.

**Module responsibilities:**
- `js/api.js` — All MLB API endpoint URLs and fetch helpers. `MLB` object holds URL builders; `fetchJSON` wraps fetch with a 12-second timeout. `getSchedule`, `getLive`, `getContent`, `getStandings`, `getTeam`, `getRosterActive`, `getPeopleStats` are the main data fetchers.
- `js/scores.js` — Scores page (game card grid with date nav) and Box Score modal. `renderScores(state)` is the main entry; `openBoxLive(game)` opens the box score overlay with batting/pitching tables.
- `js/standings.js` — Standings page with Division/League/MLB segmented views. Tapping a team row navigates to `#/team/:id`.
- `js/team.js` — Team detail page with active roster, season stats, and lineup order inferred from the most recent completed game's box score.
- `js/highlights.js` — Opens the Highlights modal for a given recap URL.
- `js/components.js` — `setTeamLogo()` (tries multiple MLB CDN logo URLs with fallbacks) and `linescoreTable()`.
- `js/media.js` — `findRecapFromContent()` extracts a highlight/recap video URL from the MLB content endpoint response.
- `js/utils.js` — DOM helpers (`$`, `$$`), date formatting (`toDateKey`, `fromKey`, `dayLabel`, `localTime`), and value formatters (`escapeHtml`, `safe`, `num`, `formatAVG`).

**Overlays** — Two modal overlays are declared in `index.html`: `#overlay` (box score) and `#hlOverlay` (highlights). They're shown/hidden via `style.display`.

**PWA/Service Worker** — `sw.js` uses a cache-first strategy for static assets and network-first for HTML navigations. MLB API calls are never cached. When adding new JS files, update the `ASSETS` array in `sw.js` and bump `CACHE_NAME` so clients pick up the change.

**Deployment** — The app is hosted on GitHub Pages. The manifest and service worker registration use the `/kids-baseball-app/` path prefix explicitly.
