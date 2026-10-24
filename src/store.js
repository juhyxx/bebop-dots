// Small localStorage wrapper; everything still works when storage is unavailable.
// Keeps the app's old name (mTeacher), so progress saved before the rename stays.
const PREFIX = 'mteacher.';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // private mode / storage full — settings just won't persist
  }
}
