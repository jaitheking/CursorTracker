# ⚡ Cursor Performance Tracker

An elegant, high-performance static Progressive Web App (PWA) built to log, format, and export athletic workout sessions cleanly. Designed for rapid data entry with pre-configured fitness baselines, automated local state backups, and cross-platform native sharing capabilities.

---

## 🚀 Features

* **Dual-Mode Tracking**: Specialized logging configurations for both Running sessions and Gym/Strength workouts.
* **Progressive Web App (PWA)**: Installable on iOS, Android, and Desktop platforms. Fully functional offline via custom service worker caching strategies.
* **Data Safety (Auto-Save Caching)**: Built-in state engine automatically saves your input to `localStorage` on every single keystroke, preventing data loss if tabs refresh or close accidentally.
* **Smart Local Export & Share**: Generates a formatted text log file named `{yyyy-mm-dd}.txt` for local device download, with an advanced mobile fallback triggering the native System Share Sheet (`navigator.share`).
* **One-Click Clipboard Sync**: Formats metrics instantly into clean Markdown syntax and copies it straight to the clipboard with visual success confirmation.
* **Body Composition Tracking**: Integrated sub-grid tracking to capture weight, muscle mass, and body fat percentage alongside training logs.

---

## 🛠️ Tech Stack & Engineering Standards

- **Language**: Strict, type-safe **TypeScript (TS)** targeting the modern `ES2022` runtime environment.
- **Styling**: Native CSS3 using modular CSS custom variables for streamlined design updates.
- **Compilation**: High-performance, decoupled setup separating source code files from compiled browser binaries.
- **Hosting Engine**: Optimized for seamless edge-network routing over **Vercel** via static output mappings.

---

## 📂 Project Layout

```text
├── 📁 src/
│   └── app.ts           # Central core type-safe application state logic engine
├── 📁 scripts/
│   └── app.js           # Production browser-optimized compilation binary (Git ignored)
├── 📁 css/
│   └── styles.css       # Extracted visual design and structural responsive layout rules
├── index.html           # Semantically organized static UI markup interface shell
├── manifest.json        # PWA configuration (app metadata, theme colors, launcher icons)
├── sw.js                # Service Worker handling offline resource delivery caching
├── tsconfig.json        # Strict TypeScript compiler constraints configuration mapping
├── vercel.json          # Target build directory deployment instruction routing rule
└── package.json         # Developer command automation script bindings wrapper