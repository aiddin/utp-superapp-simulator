/**
 * superapp.js — Super App Mini-App SDK
 * Version: 1.0.0
 *
 * Attaches window.SuperApp to the global scope, providing Mini-Apps with
 * access to Shell services via the postMessage bridge contract v1.0.
 *
 * Works in three environments:
 *   1. Flutter Shell APK  — Shell injects __SUPERAPP_* context variables before page load
 *   2. Web Simulator      — Simulator injects __SUPERAPP_* context variables before page load
 *   3. Standalone browser — Falls back to safe mock defaults for local development
 *
 * Mini-App → Shell postMessage actions:
 *   MINI_APP_READY, GO_BACK, OPEN_APP, TOAST, LOADING,
 *   LOCAL_NOTIFY, SCHEDULE_NOTIFY, CANCEL_NOTIFY, AI_CHAT, AI_COMPLETE,
 *   SCAN_QR, TAKE_PHOTO, RECORD_VIDEO, PICK_PHOTO, PICK_VIDEO
 *
 * Shell → Mini-App messages (received via window.addEventListener('message')):
 *   SHELL_EVENT — carries { event: 'notification'|'logout'|'themeChange'|'resume', payload }
 *   AI_CHAT_REPLY    — carries { _msgId, reply }
 *   AI_COMPLETE_REPLY — carries { _msgId, result }
 *
 */

