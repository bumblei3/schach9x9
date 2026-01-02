// utils.js
/**
 * Utility functions for Schach9x9.
 * Add helper functions here (e.g., deep copy, coordinate conversion).
 */
export function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function coordToAlgebraic(r, c) {
  const file = String.fromCharCode(97 + c); // a-i
  const rank = 9 - r; // 9-1
  return `${file}${rank}`;
}

export function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Safely parses JSON with a fallback value.
 * Logs errors instead of throwing.
 * @param {string} jsonString
 * @param {any} fallback
 * @returns {any}
 */
export function safeJSONParse(jsonString, fallback = null) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('JSON Parse Error:', e);
    return fallback;
  }
}
