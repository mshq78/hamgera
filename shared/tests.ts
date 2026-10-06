/** The tests (آزمون‌ها) hosted by هم‌گرا. Shared by the browser and the API: ids, names and defaults only. */

export const TEST_IDS = ['masirnama', 'naghshnama', 'tasmimnama'] as const;
export type TestId = (typeof TEST_IDS)[number];

export interface TestMeta {
  id: TestId;
  /** Display name (with ZWNJ). */
  title: string;
  tagline: string;
  /** Approximate duration shown to participants. */
  duration: string;
  /** Whether the participant sees a result after submitting (the admin can override per test). */
  showResultDefault: boolean;
}

export const TESTS_META: Record<TestId, TestMeta> = {
  masirnama: {
    id: 'masirnama',
    title: 'مسیرنما',
    tagline: 'ابزار شناخت و توسعه سازمانی',
    duration: 'حدود ۱۲ تا ۱۸ دقیقه',
    showResultDefault: false,
  },
  naghshnama: {
    id: 'naghshnama',
    title: 'نقش‌نما',
    tagline: 'تصویری از شیوه نقش‌آفرینی شما در تیم',
    duration: 'حدود ۱۰ تا ۱۵ دقیقه',
    showResultDefault: true,
  },
  tasmimnama: {
    id: 'tasmimnama',
    title: 'تصمیم‌نما',
    tagline: 'وقت تصمیم، شبیه کدومی؟',
    duration: 'حدود ۵ دقیقه',
    showResultDefault: true,
  },
};

export const isTestId = (v: unknown): v is TestId => typeof v === 'string' && (TEST_IDS as readonly string[]).includes(v);
