import { request, HttpResult } from './http';
import type { TestId } from '../../../shared/tests';
import type { TestMode, TestStatus } from '../../../shared/schedule';

export interface LoginData {
  token: string;
  mobile: string;
  firstName: string;
  lastName: string;
}

export interface ParticipantTest {
  id: TestId;
  status: TestStatus;
  opensAt: string | null;
  closesAt: string | null;
  allowRetake: boolean;
  showResult: boolean;
  completed: boolean;
  completedAt: string | null;
}

export interface AdminTest {
  testId: TestId;
  mode: TestMode;
  opensAt: string | null;
  closesAt: string | null;
  graceMinutes: number;
  allowRetake: boolean;
  showResult: boolean;
  status: TestStatus;
  ready: boolean;
  notReadyReason: string | null;
  sessions: number;
  people: number;
}

export interface RosterUser {
  mobile: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  lastLoginAt: string | null;
  completed: TestId[];
}

export interface UserInput {
  firstName: string;
  lastName: string;
  mobile: string;
  nationalId: string;
}

export interface StoredSession<D = any, R = any> {
  sessionId: string;
  mobile: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  data: D;
  result: R | null;
}

export type SubmitFailure = 'offline' | 'closed' | 'already' | 'unauthorized' | 'server';

export const api = {
  login: (mobile: string, nationalId: string) => request<LoginData>('/api/auth', { method: 'POST', body: { mobile, nationalId } }),

  // participant
  listTests: (token: string) => request<{ serverNow: string; tests: ParticipantTest[] }>('/api/tests', { token }),
  mySession: (token: string, testId: TestId) =>
    request<{ session: { sessionId: string; submittedAt: string; result: any | null } | null }>('/api/sessions', { token, query: { testId } }),
  async submit(token: string, body: { testId: TestId; sessionId: string; startedAt: string; payload: unknown }) {
    const res = await request<{ ok: true; result: any | null }>('/api/sessions', { method: 'POST', token, body });
    if (res.ok) return { ok: true as const, result: res.data.result };
    const reason: SubmitFailure = res.offline ? 'offline' : res.status === 401 ? 'unauthorized' : res.status === 409 ? 'already' : res.status === 403 ? 'closed' : 'server';
    return { ok: false as const, reason };
  },

  // admin
  adminTests: (pw: string) => request<{ serverNow: string; tests: AdminTest[] }>('/api/tests', { adminPassword: pw }),
  saveSchedule: (pw: string, cfg: Omit<AdminTest, 'status' | 'ready' | 'notReadyReason' | 'sessions' | 'people'>) =>
    request<{ ok: true }>('/api/tests', { method: 'PUT', adminPassword: pw, body: cfg }),
  listUsers: (pw: string) => request<{ users: RosterUser[] }>('/api/users', { adminPassword: pw }),
  addUsers: (pw: string, users: UserInput[]) =>
    request<{ added: number; updated: number; errors: { index: number; reason: string }[] }>('/api/users', { method: 'POST', adminPassword: pw, body: { users } }),
  deleteUser: (pw: string, mobile: string) => request<{ ok: true }>('/api/users', { method: 'DELETE', adminPassword: pw, query: { mobile } }),
  adminSessions: <D = any, R = any>(pw: string, testId: TestId): Promise<HttpResult<{ sessions: StoredSession<D, R>[] }>> =>
    request('/api/sessions', { adminPassword: pw, query: { testId } }),
};
