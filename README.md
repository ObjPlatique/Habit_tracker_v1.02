# Habit_tracker_v1.02

## PWA Integration Steps

1. **Manifest setup**
   - Add `manifest.json` at the project root.
   - Set `display` to `fullscreen` and define icons, colors, and start URL.
   - Link it in `index.html`:
     ```html
     <link rel="manifest" href="./manifest.json">
     ```

2. **App icons**
   - Place app icons in `/icons` (`icon.svg`, `icon-192.svg`, `icon-512.svg`).
   - Reference icon and apple touch icon in `index.html`:
     ```html
     <link rel="icon" type="image/svg+xml" href="./icons/icon.svg">
     <link rel="apple-touch-icon" href="./icons/icon-192.svg">
     ```

3. **Service worker**
   - Add `service-worker.js` with install/activate/fetch handlers.
   - Cache static assets during install.
   - Serve cached assets first for offline support and cache network responses.

4. **Register service worker**
   - Register `service-worker.js` in `script.js` using:
     ```js
     navigator.serviceWorker.register('./service-worker.js')
     ```

5. **Enable Add to Home Screen**
   - Listen for the `beforeinstallprompt` event.
   - Store deferred prompt and expose an install button.
   - Call `prompt()` on user click.

6. **Fullscreen mode**
   - Set manifest display mode to fullscreen.
   - Add a fullscreen toggle button that uses the Fullscreen API.

## Notes

- For local testing, serve over `http://localhost` (or HTTPS in production).
- In Chrome DevTools, use **Application > Manifest** and **Application > Service Workers** to verify PWA readiness.
