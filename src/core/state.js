/**
 * Centralized Simulator State
 * 
 * Reactive state store with subscriber pattern.
 * Components subscribe to state changes and re-render when relevant data changes.
 */

const state = {
  currentRole:  'student',
  currentUrl:   '',
  previewMode:  'desktop',   // 'desktop' | 'mobile'
  appLoaded:    false,
  logEntries:   [],          // { cls, dir, msg, ts }
  activeFilter: 'all',       // 'all' | 'sent' | 'received' | 'info'
  mockLocation: { lat: 4.3851, lng: 100.9925, alt: 100, heading: 0, campus: 'UTP Main Campus' },
};

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

/**
 * Get current state value.
 * @param {string} key 
 * @returns {*}
 */
export function getState(key) {
  return state[key];
}

/**
 * Update state and notify subscribers.
 * @param {string} key 
 * @param {*} value 
 */
export function setState(key, value) {
  const oldValue = state[key];
  state[key] = value;

  if (oldValue !== value) {
    const subs = listeners.get(key);
    if (subs) {
      subs.forEach(fn => fn(value, oldValue));
    }
  }
}

/**
 * Subscribe to a specific state key.
 * @param {string} key 
 * @param {Function} callback - (newValue, oldValue) => void
 * @returns {Function} unsubscribe function
 */
export function subscribe(key, callback) {
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
  }
  listeners.get(key).add(callback);

  return () => {
    listeners.get(key).delete(callback);
  };
}

/**
 * Add a log entry to state.
 * @param {string} cls - 'sent' | 'received' | 'info' | 'ok' | 'warn' | 'event'
 * @param {string} dir - direction indicator character
 * @param {string} msg - log message
 */
export function addLogEntry(cls, dir, msg) {
  const now = new Date();
  const ts = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const entry = { cls, dir, msg, ts };

  state.logEntries = [...state.logEntries, entry];

  // Notify log subscribers
  const subs = listeners.get('logEntries');
  if (subs) {
    subs.forEach(fn => fn(state.logEntries, entry));
  }
}

/**
 * Clear all log entries.
 */
export function clearLogEntries() {
  state.logEntries = [];
  const subs = listeners.get('logEntries');
  if (subs) {
    subs.forEach(fn => fn(state.logEntries, null));
  }
}
