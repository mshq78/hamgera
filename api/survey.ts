import { allow, endpoint, HttpError, queryString } from './_lib/http.js';
import { db } from './_lib/db.js';
import { answerRows, eventByCode, statusOf } from './_lib/reaction.js';
import { cleanSubmission, eventAccepts } from '../shared/reaction/validate.js';
import { SURVEY_VERSION } from '../shared/reaction/questions.js';
import { cleanHampayam } from '../shared/hampayam/validate.js';
import { HP_VERSION } from '../shared/hampayam/questions.js';

/**
 * Public, anonymous endpoint of an event survey (no login). Nothing identifying is read or stored: no name,
 * phone, e-mail, token or IP address — only the answers, the optional group the respondent picked and times.
 *
 * GET  /api/survey?code=…  → { title, eventDate, segments, status, opensAt, closesAt }
 * POST /api/survey { code, responseId, startedAt, segment?, answers, words, clientVersion }
 *      Idempotent by responseId: sending the same response again never creates a second one.
 */

const RESPONSE_ID = /^[A-Za-z0-9-]{16,64}$/;
const CODE = /^[a-z0-9]{6,20}$/;

export default endpoint(async (req, res) => {
  allow(req, res, 'GET', 'POST');
  const code = req.method === 'GET' ? queryString(req, 'code') : req.body?.code;
  if (typeof code !== 'string' || !CODE.test(code)) throw new HttpError(404, 'not_found');
  const event = await eventByCode(code);
  if (!event) throw new HttpError(404, 'not_found');
  const now = Date.now();

  if (req.method === 'GET') {
    return {
      kind: event.kind,
      config: event.config,
      title: event.title,
      eventDate: event.eventDate,
      segments: event.segments,
      status: statusOf(event, now),
      opensAt: event.opensAt,
      closesAt: event.closesAt,
      serverNow: new Date(now).toISOString(),
    };
  }

  const { responseId, clientVersion } = req.body ?? {};
  if (typeof responseId !== 'string' || !RESPONSE_ID.test(responseId)) throw new HttpError(400, 'invalid_response');
  const sql = await db();

  // A retry of a submission that already went through.
  const same = await sql`SELECT event_id FROM hamgera_rx_responses WHERE id = ${responseId}`;
  if (same.length > 0) {
    if (same[0].event_id !== event.id) throw new HttpError(409, 'response_conflict');
    return { ok: true };
  }

  const hp = event.kind === 'hampayam';
  // HamPayam keeps no separate "segment": its optional profile answers (P01–P03) are stored like any other answer.
  const clean = hp
    ? (() => {
        const c = cleanHampayam(req.body, event.segments, event.config);
        return 'error' in c ? c : { ...c, segment: null as string | null, words: [] as string[] };
      })()
    : cleanSubmission(req.body, event.segments);
  if ('error' in clean) throw new HttpError(400, clean.error);
  if (!eventAccepts(event, clean.startedAt, now)) throw new HttpError(403, 'closed');

  const duration = Math.max(0, Math.round((now - Date.parse(clean.startedAt)) / 1000));
  const version = typeof clientVersion === 'string' ? clientVersion.slice(0, 20) : hp ? HP_VERSION : SURVEY_VERSION;
  const inserted = await sql`
    INSERT INTO hamgera_rx_responses (id, event_id, segment, status, started_at, submitted_at, duration_seconds, client_version)
    VALUES (${responseId}, ${event.id}, ${clean.segment}, 'submitted', ${clean.startedAt}::timestamptz, now(), ${duration}, ${version})
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  if (inserted.length === 0) return { ok: true }; // lost a race with an identical retry

  try {
    await sql`
      INSERT INTO hamgera_rx_answers (response_id, question_id, numeric_value, text_value, word_index)
      SELECT ${responseId}, x.q, x.n, x.t, x.w
      FROM jsonb_to_recordset(${JSON.stringify(answerRows(clean.answers, clean.words))}::jsonb) AS x(q text, n numeric, t text, w int)
    `;
  } catch (err) {
    await sql`DELETE FROM hamgera_rx_responses WHERE id = ${responseId}`; // never leave an answerless response behind
    throw err;
  }
  return { ok: true };
});
