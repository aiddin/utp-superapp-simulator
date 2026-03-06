import { getState, setState, addLogEntry } from '../core/state.js';
import { sendToFrame } from '../core/bridge.js';

let editing = false;

export function renderLocationCard(container) {
  const loc = getState('mockLocation');

  if (editing) {
    renderEditMode(container, loc);
  } else {
    renderViewMode(container, loc);
  }
}

function renderViewMode(container, loc) {
  container.innerHTML = `
    <div class="location-card">
      <div class="location-header">
        <span class="location-title">📍 Mock GPS</span>
        <button class="btn-icon" id="btn-edit-location" title="Edit Location">✏️</button>
      </div>
      <div class="location-fields">
        <div class="loc-field"><span>Lat</span> ${loc.lat}</div>
        <div class="loc-field"><span>Lng</span> ${loc.lng}</div>
        <div class="loc-field"><span>Alt</span> ${loc.alt}m</div>
        <div class="loc-field"><span>Hdg</span> ${loc.heading}°</div>
      </div>
      <div class="loc-campus">${loc.campus}</div>
    </div>
  `;

  document.getElementById('btn-edit-location').onclick = () => {
    editing = true;
    renderLocationCard(container);
  };
}

function renderEditMode(container, loc) {
  container.innerHTML = `
    <div class="location-card location-card-editing">
      <div class="location-header">
        <span class="location-title">📍 Edit Mock GPS</span>
      </div>
      <div class="loc-edit-grid">
        <label class="ctx-edit-field">
          <span>Latitude</span>
          <input type="number" step="any" id="edit-lat" value="${loc.lat}" placeholder="4.3851" />
        </label>
        <label class="ctx-edit-field">
          <span>Longitude</span>
          <input type="number" step="any" id="edit-lng" value="${loc.lng}" placeholder="100.9925" />
        </label>
        <label class="ctx-edit-field">
          <span>Altitude (m)</span>
          <input type="number" step="any" id="edit-alt" value="${loc.alt}" placeholder="100" />
        </label>
        <label class="ctx-edit-field">
          <span>Heading (°)</span>
          <input type="number" step="any" min="0" max="360" id="edit-heading" value="${loc.heading}" placeholder="0" />
        </label>
        <label class="ctx-edit-field ctx-edit-full">
          <span>Campus</span>
          <input type="text" id="edit-campus" value="${loc.campus}" placeholder="UTP Main Campus" />
        </label>
      </div>
      <div class="ctx-edit-actions">
        <button class="btn-secondary" id="btn-loc-cancel">Cancel</button>
        <button class="btn-primary" id="btn-loc-save">Save</button>
      </div>
    </div>
  `;

  document.getElementById('btn-loc-cancel').onclick = () => {
    editing = false;
    renderLocationCard(container);
  };

  document.getElementById('btn-loc-save').onclick = () => {
    const newLoc = {
      lat: parseFloat(document.getElementById('edit-lat').value) || loc.lat,
      lng: parseFloat(document.getElementById('edit-lng').value) || loc.lng,
      alt: parseFloat(document.getElementById('edit-alt').value) || loc.alt,
      heading: parseFloat(document.getElementById('edit-heading').value) || 0,
      campus: document.getElementById('edit-campus').value.trim() || loc.campus,
    };

    setState('mockLocation', newLoc);
    addLogEntry('info', '📍', `Mock GPS updated → ${newLoc.lat}, ${newLoc.lng} — ${newLoc.campus}`);

    editing = false;
    renderLocationCard(container);
  };
}
