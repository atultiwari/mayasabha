// Browser side of the phone-remote relay. Used by stage pages (announce buttons, receive presses)
// and by the phone remote page (receive buttons, send presses). Reconnects automatically.
import { parseServerMessage } from './protocol.js';
import { serverInfo } from './server-info.js';

const RETRY_MS = 2000;

/**
 * @param {{ role: 'stage'|'remote', layout?: object, onMessage: (msg: object) => void, onStatus?: (s: string) => void }} opts
 * @returns {{ send: (msg: object) => void, setLayout: (layout: object) => void }}
 */
export function connectRemote({ role, layout = null, onMessage, onStatus = () => {} }) {
  let socket = null;
  let currentLayout = layout;

  function hello() {
    send({ type: 'hello', role, layout: role === 'stage' ? currentLayout : undefined });
  }

  function open() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    try {
      socket = new WebSocket(`${protocol}://${location.host}/ws`);
    } catch (err) {
      onStatus('offline');
      console.warn('remote: cannot open socket', err);
      return;
    }
    socket.addEventListener('open', () => {
      onStatus('connected');
      hello();
    });
    socket.addEventListener('message', (event) => {
      const msg = parseServerMessage(event.data);
      if (msg) onMessage(msg);
    });
    socket.addEventListener('close', () => {
      onStatus('offline');
      setTimeout(open, RETRY_MS);
    });
    socket.addEventListener('error', () => socket.close());
  }

  function send(msg) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  }

  function setLayout(next) {
    currentLayout = next;
    hello();
  }

  // Only connect when the local server is there (not on the online, static version).
  serverInfo().then((info) => (info ? open() : onStatus('unavailable')));
  return { send, setLayout };
}
