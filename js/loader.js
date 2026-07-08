/* =============================================================
   Shared pre-reveal loader — single source of the orbiting-badge
   DOM. markup() returns the loader HTML string; build() returns a
   detached DOM node. Pairs with css/loader.css. Used by
   receive.html and index.html so the two can never differ again.
   Markup is copied verbatim from receive.html's original loader.
   ============================================================= */
(function (global) {
  function markup() {
    return '' +
      '<div class="jz-orbit" role="status" aria-label="Loading your Jigzo">' +
        '<div class="jz-orbit__ring">' +
          '<div class="jz-orbit__arm"><div class="jz-orbit__badge"><svg viewBox="0 0 100 100"><defs><linearGradient id="jzbG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E7C485"/><stop offset=".45" stop-color="#A67C3D"/><stop offset="1" stop-color="#1C140A"/></linearGradient></defs><circle cx="50" cy="50" r="49" fill="url(#jzbG)"/><g fill="#050505"><rect x="33" y="33" width="34" height="34" rx="8"/><circle cx="50" cy="29" r="8.6"/><circle cx="50" cy="71" r="8.6"/><circle cx="29" cy="50" r="8.6"/><circle cx="71" cy="50" r="8.6"/></g></svg></div></div>' +
          '<div class="jz-orbit__arm"><div class="jz-orbit__badge"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="49" fill="#FAF8EC"/><circle cx="50" cy="50" r="48.3" fill="none" stroke="rgba(5,5,5,0.07)" stroke-width="1"/><g fill="#050505"><rect x="33" y="33" width="34" height="34" rx="8"/><circle cx="50" cy="29" r="8.6"/><circle cx="50" cy="71" r="8.6"/><circle cx="29" cy="50" r="8.6"/><circle cx="71" cy="50" r="8.6"/></g></svg></div></div>' +
          '<div class="jz-orbit__arm"><div class="jz-orbit__badge"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="49" fill="#111110"/><circle cx="50" cy="50" r="48.3" fill="none" stroke="rgba(166,124,61,0.42)" stroke-width="1"/><g fill="#FAF8EC"><rect x="33" y="33" width="34" height="34" rx="8"/><circle cx="50" cy="29" r="8.6"/><circle cx="50" cy="71" r="8.6"/><circle cx="29" cy="50" r="8.6"/><circle cx="71" cy="50" r="8.6"/></g></svg></div></div>' +
        '</div>' +
        '<div class="jz-orbit__label">Preparing your reveal</div>' +
      '</div>';
  }
  function build() {
    var wrap = document.createElement('div');
    wrap.innerHTML = markup();
    return wrap.firstChild;
  }
  global.JZLoader = { markup: markup, build: build };
})(window);
