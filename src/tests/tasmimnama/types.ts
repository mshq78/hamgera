import type { CharacterCode } from './content/characters.codes';

/** The payload the participant flow sends with the final submission (POST /api/sessions → `payload`). */
export interface SubmitPayload {
  trackingCode: string;
  startedAt: string;
  finishedAt: string;
  /** question id → chosen option id */
  answers: Record<string, string>;
  tiebreakAnswer: string | null;
}

/** What the participant may see after submitting. */
export interface TasmimnamaResult {
  characterCode: CharacterCode;
  trackingCode: string | null;
  finishedAt: string;
}

/** What the server stores for a session of this test (admin only). */
export interface SessionData {
  trackingCode: string | null;
  startedAt: string;
  finishedAt: string;
  answers: Record<string, string>;
  tiebreakAnswer: string | null;
  tally: Record<CharacterCode, number>;
}

/** The draft kept on the device until the final submission succeeds. */
export interface Draft {
  sessionId: string;
  trackingCode: string;
  startedAt: string;
  answers: Record<string, string>;
  tiebreakAnswer: string | null;
}
