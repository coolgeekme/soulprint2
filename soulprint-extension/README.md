# SoulPrint Chrome Extension

Manifest V3 sidebar extension for SoulPrint Engine. It supports login, streaming chat, current-page context, selected-text actions, conversation sync, keyboard shortcuts, and a resizable Shadow DOM UI.

## Build

```bash
cd soulprint-extension
npm install
npm run build
```

Load `soulprint-extension/dist` from `chrome://extensions` with Developer mode enabled. Run `npm run dev` for watch builds, then reload the unpacked extension after changes.

## Automated smoke test

Current branded Chrome builds ignore command-line extension loading. Install Chrome for Testing locally, then run the browser smoke test:

```bash
npx @puppeteer/browsers install chrome@stable
npm run test:smoke
```

The test verifies the background worker, injected Shadow DOM sidebar, and popup page. You can also set `CHROME_PATH` to an existing Chrome for Testing executable.

Production API calls use `https://soulprintengine.ai`. To use a local backend, set `soulprint_settings.apiBaseUrl` to `http://localhost:3000` in `chrome.storage.local` from the extension service worker console.

## Google sign-in

The popup uses `chrome.identity.launchWebAuthFlow` to open the existing SoulPrint Firebase login. After Google authentication, `/auth` returns the SoulPrint JWT to Chrome's generated `chromiumapp.org` callback, and the extension verifies the token through `/api/auth/me` before storing it.

The matching `app/auth/page.js` change must be deployed to `soulprintengine.ai` before Google sign-in will complete in a locally loaded extension. No extension-specific Google OAuth client ID is required because Google authentication continues to run through the existing SoulPrint web/Firebase configuration.
