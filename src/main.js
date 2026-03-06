import { getState, subscribe, setState, addLogEntry } from './core/state.js';
import { initBridge, sendContextToFrame } from './core/bridge.js';
import { MOCK_USERS } from './core/mock-users.js';
import { renderToolbar } from './components/Toolbar.js';
import { renderPhoneFrame } from './components/PhoneFrame.js';
import { renderLogHeader, appendLogEntry } from './components/LogPanel.js';
import { renderContextCard } from './components/ContextCard.js';
import { renderLogFilters } from './components/LogFilters.js';
import { renderLocationCard } from './components/LocationCard.js';

/**
 * Main Simulator Application
 */
class SimulatorApp {
  constructor() {
    this.init();
  }

  init() {
    // 1. Initial Render
    this.render();

    // 2. Initialize Bridge
    initBridge({
      frame: document.getElementById('mini-app-frame'),
      onToast: this.handleToast.bind(this),
      onLoading: this.handleLoading.bind(this),
      onAppReady: this.handleAppReady.bind(this)
    });

    // 3. Wire Component Actions
    this.wireEvents();

    // 4. Subscriptions
    this.setupSubscriptions();

    // 5. Resizable Side Panel
    this.initResize();

    addLogEntry('ok', '✓', 'Simulator Core Initialized v2.0');
  }

  render() {
    renderToolbar(document.getElementById('toolbar-container'));
    renderPhoneFrame(document.getElementById('phone-container'));
    renderLogHeader(document.getElementById('log-header-container'));
    renderContextCard(document.getElementById('context-card-container'));
    renderLocationCard(document.getElementById('location-card-container'));
    renderLogFilters(document.getElementById('log-filters-container'));
    
    this.wireChromeEvents();
    this.updateShellUI();
  }

  wireEvents() {
    // Handle URL load from toolbar
    const toolbar = document.getElementById('toolbar-container');
    
    const triggerLoad = () => {
      const urlInput = document.getElementById('url-input');
      const url = urlInput?.value.trim();
      if (url) this.loadMiniApp(url);
    };

    toolbar.addEventListener('click', (e) => {
      if (e.target.id === 'btn-load') triggerLoad();
    });

    toolbar.addEventListener('keydown', (e) => {
      if (e.target.id === 'url-input' && e.key === 'Enter') triggerLoad();
    });
  }

  setupSubscriptions() {
    // Log entries update
    subscribe('logEntries', (logs, entry) => {
      const body = document.getElementById('log-body');
      const header = document.getElementById('log-header-container');
      const activeFilter = getState('activeFilter') || 'all';
      
      if (entry === null) {
        body.innerHTML = '';
      } else if (entry) {
        // Only append if it matches current filter
        if (activeFilter === 'all' || entry.cls === activeFilter) {
          appendLogEntry(body, entry);
        }
      }
      renderLogHeader(header);
    });

    // Filter update
    subscribe('activeFilter', (filter) => {
      const body = document.getElementById('log-body');
      const filters = document.getElementById('log-filters-container');
      const logs = getState('logEntries');
      
      renderLogFilters(filters);
      body.innerHTML = '';
      
      logs.forEach(e => {
        if (filter === 'all' || e.cls === filter) {
          appendLogEntry(body, e);
        }
      });
    });

    // Preview mode updates
    subscribe('previewMode', (mode) => {
      const frameContainer = document.getElementById('phone-container');
      const toolbarContainer = document.getElementById('toolbar-container');

      renderPhoneFrame(frameContainer);
      renderToolbar(toolbarContainer);
      this.wireChromeEvents();

      // Reload via loadMiniApp to preserve context injection
      const currentUrl = getState('currentUrl');
      if (currentUrl) {
        this.loadMiniApp(currentUrl);
      }
    });

    // Role updates
    subscribe('currentRole', (role) => {
      const contextContainer = document.getElementById('context-card-container');
      const toolbarContainer = document.getElementById('toolbar-container');
      
      addLogEntry('info', '👤', `Switched session to: ${role.toUpperCase()}`);
      
      renderContextCard(contextContainer);
      renderToolbar(toolbarContainer);
      this.wireChromeEvents();
      this.updateShellUI();
      
      // Reload current app with new role context
      if (getState('currentUrl')) {
        this.loadMiniApp(getState('currentUrl'));
      }
    });
  }

  updateShellUI() {
    const role = getState('currentRole');
    const user = MOCK_USERS[role];

    const versionBar = document.getElementById('version-bar-container');
    if (versionBar) {
      versionBar.innerHTML = `Connected: <strong>${user.name}</strong> | Bridge Contract v1.0`;
    }
  }

