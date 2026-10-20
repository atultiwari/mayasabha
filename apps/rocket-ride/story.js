// The story engine: a pure state machine over STORY. updateStory() advances time (narration ends,
// travel finishes, actions time out kindly); storyEvent() handles claps, waves, pops, the phone's
// Help button and chapter skipping. Both return { state, effects } for main.js to perform
// (speech, sounds, big countdown numbers, praise).
import { DEFAULTS, NUMBERS, PRAISE, STORY } from './story-data.js';

export const ACT_TIMEOUT_S = 40; // an action finishes by itself after this, so nobody ever gets stuck
const HELP_WAVE = 0.34;

/** @typedef {{ chapter: number, step: number, t: number, count: number, wave: number, finished: boolean, duration?: number }} StoryState */
/** @typedef {{ lang: 'en'|'hi', name?: string, pilot?: string }} StoryContext */

export const currentStep = (s) => STORY[s.chapter]?.steps[s.step];

export function fillText(template, ctx) {
  const name = ctx.name || DEFAULTS.name[ctx.lang] || DEFAULTS.name.en;
  return template.replaceAll('{name}', name).replaceAll('{pilot}', ctx.pilot || '');
}

/** Seconds to leave for a spoken line (roughly 2.4 words a second, plus a breath). */
export function sayDuration(text) {
  return 1.2 + text.trim().split(/\s+/).length * 0.42;
}

function enterStep(state, ctx) {
  const step = currentStep(state);
  const base = { ...state, t: 0, count: 0, wave: 0 };
  if (!step) return { state: { ...base, finished: true }, effects: [{ type: 'end' }] };
  if (step.kind === 'say') {
    const text = fillText(step.text[ctx.lang], ctx);
    return { state: { ...base, duration: sayDuration(text) }, effects: [{ type: 'say', text }] };
  }
  if (step.kind === 'act') return { state: base, effects: [{ type: 'say', text: fillText(step.prompt[ctx.lang], ctx) }, { type: 'prompt', action: step.action }] };
  if (step.kind === 'travel') return { state: base, effects: [{ type: 'sound', name: 'boing' }, { type: 'travel' }] };
  return { state: base, effects: [{ type: 'goodnight' }] };
}

function goTo(state, chapter, step, ctx) {
  return enterStep({ ...state, chapter, step, finished: false }, ctx);
}

function advance(state, ctx) {
  const chapter = STORY[state.chapter];
  if (state.step + 1 < chapter.steps.length) return goTo(state, state.chapter, state.step + 1, ctx);
  if (state.chapter + 1 < STORY.length) return goTo(state, state.chapter + 1, 0, ctx);
  return { state: { ...state, finished: true }, effects: [{ type: 'end' }] };
}

function complete(state, ctx) {
  const praise = PRAISE[(state.chapter + state.step) % PRAISE.length][ctx.lang];
  const next = advance(state, ctx);
  return { state: next.state, effects: [{ type: 'sound', name: 'chime' }, { type: 'praise', text: praise }, ...next.effects] };
}

export function startStory(ctx) {
  return enterStep({ chapter: 0, step: 0, t: 0, count: 0, wave: 0, finished: false }, ctx);
}

/** Advances the story clock. @returns {{ state: StoryState, effects: object[] }} */
export function updateStory(prev, dt, ctx) {
  if (prev.finished) return { state: prev, effects: [] };
  const state = { ...prev, t: prev.t + dt };
  const step = currentStep(state);
  if (step.kind === 'say' && state.t >= state.duration) return advance(state, ctx);
  if (step.kind === 'act' && state.t >= ACT_TIMEOUT_S) return complete(state, ctx);
  if (step.kind === 'travel' && state.t >= step.seconds) return advance(state, ctx);
  if (step.kind === 'end' && state.t >= step.seconds) return { state: { ...state, finished: true }, effects: [{ type: 'end' }] };
  return { state, effects: [] };
}

function countUp(state, step, ctx) {
  const count = state.count + 1;
  const effects = [{ type: 'count', n: count }, { type: 'sound', name: 'pop' }];
  if (step.action === 'count') effects.push({ type: 'say', text: NUMBERS[ctx.lang][count - 1] ?? String(count) });
  return { state: { ...state, count }, effects };
}

function actionEvent(state, step, ev, ctx) {
  let r = { state, effects: [] };
  const counts = { clap: ['clap', 'count'], pop: ['pop'] };
  if (ev.type === 'wave' && step.action === 'wave') r = { state: { ...state, wave: state.wave + Math.max(0, ev.amount) }, effects: [] };
  else if (ev.type === 'help' && step.action === 'wave') r = { state: { ...state, wave: state.wave + HELP_WAVE }, effects: [] };
  else if (ev.type === 'help' || counts[ev.type]?.includes(step.action)) r = countUp(state, step, ctx);
  const done = step.action === 'wave' ? r.state.wave >= step.needed : r.state.count >= step.needed;
  if (!done) return r;
  const finished = complete(r.state, ctx);
  return { state: finished.state, effects: [...r.effects, ...finished.effects] };
}

/** Reacts to the child or a grown-up. @returns {{ state: StoryState, effects: object[] }} */
export function storyEvent(state, ev, ctx) {
  if (ev.type === 'next-chapter') return goTo(state, Math.min(STORY.length - 1, state.chapter + 1), 0, ctx);
  if (ev.type === 'prev-chapter') return goTo(state, Math.max(0, state.chapter - 1), 0, ctx);
  if (ev.type === 'restart') return startStory(ctx);
  if (state.finished) return { state, effects: [] };
  if (ev.type === 'skip') return advance(state, ctx);
  const step = currentStep(state);
  return step.kind === 'act' ? actionEvent(state, step, ev, ctx) : { state, effects: [] };
}
