// Is the local MayaSabha server behind this page? On the online version (GitHub Pages) there is no
// server, so the phone remote and the Wi-Fi address are unavailable and pages run keyboard-only.
// The answer is fetched once and shared.

let pending = null;

/** @returns {Promise<{ port: number, remoteUrls: string[] } | null>} null when there is no local server */
export function serverInfo() {
  if (!pending) {
    pending = fetch('/api/info', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => (body?.success && Array.isArray(body.data?.remoteUrls) ? body.data : null))
      .catch(() => null);
  }
  return pending;
}
