// Theme persistence across all pages
(function() {
  const saved = localStorage.getItem('sf-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();

function initTheme() {
  const saved = localStorage.getItem('sf-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = saved === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('sf-theme', next);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = next === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
}

document.addEventListener('DOMContentLoaded', initTheme);
