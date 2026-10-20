import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORY } from '../apps/rocket-ride/story-data.js';
import { ACT_TIMEOUT_S, currentStep, fillText, sayDuration, startStory, storyEvent, updateStory } from '../apps/rocket-ride/story.js';

const ctx = { lang: 'en', name: 'Aarav', pilot: 'Masha' };

/** Runs the story for `seconds`, collecting effects. */
function run(state, seconds, dt = 0.1) {
  let s = state;
  const effects = [];
  for (let t = 0; t < seconds; t += dt) {
    const r = updateStory(s, dt, ctx);
    s = r.state;
    effects.push(...r.effects);
  }
  return { state: s, effects };
}

test('every line exists in English and Hindi', () => {
  for (const chapter of STORY) {
    for (const step of chapter.steps) {
      const text = step.text ?? step.prompt;
      if (text) assert.ok(text.en && text.hi, `${chapter.id}: missing translation`);
    }
  }
});

test('placeholders are filled with the child and co-pilot names', () => {
  assert.equal(fillText('Hello {name}! {pilot} too.', ctx), 'Hello Aarav! Masha too.');
  assert.ok(sayDuration('a b c d e f g h') > sayDuration('a b'));
});

test('the story starts by saying the first line', () => {
  const { state, effects } = startStory(ctx);
  assert.equal(state.chapter, 0);
  assert.deepEqual(effects[0], { type: 'say', text: 'Hello Aarav! Today we are flying to the Moon and the planets!' });
});

test('narration moves on by itself; an action waits for claps', () => {
  let { state } = startStory(ctx);
  ({ state } = run(state, 30));
  assert.equal(currentStep(state).kind, 'act');
  assert.equal(currentStep(state).action, 'clap');
  for (let i = 0; i < 2; i += 1) ({ state } = storyEvent(state, { type: 'clap' }, ctx));
  assert.equal(currentStep(state).kind, 'act');
  const third = storyEvent(state, { type: 'clap' }, ctx);
  assert.ok(third.effects.some((e) => e.type === 'praise'));
  assert.equal(currentStep(third.state).kind, 'say');
});

test('each clap during the countdown reports the count', () => {
  let { state } = startStory(ctx);
  ({ state } = run(state, 30));
  const r = storyEvent(state, { type: 'clap' }, ctx);
  assert.ok(r.effects.some((e) => e.type === 'count' && e.n === 1));
});

test('nobody gets stuck: an action completes on its own after the timeout', () => {
  let { state } = startStory(ctx);
  ({ state } = run(state, 30));
  assert.equal(currentStep(state).kind, 'act');
  const at = { chapter: state.chapter, step: state.step };
  ({ state } = run(state, ACT_TIMEOUT_S + 1));
  assert.notDeepEqual({ chapter: state.chapter, step: state.step }, at);
});

test('waving fills up gradually; the Help button also counts', () => {
  const marsAct = { chapter: 2, step: 1, t: 0, count: 0, wave: 0, finished: false };
  let r = storyEvent(marsAct, { type: 'wave', amount: 0.4 }, ctx);
  assert.equal(currentStep(r.state).kind, 'act');
  r = storyEvent(r.state, { type: 'help' }, ctx);
  r = storyEvent(r.state, { type: 'wave', amount: 0.4 }, ctx);
  assert.notEqual(currentStep(r.state).kind, 'act');
});

test('wrong kind of action is ignored (a clap does not pop bubbles)', () => {
  const popAct = { chapter: 3, step: 1, t: 0, count: 0, wave: 0, finished: false };
  const r = storyEvent(popAct, { type: 'clap' }, ctx);
  assert.equal(r.state.count, 0);
  assert.equal(storyEvent(popAct, { type: 'pop' }, ctx).state.count, 1);
});

test('next and back jump between chapters; the story finishes after the goodnight', () => {
  let { state } = startStory(ctx);
  ({ state } = storyEvent(state, { type: 'next-chapter' }, ctx));
  assert.equal(STORY[state.chapter].id, 'moon');
  ({ state } = storyEvent(state, { type: 'prev-chapter' }, ctx));
  assert.equal(STORY[state.chapter].id, 'launch');
  for (let i = 0; i < STORY.length; i += 1) ({ state } = storyEvent(state, { type: 'next-chapter' }, ctx));
  assert.equal(STORY[state.chapter].id, 'home');
  ({ state } = run(state, 120));
  assert.equal(state.finished, true);
});

test('the whole story can be played hands-free from start to end', () => {
  let { state } = startStory(ctx);
  ({ state } = run(state, 60 * 12, 0.25));
  assert.equal(state.finished, true);
});
