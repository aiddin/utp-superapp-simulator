/**
 * Bridge Handler — Shell-side postMessage logic
 * 
 * The Simulator acts as the Shell. It listens for every SDK postMessage
 * and responds exactly as the Flutter Shell would.
 * 
 * Bridge actions handled:
 *   MINI_APP_READY, GO_BACK, OPEN_APP, TOAST, LOADING,
 *   LOCAL_NOTIFY, SCHEDULE_NOTIFY, CANCEL_NOTIFY,
 *   SCAN_QR, LOCATION_GET, AI_CHAT, AI_COMPLETE
 */

import { addLogEntry, getState } from './state.js';

/** @type {HTMLIFrameElement|null} */
let frameRef = null;

/** @type {Function|null} */
let onToast = null;

/** @type {Function|null} */
let onLoading = null;

/** @type {Function|null} */
let onGoBack = null;

/** @type {Function|null} */
let onAppReady = null;

/**
 * Initialize the bridge with references and callbacks.
 * @param {object} opts
 * @param {HTMLIFrameElement} opts.frame - The mini-app iframe
 * @param {Function} opts.onToast - (message) => void
 * @param {Function} opts.onLoading - (show, text) => void
 * @param {Function} opts.onGoBack - () => void
 * @param {Function} opts.onAppReady - (title) => void
 */
export function initBridge(opts) {
  frameRef  = opts.frame;
  onToast   = opts.onToast;
  onLoading = opts.onLoading;
  onGoBack  = opts.onGoBack;
  onAppReady = opts.onAppReady;

  window.addEventListener('message', handleMessage);
}

/**
 * Send a message from Shell → Mini-App (via iframe postMessage).
 * @param {object} msg 
 */
export function sendToFrame(msg) {
  // Always get fresh iframe reference to handle iframe replacement on page reload
  const frame = document.getElementById('mini-app-frame');
  if (frame && frame.contentWindow) {
    frame.contentWindow.postMessage(msg, '*');
  }
}

/**
 * Send user context to Mini-App via postMessage.
 * This is more reliable than window.name for cross-origin/nested iframes.
 * @param {object} user - Mock user object
 */
export function sendContextToFrame(user) {
  const msg = {
    action: 'CONTEXT_INJECT',
    context: {
      __SUPERAPP_USER__: user,
      __SUPERAPP_TOKEN__: user.token,
      __SUPERAPP_ROLE__: user.role
    }
  };
  sendToFrame(msg);
  addLogEntry('info', '📨', `Context sent via postMessage: ${user.name} (${user.role})`);
}

/**
 * Simulate a Shell → Mini-App lifecycle event.
 * @param {string} eventName - 'notification' | 'logout' | 'themeChange' | 'resume'
 * @param {*} payload
 */
export function simulateShellEvent(eventName, payload) {
  const msg = {
    action: 'SHELL_EVENT',
    event: eventName,
    payload: payload || null,
  };
  sendToFrame(msg);
  addLogEntry('received', '→',
    `SHELL_EVENT: ${eventName}${payload ? ' ' + JSON.stringify(payload) : ''}`
  );
}

/**
 * Format a payload summary for the event log.
 * @param {object} payload 
 * @returns {string}
 */
function formatPayloadSummary(payload) {
  if (!payload || !Object.keys(payload).length) return '';

  const keys = Object.keys(payload).filter(k => k !== '_msgId');
  if (!keys.length) return '';

  const parts = keys.slice(0, 3).map(k => {
    let v = payload[k];
    if (typeof v === 'string') {
      v = `"${v.slice(0, 30)}${v.length > 30 ? '…' : ''}"`;
    }
    if (Array.isArray(v)) v = `[${v.length} items]`;
    if (typeof v === 'object' && v !== null) v = '{…}';
    return `${k}: ${v}`;
  });

  return ` { ${parts.join(', ')}${keys.length > 3 ? ', …' : ''} }`;
}

/**
 * Core message handler — processes all SDK postMessages.
 * @param {MessageEvent} event 
 */
