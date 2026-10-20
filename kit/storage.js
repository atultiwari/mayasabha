// localStorage can throw (private mode, blocked storage); never let that break an activity.
const PREFIX = 'mayasabha:';

export function loadJson(key) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn(`mayasabha: could not read ${key}`, err);
    return null;
  }
}

export function saveJson(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.warn(`mayasabha: could not save ${key}`, err);
  }
}
