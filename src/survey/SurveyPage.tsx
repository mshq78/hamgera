import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, CheckCircle2, Clock, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/core/components/Button';
import { ErrorStateView, LoadingSkeleton } from '@/core/components/StateViews';
import { toPersianDigits } from '@/core/utils/number';
import { dayToInstant, formatTehran, formatTehranDate } from '@/core/utils/jalali';
import { PublicEvent, surveyApi } from './surveyApi';
import { HamPayamForm } from './HamPayamForm';
import { Likert, Message, Scale010, doneKey, draftKey, drop, load, newResponseId, save } from './parts';
import {
  LIKERT_LABELS, LIKERT_QUESTIONS, MAX_OPEN_CHARS, MAX_WORD_CHARS, NPS_ID, NPS_TEXT, OPEN_QUESTIONS, OVERALL_ID, OVERALL_TEXT, SECTIONS, SURVEY_VERSION,
  WORDS_TEXT, WORD_COUNT,
} from '../../shared/reaction/questions';

/**
 * The anonymous participant form of an event (route #/s/<code>). No login and nothing identifying is collected:
 * the answers stay on this device as a draft until «ارسال نهایی», then they are stored once and locked.
 */

const T = {
  introLead: 'نظر شما برای بهتر شدن اجرای بعدی مهم است. تکمیل فرم حدود ۴ تا ۶ دقیقه زمان می‌برد.',
  privacyTitle: 'محرمانگی پاسخ‌ها',
  privacy: 'نام، شماره تماس، ایمیل یا هر اطلاعات هویتی دیگری از شما گرفته نمی‌شود. پاسخ‌ها فقط به‌صورت جمعی و برای بهبود برنامه بررسی می‌شوند.',
  start: 'شروع',
  resume: 'ادامهٔ پاسخ‌دهی',
  segmentTitle: 'گروه شما',
  segmentHint: 'اختیاری است و فقط برای مقایسهٔ گروه‌ها استفاده می‌شود.',
  segmentSkip: 'ترجیح می‌دهم نگویم',
  next: 'ادامه',
  back: 'قبلی',
  review: 'بازبینی',
  reviewTitle: 'بازبینی پاسخ‌ها',
  reviewHint: 'پیش از ارسال می‌توانید به هر بخش برگردید و پاسخ را اصلاح کنید. بعد از ارسال نهایی امکان تغییر نیست.',
  complete: 'کامل است',
  incomplete: 'پاسخ ندادهٔ لازم دارد',
  edit: 'ویرایش',
  submit: 'ارسال نهایی',
  submitting: 'در حال ارسال…',
  overallTitle: 'امتیاز کلی و توصیه',
  freeTitle: 'بازخورد آزاد',
  freeHint: 'نوشتن پاسخ‌های متنی و «سه کلمه» کاملاً اختیاری است؛ هر کدام را نخواستید خالی بگذارید.',
  charsLeft: 'کاراکتر',
  wordPlaceholder: 'یک کلمه',
  doneTitle: 'پاسخ شما با موفقیت ثبت شد.',
  doneBody: 'از بازخورد شما برای بهبود اجرای بعدی استفاده می‌شود.',
  doneBefore: 'شما قبلاً در این دستگاه پاسخ خود را ثبت کرده‌اید. سپاسگزاریم.',
  closedTitle: 'این ارزیابی بسته شده است',
  closedBody: 'در حال حاضر امکان ثبت پاسخ وجود ندارد.',
  endedTitle: 'این ارزیابی پایان یافته است',
  endedBody: 'مهلت دریافت پاسخ‌ها تمام شده است.',
  upcomingTitle: 'این ارزیابی هنوز باز نشده است',
  upcomingBody: 'زمان شروع:',
  notFoundTitle: 'این لینک معتبر نیست',
  notFoundBody: 'لینک را دوباره بررسی کنید یا از برگزارکننده بخواهید لینک درست را بفرستد.',
  loadFailed: 'فرم بارگذاری نشد.',
  offline: 'اتصال برقرار نیست؛ پاسخ شما روی همین دستگاه ذخیره شد و پس از وصل شدن اینترنت می‌توانید ارسال کنید.',
  failed: 'ارسال انجام نشد؛ پاسخ شما روی همین دستگاه مانده است. دوباره تلاش کنید.',
  closedNow: 'زمان این ارزیابی به پایان رسیده و ارسال پذیرفته نشد.',
  required: 'پاسخ به همهٔ سؤال‌های این بخش لازم است.',
  overallEnds: ['۰ = اصلاً راضی نیستم', '۱۰ = کاملاً راضی هستم'],
  npsEnds: ['۰ = اصلاً پیشنهاد نمی‌کنم', '۱۰ = حتماً پیشنهاد می‌کنم'],
};

