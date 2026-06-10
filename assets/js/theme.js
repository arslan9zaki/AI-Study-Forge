/**
 * AI Study Forge — Day / Night Mode
 * Clean rewrite: no flash, localStorage persistence, system detection
 */

(function () {

  var KEY   = 'asf-theme';
  var DAY   = 'light';
  var NIGHT = 'dark';

  /* ── 1. Read saved preference or system setting ── */
  function getSaved() {
    return localStorage.getItem(KEY);
  }

  function getSystem() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? NIGHT : DAY;
  }

  function getCurrent() {
    return getSaved() || getSystem();
  }

  /* ── 2. Apply theme to <html> ── */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    updateAllButtons(theme);
  }

  /* ── 3. Toggle between day and night ── */
  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || getCurrent();
    applyTheme(current === NIGHT ? DAY : NIGHT);
  }

  /* ── 4. Update every toggle button icon + label ── */
  function updateAllButtons(theme) {
    var isNight = theme === NIGHT;
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.innerHTML = isNight
        ? '<span style="font-size:18px" aria-hidden="true">☀️</span><span class="theme-btn-label">Day Mode</span>'
        : '<span style="font-size:18px" aria-hidden="true">🌙</span><span class="theme-btn-label">Night Mode</span>';
      btn.setAttribute('aria-label', isNight ? 'Switch to Day Mode' : 'Switch to Night Mode');
      btn.setAttribute('title',      isNight ? 'Switch to Day Mode' : 'Switch to Night Mode');
    });
  }

  /* ── 5. Wire up all existing buttons ── */
  function wireButtons() {
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      /* Remove any old listeners by replacing the node */
      var fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', toggleTheme);
    });
  }

  /* ── 6. Apply immediately (prevents flash) ── */
  applyTheme(getCurrent());

  /* ── 7. Wire buttons once DOM is ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      wireButtons();
      updateAllButtons(getCurrent());
    });
  } else {
    wireButtons();
    updateAllButtons(getCurrent());
  }

  /* ── 8. React to system preference changes ── */
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!getSaved()) {
        applyTheme(e.matches ? NIGHT : DAY);
      }
    });
  }

  /* ── 9. Global API ── */
  window.ASFTheme = { toggle: toggleTheme, set: applyTheme, get: getCurrent };

})();
