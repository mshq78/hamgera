import type { TestId } from '../../../shared/tests.js';

/** What a submission turns into: the sanitised raw data (always kept) and the computed result, if the test has one. */
export interface Processed {
  data: Record<string, unknown>;
  result: Record<string, unknown> | null;
}

export interface TestHandler {
  id: TestId;
  /** False while the instrument cannot be scored yet; such a test cannot be opened by the admin. */
  ready: boolean;
  notReadyReason?: string;
  /** Validates the payload (throws HttpError 400 `invalid_session`) and computes the result on the server. */
  process(payload: unknown): Processed;
}
