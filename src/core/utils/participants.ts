import { cleanPersianText, normalizeIranMobile, normalizeNationalId } from '../../../shared/validation';
import type { UserInput } from '../services/api';

export type RowErrorReason = 'name' | 'mobile' | 'national_id' | 'duplicate';

export interface ParsedParticipants {
  /** Rows that passed validation, with their spreadsheet row number (1-based, header = 1). */
  valid: (UserInput & { row: number })[];
  errors: { row: number; reason: RowErrorReason }[];
  /** Field keys whose column header was not found; when non-empty nothing was parsed. */
  missingColumns: (keyof UserInput)[];
}

const FIELD_ALIASES: Record<keyof UserInput, string[]> = {
  firstName: ['نام'],
  lastName: ['نامخانوادگی', 'فامیل', 'فامیلی'],
  nationalId: ['کدملی', 'شمارهملی', 'کدملیشماره'],
  mobile: ['تلفنهمراه', 'شمارهتماس', 'شمارهموبایل', 'شمارههمراه', 'موبایل', 'همراه', 'تلفن'],
};

const normalizeHeader = (v: unknown) => cleanPersianText(String(v ?? '')).replace(/[\s‌]/g, '');

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(Math.trunc(v));
  return String(v).trim();
}

/**
 * Reads only the four needed columns by header name; any other column (e.g. row number) is ignored.
 * Excel often drops leading zeros of numeric cells, so national IDs are zero-padded to 10 digits and
 * mobiles accept the 9xxxxxxxxx form.
 */
export function parseParticipantRows(rows: unknown[][]): ParsedParticipants {
  const wanted = Object.keys(FIELD_ALIASES) as (keyof UserInput)[];

  // Header row = the first of the first 10 rows that contains the most of the four fields.
  let headerIdx = -1;
  let columns: Partial<Record<keyof UserInput, number>> = {};
  let bestFound = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const found: Partial<Record<keyof UserInput, number>> = {};
    (rows[i] ?? []).forEach((cell, col) => {
      const h = normalizeHeader(cell);
      for (const f of wanted) if (found[f] === undefined && FIELD_ALIASES[f].includes(h)) found[f] = col;
    });
    const n = Object.keys(found).length;
    if (n > bestFound) {
      bestFound = n;
      headerIdx = i;
      columns = found;
    }
    if (n === wanted.length) break;
  }

  const missingColumns = wanted.filter((f) => columns[f] === undefined);
  if (headerIdx < 0 || missingColumns.length > 0) {
    return { valid: [], errors: [], missingColumns: headerIdx < 0 ? wanted : missingColumns };
  }

  const valid: ParsedParticipants['valid'] = [];
  const errors: ParsedParticipants['errors'] = [];
  const seen = new Set<string>();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const row = i + 1;
    const raw = (f: keyof UserInput) => r[columns[f]!];
    if (wanted.every((f) => cellToString(raw(f)) === '')) continue; // blank row

    const firstName = cleanPersianText(cellToString(raw('firstName')));
    const lastName = cleanPersianText(cellToString(raw('lastName')));
    const mobile = normalizeIranMobile(cellToString(raw('mobile')));
    const nationalId = normalizeNationalId(cellToString(raw('nationalId')), true);

    const reason: RowErrorReason | null = !firstName || !lastName
      ? 'name'
      : !mobile
      ? 'mobile'
      : !nationalId
      ? 'national_id'
      : seen.has(mobile)
      ? 'duplicate'
      : null;
    if (reason) {
      errors.push({ row, reason });
      continue;
    }
    seen.add(mobile!);
    valid.push({ firstName, lastName, mobile: mobile!, nationalId: nationalId!, row });
  }

  return { valid, errors, missingColumns: [] };
}

/** Reads the first sheet of an .xlsx file in the browser and extracts participants. */
export async function readParticipantsFromExcel(file: File): Promise<ParsedParticipants> {
  const { readSheet } = await import('read-excel-file/browser');
  return parseParticipantRows((await readSheet(file)) as unknown[][]);
}
