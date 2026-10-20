// A phone as the camera, through the free Android app "IP Webcam" (or anything that serves
// /shot.jpg). The local server fetches still photos from the phone and passes them on, so pages
// can use them without cross-origin trouble. Only private home-network addresses are accepted,
// and only the fixed /shot.jpg path is ever fetched, so the server can't be used as an open proxy.

const PRIVATE = [/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, /^192\.168\.\d{1,3}\.\d{1,3}$/, /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/];
const ROTATIONS = [0, 90, 180, 270];

/** @returns {{ base: string, rotate: number } | null} */
export function parsePhoneCamera(input, rotate = 0) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const text = /^[a-z]+:\/\//i.test(input.trim()) ? input.trim() : `http://${input.trim()}`;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' || url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;
  if (!PRIVATE.some((re) => re.test(url.hostname))) return null;
  return { base: `http://${url.host}`, rotate: ROTATIONS.includes(rotate) ? rotate : 0 };
}

export const snapshotUrl = (cam) => `${cam.base}/shot.jpg`;
