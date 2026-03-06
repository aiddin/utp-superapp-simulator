import { getState, setState } from '../core/state.js';
import { MOCK_USERS } from '../core/mock-users.js';

export function renderToolbar(container) {
  container.innerHTML = `
    <div class="brand">
      <div class="brand-logo">U</div>
      <div class="brand-info">
        <h1>UTP Super App</h1>
        <p>Mini-App Simulator v2.0</p>
      </div>
    </div>
    
    <div class="divider-v"></div>
    
    <div class="url-bar">
      <input type="url" id="url-input" class="url-input" placeholder="Enter Mini-App URL (e.g., /demo/demo-miniapp.html)" autocomplete="off" />
      <button class="btn-primary" id="btn-load">Load App</button>
    </div>
    
    <div class="divider-v"></div>
    
    <div class="role-switcher">
      <select id="role-select" class="role-select">
        ${Object.keys(MOCK_USERS).map(role => `
          <option value="${role}" ${getState('currentRole') === role ? 'selected' : ''}>
            ${role.toUpperCase()}
          </option>
        `).join('')}
      </select>
    </div>

    <div class="preview-mode">
      <button id="btn-desktop" class="btn-preview ${getState('previewMode') === 'desktop' ? 'active' : ''}" title="Desktop View">🖥️</button>
      <button id="btn-mobile" class="btn-preview ${getState('previewMode') === 'mobile' ? 'active' : ''}" title="Mobile View">📱</button>
    </div>
  `;

  // Bind Events
  // Note: We'll wire the actual load action in main.js to keep it clean
  document.getElementById('role-select').onchange = (e) => setState('currentRole', e.target.value);
  document.getElementById('btn-desktop').onclick = () => setState('previewMode', 'desktop');
  document.getElementById('btn-mobile').onclick = () => setState('previewMode', 'mobile');
}
