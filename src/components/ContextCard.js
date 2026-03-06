import { getState, addLogEntry } from '../core/state.js';
import { MOCK_USERS } from '../core/mock-users.js';

let editing = false;

export function renderContextCard(container) {
  const role = getState('currentRole');
  const user = MOCK_USERS[role];

  if (editing) {
    renderEditMode(container, role, user);
  } else {
    renderViewMode(container, role, user);
  }
}

function renderViewMode(container, role, user) {
  container.innerHTML = `
    <div class="context-card ${role}">
      <div class="context-avatar">${user.name.charAt(0)}</div>
      <div class="context-info">
        <div class="ctx-name">${user.name} <span class="ctx-tag">${user.role.toUpperCase()}</span></div>
        <div class="ctx-meta">Injected as window.__SUPERAPP_USER__</div>
        <div class="ctx-details">
          <div class="ctx-field">UUID: <span class="token-snip" title="${user.uuid}">${user.uuid.substring(0, 8)}...</span></div>
          <div class="ctx-field">ID: <span>${user.id || 'N/A'}</span></div>
          <div class="ctx-field">Email: <span>${user.email}</span></div>
        </div>
      </div>
      <button class="btn-edit-profile btn-icon" id="btn-edit-profile" title="Edit Profile">✏️</button>
    </div>
  `;

  document.getElementById('btn-edit-profile').onclick = () => {
    editing = true;
    renderContextCard(container);
  };
}

function renderEditMode(container, role, user) {
  container.innerHTML = `
    <div class="context-card ${role} context-card-editing">
      <div class="context-edit-form">
        <div class="ctx-edit-title">Edit Profile <span class="ctx-tag">${role.toUpperCase()}</span></div>
        <div class="ctx-edit-grid">
          <label class="ctx-edit-field ctx-edit-full">
            <span>UUID</span>
            <input type="text" id="edit-uuid" value="${user.uuid}" />
          </label>
          <label class="ctx-edit-field">
            <span>Name</span>
            <input type="text" id="edit-name" value="${user.name}" />
          </label>
          <label class="ctx-edit-field">
            <span>ID</span>
            <input type="text" id="edit-id" value="${user.id || ''}" />
          </label>
          <label class="ctx-edit-field">
            <span>Email</span>
            <input type="email" id="edit-email" value="${user.email}" />
          </label>
          <label class="ctx-edit-field">
            <span>Role</span>
            <select id="edit-role" class="ctx-edit-select">
              <option value="student" ${user.role === 'student' ? 'selected' : ''}>Student</option>
              <option value="lecturer" ${user.role === 'lecturer' ? 'selected' : ''}>Lecturer</option>
              <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>Staff</option>
            </select>
          </label>
        </div>
        <div class="ctx-edit-actions">
          <button class="btn-secondary" id="btn-edit-cancel">Cancel</button>
          <button class="btn-primary" id="btn-edit-save">Save & Reload</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-edit-cancel').onclick = () => {
    editing = false;
    renderContextCard(container);
  };

  document.getElementById('btn-edit-save').onclick = () => {
    // Update the mock user object in-place
    user.uuid  = document.getElementById('edit-uuid').value.trim() || user.uuid;
    user.name  = document.getElementById('edit-name').value.trim() || user.name;
    user.id    = document.getElementById('edit-id').value.trim() || user.id;
    user.email = document.getElementById('edit-email').value.trim() || user.email;
    user.role  = document.getElementById('edit-role').value.trim() || user.role;

    addLogEntry('info', '👤', `Profile updated → ${user.name} | ${user.role} | ${user.id} | ${user.email}`);

    editing = false;
    renderContextCard(container);

    // Update shell UI (avatar, version bar)
    const avatar = document.getElementById('chrome-avatar');
    if (avatar) avatar.textContent = user.name.charAt(0);
    const versionBar = document.getElementById('version-bar-container');
    if (versionBar) versionBar.innerHTML = `Connected: <strong>${user.name}</strong> | Bridge Contract v1.0`;

    // Reload the mini-app with updated context
    // Must replace the iframe entirely — setting iframe.name on an existing
    // iframe does NOT update window.name inside the browsing context, so the
    // SDK would still read the stale user from the old window.name value.
    const currentUrl = getState('currentUrl');
    if (currentUrl) {
      const frame = document.getElementById('mini-app-frame');
      if (frame) {
        const contextPayload = JSON.stringify({
          __SUPERAPP_USER__: user,
          __SUPERAPP_TOKEN__: user.token,
          __SUPERAPP_ROLE__: user.role
        });
        const parent = frame.parentNode;
        const newFrame = document.createElement('iframe');
        newFrame.id = 'mini-app-frame';
        newFrame.allow = frame.allow;
        newFrame.referrerPolicy = frame.referrerPolicy;
        newFrame.name = contextPayload;
        parent.replaceChild(newFrame, frame);
        newFrame.src = currentUrl;
      }
    }
  };
}
