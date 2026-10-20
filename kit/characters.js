// Character slots. Every role (the pet, the three visitors, the fruit) has built-in Noto emoji art,
// and can be swapped for your own picture through assets/custom/characters.json. That folder is
// git-ignored, so private images (e.g. your child's favourite cartoon characters) stay on your machine.

const NOTO = '../../assets/noto/';
const CUSTOM = '../../assets/custom/';
const FILE_PATTERN = /^[\w-][\w.-]{0,80}\.(png|webp|jpe?g|svg)$/i;
const SCALE_RANGE = [0.3, 3];
const NOTO_FOOT_PAD = 0.05; // emoji art has a little empty space under the feet; trimmed custom art has none

/** Built-in art; all of it faces left. */
export const ROLES = Object.freeze({
  pet: { file: '3d-dog.png', label: 'Puppy', icon: '🐶' },
  elephant: { file: '3d-elephant.png', label: 'Hathi', icon: '🐘' },
  monkey: { file: '3d-monkey.png', label: 'Monkey', icon: '🐒' },
  mouse: { file: '3d-mouse.png', label: 'Mouse', icon: '🐭' },
  penguin: { file: '3d-penguin.png', label: 'Penguin', icon: '🐧' },
  banana: { file: '3d-banana.png', label: 'Banana', icon: '🍌' },
  apple: { file: '3d-apple.png', label: 'Apple', icon: '🍎' },
  orange: { file: '3d-orange.png', label: 'Orange', icon: '🍊' },
});

const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Validates characters.json. Unknown roles and unsafe file names are dropped. */
export function parseManifest(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
  const out = {};
  for (const [role, entry] of Object.entries(json)) {
    if (!ROLES[role] || !entry || typeof entry !== 'object') continue;
    if (typeof entry.file !== 'string' || !FILE_PATTERN.test(entry.file)) continue;
    out[role] = {
      file: entry.file,
      happyFile: typeof entry.happyFile === 'string' && FILE_PATTERN.test(entry.happyFile) ? entry.happyFile : null,
      facing: entry.faces === 'right' ? 1 : -1,
      scale: Number.isFinite(entry.scale) ? clamp(entry.scale, ...SCALE_RANGE) : 1,
      label: text(entry.label, 16),
      icon: text(entry.icon, 8),
    };
  }
  return out;
}

/** Merges validated overrides over the built-in roles. facing: -1 = art looks left, 1 = right. */
export function resolveCharacters(overrides) {
  return Object.fromEntries(Object.entries(ROLES).map(([role, base]) => {
    const o = overrides[role];
    return [role, o
      ? { src: CUSTOM + o.file, happySrc: o.happyFile ? CUSTOM + o.happyFile : null, facing: o.facing, scale: o.scale,
        footPad: 0, label: o.label ?? base.label, icon: o.icon ?? base.icon, custom: true }
      : { src: NOTO + base.file, happySrc: null, facing: -1, scale: 1, footPad: NOTO_FOOT_PAD, label: base.label, icon: base.icon, custom: false }];
  }));
}

/** Phone-remote buttons, named after whoever plays each role. */
export function remoteLayout(chars) {
  const role = (id) => ({ id, label: chars[id].label, icon: chars[id].icon });
  return {
    title: `Room Pet ${chars.pet.icon}`,
    buttons: [
      role('banana'), role('apple'), role('orange'),
      { id: 'happy', label: 'Jump!', icon: '🎉' },
      { id: 'come', label: `Come, ${chars.pet.label}`.slice(0, 24), icon: chars.pet.icon },
      { id: 'bark', label: 'Hello!', icon: '🔊' },
      role('elephant'), role('monkey'), role('mouse'), role('penguin'),
      { id: 'sit', label: 'Sit', icon: '🪑' },
      { id: 'sleep', label: 'Sleep', icon: '💤' },
      { id: 'demo', label: 'Demo', icon: '🎬' },
    ],
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

async function fetchManifest() {
  try {
    const res = await fetch(`${CUSTOM}characters.json`, { cache: 'no-store' });
    return res.ok ? parseManifest(await res.json()) : {};
  } catch (err) {
    console.warn('characters.json unreadable, using built-in art', err);
    return {};
  }
}

/**
 * Loads every role's picture. A broken custom picture falls back to the built-in one.
 * @returns {Promise<{ chars: Record<string, object>, problems: string[] }>}
 */
export async function loadCharacters() {
  const chars = resolveCharacters(await fetchManifest());
  const problems = [];
  const entries = await Promise.all(Object.entries(chars).map(async ([role, c]) => {
    try {
      const img = await loadImage(c.src);
      // The happy pose is optional: if its picture is missing, the normal one is used.
      const happyImg = c.happySrc ? await loadImage(c.happySrc).catch(() => { problems.push(`${role} happy pose`); return null; }) : null;
      return [role, { ...c, img, happyImg }];
    } catch (err) {
      if (!c.custom) throw err;
      problems.push(`${role}: ${c.src.split('/').pop()}`);
      const fallback = resolveCharacters({})[role];
      return [role, { ...fallback, img: await loadImage(fallback.src), happyImg: null }];
    }
  }));
  return { chars: Object.fromEntries(entries), problems };
}