interface Draft {
  responseId: string;
  startedAt: string;
  segment: string | null;
  answers: Record<string, number | string>;
  words: string[];
  step: number;
}

// ---- the page --------------------------------------------------------------------------------------
type Load = { kind: 'loading' } | { kind: 'notfound' } | { kind: 'failed' } | { kind: 'ready'; event: PublicEvent };

export default function SurveyPage() {
  const { code = '' } = useParams();
  const [load_, setLoad] = useState<Load>({ kind: 'loading' });
  const [draft, setDraft] = useState<Draft | null>(() => load<Draft>(draftKey(code)));
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState<'now' | 'before' | null>(() => (load<boolean>(doneKey(code)) ? 'before' : null));
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const fetchEvent = useCallback(async () => {
    setLoad({ kind: 'loading' });
    const res = await surveyApi.event(code);
    if (res.ok) setLoad({ kind: 'ready', event: res.data });
    else setLoad(res.status === 404 ? { kind: 'notfound' } : { kind: 'failed' });
  }, [code]);
  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const event = load_.kind === 'ready' ? load_.event : null;
  const hasSegments = (event?.segments.length ?? 0) > 0;

  // steps: 0 intro · 1 group (if any) · then A–D · overall · free text · review
  const steps = useMemo(() => {
    const s: { id: string; title: string }[] = [];
    if (hasSegments) s.push({ id: 'segment', title: T.segmentTitle });
    SECTIONS.forEach((x) => s.push({ id: `sec-${x.key}`, title: x.title }));
    s.push({ id: 'overall', title: T.overallTitle }, { id: 'free', title: T.freeTitle }, { id: 'review', title: T.reviewTitle });
    return s;
  }, [hasSegments]);

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      save(draftKey(code), next);
      return next;
    });
  };
  const setAnswer = (id: string, v: number | string) => update({ answers: { ...(draft?.answers ?? {}), [id]: v } });
  const go = (step: number) => {
    update({ step });
    setShowMissing(false);
    topRef.current?.scrollIntoView({ block: 'start' });
  };

  const begin = () => {
    const d: Draft = draft ?? { responseId: newResponseId(), startedAt: new Date().toISOString(), segment: null, answers: {}, words: ['', '', ''], step: 0 };
    save(draftKey(code), d);
    setDraft(d);
    setStarted(true);
  };

  const sectionComplete = (id: string): boolean => {
    const a = draft?.answers ?? {};
    if (id.startsWith('sec-')) return LIKERT_QUESTIONS.filter((q) => q.section === id.slice(4)).every((q) => typeof a[q.id] === 'number');
    if (id === 'overall') return typeof a[OVERALL_ID] === 'number' && typeof a[NPS_ID] === 'number';
    return true; // the free-text step (including the three words) is optional
  };
  const allComplete = steps.every((s) => sectionComplete(s.id));

  const submit = async () => {
    if (!draft || sending) return;
    if (!allComplete) return setShowMissing(true);
    setSending(true);
    setNotice(null);
    const res = await surveyApi.submit({
      code,
      responseId: draft.responseId,
      startedAt: draft.startedAt,
      segment: draft.segment,
      answers: draft.answers,
      words: draft.words.map((w) => w.trim()).filter(Boolean),
      clientVersion: SURVEY_VERSION,
    });
    setSending(false);
    if (res.ok) {
      drop(draftKey(code));
      save(doneKey(code), true);
      setDone('now');
    } else {
      setNotice(res.offline ? T.offline : res.error === 'closed' ? T.closedNow : T.failed);
    }
  };

  // ---- states before the form ----
  if (load_.kind === 'loading') return <LoadingSkeleton lines={4} />;
  if (load_.kind === 'notfound') return <Message icon={<Lock className="w-8 h-8" aria-hidden="true" />} title={T.notFoundTitle}><p>{T.notFoundBody}</p></Message>;
  if (load_.kind === 'failed' || !event) return <ErrorStateView title={T.loadFailed} description="" onRetry={fetchEvent} />;
  if (event.kind === 'hampayam') return <HamPayamForm code={code} event={event} />;

  if (done) {
    return (
      <Message icon={<CheckCircle2 className="w-8 h-8" aria-hidden="true" />} title={done === 'now' ? T.doneTitle : T.doneBefore}>
        {done === 'now' && <p>{T.doneBody}</p>}
      </Message>
    );
  }
  const resuming = !!draft && Object.keys(draft.answers).length > 0;
  if (event.status !== 'open' && !started && !resuming) {
    if (event.status === 'upcoming' && event.opensAt)
      return <Message icon={<Clock className="w-8 h-8" aria-hidden="true" />} title={T.upcomingTitle}><p>{T.upcomingBody} {formatTehran(event.opensAt)}</p></Message>;
    return event.status === 'ended'
      ? <Message icon={<Lock className="w-8 h-8" aria-hidden="true" />} title={T.endedTitle}><p>{T.endedBody}</p></Message>
      : <Message icon={<Lock className="w-8 h-8" aria-hidden="true" />} title={T.closedTitle}><p>{T.closedBody}</p></Message>;
  }

  // ---- intro ----
  if (!started) {
    return (
      <div className="w-full flex flex-col gap-5 py-2">
        <header className="space-y-2 text-center pt-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-amber-100">{event.title}</h1>
          {event.eventDate && <p className="text-sm text-slate-500 dark:text-slate-400">{formatTehranDate(dayToInstant(event.eventDate))}</p>}
        </header>
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <p className="text-base leading-loose text-slate-700 dark:text-slate-200">{T.introLead}</p>
          <div className="flex gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-amber-100">{T.privacyTitle}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-1">{T.privacy}</p>
            </div>
          </div>
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={begin}>{resuming ? T.resume : T.start}</Button>
      </div>
    );
  }

  if (!draft) return null;
  const step = Math.min(draft.step, steps.length - 1);
  const current = steps[step];
  const isLast = current.id === 'review';
  const canGoNext = sectionComplete(current.id);

  return (
    <div className="w-full flex flex-col gap-5 py-2" ref={topRef}>
      <header className="space-y-1">
        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400" aria-live="polite">
          بخش {toPersianDigits(step + 1)} از {toPersianDigits(steps.length)}
        </p>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-amber-100">{current.title}</h1>
      </header>

      <div className="space-y-7">
        {current.id === 'segment' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">{T.segmentHint}</p>
            {[...event.segments, ''].map((seg) => (
              <button
                key={seg || 'none'}
                type="button"
                onClick={() => update({ segment: seg || null })}
                aria-pressed={(draft.segment ?? '') === seg}
                className={`w-full text-right min-h-[52px] px-4 rounded-2xl border text-base font-medium cursor-pointer transition ${
                  (draft.segment ?? '') === seg
                    ? 'bg-slate-900 text-amber-100 border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-amber-400'
                }`}
              >
                {seg || T.segmentSkip}
              </button>
            ))}
          </div>
        )}

        {current.id.startsWith('sec-') &&
          LIKERT_QUESTIONS.filter((q) => q.section === current.id.slice(4)).map((q) => (
            <Likert key={q.id} id={q.id} text={q.text} value={draft.answers[q.id] as number | undefined} onChange={(v) => setAnswer(q.id, v)} />
          ))}

        {current.id === 'overall' && (
          <>
            <Scale010 text={OVERALL_TEXT} ends={T.overallEnds} value={draft.answers[OVERALL_ID] as number | undefined} onChange={(v) => setAnswer(OVERALL_ID, v)} />
            <Scale010 text={NPS_TEXT} ends={T.npsEnds} value={draft.answers[NPS_ID] as number | undefined} onChange={(v) => setAnswer(NPS_ID, v)} />
          </>
        )}

        {current.id === 'free' && (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">{T.freeHint}</p>
            {OPEN_QUESTIONS.map((q) => {
              const value = (draft.answers[q.id] as string | undefined) ?? '';
              return (
                <div key={q.id} className="space-y-1.5">
                  <label htmlFor={q.id} className="block text-base font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">{q.text}</label>
                  <textarea
                    id={q.id}
                    value={value}
                    maxLength={MAX_OPEN_CHARS}
                    rows={3}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="w-full px-3.5 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <p className="text-[13px] text-slate-500 dark:text-slate-400 text-left" dir="ltr">{toPersianDigits(value.length)} / {toPersianDigits(MAX_OPEN_CHARS)} {T.charsLeft}</p>
                </div>
              );
            })}
            <fieldset className="space-y-2">
              <legend className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">{WORDS_TEXT}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {Array.from({ length: WORD_COUNT }, (_, i) => (
                  <input
                    key={i}
                    aria-label={`${T.wordPlaceholder} ${toPersianDigits(i + 1)}`}
                    placeholder={`${T.wordPlaceholder} ${toPersianDigits(i + 1)}`}
                    maxLength={MAX_WORD_CHARS}
                    value={draft.words[i] ?? ''}
                    onChange={(e) => update({ words: Array.from({ length: WORD_COUNT }, (_, k) => (k === i ? e.target.value : draft.words[k] ?? '')) })}
                    className="w-full px-3.5 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                ))}
              </div>
            </fieldset>
          </>
        )}

        {isLast && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{T.reviewHint}</p>
            <ul className="space-y-2">
              {steps.slice(0, -1).map((s, i) => {
                const ok = sectionComplete(s.id);
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                      {ok ? <Check className="w-4 h-4 text-slate-900 dark:text-amber-300" aria-hidden="true" /> : <span className="w-4 h-4 rounded-full border-2 border-amber-500" aria-hidden="true" />}
                      {s.title}
                      <span className={`text-xs ${ok ? 'text-slate-500 dark:text-slate-400' : 'text-amber-700 dark:text-amber-300 font-semibold'}`}>· {ok ? T.complete : T.incomplete}</span>
                    </span>
                    <Button variant="outline" size="sm" onClick={() => go(i)}>{T.edit}</Button>
                  </li>
                );
              })}
            </ul>
            {showMissing && !allComplete && <p role="alert" className="text-sm text-rose-500 font-medium">{T.required}</p>}
          </div>
        )}
      </div>

      {notice && <p role="alert" className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">{notice}</p>}

      <div className="flex gap-3 pt-2">
        {step > 0 && <Button variant="outline" size="lg" onClick={() => go(step - 1)}>{T.back}</Button>}
        {isLast ? (
          <Button variant="primary" size="lg" className="flex-1" isLoading={sending} onClick={submit}>{T.submit}</Button>
        ) : (
          <Button variant="primary" size="lg" className="flex-1" disabled={!canGoNext} onClick={() => go(step + 1)}>{current.id === 'free' ? T.review : T.next}</Button>
        )}
      </div>
    </div>
  );
}