function handleMessage(event) {
  const data = event.data;
  if (!data || typeof data !== 'object' || !data._superapp) return;

  const action  = data.action;
  const payload = data.payload || {};

  // Log every incoming message from Mini-App
  addLogEntry('sent', '←', `${action}${formatPayloadSummary(payload)}`);

  switch (action) {
    case 'MINI_APP_READY':
      addLogEntry('ok', '✓', 'Mini-App SDK initialised successfully');
      if (onAppReady) {
        // Try to read page title from iframe
        let title = '';
        try {
          title = frameRef.contentDocument?.title || '';
        } catch (e) { /* cross-origin */ }
        onAppReady(title);
      }
      break;

    case 'GO_BACK':
      addLogEntry('info', 'ℹ', 'Shell: GO_BACK received — showing return overlay');
      if (onGoBack) onGoBack();
      break;

    case 'OPEN_APP':
      addLogEntry('info', 'ℹ', `Shell: would open Mini-App id="${payload.appId}"`);
      if (onToast) onToast(`🚀 Opening: ${payload.appId}`);
      break;

    case 'TOAST':
      if (onToast) onToast(payload.message);
      addLogEntry('info', 'ℹ', `Toast displayed: "${payload.message}"`);
      break;

    case 'LOADING':
      if (onLoading) onLoading(payload.show, 'Processing…');
      addLogEntry('info', 'ℹ', `Loading overlay: ${payload.show ? 'ON' : 'OFF'}`);
      break;

    case 'LOCAL_NOTIFY':
      addLogEntry('event', '🔔', `LOCAL_NOTIFY: "${payload.title}" — ${payload.body}`);
      if (onToast) onToast(`🔔 ${payload.title}`);
      break;

    case 'SCHEDULE_NOTIFY':
      addLogEntry('event', '⏰', `SCHEDULE_NOTIFY: "${payload.title}" at ${payload.at}`);
      if (onToast) onToast(`⏰ Scheduled: ${payload.title}`);
      break;

    case 'CANCEL_NOTIFY':
      addLogEntry('event', '✕', `CANCEL_NOTIFY id=${payload.id}`);
      break;

    case 'SCAN_QR':
      addLogEntry('info', '📷', 'Shell: opening QR scanner — waiting for link input…');
      showQRModal(payload._msgId);
      break;

    case 'CAMERA_GET':
    case 'GET_PHOTO':
    case 'TAKE_PHOTO':
      addLogEntry('info', '📷', `Shell: ${action} — waiting for user input…`);
      showCameraModal(payload._msgId, action + '_REPLY');
      break;

    case 'LOCATION_GET': {
      const loc = getState('mockLocation');
      addLogEntry('info', 'ℹ', 'Shell: reading GPS (simulated)…');
      setTimeout(() => {
        const reply = {
          action: 'LOCATION_REPLY',
          _msgId: payload._msgId,
          lat: loc.lat,
          lng: loc.lng,
          altitude: loc.alt,
          heading: loc.heading,
          campus: loc.campus,
        };
        sendToFrame(reply);
        addLogEntry('received', '→', `LOCATION_REPLY: ${loc.lat}, ${loc.lng} HEADING: ${loc.heading}°  ALTITUDE: ${loc.alt}m — ${loc.campus}`);
      }, 120);
      break;
    }

    case 'AI_CHAT':
      addLogEntry('info', 'ℹ',
        `AI_CHAT: ${payload.messages?.length || 0} message(s)` +
        (payload.model ? `, model=${payload.model}` : '') +
        ' — SDK fallback fires in 800ms'
      );
      // Let the SDK's own 800ms fallback produce the response
      break;

    case 'AI_COMPLETE':
      addLogEntry('info', 'ℹ',
        `AI_COMPLETE: "${(payload.prompt || '').slice(0, 50)}…"` +
        ' — SDK fallback fires in 800ms'
      );
      break;

    case 'STORAGE_SET': {
      const key = payload.key;
      const value = payload.value;
      addLogEntry('info', '💾', `STORAGE_SET: ${key} = "${value}"`);
      // Intercept miniapp_title to update chrome bar
      if (key === 'miniapp_title' && value) {
        const chromeTitle = document.getElementById('chrome-title');
        if (chromeTitle) chromeTitle.textContent = value;
        addLogEntry('ok', '✓', `App title set: "${value}"`);
      }
      sendToFrame({ action: 'STORAGE_SET_REPLY', _msgId: payload._msgId, data: true });
      break;
    }

    case 'STORAGE_GET':
      addLogEntry('info', '💾', `STORAGE_GET: ${payload.key}`);
      sendToFrame({ action: 'STORAGE_GET_REPLY', _msgId: payload._msgId, data: null });
      break;

    case 'STORAGE_REMOVE':
      addLogEntry('info', '💾', `STORAGE_REMOVE: ${payload.key}`);
      sendToFrame({ action: 'STORAGE_REMOVE_REPLY', _msgId: payload._msgId, data: true });
      break;

    case 'STORAGE_CLEAR':
      addLogEntry('info', '💾', 'STORAGE_CLEAR');
      sendToFrame({ action: 'STORAGE_CLEAR_REPLY', _msgId: payload._msgId, data: true });
      break;

    default:
      addLogEntry('warn', '⚠', `Unknown action: ${action}`);
  }
}

