/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

/** Server rejects anything longer; keep the tail so long threads still work. */
const MAX_TURNS = 19;

/**
 * Builds the history to send with a new question. Gemini requires the history
 * to open on a user turn, but the one-shot "Ask Advisor" button seeds the
 * thread with a bare model message — so anything before the first user turn is
 * dropped.
 */
export function trimChatHistory(thread: ChatTurn[], question: string): ChatTurn[] {
  const history: ChatTurn[] = [...thread, { role: 'user', text: question }];
  const firstUser = history.findIndex((m) => m.role === 'user');
  return history.slice(firstUser === -1 ? history.length : firstUser).slice(-MAX_TURNS);
}
