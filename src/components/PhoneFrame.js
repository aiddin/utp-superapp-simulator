import { getState } from '../core/state.js';
import { simulateShellEvent } from '../core/bridge.js';

export function renderPhoneFrame(container) {
  const previewMode = getState('previewMode');
  
  container.innerHTML = `
    <div class="phone-frame ${previewMode}" id="phone-frame">
      <div class="phone-screen">
        <div class="phone-status-bar">
          <span id="clock">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span>5G / WiFi / 🔋</span>
        </div>
        <div class="phone-chrome">
          <button class="chrome-back" id="btn-chrome-back" title="Go Back">←</button>
          <div class="chrome-info">
            <div class="chrome-title" id="chrome-title">Simulator</div>
            <div class="chrome-sub" id="chrome-sub">Ready to load</div>
          </div>
          <button class="chrome-refresh" id="btn-chrome-refresh" title="Refresh App">↻</button>
          <button class="chrome-kebab" id="btn-chrome-menu" title="Quick Menu">
            <span></span><span></span><span></span>
          </button>
        </div>
        <div class="webview-container">
          <iframe id="mini-app-frame" allow="camera; geolocation; storage-access; clipboard-write; microphone" referrerpolicy="no-referrer-when-downgrade"></iframe>
          <div id="loading-overlay" class="overlay" style="display:none">
            <div class="spinner"></div>
            <p id="loading-text">Loading Mini-App...</p>
            <div class="troubleshoot-hint">
              <p>Stuck in a redirect loop?</p>
              <a href="#" id="link-open-new-tab" target="_blank">🚀 Open in New Tab to Init Session</a>
            </div>
          </div>
          <div id="toast" class="toast"></div>

          <!-- Quick Menu Bottom Sheet -->
          <div class="quick-menu-backdrop" id="quick-menu-backdrop" style="display:none"></div>
          <div class="quick-menu" id="quick-menu">
            <div class="quick-menu-handle"></div>
            <button class="quick-menu-item" data-action="refresh">↻  Refresh App</button>
            <button class="quick-menu-item" data-action="scan-qr">📷  Scan QR</button>
            <button class="quick-menu-item" data-action="location">📍  Get Location</button>
            <button class="quick-menu-item" data-action="open-tab">🚀  Open in New Tab</button>
            <button class="quick-menu-item" data-action="go-back">←  Go Back</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-chrome-back').onclick = () => simulateShellEvent('go-back', {});
}
