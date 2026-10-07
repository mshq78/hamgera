/** ارزیابی تجربه «هم‌پیام» (Reaction & Experience): questions of the form. Shared by the browser and the API. */

export const HP_VERSION = '1.0';
export const HP_DEFAULT_TITLE = 'هم‌پیام';

export type HpDimKey = 'EXP' | 'ENG' | 'CON' | 'DES' | 'FAC' | 'IDN';

export const HP_LIKERT_LABELS = ['کاملاً مخالفم', 'مخالفم', 'نه موافقم نه مخالفم', 'موافقم', 'کاملاً موافقم'] as const;

export const HP_DIMENSIONS: { key: HpDimKey; title: string; en: string; section: string }[] = [
  { key: 'EXP', title: 'کیفیت تجربه', en: 'Experience Quality', section: 'تجربه' },
  { key: 'ENG', title: 'درگیری و مشارکت', en: 'Engagement', section: 'تجربه' },
  { key: 'CON', title: 'ارتباط و هم‌افزایی ادراک‌شده', en: 'Connection', section: 'ارتباط و طراحی' },
  { key: 'DES', title: 'طراحی رویداد', en: 'Design', section: 'ارتباط و طراحی' },
  { key: 'FAC', title: 'کیفیت تسهیلگری', en: 'Facilitation', section: 'تسهیلگری و روایت «مای پیام»' },
  { key: 'IDN', title: 'طنین هویتی روایت', en: 'Identity Resonance', section: 'تسهیلگری و روایت «مای پیام»' },
];

const texts: [HpDimKey, string[]][] = [
  ['EXP', ['هدف و مسیر کلی رویداد از ابتدا برای من روشن بود.', 'اجزای مختلف برنامه در کنار هم یک تجربه منسجم ایجاد کردند.', 'ریتم کلی برنامه برای حفظ توجه و انرژی من مناسب بود.', 'زمانی که برای حضور در این رویداد صرف کردم ارزشمند بود.']],
  ['ENG', ['در بیشتر بخش‌های رویداد واقعاً درگیر فعالیت بودم، نه صرفاً حاضر.', 'فعالیت‌ها مرا به مشارکت فعال وادار می‌کردند.', 'تنوع فعالیت‌ها باعث شد توجه و مشارکت من در طول برنامه حفظ شود.', 'فضای رویداد به من اجازه داد بدون تشریفات معمول سازمانی مشارکت کنم.']],
  ['CON', ['ترکیب اعضای تیم، فرصت تعامل با مدیران و همکارانی خارج از دایره معمول کاری من ایجاد کرد.', 'فضای برنامه گفت‌وگو و شنیدن دیدگاه‌های متفاوت را تسهیل کرد.', 'فعالیت‌های تیمی به استفاده از توانمندی‌های متفاوت اعضا کمک کردند.', 'در طول رویداد احساس کردم همکاری میان افراد از شرکت‌ها یا واحدهای مختلف امکان‌پذیر و طبیعی است.']],
  ['DES', ['چالش‌ها و بازی‌ها صرفاً سرگرم‌کننده نبودند و با هدف رویداد ارتباط داشتند.', 'سطح دشواری فعالیت‌ها برای شرکت‌کنندگان این گروه مناسب بود.', 'ترتیب فعالیت‌ها و انتقال از یک بخش به بخش بعدی منطقی بود.', 'تعادل مناسبی میان رقابت، همکاری، گفت‌وگو و زمان‌های غیررسمی وجود داشت.']],
  ['FAC', ['دستورالعمل فعالیت‌ها روشن و قابل فهم بود.', 'تسهیلگران بدون دخالت بیش از حد، جریان فعالیت‌ها را به‌خوبی هدایت کردند.', 'گفت‌وگوها و جمع‌بندی‌های پس از فعالیت‌ها به معنا دادن تجربه کمک کردند.', 'مدیریت زمان، جابه‌جایی و هماهنگی اجرایی برنامه روان بود.']],
  ['IDN', ['روایت «ماموریت عامل دهم» برای من قابل فهم و دنبال‌کردنی بود.', 'کشف «مای پیام» در پایان رویداد برای من معنادار بود.', 'روایت عامل دهم باعث شد فعالیت‌های مختلف برنامه به یکدیگر متصل شوند.', 'پیام نهایی رویداد با واقعیت یک هلدینگ متشکل از شرکت‌ها و تخصص‌های متفاوت تناسب داشت.']],
];

export interface HpLikert {
  id: string;
  dim: HpDimKey;
  text: string;
}
export const HP_LIKERT: HpLikert[] = texts.flatMap(([dim, list], d) => list.map((text, i) => ({ id: `Q${String(d * 4 + i + 1).padStart(2, '0')}`, dim, text })));
export const HP_LIKERT_IDS = HP_LIKERT.map((q) => q.id);

