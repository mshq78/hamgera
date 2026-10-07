import { request } from '@/core/services/http';

export interface PublicEvent {
  kind: 'tt' | 'hampayam';
  config: { profileP02: boolean; profileP03: boolean };
  title: string;
  eventDate: string | null;
  segments: string[];
  status: 'open' | 'upcoming' | 'ended' | 'closed';
  opensAt: string | null;
  closesAt: string | null;
  serverNow: string;
}

export const surveyApi = {
  event: (code: string) => request<PublicEvent>('/api/survey', { query: { code } }),
  submit: (body: Record<string, unknown>) => request<{ ok: true }>('/api/survey', { method: 'POST', body }),
};
