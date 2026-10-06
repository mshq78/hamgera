import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { TestId, TestMeta } from '../../shared/tests';
import type { StoredSession } from '@/core/services/api';

export interface ResultViewProps {
  result: any;
}

export interface AdminResultsProps {
  adminPassword: string;
  sessions: StoredSession[];
  reload: () => Promise<void>;
}

/**
 * Everything the platform needs to host a test. A test owns its questions, screens, scoring display and admin
 * results; login, drafts storage, scheduling and submission are provided by the platform (see TestRuntime).
 */
export interface TestDefinition {
  meta: TestMeta;
  icon: LucideIcon;
  /** The participant flow. Mounted at /t/<id>/*; navigation inside uses useTestNavigate(). */
  Root: React.LazyExoticComponent<React.ComponentType>;
  /** Shows a stored result (when the admin lets participants see it). Omit for tests without a result. */
  ResultView?: React.LazyExoticComponent<React.ComponentType<ResultViewProps>>;
  /** The admin's results tab for this test. */
  AdminResults: React.LazyExoticComponent<React.ComponentType<AdminResultsProps>>;
}

export type Registry = Record<TestId, TestDefinition>;
