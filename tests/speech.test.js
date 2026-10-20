import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VOICE_KEY, voiceOn } from '../kit/speech.js';

test('spoken words are off unless the family switched them on (homepage)', () => {
  assert.equal(voiceOn(null), false);
  assert.equal(voiceOn(undefined), false);
  assert.equal(voiceOn(false), false);
  assert.equal(voiceOn('yes'), false, 'only a real true counts');
  assert.equal(voiceOn(true), true);
  assert.equal(VOICE_KEY, 'voice');
});
