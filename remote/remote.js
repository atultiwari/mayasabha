// Phone remote: shows the buttons announced by whichever activity is open on the projector.
import { connectRemote } from '../kit/remote-link.js';

const grid = document.getElementById('grid');
const title = document.getElementById('title');
const status = document.getElementById('status');

function renderLayout(layout) {
  title.textContent = layout.title || 'Projector Remote';
  grid.replaceChildren(...layout.buttons.map((b) => {
    const btn = document.createElement('button');
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = b.icon;
    const label = document.createElement('span');
    label.textContent = b.label;
    btn.append(icon, label);
    btn.addEventListener('click', () => {
      link.send({ type: 'press', id: b.id });
      navigator.vibrate?.(20);
      btn.classList.add('flash');
      setTimeout(() => btn.classList.remove('flash'), 150);
    });
    return btn;
  }));
}

const link = connectRemote({
  role: 'remote',
  onMessage: (msg) => {
    if (msg.type === 'layout') renderLayout(msg.layout);
  },
  onStatus: (s) => {
    status.textContent = s === 'connected' ? '● connected' : '○ reconnecting…';
    status.className = s;
  },
});