/**
 * Show the camera modal for the user to pick a photo.
 * @param {string} msgId - Original message ID to echo back
 * @param {string} replyAction - The action name for the reply
 */
function showCameraModal(msgId, replyAction) {
  const modal = document.getElementById('camera-modal');
  const dropZone = document.getElementById('camera-drop-zone');
  const fileInput = document.getElementById('camera-file-input');
  const preview = document.getElementById('camera-preview');
  const prompt = dropZone.querySelector('.camera-drop-prompt');
  const sendBtn = document.getElementById('btn-camera-send');
  const cancelBtn = document.getElementById('btn-camera-cancel');
  const closeBtn = document.getElementById('btn-camera-close');

  let selectedBase64 = null;

  const reset = () => {
    modal.style.display = 'none';
    preview.style.display = 'none';
    prompt.style.display = '';
    sendBtn.disabled = true;
    fileInput.value = '';
    selectedBase64 = null;
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      selectedBase64 = e.target.result;
      preview.src = selectedBase64;
      preview.style.display = 'block';
      prompt.style.display = 'none';
      sendBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  };

  // Show modal
  modal.style.display = 'flex';

  // Click to browse
  dropZone.onclick = () => fileInput.click();
  fileInput.onchange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };

  // Drag & drop
  dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
  dropZone.ondragleave = () => dropZone.classList.remove('dragover');
  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  // Send
  sendBtn.onclick = () => {
    if (!selectedBase64) return;
    const reply = {
      action: replyAction,
      _msgId: msgId,
      data: selectedBase64,
    };
    sendToFrame(reply);
    addLogEntry('received', '→', `${replyAction}: image sent (${(selectedBase64.length / 1024).toFixed(1)} KB)`);
    reset();
  };

  // Cancel / close
  cancelBtn.onclick = () => {
    addLogEntry('warn', '⚠', `Camera cancelled by user`);
    const reply = { action: replyAction, _msgId: msgId, data: null, error: 'cancelled' };
    sendToFrame(reply);
    reset();
  };
  closeBtn.onclick = cancelBtn.onclick;

  // Close on backdrop click
  modal.onclick = (e) => { if (e.target === modal) cancelBtn.onclick(); };
}

/**
 * Show the QR scanner modal — user enters a link instead of scanning.
 * @param {string} msgId - Original message ID to echo back
 */
function showQRModal(msgId) {
  const modal = document.getElementById('qr-modal');
  const input = document.getElementById('qr-link-input');
  const sendBtn = document.getElementById('btn-qr-send');
  const cancelBtn = document.getElementById('btn-qr-cancel');
  const closeBtn = document.getElementById('btn-qr-close');

  const reset = () => {
    modal.style.display = 'none';
    input.value = '';
    sendBtn.disabled = true;
  };

  const submit = () => {
    const link = input.value.trim();
    if (!link) return;
    const reply = {
      action: 'SCAN_QR_REPLY',
      _msgId: msgId,
      data: link,
    };
    sendToFrame(reply);
    addLogEntry('received', '→', `SCAN_QR_REPLY: "${link}"`);
    reset();
  };

  // Show modal & focus
  modal.style.display = 'flex';
  setTimeout(() => input.focus(), 50);

  // Enable button when input has value
  input.oninput = () => { sendBtn.disabled = !input.value.trim(); };

  // Submit on Enter
  input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };

  // Send
  sendBtn.onclick = submit;

  // Cancel / close
  const cancel = () => {
    addLogEntry('warn', '⚠', 'QR scan cancelled by user');
    sendToFrame({ action: 'SCAN_QR_REPLY', _msgId: msgId, data: null, error: 'cancelled' });
    reset();
  };
  cancelBtn.onclick = cancel;
  closeBtn.onclick = cancel;
  modal.onclick = (e) => { if (e.target === modal) cancel(); };
}

/**
 * Destroy the bridge — remove event listener.
 */
export function destroyBridge() {
  window.removeEventListener('message', handleMessage);
  frameRef = null;
}
