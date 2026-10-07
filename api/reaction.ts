import { allow, endpoint, HttpError, queryString } from './_lib/http.js';
import { db } from './_lib/db.js';
import { requireAdmin } from './_lib/auth.js';
import { answerRows, eventById, eventFromRow, loadResponses, newEventCode, newId, statusOf } from './_lib/reaction.js';
import { LIKERT_IDS, MAX_OPEN_CHARS, MAX_WORD_CHARS, NPS_ID, OPEN_IDS, OVERALL_ID, SURVEY_VERSION, WORDS_ID, WORD_COUNT } from '../shared/reaction/questions.js';
import { sanitizeText } from '../shared/reaction/validate.js';
import { HP_JOURNEY_IDS, HP_LIKERT_IDS, HP_NA, HP_OPEN, HP_OPEN_IDS, HP_SCALE_IDS, HP_VERSION, hpConfig } from '../shared/hampayam/questions.js';

/**
 * Admin-only management of reaction surveys (header `x-admin-password`).
 *
 * GET  ?resource=events                         → events with response counts and link status
 * GET  ?resource=responses&eventIds=a,b[&includeDeleted=1] → final responses (raw answers)
 * GET  ?resource=audit[&eventId=…]              → the audit log (latest 200)
 * POST { action: 'createEvent' | 'updateEvent', … }
 * POST { action: 'editResponse', responseId, changes: { Q03: 4, Q23: '…', Q27: ['a','b'], segment: '…' } }
 * POST { action: 'deleteResponse' | 'restoreResponse', responseId }      (soft delete)
 * POST { action: 'setTags', responseId, questionId, tags: [...] }
 *
 * Every edit, delete, restore and tag change is written to the audit log with before/after values.
 */

const MAX_SEGMENTS = 30;
const iso = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null;
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  if (!Number.isFinite(t)) throw new HttpError(400, 'invalid_time');
  return new Date(t).toISOString();
};
const text = (v: unknown, max: number): string | null => sanitizeText(v, max) || null;

function eventInput(b: any) {
  const title = sanitizeText(b.title, 120);
  if (!title) throw new HttpError(400, 'invalid_title');
  let eventDate: string | null = null;
  if (b.eventDate) {
    if (typeof b.eventDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.eventDate) || !Number.isFinite(Date.parse(b.eventDate))) throw new HttpError(400, 'invalid_date');
    eventDate = b.eventDate;
  }
  const segments = Array.isArray(b.segments) ? [...new Set(b.segments.map((s: unknown) => sanitizeText(s, 60)).filter(Boolean))].slice(0, MAX_SEGMENTS) : [];
  const opensAt = iso(b.opensAt);
  const closesAt = iso(b.closesAt);
  if (opensAt && closesAt && Date.parse(closesAt) <= Date.parse(opensAt)) throw new HttpError(400, 'closes_before_opens');
  const config = hpConfig(b.config);
  return { title, eventDate, cohort: text(b.cohort, 60), location: text(b.location, 120), segments, isActive: b.isActive !== false, opensAt, closesAt, config };
}

