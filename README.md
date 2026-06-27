# ⚡ Cursor Performance Tracker

An elegant, high-performance static Progressive Web App (PWA) built to log, format, and export athletic workout sessions cleanly. Designed for rapid data entry with pre-configured fitness baselines, automated local state backups, multi-file chronological timeline history, and cross-platform native sharing capabilities.

---

## 🚀 Features

* **Dual-Mode Tracking**: Specialized logging configurations for both Running sessions and Gym/Strength workouts with smart layout toggles.
* **Progressive Web App (PWA)**: Fully installable standalone app across iOS, Android, and Desktop platforms. Completely functional offline via custom service worker caching strategies.
* **Data Safety (Auto-Save Caching)**: Reactive state engine records input values to `localStorage` on every keystroke, ensuring zero data loss if background tabs refresh or close accidentally.
* **Historical Workflow Timeline & Dashboard**: A completely decoupled data review interface (`history.html`) that maintains your historical workout records statefully in an immutable JSON array.
* **Retroactive Phone Folder Log Importer**: A premium batch ingestion engine using the HTML5 `FileReader` API and regex parsing. Select all your older standalone `{yyyy-mm-dd}.txt` files directly from your phone's folder to parse and sync them into your dashboard timeline with built-in deduplication checks.
* **Smart Local Export & Share**: Generates beautifully formatted Markdown files named `{yyyy-mm-dd}.txt` for local device download, paired with a modern mobile fallback triggering the native System Share Sheet (`navigator.share`).
* **One-Click Clipboard Sync**: Formats metrics into highly structured markdown syntax and pipes it straight to the clipboard with contextual color state validation feedback.
* **Body Composition Tracking**: Integrated sub-grid parameters to capture trends in weight, muscle mass, and body fat percentage alongside training sessions.

---

## 🛠️ Tech Stack & Engineering Standards

- **Language**: Strict, decoupled **TypeScript (TS)** targeting the modern `ES2022` runtime engine environment.
- **Styling**: Native CSS3 using modular CSS custom design variables (`--bg-color`, `--primary-color`) for layout unity across separate app pages.
- **Architectural Isolation**: Clean structural separation of concerns isolating your core workspace logic from your historical layout data review engine and your service worker updater layer.
- **Hosting Engine**: Highly optimized for zero-overhead static distribution edge caching over **Vercel**.

---

## 📂 Project Layout

```text
├── 📁 src/
│   ├── app.ts           # Core entry, input layout toggles, and data generation engine
│   ├── history.ts       # Separated timeline manager, data parsing, and file import utility
│   └── sw-register.ts   # Decoupled type-safe PWA service worker updater registration layer
├── 📁 scripts/
│   ├── app.js           # Production browser-optimized compilation binary (Git ignored)
│   ├── history.js       # Production compiled dashboard control binary (Git ignored)
│   └── sw-register.js   # Production compiled network registration binary (Git ignored)
├── 📁 css/
│   └── styles.css       # Extracted visual design and structural responsive layout rules
├── index.html           # Main quick data entry portal & configuration layout shell
├── history.html         # Historical workout timeline dashboard UI
├── manifest.json        # PWA configuration (app metadata, theme colors, launcher icons)
├── sw.js                # Root Service Worker handling resource caching and update listeners
├── tsconfig.json        # Strict TypeScript compiler boundaries and compilation mapping rules
├── vercel.json          # Edge deployment directory output mapping rule routing to root
└── package.json         # Developer command automation script bindings wrapper