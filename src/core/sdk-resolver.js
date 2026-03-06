/**
 * SDK URL Resolver
 *
 * Returns the local superapp.js URL (served from public/ folder).
 * The local SDK includes cross-origin support for APEX integration.
 */

export function getSDKUrl() {
  // Vite serves public/ files from root, and handles base path automatically
  return '/superapp.js';
}
