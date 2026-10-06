import { request } from '@/core/services/http';
import type { AnalysisResult, AnalysisSummary, ManualFormSpec, ManualQuestionRating } from './types';

/** Admin-only calls to /api/analysis (the engine and its rules live on the server). */
export const analysisApi = {
  list: (pw: string) => request<{ analyses: AnalysisSummary[] }>('/api/analysis', { adminPassword: pw }),
  get: (pw: string, sessionId: string) =>
    request<{ result: AnalysisResult; versions: number }>('/api/analysis', { adminPassword: pw, query: { sessionId } }),
  form: (pw: string, sessionId: string) => request<ManualFormSpec>('/api/analysis', { adminPassword: pw, query: { sessionId, form: '1' } }),
  run: (pw: string, sessionId: string, method: 'ai' | 'rules') =>
    request<{ result: AnalysisResult }>('/api/analysis', { method: 'POST', adminPassword: pw, body: { sessionId, method } }),
  manual: (pw: string, sessionId: string, ratings: ManualQuestionRating[], note: string) =>
    request<{ result: AnalysisResult }>('/api/analysis', { method: 'POST', adminPassword: pw, body: { sessionId, method: 'manual', ratings, note } }),
  auditExport: (pw: string, sessionId: string) =>
    request<{ ok: true }>('/api/analysis', { method: 'POST', adminPassword: pw, body: { sessionId, audit: 'export' } }),
};
