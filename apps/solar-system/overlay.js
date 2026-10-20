// Text drawn over the 3D view, inside the warped stage so it is corner-pinned with the picture:
// name labels that follow each body, and a big caption (name + fact) when flying to one.

const STYLE = `
  .ss-label { position: absolute; transform: translate(-50%, 0); color: #e8f0ff; font: 700 26px system-ui, sans-serif;
    text-shadow: 0 2px 8px #000; pointer-events: none; white-space: nowrap; }
  .ss-caption { position: absolute; left: 50%; bottom: 60px; transform: translateX(-50%); max-width: 1500px; text-align: center;
    color: #fff; font: 600 40px/1.35 system-ui, sans-serif; text-shadow: 0 3px 14px #000; transition: opacity 600ms ease; }
  .ss-caption h2 { margin: 0 0 8px; font-size: 84px; letter-spacing: 0.01em; color: #ffe08a; }
  .ss-caption[hidden] { display: block; opacity: 0; }
`;

/**
 * @param {HTMLElement} host the stage's warped container
 * @param {{ id: string }[]} bodies
 */
export function createOverlay(host, bodies) {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);
  const labels = new Map(bodies.map((b) => {
    const el = document.createElement('div');
    el.className = 'ss-label';
    host.append(el);
    return [b.id, el];
  }));
  const caption = document.createElement('div');
  caption.className = 'ss-caption';
  caption.hidden = true;
  const title = document.createElement('h2');
  const text = document.createElement('div');
  caption.append(title, text);
  host.append(caption);

  return {
    /** @param {Map<string, {x:number,y:number,visible:boolean,text:string}>} positions stage px */
    updateLabels(positions, show) {
      for (const [id, el] of labels) {
        const p = positions.get(id);
        const visible = show && p?.visible;
        el.style.display = visible ? 'block' : 'none';
        if (!visible) continue;
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
        if (el.textContent !== p.text) el.textContent = p.text;
      }
    },
    showCaption(name, fact) {
      title.textContent = name;
      text.textContent = fact;
      caption.hidden = false;
    },
    hideCaption() {
      caption.hidden = true;
    },
  };
}
