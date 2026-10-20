// Messages between stage pages, phone remotes and the relay server. Shared by browser and Node.
// Everything that arrives over the network is validated here before use.

const ROLES = new Set(['stage', 'remote']);
const MAX_BUTTONS = 24;
const ID_PATTERN = /^[a-z0-9-]{1,32}$/;
const isId = (v) => typeof v === 'string' && ID_PATTERN.test(v);

function cleanText(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** @returns {{title:string, buttons:{id:string,label:string,icon:string}[]} | null} */
export function parseLayout(layout) {
  if (!layout || typeof layout !== 'object' || !Array.isArray(layout.buttons)) return null;
  const buttons = layout.buttons
    .slice(0, MAX_BUTTONS)
    .filter((b) => b && isId(b.id))
    .map((b) => ({ id: b.id, label: cleanText(b.label, 24), icon: cleanText(b.icon, 8) }));
  return { title: cleanText(layout.title, 40), buttons };
}

/** Parses one raw text message; returns a clean message object or null if invalid. */
export function parseClientMessage(text) {
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return null;
  }
  if (!msg || typeof msg !== 'object') return null;
  if (msg.type === 'hello' && ROLES.has(msg.role)) {
    return { type: 'hello', role: msg.role, layout: msg.role === 'stage' ? parseLayout(msg.layout) : null };
  }
  if (msg.type === 'press' && isId(msg.id)) return { type: 'press', id: msg.id };
  return null;
}

/** Parses a server → client message (layout pushed to remotes, presses pushed to stages). */
export function parseServerMessage(text) {
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return null;
  }
  if (msg?.type === 'layout') {
    const layout = parseLayout(msg.layout);
    return layout ? { type: 'layout', layout } : null;
  }
  if (msg?.type === 'press' && isId(msg.id)) return { type: 'press', id: msg.id };
  return null;
}
