import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, parseManifest, remoteLayout, resolveCharacters } from '../kit/characters.js';

test('without a manifest every role uses the built-in Noto art, facing left', () => {
  const chars = resolveCharacters({});
  assert.deepEqual(Object.keys(chars).sort(), Object.keys(ROLES).sort());
  assert.equal(chars.pet.src, '../../assets/noto/3d-dog.png');
  assert.equal(chars.pet.facing, -1);
  assert.equal(chars.pet.custom, false);
});

test('a manifest swaps in custom art, names and facing for chosen roles only', () => {
  const overrides = parseManifest({
    pet: { file: 'tom.png', faces: 'right', label: 'Tom', icon: '🐱', scale: 1.3 },
    mouse: { file: 'jerry.webp', label: 'Jerry' },
  });
  const chars = resolveCharacters(overrides);
  assert.equal(chars.pet.src, '../../assets/custom/tom.png');
  assert.equal(chars.pet.facing, 1);
  assert.equal(chars.pet.scale, 1.3);
  assert.equal(chars.mouse.label, 'Jerry');
  assert.equal(chars.mouse.facing, -1);
  assert.equal(chars.elephant.custom, false);
});

test('parseManifest drops unknown roles, unsafe file names and silly values', () => {
  const out = parseManifest({
    dragon: { file: 'd.png' },
    pet: { file: '../../server.mjs' },
    mouse: { file: 'sub/dir.png' },
    monkey: { file: 'ok.PNG', faces: 'up', scale: 99, label: 'x'.repeat(40) },
    apple: 'nope',
  });
  assert.deepEqual(Object.keys(out), ['monkey']);
  assert.equal(out.monkey.facing, -1);
  assert.equal(out.monkey.scale, 3);
  assert.equal(out.monkey.label.length, 16);
  assert.deepEqual(parseManifest(null), {});
  assert.deepEqual(parseManifest([1, 2]), {});
});

test('remote buttons use the custom names and icons', () => {
  const layout = remoteLayout(resolveCharacters(parseManifest({ mouse: { file: 'j.png', label: 'Jerry', icon: '🧀' } })));
  const mouse = layout.buttons.find((b) => b.id === 'mouse');
  assert.equal(mouse.label, 'Jerry');
  assert.equal(mouse.icon, '🧀');
  assert.ok(layout.buttons.some((b) => b.id === 'demo'));
});

test('a role can have a second picture for its happy pose; custom art sits flush on the ledge', () => {
  const chars = resolveCharacters(parseManifest({ pet: { file: 'masha.png', happyFile: 'masha-happy.png' }, mouse: { file: 'm.png', happyFile: '../x.png' } }));
  assert.equal(chars.pet.happySrc, '../../assets/custom/masha-happy.png');
  assert.equal(chars.mouse.happySrc, null);
  assert.equal(chars.pet.footPad, 0);
  assert.ok(chars.elephant.footPad > 0);
});

test('the penguin is a role with its own phone button', () => {
  const layout = remoteLayout(resolveCharacters({}));
  assert.ok(layout.buttons.some((b) => b.id === 'penguin'));
  assert.equal(resolveCharacters({}).penguin.src, '../../assets/noto/3d-penguin.png');
});
