import type { ScoringTable } from './tasmimnama.scoring.js';

/**
 * ⚠️ مبنای امتیازدهی تصمیم‌نما — باید تکمیل شود.
 *
 * هر گزینهٔ هر سؤال را به شخصیت (یا شخصیت‌هایی) وصل کنید که آن گزینه سبک تصمیم‌گیری‌اش را نشان می‌دهد.
 * کدها: DAVINCI | EINSTEIN | LINCOLN | CHURCHILL | EDISON
 *
 * تا وقتی همهٔ گزینه‌ها (۴۸ گزینه) و ۵ گزینهٔ سؤال تساوی‌شکن پر نشده باشد، آزمون «آمادهٔ باز شدن» نیست و
 * ادمین نمی‌تواند آن را باز کند. هیچ مقدار پیش‌فرضی حدس زده نشده است.
 *
 * نمونه:  'q1-a': ['EINSTEIN'],   'q1-b': ['LINCOLN', 'DAVINCI'],   ...
 */
export const TASMIMNAMA_TABLE: ScoringTable = {
  options: {
    // 'q1-a': [],
  },
  tiebreak: {
    // 'tb-a': 'DAVINCI',
  },
};
