import { getState, clearLogEntries } from '../core/state.js';

export function renderLogHeader(container) {
  const count = getState('logEntries').length;
  
  container.innerHTML = `
    <div class="log-title-wrap">
      <span class="log-dot"></span>
      <span class="log-title">SDK EVENT LOG</span>
      <span class="log-count">${count}</span>
    </div>
    <div class="log-actions">
      <button id="btn-expand-log" class="btn-icon" title="Expand Log Panel">⬆️</button>
      <button id="btn-fullscreen-log" class="btn-icon" title="Fullscreen Log">⛶</button>
      <button id="btn-copy-log" class="btn-icon" title="Copy Log">📋</button>
      <button id="btn-clear-log" class="btn-icon" title="Clear Log">🗑️</button>
    </div>
  `;

  document.getElementById('btn-clear-log').onclick = clearLogEntries;
  document.getElementById('btn-copy-log').onclick = () => {
    const logs = getState('logEntries').map(e => `[${e.ts}] ${e.dir} ${e.msg}`).join('\n');
    navigator.clipboard.writeText(logs).then(() => alert('Log copied to clipboard!'));
  };

  // Expand — hides context card, gives log full panel height
  document.getElementById('btn-expand-log').onclick = () => {
    const panel = document.querySelector('.side-panel');
    panel.classList.toggle('log-expanded');
    const btn = document.getElementById('btn-expand-log');
    btn.textContent = panel.classList.contains('log-expanded') ? '⬇️' : '⬆️';
    btn.title = panel.classList.contains('log-expanded') ? 'Collapse Log Panel' : 'Expand Log Panel';
  };

  // Fullscreen — log panel takes over the entire viewport
  document.getElementById('btn-fullscreen-log').onclick = () => {
    const panel = document.querySelector('.side-panel');
    panel.classList.toggle('log-fullscreen');
    const btn = document.getElementById('btn-fullscreen-log');
    btn.textContent = panel.classList.contains('log-fullscreen') ? '⛶' : '⛶';
    btn.title = panel.classList.contains('log-fullscreen') ? 'Exit Fullscreen' : 'Fullscreen Log';
  };
}

export function appendLogEntry(logBody, entry) {
  if (!logBody) return;
  
  const row = document.createElement('div');
  row.className = `log-entry ${entry.cls}`;
  
  const escapedMsg = entry.msg
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  row.innerHTML = `
    <span class="log-ts">${entry.ts}</span>
    <span class="log-dir">${entry.dir}</span>
    <span class="log-msg">${escapedMsg}</span>
  `;

  row.addEventListener('click', () => row.classList.toggle('expanded'));

  logBody.appendChild(row);
  logBody.scrollTop = logBody.scrollHeight;
}
