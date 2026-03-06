import { getState, setState } from '../core/state.js';

export function renderLogFilters(container) {
  const activeFilter = getState('activeFilter') || 'all';
  
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'sent', label: '↑ Out' },
    { id: 'received', label: '↓ In' },
    { id: 'event', label: '📢 Events' },
    { id: 'info', label: 'ℹ️ Info' }
  ];

  container.innerHTML = `
    <div class="filter-tabs">
      ${filters.map(f => `
        <button class="filter-tab ${activeFilter === f.id ? 'active' : ''}" data-filter="${f.id}">
          ${f.label}
        </button>
      `).join('')}
    </div>
  `;

  // Bind Events
  container.querySelectorAll('.filter-tab').forEach(btn => {
    btn.onclick = () => {
      setState('activeFilter', btn.dataset.filter);
    };
  });
}
