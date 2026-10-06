/** ارزیابی واکنش (Kirkpatrick Level 1): the 27 questions of the form. Shared by the browser and the API. */

export const SURVEY_VERSION = '1.0';
export const DEFAULT_EVENT_TITLE = 'بوت‌کمپ ۳ت';

export type SectionKey = 'A' | 'B' | 'C' | 'D';

export interface LikertQuestion {
  id: string;
  section: SectionKey;
  text: string;
}

export const LIKERT_LABELS = ['کاملاً مخالفم', 'مخالفم', 'نظری ندارم', 'موافقم', 'کاملاً موافقم'] as const;

export const SECTIONS: { key: SectionKey; title: string; dimension: DimensionKey }[] = [
  { key: 'A', title: 'طراحی و ارتباط با کار', dimension: 'design_relevance' },
  { key: 'B', title: 'درگیری و مشارکت', dimension: 'engagement' },
  { key: 'C', title: 'کیفیت تسهیلگری و اجرا', dimension: 'facilitation_delivery' },
  { key: 'D', title: 'رضایت کلی', dimension: 'overall_satisfaction' },
];

export type DimensionKey = 'design_relevance' | 'engagement' | 'facilitation_delivery' | 'overall_satisfaction';

const q = (n: number, section: SectionKey, text: string): LikertQuestion => ({ id: `Q${String(n).padStart(2, '0')}`, section, text });

export const LIKERT_QUESTIONS: LikertQuestion[] = [
  q(1, 'A', 'هدف و مسیر کلی بوت‌کمپ برای من روشن بود.'),
  q(2, 'A', 'موضوعات مطرح‌شده با چالش‌های واقعی تصمیم‌گیری در محیط کار مرتبط بودند.'),
  q(3, 'A', 'فعالیت‌ها و بازی‌ها به‌درستی با موضوعات آموزشی ارتباط داشتند.'),
  q(4, 'A', 'تنوع روش‌های اجرا، شامل بازی، تجربه، گفت‌وگو، فیلم و روایت، مناسب بود.'),
  q(5, 'A', 'سطح دشواری فعالیت‌ها برای من مناسب بود.'),
  q(6, 'A', 'ترتیب فعالیت‌ها و جریان کلی برنامه منطقی و قابل‌فهم بود.'),
  q(7, 'B', 'در بیشتر بخش‌های برنامه مشارکت فعال داشتم.'),
  q(8, 'B', 'فعالیت‌های تیمی برای من جذاب و درگیرکننده بودند.'),
  q(9, 'B', 'فضای برنامه امکان اظهار نظر، گفت‌وگو و مشارکت را فراهم می‌کرد.'),
  q(10, 'B', 'میزان رقابت میان تیم‌ها به جذابیت برنامه کمک کرد.'),
  q(11, 'B', 'تعادل مناسبی میان فعالیت، آموزش، گفت‌وگو و استراحت وجود داشت.'),
  q(12, 'B', 'مدت زمان کلی برنامه متناسب با حجم فعالیت‌ها بود.'),
  q(13, 'C', 'توضیحات و دستورالعمل فعالیت‌ها روشن و قابل‌فهم بود.'),
  q(14, 'C', 'تسهیلگران توانستند فعالیت‌ها را به‌خوبی هدایت کنند.'),
  q(15, 'C', 'جمع‌بندی‌ها و توضیحات پس از فعالیت‌ها به فهم بهتر تجربه کمک می‌کرد.'),
  q(16, 'C', 'مدیریت زمان و جابه‌جایی بین بخش‌های مختلف برنامه مناسب بود.'),
  q(17, 'C', 'امکانات، فضا و شرایط اجرایی متناسب با نوع برنامه بود.'),
  q(18, 'D', 'این بوت‌کمپ نسبت به دوره‌های آموزشی معمول، تجربه متفاوت و جذابی برای من بود.'),
  q(19, 'D', 'از زمانی که برای حضور در این برنامه صرف کردم راضی هستم.'),
  q(20, 'D', 'در مجموع، کیفیت اجرای بوت‌کمپ ۳ت را مطلوب ارزیابی می‌کنم.'),
];

export const LIKERT_IDS = LIKERT_QUESTIONS.map((x) => x.id);

export const OVERALL_ID = 'Q21';
export const NPS_ID = 'Q22';
export const OVERALL_TEXT = 'از ۰ تا ۱۰ چه امتیازی به تجربه کلی خود از بوت‌کمپ ۳ت می‌دهید؟';
export const NPS_TEXT = 'اگر یکی از همکاران شما شرایط مشابهی داشته باشد، تا چه اندازه شرکت در این بوت‌کمپ را به او پیشنهاد می‌کنید؟';

export interface OpenQuestion {
  id: string;
  text: string;
}
export const OPEN_QUESTIONS: OpenQuestion[] = [
  { id: 'Q23', text: 'کدام بخش بوت‌کمپ برای شما جذاب‌تر یا ارزشمندتر بود؟' },
  { id: 'Q24', text: 'کدام بخش برنامه کمتر برای شما جذاب یا مفید بود؟' },
  { id: 'Q25', text: 'اگر اختیار داشتید یک بخش از برنامه را تغییر دهید، چه چیزی را تغییر می‌دادید؟' },
  { id: 'Q26', text: 'چه پیشنهادی برای بهبود اجرای بعدی بوت‌کمپ دارید؟' },
];
export const OPEN_IDS = OPEN_QUESTIONS.map((x) => x.id);

export const WORDS_ID = 'Q27';
export const WORDS_TEXT = 'اگر بخواهید تجربه این بوت‌کمپ را فقط با سه کلمه توصیف کنید، چه می‌نویسید؟';
export const WORD_COUNT = 3;

export const MAX_OPEN_CHARS = 500;
export const MAX_WORD_CHARS = 30;

/** Everything that can be asked, in form order (Q27 is stored as three words). */
export const ALL_QUESTION_IDS = [...LIKERT_IDS, OVERALL_ID, NPS_ID, ...OPEN_IDS, WORDS_ID];

export const questionText = (id: string): string =>
  LIKERT_QUESTIONS.find((x) => x.id === id)?.text ??
  OPEN_QUESTIONS.find((x) => x.id === id)?.text ??
  (id === OVERALL_ID ? OVERALL_TEXT : id === NPS_ID ? NPS_TEXT : id === WORDS_ID ? WORDS_TEXT : id);
