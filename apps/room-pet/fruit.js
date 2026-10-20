// Falling fruit (banana, apple, orange) that lands and settles on ledges. Pure and immutable.
import { ledgeBelow, yAt } from '../../kit/ledges.js';

export const FRUIT = Object.freeze({ gravity: 1900, bounce: 0.38, restSpeed: 260, size: 150, maxBites: 3 });
export const FRUIT_KINDS = Object.freeze(['banana', 'apple', 'orange']);

let counter = 0;

/** @returns {{ id: string, kind: string, x: number, y: number, vy: number, rot: number, spin: number, resting: boolean, ledgeId: string|null, bites: number }} */
export function spawnFruit(kind, x, rng = Math.random) {
  counter += 1;
  return { id: `fruit-${counter}`, kind, x, y: -FRUIT.size, vy: 0, rot: rng() * 6, spin: (rng() - 0.5) * 8, resting: false, ledgeId: null, bites: 0 };
}

function stepOne(fruit, ledges, dt) {
  if (fruit.resting) {
    // Its ledge was deleted in edit mode: start falling again.
    const ledge = ledges.find((l) => l.id === fruit.ledgeId);
    return ledge ? { ...fruit, y: yAt(ledge, fruit.x) } : { ...fruit, resting: false, ledgeId: null };
  }
  const vy = fruit.vy + FRUIT.gravity * dt;
  const y = fruit.y + vy * dt;
  const surface = ledgeBelow(ledges, { x: fruit.x, y: fruit.y });
  const floorY = surface ? yAt(surface, fruit.x) : Infinity;
  const rot = fruit.rot + fruit.spin * dt;
  if (y < floorY) return { ...fruit, y, vy, rot };
  if (vy > FRUIT.restSpeed) return { ...fruit, y: floorY, vy: -vy * FRUIT.bounce, rot, spin: fruit.spin * 0.5 };
  return { ...fruit, y: floorY, vy: 0, rot: 0, spin: 0, resting: true, ledgeId: surface.id };
}

/** Advances all fruit; fruit that falls off the bottom of the stage is dropped. */
export function stepFruits(fruits, ledges, dt, stageHeight) {
  return fruits.map((f) => stepOne(f, ledges, dt)).filter((f) => f.y < stageHeight + FRUIT.size);
}

export const biteFruit = (fruits, id) => fruits.map((f) => (f.id === id ? { ...f, bites: Math.min(FRUIT.maxBites, f.bites + 1) } : f));
export const removeFruit = (fruits, id) => fruits.filter((f) => f.id !== id);
