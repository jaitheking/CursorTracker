# ⚡ Cursor Performance Tracker

An elegant, high-performance static Progressive Web App (PWA) built to log, format, and export athletic workout sessions cleanly. Designed for rapid data entry with pre-configured fitness baselines.

---

## 🚀 Features

*   **Dual-Mode Tracking**: Specialized logging configurations for both Running sessions and Gym/Strength workouts.
*   **Progressive Web App (PWA)**: Installable on iOS, Android, and Desktop platforms. Fully functional offline via custom service worker caching strategies.
*   **One-Click Export**: Formats data into clean Markdown structures and copies directly to your clipboard for easy external logging.
*   **Body Composition Tracking**: Integrated fields to track weight, muscle mass, and body fat percentage alongside workout performance[cite: 1].

---

## 📂 Project Structure

```text
├── index.html         # Main user interface, application logic, and service worker registration
├── manifest.json      # PWA configuration (app metadata, theme colors, and launcher icons)
└── sw.js              # Service Worker handling offline caching and resource delivery