export default endpoint(async (req, res) => {
  allow(req, res, 'GET', 'POST');
  requireAdmin(req);
  const sql = await db();
  const audit = (action: string, eventId: string | null, responseId: string | null, before: unknown, after: unknown) =>
    sql`INSERT INTO hamgera_rx_audit (admin_user, action, event_id, response_id, before_json, after_json)
        VALUES ('admin', ${action}, ${eventId}, ${responseId}, ${before === null ? null : JSON.stringify(before)}::jsonb, ${after === null ? null : JSON.stringify(after)}::jsonb)`;

  if (req.method === 'GET') {
    const resource = queryString(req, 'resource');
    if (resource === 'events') {
      const rows = await sql`
        SELECT e.*, (SELECT count(*)::int FROM hamgera_rx_responses r WHERE r.event_id = e.id AND r.deleted_at IS NULL) AS responses
        FROM hamgera_rx_events e ORDER BY e.event_date DESC NULLS LAST, e.created_at DESC
      `;
      return { serverNow: new Date().toISOString(), events: rows.map((r) => ({ ...eventFromRow(r), status: statusOf(eventFromRow(r)), responses: r.responses })) };
    }
    if (resource === 'responses') {
      const ids = (queryString(req, 'eventIds') ?? '').split(',').filter((x) => /^[A-Za-z0-9-]{8,64}$/.test(x)).slice(0, 20);
      return { responses: await loadResponses(ids, queryString(req, 'includeDeleted') === '1') };
    }
    if (resource === 'audit') {
      const eventId = queryString(req, 'eventId');
      const rows = eventId
        ? await sql`SELECT * FROM hamgera_rx_audit WHERE event_id = ${eventId} ORDER BY id DESC LIMIT 200`
        : await sql`SELECT * FROM hamgera_rx_audit ORDER BY id DESC LIMIT 200`;
      return {
        audit: rows.map((r) => ({ id: Number(r.id), action: r.action, eventId: r.event_id, responseId: r.response_id, before: r.before_json, after: r.after_json, at: new Date(r.created_at).toISOString() })),
      };
    }
    throw new HttpError(400, 'invalid_resource');
  }

  const b = req.body ?? {};
  switch (b.action) {
    case 'createEvent': {
      const e = eventInput(b);
      const kind = b.kind === 'hampayam' ? 'hampayam' : 'tt';
      const version = kind === 'hampayam' ? HP_VERSION : SURVEY_VERSION;
      const id = newId();
      // Short codes can collide: the unique index decides, and we simply draw another one.
      for (let attempt = 0; ; attempt++) {
        const code = newEventCode();
        const rows = await sql`
          INSERT INTO hamgera_rx_events (id, code, title, event_date, cohort, location, segments, is_active, opens_at, closes_at, survey_version, kind, config)
          VALUES (${id}, ${code}, ${e.title}, ${e.eventDate}::date, ${e.cohort}, ${e.location}, ${JSON.stringify(e.segments)}::jsonb, ${e.isActive}, ${e.opensAt}::timestamptz, ${e.closesAt}::timestamptz, ${version}, ${kind}, ${JSON.stringify(e.config)}::jsonb)
          ON CONFLICT (code) DO NOTHING
          RETURNING code
        `;
        if (rows.length > 0) {
          await audit('create_event', id, null, null, e);
          return { ok: true, id, code };
        }
        if (attempt >= 20) throw new HttpError(500, 'code_exhausted');
      }
    }
    case 'updateEvent': {
      const before = typeof b.id === 'string' ? await eventById(b.id) : null;
      if (!before) throw new HttpError(404, 'event_not_found');
      const e = eventInput(b);
      await sql`
        UPDATE hamgera_rx_events SET title = ${e.title}, event_date = ${e.eventDate}::date, cohort = ${e.cohort}, location = ${e.location},
          segments = ${JSON.stringify(e.segments)}::jsonb, is_active = ${e.isActive}, opens_at = ${e.opensAt}::timestamptz, closes_at = ${e.closesAt}::timestamptz,
          config = ${JSON.stringify(before.kind === 'hampayam' ? e.config : before.config)}::jsonb
        WHERE id = ${before.id}
      `;
      await audit('update_event', before.id, null, before, e);
      return { ok: true };
    }
    case 'editResponse':
    case 'deleteResponse':
    case 'restoreResponse':
    case 'setTags': {
      const rid = b.responseId;
      if (typeof rid !== 'string') throw new HttpError(400, 'invalid_response');
      const found = await sql`SELECT event_id FROM hamgera_rx_responses WHERE id = ${rid}`;
      if (!found[0]) throw new HttpError(404, 'response_not_found');
      const eventId: string = found[0].event_id;
      const ev = await eventById(eventId);
      const hp = ev?.kind === 'hampayam';
      const openIds = hp ? HP_OPEN_IDS : OPEN_IDS;
      const [current] = await loadResponses([eventId], true).then((all) => all.filter((r) => r.id === rid));

      if (b.action === 'deleteResponse' || b.action === 'restoreResponse') {
        const deleting = b.action === 'deleteResponse';
        await sql`UPDATE hamgera_rx_responses SET deleted_at = ${deleting ? new Date().toISOString() : null}::timestamptz WHERE id = ${rid}`;
        await audit(deleting ? 'delete_response' : 'restore_response', eventId, rid, { deleted: !deleting }, { deleted: deleting });
        return { ok: true };
      }

      if (b.action === 'setTags') {
        if (!openIds.includes(b.questionId) || !Array.isArray(b.tags)) throw new HttpError(400, 'invalid_tags');
        const tags = [...new Set(b.tags.map((t: unknown) => sanitizeText(t, 30)).filter(Boolean))].slice(0, 10);
        const before = current?.tags[b.questionId] ?? [];
        await sql`UPDATE hamgera_rx_answers SET tags = ${JSON.stringify(tags)}::jsonb WHERE response_id = ${rid} AND question_id = ${b.questionId}`;
        await audit('set_tags', eventId, rid, { [b.questionId]: before }, { [b.questionId]: tags });
        return { ok: true };
      }

      // editResponse: validate every change first, apply only if all are valid
      const changes = b.changes;
      if (hp) {
        // HamPayam: ratings, journey (1–5 or N/A) and open answers can be corrected; every change is audited.
        if (!changes || typeof changes !== 'object' || Object.keys(changes).length === 0) throw new HttpError(400, 'invalid_changes');
        const hb: Record<string, unknown> = {};
        const ha: Record<string, unknown> = {};
        const hw: (() => Promise<unknown>)[] = [];
        for (const [qid, value] of Object.entries(changes)) {
          hb[qid] = current?.answers[qid] ?? null;
          if (HP_LIKERT_IDS.includes(qid) || HP_SCALE_IDS.includes(qid)) {
            const [lo, hi] = HP_LIKERT_IDS.includes(qid) ? [1, 5] : [0, 10];
            if (typeof value !== 'number' || !Number.isInteger(value) || value < lo || value > hi) throw new HttpError(400, 'invalid_changes');
            ha[qid] = value;
            hw.push(() => sql`UPDATE hamgera_rx_answers SET numeric_value = ${value}, updated_at = now() WHERE response_id = ${rid} AND question_id = ${qid}`);
          } else if (HP_JOURNEY_IDS.includes(qid)) {
            const na = value === HP_NA;
            const none = value === null;
            if (!na && !none && (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5)) throw new HttpError(400, 'invalid_changes');
            ha[qid] = value;
            hw.push(async () => {
              await sql`DELETE FROM hamgera_rx_answers WHERE response_id = ${rid} AND question_id = ${qid}`;
              if (!none) await sql`INSERT INTO hamgera_rx_answers (response_id, question_id, numeric_value, text_value) VALUES (${rid}, ${qid}, ${na ? null : (value as number)}, ${na ? HP_NA : null})`;
            });
          } else if (openIds.includes(qid)) {
            const t = sanitizeText(value, HP_OPEN.find((o) => o.id === qid)!.max);
            ha[qid] = t || null;
            hw.push(async () => {
              await sql`DELETE FROM hamgera_rx_answers WHERE response_id = ${rid} AND question_id = ${qid}`;
              if (t) await sql`INSERT INTO hamgera_rx_answers (response_id, question_id, text_value) VALUES (${rid}, ${qid}, ${t})`;
            });
          } else throw new HttpError(400, 'invalid_changes');
        }
        for (const w of hw) await w();
        await audit('edit_response', eventId, rid, hb, ha);
        return { ok: true };
      }
      if (!changes || typeof changes !== 'object' || Object.keys(changes).length === 0) throw new HttpError(400, 'invalid_changes');
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      const writes: (() => Promise<unknown>)[] = [];
      for (const [qid, value] of Object.entries(changes)) {
        if (LIKERT_IDS.includes(qid) || qid === OVERALL_ID || qid === NPS_ID) {
          const max = LIKERT_IDS.includes(qid) ? 5 : 10;
          const min = LIKERT_IDS.includes(qid) ? 1 : 0;
          if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new HttpError(400, 'invalid_changes');
          before[qid] = current?.answers[qid];
          after[qid] = value;
          writes.push(() => sql`UPDATE hamgera_rx_answers SET numeric_value = ${value}, updated_at = now() WHERE response_id = ${rid} AND question_id = ${qid}`);
        } else if (OPEN_IDS.includes(qid)) {
          const t = sanitizeText(value, MAX_OPEN_CHARS);
          before[qid] = current?.answers[qid] ?? null;
          after[qid] = t || null;
          writes.push(async () => {
            await sql`DELETE FROM hamgera_rx_answers WHERE response_id = ${rid} AND question_id = ${qid}`;
            if (t) await sql`INSERT INTO hamgera_rx_answers (response_id, question_id, text_value) VALUES (${rid}, ${qid}, ${t})`;
          });
        } else if (qid === WORDS_ID) {
          const words = Array.isArray(value) ? value.slice(0, WORD_COUNT).map((w) => sanitizeText(w, MAX_WORD_CHARS)).filter(Boolean) : [];
          before[qid] = current?.words ?? [];
          after[qid] = words;
          writes.push(async () => {
            await sql`DELETE FROM hamgera_rx_answers WHERE response_id = ${rid} AND question_id = ${WORDS_ID}`;
            if (words.length === 0) return;
            const rows = answerRows({}, words);
            await sql`INSERT INTO hamgera_rx_answers (response_id, question_id, text_value, word_index)
                      SELECT ${rid}, x.q, x.t, x.w FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(q text, n numeric, t text, w int)`;
          });
        } else if (qid === 'segment') {
          const event = await eventById(eventId);
          if (value !== null && (typeof value !== 'string' || !event?.segments.includes(value))) throw new HttpError(400, 'invalid_changes');
          before.segment = current?.segment ?? null;
          after.segment = value;
          writes.push(() => sql`UPDATE hamgera_rx_responses SET segment = ${value as string | null} WHERE id = ${rid}`);
        } else {
          throw new HttpError(400, 'invalid_changes');
        }
      }
      for (const w of writes) await w();
      await audit('edit_response', eventId, rid, before, after);
      return { ok: true };
    }
    default:
      throw new HttpError(400, 'invalid_action');
  }
});