export const HP_OVERALL_ID = 'Q25';
export const HP_NPS_ID = 'Q26';
export const HP_FUTURE_ID = 'Q27';
export const HP_SCALE_010: { id: string; text: string; ends: [string, string]; index: string }[] = [
  { id: 'Q25', text: 'در مجموع، به تجربه «هم‌پیام» از ۰ تا ۱۰ چه امتیازی می‌دهید؟', ends: ['۰ = بسیار ضعیف', '۱۰ = عالی'], index: 'Overall' },
  { id: 'Q26', text: 'تا چه اندازه شرکت در این رویداد را به مدیری با شرایط مشابه خود پیشنهاد می‌کنید؟', ends: ['۰ = اصلاً پیشنهاد نمی‌کنم', '۱۰ = حتماً پیشنهاد می‌کنم'], index: 'NPS' },
  { id: 'Q27', text: 'اگر همین رویداد دوباره برگزار شود، حضور در نسخه مشابه آن برای شما تا چه اندازه ارزشمند است؟', ends: ['۰ = بی‌ارزش', '۱۰ = بسیار ارزشمند'], index: 'Future Value' },
];
export const HP_SCALE_IDS = HP_SCALE_010.map((q) => q.id);

export const HP_JOURNEY_TITLE = 'هر بخش از مسیر را بر اساس تجربه خودتان امتیاز دهید.';
export const HP_NA_LABEL = 'شرکت نکردم / قابل ارزیابی نیست';
export const HP_NA = 'NA';
export const HP_JOURNEY: { id: string; text: string }[] = [
  'افتتاحیه و آغاز مأموریت عامل دهم', 'شناخت نقش‌های تیمی و تشکیل تیم‌های مکمل', 'بازی‌های یخ‌شکن', 'ضیافت شام تیمی', 'کافه گفت‌وگو',
  'ورزش صبحگاهی و آغاز روز دوم', 'بازی‌های محیطی و تیمی', 'فعالیت‌های ساختی، گفت‌وگومحور و سینمامحور', 'کشف عامل دهم و رونمایی «مای پیام»', 'بیانیه هم‌پیام و اختتامیه',
].map((text, i) => ({ id: `J${String(i + 1).padStart(2, '0')}`, text }));
export const HP_JOURNEY_IDS = HP_JOURNEY.map((j) => j.id);

export const HP_OPEN: { id: string; text: string; max: number; label: string }[] = [
  { id: 'O01', text: 'در کدام لحظه احساس کردید این رویداد با یک برنامه یا دوره معمول فرق دارد؟', max: 500, label: 'لحظه اوج' },
  { id: 'O02', text: 'در کدام بخش انرژی یا درگیری شما با برنامه افت کرد؟', max: 500, label: 'نقطه افت' },
  { id: 'O03', text: 'اگر می‌توانستید یک «عامل یازدهم» به هم‌پیام اضافه کنید، آن عامل چه بود؟', max: 300, label: 'عامل یازدهم' },
  { id: 'O04', text: 'اگر اختیار داشتید فقط یک بخش رویداد را تغییر دهید، چه چیزی را تغییر می‌دادید؟', max: 500, label: 'پیشنهاد بهبود' },
  { id: 'O05', text: 'اگر مدیرعامل از شما بپرسد «هم‌پیام ارزش برگزاری داشت؟ چرا؟» پاسخ شما در یک جمله چیست؟', max: 400, label: 'نقل‌قول مدیریتی' },
];
export const HP_OPEN_IDS = HP_OPEN.map((q) => q.id);

export interface ProfileField {
  id: 'P01' | 'P02' | 'P03';
  text: string;
  /** P01's options are the companies the admin lists for the event. */
  options: string[] | null;
}
export const HP_PROFILE: ProfileField[] = [
  { id: 'P01', text: 'شرکت/واحدی که در آن فعالیت می‌کنید', options: null },
  { id: 'P02', text: 'سطح مسئولیت شما', options: ['مدیر', 'معاون', 'سایر'] },
  { id: 'P03', text: 'سابقه حضور در هلدینگ پیام', options: ['کمتر از ۲ سال', '۲ تا ۵ سال', '۵ تا ۱۰ سال', 'بیش از ۱۰ سال'] },
];

export const HP_WELCOME =
  'این فرم برای بررسی کیفیت تجربه «هم‌پیام» و بهبود اجراهای بعدی طراحی شده است. پاسخ‌ها به صورت تجمیعی تحلیل می‌شوند و برای ارزیابی عملکرد فردی استفاده نخواهند شد. تکمیل فرم حدود ۵ تا ۷ دقیقه زمان می‌برد.';

export const HP_ALL_IDS = [...HP_LIKERT_IDS, ...HP_SCALE_IDS, ...HP_JOURNEY_IDS, ...HP_OPEN_IDS];

export function hpQuestionText(id: string): string {
  return (
    HP_LIKERT.find((q) => q.id === id)?.text ?? HP_SCALE_010.find((q) => q.id === id)?.text ?? HP_JOURNEY.find((q) => q.id === id)?.text ?? HP_OPEN.find((q) => q.id === id)?.text ??
    HP_PROFILE.find((q) => q.id === id)?.text ?? id
  );
}

/** Event settings that switch optional profile fields on or off (P01 is on when the event lists companies). */
export interface HpConfig {
  profileP02: boolean;
  profileP03: boolean;
}
export const HP_DEFAULT_CONFIG: HpConfig = { profileP02: true, profileP03: true };
export const hpConfig = (raw: unknown): HpConfig => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<HpConfig>;
  return { profileP02: r.profileP02 !== false, profileP03: r.profileP03 !== false };
};