  async loadMiniApp(url) {
    setState('currentUrl', url);
    const frame = document.getElementById('mini-app-frame');
    const overlay = document.getElementById('loading-overlay');
    const chromeTitle = document.getElementById('chrome-title');
    const chromeSub = document.getElementById('chrome-sub');
    
    if (overlay) overlay.style.display = 'flex';
    if (chromeTitle) chromeTitle.textContent = 'Loading...';
    if (chromeSub) chromeSub.textContent = url;

    // URL Rewriting for Proxy (Fix for Oracle APEX Redirect Loop)
    let processedUrl = url;
    if (url.includes('oracleapex.com/ords')) {
      processedUrl = url.replace(/https?:\/\/oracleapex.com/, '');
      addLogEntry('info', '🛰️', `Proxy active: Rewrote to ${processedUrl}`);
    }

    addLogEntry('info', 'ℹ️', `Requesting: ${processedUrl}`);

    // Resolve Context for the role
    const role = getState('currentRole');
    const user = MOCK_USERS[role];
    
    // Delivery via window.name for context injection
    // window.name works cross-origin, so inject for ALL URLs
    const contextPayload = JSON.stringify({
      __SUPERAPP_USER__: user,
      __SUPERAPP_TOKEN__: user.token,
      __SUPERAPP_ROLE__: user.role
    });
    addLogEntry('info', 'ℹ️', `Context injected via window.name for ${user.name} (${user.role})`);

    if (frame) {
      // Hard Reset the iframe to clear any stuck redirects or listeners
      const parent = frame.parentNode;
      const newFrame = document.createElement('iframe');
      newFrame.id = 'mini-app-frame';
      newFrame.allow = frame.allow;
      newFrame.referrerPolicy = frame.referrerPolicy;

      // Set window.name on the NEW frame BEFORE setting src
      // This ensures context is available when the page loads
      newFrame.name = contextPayload;

      parent.replaceChild(newFrame, frame);

      newFrame.onload = () => {
        // Send context via postMessage (works for all cross-origin/nested iframes)
        // Use a small delay to ensure SDK has loaded
        setTimeout(() => {
          sendContextToFrame(user);
        }, 100);

        // Also try window.name as fallback (for compatibility)
        try {
          newFrame.contentWindow.name = contextPayload;
          newFrame.contentWindow.__SUPERAPP_USER__ = user;
          newFrame.contentWindow.__SUPERAPP_TOKEN__ = user.token;
          newFrame.contentWindow.__SUPERAPP_ROLE__ = user.role;
          addLogEntry('info', '🔧', 'Injected context via window variables (same-origin)');
        } catch (e) {
          // Cross-origin: postMessage is the primary method
          addLogEntry('info', 'ℹ️', 'Cross-origin detected, using postMessage for context');
        }

        if (overlay) overlay.style.display = 'none';
        if (chromeTitle && chromeTitle.textContent === 'Loading...') {
          chromeTitle.textContent = 'Mini-App';
        }
        addLogEntry('ok', '✓', 'Mini-App Navigation Complete');
      };

      newFrame.src = processedUrl;
    }
  }

  handleToast(message) {
    addLogEntry('event', '💬', `Shell Toast: "${message}"`);
    const toastEl = document.getElementById('toast');
    if (toastEl) {
      toastEl.textContent = message;
      toastEl.style.display = 'block';
      setTimeout(() => { toastEl.style.display = 'none'; }, 3000);
    }
  }

  handleLoading(show, text) {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    if (overlay) {
      overlay.style.display = show ? 'flex' : 'none';
      if (text && loadingText) loadingText.textContent = text;
    }
  }

  handleAppReady(title) {
    const chromeTitle = document.getElementById('chrome-title');
    if (title && chromeTitle) {
      chromeTitle.textContent = title;
    }
    addLogEntry('ok', '✓', 'Protocol: MINI_APP_READY');
  }

  initResize() {
    const handle = document.getElementById('resize-handle');
    const panel = document.getElementById('side-panel');
    if (!handle || !panel) return;

    const MIN_WIDTH = 280;
    const MAX_WIDTH = window.innerWidth * 0.75;
    let startX, startWidth;

    const onMouseMove = (e) => {
      const delta = startX - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      panel.style.width = newWidth + 'px';
    };

    const onMouseUp = () => {
      handle.classList.remove('dragging');
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = panel.getBoundingClientRect().width;
      handle.classList.add('dragging');
      document.body.classList.add('resizing');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  wireChromeEvents() {
    const btnBack = document.getElementById('btn-chrome-back');
    const btnRefresh = document.getElementById('btn-chrome-refresh');
    const btnMenu = document.getElementById('btn-chrome-menu');
    const quickMenu = document.getElementById('quick-menu');
    const backdrop = document.getElementById('quick-menu-backdrop');

    if (btnBack) {
      btnBack.onclick = () => simulateShellEvent('go-back', {});
    }

    if (btnRefresh) {
      btnRefresh.onclick = () => {
        const currentUrl = getState('currentUrl');
        if (currentUrl) this.loadMiniApp(currentUrl);
      };
    }

    // Quick Menu toggle
    const openMenu = () => {
      quickMenu.classList.add('open');
      backdrop.style.display = 'block';
    };

    const closeMenu = () => {
      quickMenu.classList.remove('open');
      backdrop.style.display = 'none';
    };

    if (btnMenu) btnMenu.onclick = openMenu;
    if (backdrop) backdrop.onclick = closeMenu;

    // Quick Menu actions
    if (quickMenu) {
      quickMenu.onclick = (e) => {
        const item = e.target.closest('[data-action]');
        if (!item) return;
        closeMenu();

        switch (item.dataset.action) {
          case 'refresh': {
            const url = getState('currentUrl');
            if (url) this.loadMiniApp(url);
            break;
          }
          case 'scan-qr':
            simulateShellEvent('scan-qr', {});
            // Trigger SCAN_QR via bridge for the mini-app
            addLogEntry('info', '📷', 'Quick Menu: triggered SCAN_QR');
            break;
          case 'location':
            simulateShellEvent('location', {});
            addLogEntry('info', '📍', 'Quick Menu: triggered GET_LOCATION');
            break;
          case 'open-tab': {
            const url = getState('currentUrl');
            if (url) window.open(url, '_blank');
            break;
          }
          case 'go-back':
            simulateShellEvent('go-back', {});
            break;
        }
      };
    }
  }
}

// Start the app
new SimulatorApp();
