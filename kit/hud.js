// Small on-screen helpers: a key-help panel (toggle with H) and short toast messages.
// Both sit outside the warped stage so they stay readable while you set things up.

function injectStyles() {
  if (document.getElementById('pk-hud-style')) return;
  const style = document.createElement('style');
  style.id = 'pk-hud-style';
  style.textContent = `
    .pk-help { position: fixed; right: 16px; bottom: 16px; max-width: 420px; padding: 14px 18px; border-radius: 12px;
      background: rgba(10,10,20,0.82); color: #f4f1ff; font: 500 15px/1.6 system-ui, sans-serif; z-index: 10; }
    .pk-help h2 { margin: 0 0 6px; font-size: 16px; }
    .pk-help kbd { display: inline-block; min-width: 1.6em; padding: 0 6px; margin-right: 8px; border-radius: 6px;
      background: #2c2850; text-align: center; font: 700 13px/1.6 ui-monospace, monospace; }
    .pk-help[hidden], .pk-toast[hidden] { display: none; }
    .pk-toast { position: fixed; left: 50%; top: 24px; transform: translateX(-50%); padding: 10px 18px; border-radius: 999px;
      background: rgba(10,10,20,0.85); color: #fff; font: 600 16px system-ui, sans-serif; z-index: 11; }
  `;
  document.head.append(style);
}

/**
 * @param {{ title: string, keys: [string, string][], footer?: string }} opts
 */
export function createHud({ title, keys, footer = '' }) {
  injectStyles();
  const help = document.createElement('aside');
  help.className = 'pk-help';
  const heading = document.createElement('h2');
  heading.textContent = title;
  help.append(heading);
  for (const [key, text] of keys) {
    const row = document.createElement('div');
    const kbd = document.createElement('kbd');
    kbd.textContent = key;
    row.append(kbd, document.createTextNode(text));
    help.append(row);
  }
  if (footer) {
    const foot = document.createElement('div');
    foot.style.marginTop = '8px';
    foot.style.opacity = '0.7';
    foot.textContent = footer;
    help.append(foot);
  }

  const toastEl = document.createElement('div');
  toastEl.className = 'pk-toast';
  toastEl.hidden = true;
  document.body.append(help, toastEl);

  let toastTimer = 0;
  function toast(message, ms = 1800) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
  }

  return {
    toggleHelp: () => { help.hidden = !help.hidden; },
    hideHelp: () => { help.hidden = true; },
    setFooter: (text) => {
      const foot = help.lastElementChild;
      if (footer && foot) foot.textContent = text;
    },
    toast,
  };
}
