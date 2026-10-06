import { request } from '@/core/services/http';
import type { RxResponse } from '../../../shared/reaction/metrics';
import type { TestStatus } from '../../../shared/schedule';

export interface RxEvent {
  id: string;
  code: string;
  title: string;
  eventDate: string | null;
  cohort: string | null;
  location: string | null;
  segments: string[];
  isActive: boolean;
  opensAt: string | null;
  closesAt: string | null;
  surveyVersion: string;
  createdAt: string;
  status: TestStatus;
  responses: number;
}

export interface RxStoredResponse extends RxResponse {
  deleted: boolean;
  clientVersion: string | null;
  tags: Record<string, string[]>;
}

export interface RxAuditEntry {
  id: number;
  action: string;
  eventId: string | null;
  responseId: string | null;
  before: unknown;
  after: unknown;
  at: string;
}

export interface EventInput {
  title: string;
  eventDate: string | null;
  cohort: string | null;
  location: string | null;
  segments: string[];
  isActive: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

const post = <T,>(pw: string, body: Record<string, unknown>) => request<T>('/api/reaction', { method: 'POST', adminPassword: pw, body });

export const rxApi = {
  events: (pw: string) => request<{ events: RxEvent[] }>('/api/reaction', { adminPassword: pw, query: { resource: 'events' } }),
  responses: (pw: string, eventIds: string[], includeDeleted = false) =>
    request<{ responses: RxStoredResponse[] }>('/api/reaction', { adminPassword: pw, query: { resource: 'responses', eventIds: eventIds.join(','), ...(includeDeleted ? { includeDeleted: '1' } : {}) } }),
  audit: (pw: string, eventId?: string) => request<{ audit: RxAuditEntry[] }>('/api/reaction', { adminPassword: pw, query: { resource: 'audit', ...(eventId ? { eventId } : {}) } }),
  createEvent: (pw: string, e: EventInput) => post<{ ok: true; id: string; code: string }>(pw, { action: 'createEvent', ...e }),
  updateEvent: (pw: string, id: string, e: EventInput) => post<{ ok: true }>(pw, { action: 'updateEvent', id, ...e }),
  editResponse: (pw: string, responseId: string, changes: Record<string, unknown>) => post<{ ok: true }>(pw, { action: 'editResponse', responseId, changes }),
  deleteResponse: (pw: string, responseId: string) => post<{ ok: true }>(pw, { action: 'deleteResponse', responseId }),
  restoreResponse: (pw: string, responseId: string) => post<{ ok: true }>(pw, { action: 'restoreResponse', responseId }),
  setTags: (pw: string, responseId: string, questionId: string, tags: string[]) => post<{ ok: true }>(pw, { action: 'setTags', responseId, questionId, tags }),
};

/** The link participants open. The form is served from the same site, behind the hash router. */
export const surveyLink = (code: string) => `${window.location.origin}/#/s/${code}`;