(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // 0. Guard — prevent double-initialisation
  // ---------------------------------------------------------------------------
  if (global.SuperApp) {
    return;
  }

  // ---------------------------------------------------------------------------
  // 1. Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Send a postMessage to the parent Shell (Simulator iframe parent or Flutter
   * WebView's message handler).  The Shell identifies SDK messages by the
   * presence of the `_superapp` flag.
   */
  function postToShell(action, payload) {
    var message = { _superapp: true, action: action };
    if (payload !== undefined) {
      message.payload = payload;
    }
    // In a Flutter WebView, window.parent === window, but the Flutter bridge
    // still intercepts window.postMessage.  In the Simulator the Mini-App runs
    // inside an <iframe>, so window.parent is the Simulator host page.
    var target = global.parent !== global ? global.parent : global;
    target.postMessage(message, '*');
  }

  /**
   * Generate a lightweight unique ID for request/response correlation
   * (used by ai.chat and ai.complete to match async replies).
   */
  function uid() {
    return 'sa_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  // ---------------------------------------------------------------------------
  // 2. Context resolution — three sources, in priority order:
  //    1. window.__SUPERAPP_*  injected by Flutter Shell / same-origin Simulator
  //    2. window.name          set by cross-origin Simulator before iframe.src loads
  //    3. Hardcoded defaults   for plain browser / local dev
  //
  // Why window.name?
  //   The Simulator runs on a different origin (github.io) from the APEX app
  //   (apex.oracle.com). The browser blocks DOM access between them, so the
  //   Simulator cannot set window.__SUPERAPP_* directly. However, setting
  //   iframe.name before iframe.src is assigned causes window.name inside the
  //   loaded page to contain that value — this works cross-origin without
  //   modifying the URL (which caused redirect loops on APEX).
  // ---------------------------------------------------------------------------
  var _defaultUser = {
    uuid:  '00000000-0000-0000-0000-000000000000',
    id:    'S00000',
    name:  'Dev User',
    role:  'student',
    email: 'dev@utp.edu.my'
  };

  // Parse window.name context (set by Simulator for cross-origin iframes)
  var _nameCtx = (function() {
    try {
      var name = global.name;
      if (!name || name.charAt(0) !== '{') return null;
      return JSON.parse(name);
    } catch(e) { return null; }
  }());

  /**
   * Read a context variable with three-level fallback:
   *   window.__SUPERAPP_* → window.name ctx → hardcoded default
   */
  function ctx(key, fallback) {
    // Priority 1: Flutter Shell / same-origin Simulator DOM injection
    if (global[key] !== undefined && global[key] !== null) return global[key];
    // Priority 2: window.name context (cross-origin Simulator)
    if (_nameCtx && _nameCtx[key] !== undefined && _nameCtx[key] !== null) {
      return _nameCtx[key];
    }
    // Priority 3: hardcoded default
    return fallback;
  }

  // ---------------------------------------------------------------------------
  // 3. In-memory sandboxed storage
  //    Keys are namespaced by the page origin so each Mini-App is isolated.
  // ---------------------------------------------------------------------------
  var _storageNamespace = 'sa_store_' + global.location.hostname + '_';
  var _store = {};

  // ---------------------------------------------------------------------------
  // 4. Event listener registry  (SuperApp.on)
  // ---------------------------------------------------------------------------
  var _listeners = {
    notification: [],
    logout:       [],
    themeChange:  [],
    resume:       []
  };

  // ---------------------------------------------------------------------------
  // 5. Pending async reply map  (used by ai.chat / ai.complete)
  // ---------------------------------------------------------------------------
  var _pendingReplies = {};

  // ---------------------------------------------------------------------------
  // 6. Listen for messages coming FROM the Shell into this Mini-App page
  // ---------------------------------------------------------------------------
  global.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;

    // Shell → Mini-App: context injection (for cross-origin/nested iframes)
    if (data.action === 'CONTEXT_INJECT' && data.context) {
      // Update global context variables that were missed during initial load
      if (data.context.__SUPERAPP_USER__) {
        global.__SUPERAPP_USER__ = data.context.__SUPERAPP_USER__;
      }
      if (data.context.__SUPERAPP_TOKEN__) {
        global.__SUPERAPP_TOKEN__ = data.context.__SUPERAPP_TOKEN__;
      }
      if (data.context.__SUPERAPP_ROLE__) {
        global.__SUPERAPP_ROLE__ = data.context.__SUPERAPP_ROLE__;
      }
      return;
    }

    // Shell → Mini-App: shell lifecycle events
    if (data.action === 'SHELL_EVENT') {
      var eventName = data.event;
      var payload   = data.payload !== undefined ? data.payload : null;
      if (_listeners[eventName]) {
        _listeners[eventName].forEach(function (cb) {
          try { cb(payload); } catch (e) { /* isolate listener errors */ }
        });
      }
      return;
    }

    // Shell → Mini-App: AI chat reply
    if (data.action === 'AI_CHAT_REPLY' && data._msgId && _pendingReplies[data._msgId]) {
      var chatResolvers = _pendingReplies[data._msgId];
      delete _pendingReplies[data._msgId];
      if (data.error) {
        chatResolvers.reject(new Error(data.error));
      } else {
        chatResolvers.resolve({ reply: data.reply });
      }
      return;
    }

    // Shell → Mini-App: Storage get reply
    if (data.action === 'STORAGE_GET_REPLY' && data._msgId && _pendingReplies[data._msgId]) {
      var storageResolvers = _pendingReplies[data._msgId];
      delete _pendingReplies[data._msgId];
      if (data.error) {
        storageResolvers.reject(new Error(data.error));
      } else {
        storageResolvers.resolve(data.data);
      }
      return;
    }

    // Shell → Mini-App: AI complete reply
    if (data.action === 'AI_COMPLETE_REPLY' && data._msgId && _pendingReplies[data._msgId]) {
      var completeResolvers = _pendingReplies[data._msgId];
      delete _pendingReplies[data._msgId];
      if (data.error) {
        completeResolvers.reject(new Error(data.error));
      } else {
        completeResolvers.resolve({ result: data.result });
      }
      return;
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Module implementations
  // ---------------------------------------------------------------------------

  // --- 7.1  auth -----------------------------------------------------------
  var auth = {
    /**
     * Returns the authenticated user's profile.
     * Data is read from window.__SUPERAPP_USER__ injected by the Shell.
     *
     * @returns {Promise<{uuid: string, id: string, name: string, role: string, email: string}>}
     */
    getUser: function () {
      var user = ctx('__SUPERAPP_USER__', _defaultUser);
      var safeUser = {
        uuid:  user.uuid  || _defaultUser.uuid,
        id:    user.id    || _defaultUser.id,
        name:  user.name  || _defaultUser.name,
        role:  user.role  || _defaultUser.role,
        email: user.email || _defaultUser.email
      };
      return Promise.resolve(safeUser);
    },

    /**
     * Returns the scoped JWT for this Mini-App session.
     * Use as `Authorization: Bearer <token>` in APEX REST calls.
     *
     * @returns {Promise<string>}
     */
    getScopedToken: function () {
      var token = ctx('__SUPERAPP_TOKEN__', 'mock-scoped-jwt-dev');
      return Promise.resolve(token);
    }
  };

  // --- 7.2  storage --------------------------------------------------------
  var storage = {
    /**
     * Stores a string value, sandboxed to this Mini-App's origin.
     *
     * @param {string} key
     * @param {string} value
     * @returns {Promise<void>}
     */
    // set: function (key, value) {
    //   _store[_storageNamespace + key] = String(value);
    //   return Promise.resolve();
    // },

    // get: function (key) {
    //   var val = _store[_storageNamespace + key];
    //   return Promise.resolve(val !== undefined ? val : null);
    // },

    // remove: function (key) {
    //   delete _store[_storageNamespace + key];
    //   return Promise.resolve();
    // }

    // === Shell-backed storage (persistent) ===
    set: function (key, value) {
      postToShell('STORAGE_SET', { key: key, value: value });
      return Promise.resolve();
    },

    get: function (key) {
      return new Promise(function (resolve, reject) {
        var msgId = uid();
        _pendingReplies[msgId] = { resolve: resolve, reject: reject };
        postToShell('STORAGE_GET', { _msgId: msgId, key: key });
      });
    },

    remove: function (key) {
      postToShell('STORAGE_REMOVE', { key: key });
      return Promise.resolve();
    }
  };

  // --- 7.3  navigation -----------------------------------------------------
  var navigation = {
    /**
     * Signals the Shell to close this Mini-App and return to the dashboard.
     * Sends: { _superapp: true, action: 'GO_BACK' }
     */
    goBack: function () {
      postToShell('GO_BACK');
    },

    /**
     * Requests the Shell to open another registered Mini-App by its ID.
     * Sends: { _superapp: true, action: 'OPEN_APP', payload: { appId } }
     *
     * @param {string} appId
     */
    openMiniApp: function (appId) {
      postToShell('OPEN_APP', { appId: appId });
    }
  };

  // --- 7.4  ui -------------------------------------------------------------
  var ui = {
    /**
     * Shows a native Shell toast notification.
     * Sends: { _superapp: true, action: 'TOAST', payload: { message } }
     *
     * @param {string} message
     */
    showToast: function (message) {
      postToShell('TOAST', { message: String(message) });
    },

    /**
     * Shows the Shell's full-screen loading overlay.
     * Sends: { _superapp: true, action: 'LOADING', payload: { show: true } }
     */
    showLoading: function () {
      postToShell('LOADING', { show: true });
    },

    /**
     * Dismisses the Shell's full-screen loading overlay.
     * Sends: { _superapp: true, action: 'LOADING', payload: { show: false } }
     */
    hideLoading: function () {
      postToShell('LOADING', { show: false });
    }
  };

  // --- 7.5  camera / media --------------------------------------------------

  /**
   * Internal helper: send an async media action and wait for the Shell reply.
   * Falls back to a mock response after 300 ms if no Shell is present.
   *
   * @param {string} action      - The postMessage action (e.g. 'TAKE_PHOTO')
   * @param {string} replyAction - The expected reply action (e.g. 'TAKE_PHOTO_REPLY')
   * @param {object} payload     - Extra payload fields (merged with _msgId)
   * @param {*}      mockData    - Mock data returned when no Shell replies
   * @returns {Promise<{data: *}>}
   */
  function mediaRequest(action, replyAction, payload, mockData) {
    return new Promise(function (resolve, reject) {
      var msgId = uid();
      var settled = false;

      function onMessage(event) {
        var d = event.data;
        if (!d || d.action !== replyAction || d._msgId !== msgId) return;
        global.removeEventListener('message', onMessage);
        settled = true;
        if (d.error) {
          reject(new Error(d.error));
        } else {
          resolve({ data: d.data });
        }
      }

      global.addEventListener('message', onMessage);

      var msg = { _msgId: msgId };
      if (payload) {
        for (var k in payload) {
          if (payload.hasOwnProperty(k)) msg[k] = payload[k];
        }
      }
      postToShell(action, msg);

      // Mock fallback
      setTimeout(function () {
        if (!settled) {
          settled = true;
          global.removeEventListener('message', onMessage);
          resolve({ data: mockData });
        }
      }, 300);
    });
  }

  var camera = {
    /**
     * Opens the device camera for QR scanning.
     * Returns a parsed result: { type: 'url'|'deeplink'|'json'|'text', value, parsed? }
     *
     * @returns {Promise<{data: {type: string, value: string, parsed?: object}}>}
     */
    scanQR: function () {
      return mediaRequest('SCAN_QR', 'SCAN_QR_REPLY', {},
        { type: 'text', value: 'MOCK-QR-' + Math.random().toString(36).slice(2, 10).toUpperCase() }
      );
    },

    /**
     * Captures a photo using the device camera.
     *
     * @param {object} [options]
     * @param {number} [options.maxWidth]  - Max width in pixels
     * @param {number} [options.maxHeight] - Max height in pixels
     * @param {number} [options.quality]   - JPEG quality 0-100 (default 80)
     * @returns {Promise<{data: {path: string, name: string, size: number, mimeType: string}}>}
     */
    takePhoto: function (options) {
      var opts = options || {};
      return mediaRequest('TAKE_PHOTO', 'TAKE_PHOTO_REPLY', {
        maxWidth:  opts.maxWidth  || null,
        maxHeight: opts.maxHeight || null,
        quality:   opts.quality   || 80
      }, { path: '/mock/photo.jpg', name: 'mock_photo.jpg', size: 204800, mimeType: 'image/jpeg' });
    },

    /**
     * Records a video using the device camera.
     *
     * @param {object} [options]
     * @param {number} [options.maxDuration] - Max duration in seconds
     * @returns {Promise<{data: {path: string, name: string, size: number, mimeType: string}}>}
     */
    recordVideo: function (options) {
      var opts = options || {};
      return mediaRequest('RECORD_VIDEO', 'RECORD_VIDEO_REPLY', {
        maxDuration: opts.maxDuration || null
      }, { path: '/mock/video.mp4', name: 'mock_video.mp4', size: 5242880, mimeType: 'video/mp4' });
    },

    /**
     * Picks a photo from the device gallery.
     *
     * @param {object} [options]
     * @param {number} [options.maxWidth]  - Max width in pixels
     * @param {number} [options.maxHeight] - Max height in pixels
     * @param {number} [options.quality]   - JPEG quality 0-100 (default 80)
     * @returns {Promise<{data: {path: string, name: string, size: number, mimeType: string}}>}
     */
    pickPhoto: function (options) {
      var opts = options || {};
      return mediaRequest('PICK_PHOTO', 'PICK_PHOTO_REPLY', {
        maxWidth:  opts.maxWidth  || null,
        maxHeight: opts.maxHeight || null,
        quality:   opts.quality   || 80
      }, { path: '/mock/gallery_photo.jpg', name: 'mock_gallery.jpg', size: 307200, mimeType: 'image/jpeg' });
    },

    /**
     * Picks a video from the device gallery.
     *
     * @param {object} [options]
     * @param {number} [options.maxDuration] - Max duration in seconds
     * @returns {Promise<{data: {path: string, name: string, size: number, mimeType: string}}>}
     */
    pickVideo: function (options) {
      var opts = options || {};
      return mediaRequest('PICK_VIDEO', 'PICK_VIDEO_REPLY', {
        maxDuration: opts.maxDuration || null
      }, { path: '/mock/gallery_video.mp4', name: 'mock_gallery.mp4', size: 10485760, mimeType: 'video/mp4' });
    }
  };

  // --- 7.6  location -------------------------------------------------------
  var location = {
    /**
     * Returns the device's current GPS coordinates.
     * Mock returns Main Campus coordinates.
     * In production, the Flutter Shell intercepts LOCATION_GET and replies
     * with the real device GPS fix.
     *
     * @returns {Promise<{lat: number, lng: number, altitude: number, heading: number, campus: string}>}
     */
    get: function () {
      return new Promise(function (resolve, reject) {
        var msgId = uid();

        function onMessage(event) {
          var d = event.data;
          if (!d || d.action !== 'LOCATION_REPLY' || d._msgId !== msgId) return;
          global.removeEventListener('message', onMessage);
          if (d.error) {
            reject(new Error(d.error));
          } else {
            resolve({ lat: d.lat, lng: d.lng, altitude: d.altitude, heading: d.heading, campus: d.campus });
          }
        }

        global.addEventListener('message', onMessage);
        postToShell('LOCATION_GET', { _msgId: msgId });

        // Mock fallback — Main Campus, Perak, Malaysia
        setTimeout(function () {
          global.removeEventListener('message', onMessage);
          if (!onMessage._settled) {
            onMessage._settled = true;
            resolve({ lat: 4.3851, lng: 100.9925, altitude: 100, heading: 0, campus: 'Main Campus' });
          }
        }, 300);

        global.addEventListener('message', function settle(event) {
          var d = event.data;
          if (d && d.action === 'LOCATION_REPLY' && d._msgId === msgId) {
            onMessage._settled = true;
            global.removeEventListener('message', settle);
          }
        });
      });
    }
  };

  // --- 7.7  ai -------------------------------------------------------------
  var ai = {
    /**
     * Conversational AI via Oracle Gen AI (proxied through VTC Relay API).
     * Follows the OpenAI messages format.
     *
     * MVP flow: Mini-App → postMessage(AI_CHAT) → Flutter Shell → POST /v1/ai/chat → LiteLLM → Oracle Gen AI
     *
     * @param {{ messages: Array<{role: string, content: string|Array}>, model?: string }} options
     * @returns {Promise<{reply: string}>}
     */
    chat: function (options) {
      return new Promise(function (resolve, reject) {
        var msgId = uid();
        _pendingReplies[msgId] = { resolve: resolve, reject: reject };

        postToShell('AI_CHAT', {
          _msgId:   msgId,
          messages: options.messages,
          model:    options.model || null
        });

        // Mock fallback — resolves after 800 ms if Shell does not reply
        setTimeout(function () {
          if (_pendingReplies[msgId]) {
            delete _pendingReplies[msgId];
            resolve({ reply: '[Mock AI] I received your message. The real AI response will come from the VTC Relay API in production.' });
          }
        }, 800);
      });
    },

    /**
     * Single prompt completion via Oracle Gen AI.
     *
     * @param {{ prompt: string, model?: string }} options
     * @returns {Promise<{result: string}>}
     */
    complete: function (options) {
      return new Promise(function (resolve, reject) {
        var msgId = uid();
        _pendingReplies[msgId] = { resolve: resolve, reject: reject };

        postToShell('AI_COMPLETE', {
          _msgId:  msgId,
          prompt:  options.prompt,
          model:   options.model || null
        });

        // Mock fallback
        setTimeout(function () {
          if (_pendingReplies[msgId]) {
            delete _pendingReplies[msgId];
            resolve({ result: '[Mock AI] Prompt received. The real completion will come from the VTC Relay API in production.' });
          }
        }, 800);
      });
    }
  };

  // --- 7.8  notifications --------------------------------------------------
  var notifications = {
    /**
     * Returns the device's FCM token injected by the Flutter Shell.
     * Mini-App backend saves this and uses it to send push notifications
     * via the VTC Relay API (POST /v1/notify).
     *
     * @returns {Promise<string|null>}
     */
    getDeviceToken: function () {
      var token = ctx('__SUPERAPP_FCM_TOKEN__', null);
      return Promise.resolve(token);
    },

    /**
     * Shows a local notification on the device immediately (no server needed).
     * Sends: { _superapp: true, action: 'LOCAL_NOTIFY', payload: { title, body } }
     *
     * @param {{ title: string, body: string }} options
     * @returns {Promise<void>}
     */
    local: function (options) {
      postToShell('LOCAL_NOTIFY', {
        title: String(options.title || ''),
        body:  String(options.body  || '')
      });
      return Promise.resolve();
    },

    /**
     * Schedules a local notification for a future time.
     * Sends: { _superapp: true, action: 'SCHEDULE_NOTIFY', payload: { title, body, at, _msgId } }
     *
     * @param {{ title: string, body: string, at: string }} options  — `at` is an ISO 8601 string
     * @returns {Promise<{id: string}>}
     */
    schedule: function (options) {
      var msgId = uid();
      postToShell('SCHEDULE_NOTIFY', {
        _msgId: msgId,
        title:  String(options.title || ''),
        body:   String(options.body  || ''),
        at:     String(options.at    || '')
      });
      // The notification ID returned is the msgId; the Shell uses the same value
      return Promise.resolve({ id: msgId });
    },

    /**
     * Cancels a previously scheduled local notification.
     * Sends: { _superapp: true, action: 'CANCEL_NOTIFY', payload: { id } }
     *
     * @param {string} id — the id returned by notifications.schedule()
     * @returns {Promise<void>}
     */
    cancel: function (id) {
      postToShell('CANCEL_NOTIFY', { id: String(id) });
      return Promise.resolve();
    },

    /**
     * Saves the device's FCM token to the backend via the Shell.
     * This registers the device for push notifications.
     *
     * Flow:
     *   1. Get FCM token from __SUPERAPP_FCM_TOKEN__
     *   2. Send to Shell via postMessage
     *   3. Shell forwards to Relay API (POST /v1/device/register)
     *
     * @param {string} userId - The user ID to associate with the token
     * @returns {Promise<{success: boolean}>}
     */
    saveDeviceToken: function (userId) {
      var self = this;
      return new Promise(function (resolve, reject) {
        self.getDeviceToken().then(function(token) {
          if (!token) {
            reject(new Error('No FCM token available'));
            return;
          }

          var msgId = uid();
          _pendingReplies[msgId] = { resolve: resolve, reject: reject };
          postToShell('SAVE_FCM_TOKEN', {
            _msgId: msgId,
            userId: userId,
            token: token
          });
        }).catch(function(err) {
          reject(err);
        });
      });
    }
  };

  // --- 7.9  on (Shell event listener) -------------------------------------
  /**
   * Register a callback for Shell-emitted lifecycle events.
   *
   * Supported events:
   *   'notification'  — { title, body, data }  — push received while Mini-App is open
   *   'logout'        — null                    — Shell is logging the user out
   *   'themeChange'   — { theme: 'light'|'dark' }
   *   'resume'        — null                    — Mini-App returned to foreground
   *
   * @param {string}   event
   * @param {Function} callback
   */
  function on(event, callback) {
    if (!_listeners[event]) {
      console.warn('[SuperApp] Unknown event "' + event + '". Supported: notification, logout, themeChange, resume');
      return;
    }
    if (typeof callback !== 'function') {
      console.warn('[SuperApp] SuperApp.on() requires a function as the second argument.');
      return;
    }
    _listeners[event].push(callback);
  }

  // ---------------------------------------------------------------------------
  // 8. Assemble the public SuperApp object
  // ---------------------------------------------------------------------------
  var SuperApp = {
    version:       '1.0.0',
    auth:          auth,
    storage:       storage,
    navigation:    navigation,
    ui:            ui,
    camera:        camera,
    location:      location,
    ai:            ai,
    notifications: notifications,
    on:            on
  };

  // ---------------------------------------------------------------------------
  // 9. Attach to global scope
  // ---------------------------------------------------------------------------
  global.SuperApp = SuperApp;

  // ---------------------------------------------------------------------------
  // 10. Auto-fire MINI_APP_READY — tells the Shell the SDK has loaded
  // ---------------------------------------------------------------------------
  postToShell('MINI_APP_READY');

  // Log confirmation to console (visible in DevTools / Simulator event log)
  console.log('[SuperApp] SDK v' + SuperApp.version + ' initialised.');

}(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this));
