# Theo’s Baseball App (Multi-file)

This is the split-out version of your single-file MLB app. It keeps **Scores**, **Box Score with player stats**, and **Highlights** for final games.

## Run locally
Because we use ES modules, open the folder with a simple local server (file:// won’t work). For example:

```bash
# Python 3
cd theos-baseball
python -m http.server 8080
# then open http://localhost:8080 in your browser
```

On iPad, use any “local web server” app (or Shortcuts that launches a local server) and point it at this folder.

## Files
- `index.html` — layout, header, overlays, and the game card template
- `styles.css` — all styles
- `js/main.js` — router + bootstrapping
- `js/api.js` — MLB endpoints and fetch helpers
- `js/utils.js` — small DOM + formatting helpers
- `js/components.js` — reusable UI pieces (team logos, linescore table)
- `js/media.js` — content/recap helpers
- `js/highlights.js` — opens the Highlights modal
- `js/scores.js` — Scores page + Box Score modal

## Notes
- Standings is a placeholder route for now. When you’re ready, we can add the full standings + team pages as separate modules without touching the rest.
