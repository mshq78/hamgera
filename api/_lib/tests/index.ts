import type { TestId } from '../../../shared/tests.js';
import type { TestHandler } from './types.js';
import { masirnama } from './masirnama.js';

export type { TestHandler, Processed } from './types.js';

const pending = (id: TestId, notReadyReason: string): TestHandler => ({
  id,
  ready: false,
  notReadyReason,
  process() {
    throw new Error(`${id} is not ready`);
  },
});

export const HANDLERS: Record<TestId, TestHandler> = {
  masirnama,
  naghshnama: pending('naghshnama', 'not_ported'),
  tasmimnama: pending('tasmimnama', 'not_ported'),
};
