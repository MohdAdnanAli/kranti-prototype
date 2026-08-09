// form-cache.js — lightweight localStorage-backed draft persistence.
// Lets complex forms survive page navigation (back/forth) without losing unsaved data.

const FormCache = (function () {
  const PREFIX = 'kranti_draft_';

  function save(key, data) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(data));
    } catch (e) {
      // Storage full or unavailable — silently ignore, drafts are best-effort.
    }
  }

  function load(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clear(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch (e) {
      // ignore
    }
  }

  return { save, load, clear };
})();

// Debounce helper — fires `fn` at most once per `wait` ms after the last invocation.
function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}
