import type { TestId } from '../../../shared/tests.js';
import type { TestHandler } from './types.js';
import { masirnama } from './masirnama.js';
import { naghshnama } from './naghshnama.js';
import { tasmimnama } from './tasmimnama.js';

export type { TestHandler, Processed } from './types.js';

export const HANDLERS: Record<TestId, TestHandler> = {
  masirnama,
  naghshnama,
  tasmimnama,
};
