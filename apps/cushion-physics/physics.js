// Matter.js world (adapted from sticky-bounce): static bodies mirror the cushions, fruit or marbles
// tumble down and bounce off them, a sensor at Hathi's mouth counts arrivals. Matter mutates its own
// bodies by design; that is contained in this module.

const ITEM_RADIUS = { fruit: 46, marble: 26 };
const REST_SPEED = 0.35;
const MAX_STEP_MS = 1000 / 60;
const REST_LIMIT_S = 3.5; // fruit stuck on a flat cushion disappears after this, so the game never jams

/**
 * @param {any} Matter global from lib/matter/matter.min.js
 * @param {{ onHit: (cushionId: string, strength: number) => void, onGoal: (item: object) => void }} hooks
 */
export function createPhysics(Matter, { onHit, onGoal }) {
  const { Engine, Bodies, Body, Composite, Events, Vertices } = Matter;
  const engine = Engine.create({ gravity: { x: 0, y: 1 } });
  let cushions = new Map(); // id -> { body, version }
  let goal = null;
  let walls = [];

  Events.on(engine, 'collisionStart', ({ pairs }) => {
    for (const { bodyA, bodyB } of pairs) {
      const item = bodyA.label === 'item' ? bodyA : bodyB.label === 'item' ? bodyB : null;
      if (!item) continue;
      const other = item === bodyA ? bodyB : bodyA;
      if (other.label === 'goal') {
        Composite.remove(engine.world, item);
        onGoal(item.plugin);
      } else if (other.label === 'cushion') {
        onHit(other.plugin.id, Math.min(1, item.speed / 14));
      }
    }
  });

  function setBounds(stage) {
    walls.forEach((w) => Composite.remove(engine.world, w));
    const t = 60;
    walls = [
      Bodies.rectangle(-t / 2, stage.h / 2, t, stage.h * 2, { isStatic: true, label: 'wall' }),
      Bodies.rectangle(stage.w + t / 2, stage.h / 2, t, stage.h * 2, { isStatic: true, label: 'wall' }),
    ];
    Composite.add(engine.world, walls);
  }

  function makeCushion(c) {
    const centre = Vertices.centre(c.points);
    return Bodies.fromVertices(centre.x, centre.y, [c.points], {
      isStatic: true, label: 'cushion', restitution: 0.75, friction: 0.02, plugin: { id: c.id },
    });
  }

  /** @param {{ id: string, version: number, points: {x:number,y:number}[] }[]} list stage px */
  function syncCushions(list) {
    const next = new Map();
    for (const c of list) {
      const existing = cushions.get(c.id);
      if (existing && existing.version === c.version) {
        next.set(c.id, existing);
        continue;
      }
      if (existing) Composite.remove(engine.world, existing.body);
      const body = makeCushion(c);
      Composite.add(engine.world, body);
      next.set(c.id, { body, version: c.version });
    }
    cushions.forEach((c, id) => {
      if (!next.has(id)) Composite.remove(engine.world, c.body);
    });
    cushions = next;
  }

  function setGoal(rect) {
    if (goal) Composite.remove(engine.world, goal);
    goal = Bodies.rectangle(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, { isStatic: true, isSensor: true, label: 'goal' });
    Composite.add(engine.world, goal);
  }

  const items = () => Composite.allBodies(engine.world).filter((b) => b.label === 'item');

  /** @param {{ kind: 'fruit'|'marble', look: string }} what */
  function drop(what, x, y) {
    const r = ITEM_RADIUS[what.kind];
    const body = Bodies.circle(x, y, r, {
      label: 'item', restitution: what.kind === 'marble' ? 0.8 : 0.45, friction: 0.02, frictionAir: 0.006, plugin: { ...what },
    });
    Body.setVelocity(body, { x: (Math.random() - 0.5) * 4, y: 0 });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2);
    Composite.add(engine.world, body);
  }

  /** Removes items that fell away or have been resting too long. @returns {{x:number,y:number}[]} where items vanished */
  function cull(stage, dt) {
    const vanished = [];
    for (const b of items()) {
      b.plugin.rest = b.speed < REST_SPEED ? (b.plugin.rest ?? 0) + dt : 0;
      if (b.position.y > stage.h + 120) Composite.remove(engine.world, b);
      else if (b.plugin.rest > REST_LIMIT_S) {
        vanished.push({ x: b.position.x, y: b.position.y });
        Composite.remove(engine.world, b);
      }
    }
    return vanished;
  }

  return {
    setBounds, syncCushions, setGoal, drop, cull, items,
    clear: () => items().forEach((b) => Composite.remove(engine.world, b)),
    /** Advances in sub-steps of at most 1/60 s (Matter is most stable with small steps). */
    step: (dtMs) => {
      let left = Math.min(dtMs, 50);
      while (left > 0.5) {
        const slice = Math.min(MAX_STEP_MS, left);
        Engine.update(engine, slice);
        left -= slice;
      }
    },
    radius: (kind) => ITEM_RADIUS[kind],
  };
}
