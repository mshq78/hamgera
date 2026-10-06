import { HttpError } from '../http.js';
import type { TestHandler } from './types.js';

/**
 * مسیرنما: 12 free-text answers. Nothing is scored at submission time — the admin analyses sessions later
 * (api/analysis.ts), so the result is null and the participant never sees one.
 */

export const MASIRNAMA_QUESTION_IDS = Array.from({ length: 12 }, (_, i) => `Q${String(i + 1).padStart(2, '0')}`);
const MAX_TEXT = 1500;
const MAX_REVISIONS = 100;

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, 0), 1e9) : 0);

/** Rebuilds the payload from known fields only. Returns null when invalid. */
export function sanitizeMasirnama(body: any) {
  if (!body || typeof body !== 'object') return null;

  const questionSetVersion = str(body.questionSetVersion, 20);
  const consentVersion = str(body.consentVersion, 20);
  const consentAcceptedAt = str(body.consentAcceptedAt, 40);
  const startedAt = str(body.startedAt, 40);
  const finishedAt = str(body.finishedAt, 40);
  if (!questionSetVersion || !consentVersion || !consentAcceptedAt || !startedAt || !finishedAt) return null;

  if (!Array.isArray(body.answers) || body.answers.length !== MASIRNAMA_QUESTION_IDS.length) return null;
  const answers = [];
  for (const [i, a] of body.answers.entries()) {
    if (!a || typeof a !== 'object' || a.questionId !== MASIRNAMA_QUESTION_IDS[i]) return null;
    const text = str(a.text, MAX_TEXT);
    const m = a.clientMeta;
    if (!text || !text.trim() || !m || typeof m !== 'object') return null;
    const revisions = (Array.isArray(m.revisions) ? m.revisions : [])
      .slice(0, MAX_REVISIONS)
      .map((r: any) => ({ savedAt: str(r?.savedAt, 40) ?? '', text: str(r?.text, MAX_TEXT) ?? '' }));
    answers.push({
      questionId: a.questionId,
      text,
      clientMeta: {
        activeTimeMs: num(m.activeTimeMs),
        pasteEvents: num(m.pasteEvents),
        pastedChars: num(m.pastedChars),
        editCount: num(m.editCount),
        revisions,
        timestamp: str(m.timestamp, 40) ?? '',
        questionSetVersion: str(m.questionSetVersion, 20) ?? '',
      },
    });
  }

  return { questionSetVersion, consentVersion, consentAcceptedAt, startedAt, finishedAt, answers };
}

export const masirnama: TestHandler = {
  id: 'masirnama',
  ready: true,
  process(payload) {
    const data = sanitizeMasirnama(payload);
    if (!data) throw new HttpError(400, 'invalid_session');
    return { data, result: null };
  },
};
