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

## Install on iOS (iPhone/iPad)
The app is a PWA hosted at https://williamaltorfer.github.io/kids-baseball-app/. Installing it as a home screen app gives a full-screen, standalone experience without Safari's browser chrome.

1. Open **Safari** and go to https://williamaltorfer.github.io/kids-baseball-app/ (must be Safari — other browsers can't install standalone PWAs on iOS).
2. Tap the **Share** icon (square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**.
4. Confirm the name and tap **Add**.
5. Launch the app from its home screen icon (not from Safari) so it opens in standalone mode.

If you update the app and don't see the changes reflected, force-quit it (swipe up from the app switcher) and reopen — the service worker checks for updates on launch, but standalone PWAs don't reliably refresh in the background.

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
