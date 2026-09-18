// Injected only into the iOS JIGZO shell's main frame at document start.
// It implements the small subset of the Android Contact Picker API already used by React.
(function () {
  if (window.top !== window || location.protocol !== 'https:' ||
      location.hostname !== '__JIGZO_ALLOWED_HOST__' ||
      navigator.contacts) return;

  const handler = window.webkit?.messageHandlers?.jigzoContacts;
  if (!handler || typeof handler.postMessage !== 'function') return;

  const contacts = Object.freeze({
    getProperties: () => Promise.resolve(['name', 'tel']),
    select: (fields, options) => {
      if (!Array.isArray(fields) || fields.length !== 2 ||
          !fields.includes('name') || !fields.includes('tel') || options?.multiple !== true) {
        return Promise.reject(new TypeError('Only multiple name and phone selection is supported.'));
      }
      return handler.postMessage({ action: 'select', fields: ['name', 'tel'], multiple: true });
    }
  });
  Object.defineProperty(navigator, 'contacts', { value: contacts, configurable: false });
})();
