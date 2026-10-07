/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-check for the chat history the UI sends to /api/ai/advise. Gemini
 * rejects history that doesn't open on a user turn, and the one-shot advice
 * button seeds the thread with a bare model message — so this is the case that
 * breaks in production if the trimming regresses.
 *
 * Run: node --experimental-strip-types src/lib/chatHistory.check.ts
 */

import assert from 'node:assert';
import { trimChatHistory } from './chatHistory.ts';

type Turn = { role: 'user' | 'model'; text: string };
const u = (text: string): Turn => ({ role: 'user', text });
const m = (text: string): Turn => ({ role: 'model', text });

// Thread seeded by "Ask Advisor": leading model turn must be dropped.
assert.deepEqual(trimChatHistory([m('advice')], 'q'), [u('q')]);

// Mid-conversation: leading model turn dropped, the rest kept in order.
assert.deepEqual(trimChatHistory([m('advice'), u('a'), m('b')], 'c'), [u('a'), m('b'), u('c')]);

// Already opens on a user turn: untouched apart from the appended question.
assert.deepEqual(trimChatHistory([u('a'), m('b')], 'c'), [u('a'), m('b'), u('c')]);

// Empty thread.
assert.deepEqual(trimChatHistory([], 'q'), [u('q')]);

// Long thread is capped, still opens on a user turn and ends on the new one.
const long: Turn[] = [m('advice')];
for (let i = 0; i < 40; i++) long.push(i % 2 === 0 ? u(`u${i}`) : m(`m${i}`));
const trimmed = trimChatHistory(long, 'latest');
assert.ok(trimmed.length <= 19, `expected <= 19 turns, got ${trimmed.length}`);
assert.equal(trimmed[0].role, 'user');
assert.equal(trimmed[trimmed.length - 1].text, 'latest');

// A thread that is nothing but model turns still yields a valid request.
assert.deepEqual(trimChatHistory([m('a'), m('b')], 'q'), [u('q')]);

console.log('chatHistory: all checks passed');
