# UTP Super App — Mini-App Simulator v2.0

A powerful, modular web-based simulator for developing and testing mini-apps against the `SuperApp` SDK.

## 🚀 Enhancements (v2.0)

- **Vite-Powered**: Fast development with Hot Module Replacement (HMR).
- **Modular Architecture**: Clean separation of state, bridge logic, and UI components.
- **Reactive State**: Centralized store with a subscriber pattern for UI updates.
- **Improved Bridge**: Robust `postMessage` handling with better logging and error recovery.
- **Multi-Role Testing**: Easily switch between Student, Lecturer, and Staff contexts.
- **Responsive Preview**: Toggle between Desktop and Mobile frames instantly.
- **Polished UI**: Modern, glassmorphism-inspired design with a rich event log.

## 🛠️ Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Load a Mini-App
- Default demo: `http://localhost:5173/demo/demo-miniapp.html`
- Or paste your own local/remote URL into the URL bar.

## 📁 Structure

- `src/core/`: The "Brain" (State, Bridge logic, Mock Data).
- `src/components/`: Reusable UI modules (Toolbar, Phone Frame, Log Panel).
- `public/`: Static assets, including the `superapp.js` SDK (v1.0 with cross-origin APEX support).
- `demo/`: A sample mini-app to verify SDK functionality.

## 📦 Included SDK

The simulator includes a local copy of the Super App SDK (`public/superapp.js`) with enhanced cross-origin support for Oracle APEX integration. This SDK:

- Supports cross-origin iframe communication via `window.name`
- Works with both Flutter Shell and Web Simulator environments
- Includes full postMessage bridge for Shell services
- Handles APEX redirect scenarios correctly

Mini-apps loaded in the simulator automatically have access to this SDK.

## 🧪 Bridge Actions Supported

| Category | Actions |
|----------|---------|
| **AUTH** | `getUser`, `getScopedToken` |
| **UI** | `TOAST`, `LOADING` |
| **CAMERA** | `SCAN_QR`, `TAKE_PHOTO`, `RECORD_VIDEO`, `PICK_PHOTO`, `PICK_VIDEO` |
| **LOCATION** | `LOCATION_GET` |
| **STORAGE** | `STORAGE_SET`, `STORAGE_GET`, `STORAGE_REMOVE`, `STORAGE_CLEAR` |
| **NOTIFY** | `LOCAL_NOTIFY`, `SCHEDULE_NOTIFY`, `CANCEL_NOTIFY` |
| **AI** | `AI_CHAT`, `AI_COMPLETE` |
| **NAV** | `GO_BACK`, `OPEN_APP` |
| **SYSTEM** | `SHELL_EVENT` (push logic) |

## 🎛️ Interactive Modals

The Simulator provides interactive modals for SDK calls that require user input:

### QR Scanner (`SCAN_QR`)
When a Mini-App calls `SuperApp.camera.scanQR()`, a modal appears where you can:
- Enter a URL, deeplink (`superapp://app/<appId>`), JSON, or plain text
- The SDK parses the result into `{ type, value, parsed? }` format

### Camera / Photo Picker (`TAKE_PHOTO`, `PICK_PHOTO`)
When a Mini-App calls `SuperApp.camera.takePhoto()` or `pickPhoto()`:
- A modal appears for drag-and-drop or file browsing
- Selected image is sent back as base64 data to the Mini-App

## 🔔 Shell Event Simulation

Use the toolbar to simulate Shell → Mini-App lifecycle events:

| Event | Trigger | Effect |
|-------|---------|--------|
| `notification` | Click "Send Notification" | Fires `SuperApp.on('notification', ...)` with mock payload |
| `logout` | Click "Simulate Logout" | Fires `SuperApp.on('logout', ...)` |
| `resume` | Click "Simulate Resume" | Fires `SuperApp.on('resume', ...)` |
| `themeChange` | Toggle dark mode | Fires `SuperApp.on('themeChange', ...)` |

## 📝 Event Log

The Log Panel captures all SDK activity in real-time:

- **← Sent** — Messages from Mini-App → Shell
- **→ Received** — Responses from Shell → Mini-App
- **✓ Success** — Confirmed actions
- **⚠ Warning** — Cancelled actions or unknown commands
- **🔔 Event** — Notification-related actions

Filter by category using the log filter buttons.
