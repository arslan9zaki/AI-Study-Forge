/**
 * AI Biz Tools - Theme System
 * Handles dark/light mode toggle with localStorage and system preference detection
 */

(function() {
  'use strict';

  const THEME_KEY = 'aibiztools-theme';
  const THEME_DARK = 'dark';
  const THEME_LIGHT = 'light';
  
  // Get system preference
  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return THEME_DARK;
    }
    return THEME_LIGHT;
  }

  // Get saved theme or system preference
  function getTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === THEME_DARK || saved === THEME_LIGHT) {
      return saved;
    }
    return getSystemTheme();
  }

  // Apply theme to document
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    
    // Update toggle button if it exists
    const toggleBtn = document.querySelector('.theme-toggle');
    if (toggleBtn) {
      updateToggleIcon(toggleBtn, theme);
    }
  }

  // Update toggle button icon
  function updateToggleIcon(btn, theme) {
    const icon = btn.querySelector('.theme-icon');
    if (icon) {
      icon.textContent = theme === THEME_DARK ? '☀️' : '🌙';
    }
    const label = btn.querySelector('.theme-label');
    if (label) {
      label.textContent = theme === THEME_DARK ? 'Light Mode' : 'Dark Mode';
    }
  }

  // Toggle theme
  function toggleTheme() {
    const current = getTheme();
    const next = current === THEME_DARK ? THEME_LIGHT : THEME_DARK;
    applyTheme(next);
  }

  // Initialize theme (prevent flash)
  function initTheme() {
    // Apply theme immediately to prevent flash
    const theme = getTheme();
    document.documentElement.setAttribute('data-theme', theme);
    
    // Listen for system preference changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // Only auto-switch if user hasn't manually set a preference
        if (!localStorage.getItem(THEME_KEY)) {
          applyTheme(e.matches ? THEME_DARK : THEME_LIGHT);
        }
      });
    }
  }

  // Create theme toggle button HTML
  function createToggleButton() {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle dark/light mode');
    btn.setAttribute('type', 'button');
    btn.innerHTML = `
      <span class="theme-icon" aria-hidden="true">🌙</span>
      <span class="theme-label sr-only">Dark Mode</span>
    `;
    btn.addEventListener('click', toggleTheme);
    return btn;
  }

  // Add theme toggle to page
  function addThemeToggle() {
    // Check if toggle already exists
    if (document.querySelector('.theme-toggle')) {
      return;
    }

    // Find navbar or header to add toggle
    const navbar = document.querySelector('.navbar') || 
                   document.querySelector('nav') || 
                   document.querySelector('.main-header');
    
    if (navbar) {
      const toggle = createToggleButton();
      navbar.appendChild(toggle);
      updateToggleIcon(toggle, getTheme());
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initTheme();
      addThemeToggle();
    });
  } else {
    initTheme();
    addThemeToggle();
  }

  // Expose functions globally for manual control if needed
  window.AIBizToolsTheme = {
    toggle: toggleTheme,
    set: applyTheme,
    get: getTheme
  };

})();
