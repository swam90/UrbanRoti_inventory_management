# Ledger Inventory — PWA

A daily inventory tracker for **vendors**, **items**, and **daily entries** with monthly reports. Built for **Singapore** (S$ currency, +65 phone, OneMap postal-code lookup). Installs on Android and iPhone as a native-like app.

---

## Step-by-step: get it on your phone

### 1 · Create a GitHub repository

1. Go to <https://github.com/new>
2. **Repository name:** anything you like — for example, `inventory-app`
3. Leave it **Public** (GitHub Pages is free for public repos)
4. **Do not** check "Add a README" — we already have one
5. Click **Create repository**

### 2 · Upload these files

The easiest way (no command line needed):

1. On the new empty repo page, click **"uploading an existing file"**
2. Drag this entire folder's contents into the upload area
   *(Make sure hidden files like `.github` and `.gitignore` are included)*
3. Scroll down, click **Commit changes**

Alternatively, using git:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

### 3 · Enable GitHub Pages

1. In your repo, click **Settings** (top tab)
2. In the left sidebar, click **Pages**
3. Under **Source**, choose **GitHub Actions**
4. That's it — no other setting needed

### 4 · Wait for the first deploy (~2 minutes)

1. Click the **Actions** tab in your repo
2. Watch the "Deploy to GitHub Pages" workflow run
3. When the green tick appears, your app is live at:

   **`https://YOUR-USERNAME.github.io/YOUR-REPO/`**

Every future push to `main` will rebuild and redeploy automatically.

### 5 · Install on your phone

#### 📱 Android (Chrome / Edge / Samsung Internet)

1. Open the URL on your phone
2. Tap the **⋮** menu → **Install app** *(or "Add to Home screen")*
3. Confirm — the icon appears on your home screen
4. Open it from the icon — runs fullscreen, no browser bar

#### 🍎 iPhone / iPad (must use Safari)

1. Open the URL in **Safari** *(not Chrome — Apple only allows installs from Safari)*
2. Tap the **Share** button *(square with up-arrow at the bottom)*
3. Scroll down, tap **Add to Home Screen**
4. Tap **Add** in the top-right
5. The icon appears on your home screen, opens fullscreen

---

## How it works on the device

- **All data stays on your device** (in browser `localStorage`). Nothing is sent to any server. Different phones don't share data — back up with the Reports → Excel export.
- **Works offline** after first load thanks to a service worker. Postal-code lookups need internet but the rest of the app works without it.
- **Updates automatically** — when you push new code, the next time you open the app it updates in the background.

---

## Customising

| What                              | Where                          |
|-----------------------------------|--------------------------------|
| App name / icon name              | `vite.config.js` → `manifest`  |
| Theme colours                     | `src/index.css` → `:root`      |
| Currency / locale                 | `src/App.jsx` → `fmtMoney`     |
| Replace icons                     | Files in `public/`             |
| Add cost centres                  | `src/App.jsx` → `COST_CENTERS` |
| Add units of measurement          | `src/App.jsx` → `UOM`          |

---

## Local development (optional)

If you want to test changes on your computer before pushing:

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

To preview the production build:

```bash
npm run build
npm run preview
```

---

## Troubleshooting

**The workflow fails the first time** — open the Actions tab, click the failed run, expand the error. The most common cause is Pages not being enabled yet (Step 3).

**App not installing on iPhone** — must use Safari, not Chrome or any other browser. iOS only allows installs from Safari.

**Address lookup not working** — needs internet on first lookup for a given postcode. Subsequent lookups for the same code work offline thanks to caching.

**I want to wipe my data** — long-press the app icon → uninstall, or in browser DevTools → Application → Local Storage → clear `inv:*` keys.
