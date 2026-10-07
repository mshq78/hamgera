import React, { useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Clock, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/core/components/Button';
import { toPersianDigits } from '@/core/utils/number';
import { dayToInstant, formatTehran, formatTehranDate } from '@/core/utils/jalali';
import { PublicEvent, surveyApi } from './surveyApi';
import { Likert, Message, Scale010, doneKey, draftKey, drop, load, newResponseId, save } from './parts';
import {
  HP_DIMENSIONS, HP_JOURNEY, HP_JOURNEY_TITLE, HP_LIKERT, HP_LIKERT_LABELS, HP_NA, HP_NA_LABEL, HP_OPEN, HP_PROFILE, HP_SCALE_010, HP_VERSION, HP_WELCOME,
} from '../../shared/hampayam/questions';

/**
 * The anonymous HamPayam experience form (route /s/<code> when the event is of kind "hampayam"). Same promise as the
 * 3T form: no login, no identity, answers stay on the device as a draft until «ثبت نهایی». Four or five questions per page.
 */

const T = {
  start: 'شروع',
  resume: 'ادامهٔ پاسخ‌دهی',
  next: 'ادامه',
  back: 'قبلی',
  submit: 'ثبت نهایی',
  edit: 'ویرایش',
  required: 'برای ادامه به همهٔ سؤال‌های این صفحه پاسخ دهید.',
  reviewHint: 'پیش از ثبت نهایی می‌توانید به هر بخش برگردید. بعد از ثبت نهایی امکان ویرایش نیست.',
  profileHint: 'این اطلاعات اختیاری و غیرشناسایی است و فقط برای مقایسهٔ گروه‌ها (وقتی دست‌کم ۵ پاسخ داشته باشند) استفاده می‌شود.',
  skip: 'ترجیح می‌دهم نگویم',
  journeyHint: 'ارزیابی هر ایستگاه اختیاری است. اگر در بخشی شرکت نکردید، «قابل ارزیابی نیست» را بزنید.',
  openHint: 'همهٔ سؤال‌های این بخش اختیاری هستند؛ هر کدام را نخواستید خالی بگذارید.',
  done: 'پاسخ شما ثبت شد. سپاسگزاریم.',
  doneBefore: 'پاسخ شما قبلاً ثبت شده است.',
  offline: 'اتصال برقرار نیست؛ پاسخ شما روی همین دستگاه ذخیره شد و پس از وصل شدن اینترنت می‌توانید دوباره ثبت کنید.',
  failed: 'ثبت انجام نشد؛ پاسخ شما روی همین دستگاه مانده است. دوباره تلاش کنید.',
  closedNow: 'مهلت پاسخ‌دهی پایان یافته و ثبت پذیرفته نشد.',
  chars: 'کاراکتر',
};

interface Draft {
  responseId: string;
  startedAt: string;
  answers: Record<string, number | string>;
  step: number;
}

const choice = (on: boolean) =>
  `w-full text-right min-h-[52px] px-4 rounded-2xl border text-base font-medium cursor-pointer transition ${
    on ? 'bg-slate-900 text-amber-100 border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-amber-400'
  }`;

type Step = { id: string; title: string; ids?: string[] };

export const HamPayamForm: React.FC<{ code: string; event: PublicEvent }> = ({ code, event }) => {
  const [draft, setDraft] = useState<Draft | null>(() => load<Draft>(draftKey(code)));
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState<'now' | 'before' | null>(() => (load<boolean>(doneKey(code)) ? 'before' : null));
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const profileFields = useMemo(
    () => HP_PROFILE.filter((p) => (p.id === 'P01' ? event.segments.length > 0 : p.id === 'P02' ? event.config.profileP02 : event.config.profileP03)),
    [event]
  );

  // S02 profile · S03–S05 two pages each of four questions · S06 overall · S07 journey · S08 open · S09 review
  const steps = useMemo(() => {
    const s: Step[] = [];
    if (profileFields.length) s.push({ id: 'profile', title: 'اطلاعات زمینه‌ای (اختیاری)' });
    HP_DIMENSIONS.forEach((d) => s.push({ id: `dim-${d.key}`, title: `${d.section} — ${d.title}`, ids: HP_LIKERT.filter((q) => q.dim === d.key).map((q) => q.id) }));
    s.push({ id: 'overall', title: 'امتیاز کلی' }, { id: 'journey', title: 'نقشه مسیر تجربه' }, { id: 'open', title: 'بازخورد تشریحی' }, { id: 'review', title: 'بازبینی و ثبت' });
    return s;
  }, [profileFields]);

  const update = (patch: Partial<Draft>) =>
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      save(draftKey(code), next);
      return next;
    });
  const setAnswer = (id: string, v: number | string | null) => {
    const a = { ...(draft?.answers ?? {}) };
    if (v === null || v === '') delete a[id];
    else a[id] = v;
    update({ answers: a });
  };
  const go = (step: number) => {
    update({ step });
    setShowMissing(false);
    topRef.current?.scrollIntoView({ block: 'start' });
  };
  const begin = () => {
    const d: Draft = draft ?? { responseId: newResponseId(), startedAt: new Date().toISOString(), answers: {}, step: 0 };
    save(draftKey(code), d);
    setDraft(d);
    setStarted(true);
  };

  const complete = (s: Step): boolean => {
    const a = draft?.answers ?? {};
    if (s.ids) return s.ids.every((id) => typeof a[id] === 'number');
    if (s.id === 'overall') return HP_SCALE_010.every((q) => typeof a[q.id] === 'number');
    return true; // profile, journey and open answers are optional
  };
  const allComplete = steps.every(complete);

  const submit = async () => {
    if (!draft || sending) return;
    if (!allComplete) return setShowMissing(true);
    setSending(true);
    setNotice(null);
    const res = await surveyApi.submit({ code, responseId: draft.responseId, startedAt: draft.startedAt, answers: draft.answers, clientVersion: HP_VERSION });
    setSending(false);
    if (res.ok) {
      drop(draftKey(code));
      save(doneKey(code), true);
      setDone('now');
    } else setNotice(res.offline ? T.offline : res.error === 'closed' ? T.closedNow : T.failed);
  };

  if (done) return <Message icon={<CheckCircle2 className="w-8 h-8" aria-hidden="true" />} title={done === 'now' ? T.done : T.doneBefore}>{done === 'now' && <p>از بازخورد شما برای بهبود اجراهای بعدی استفاده می‌شود.</p>}</Message>;

  const resuming = !!draft && Object.keys(draft.answers).length > 0;
  if (event.status !== 'open' && !started && !resuming) {
    if (event.status === 'upcoming' && event.opensAt) return <Message icon={<Clock className="w-8 h-8" aria-hidden="true" />} title="این ارزیابی هنوز باز نشده است"><p>زمان شروع: {formatTehran(event.opensAt)}</p></Message>;
    return event.status === 'ended'
      ? <Message icon={<Lock className="w-8 h-8" aria-hidden="true" />} title="این ارزیابی پایان یافته است"><p>مهلت دریافت پاسخ‌ها تمام شده است.</p></Message>
      : <Message icon={<Lock className="w-8 h-8" aria-hidden="true" />} title="این ارزیابی بسته شده است"><p>در حال حاضر امکان ثبت پاسخ وجود ندارد.</p></Message>;
  }

  if (!started) {
    return (
      <div className="w-full flex flex-col gap-5 py-2">
        <header className="space-y-2 text-center pt-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-amber-100">{event.title}</h1>
          {event.eventDate && <p className="text-sm text-slate-500 dark:text-slate-400">{formatTehranDate(dayToInstant(event.eventDate))}</p>}
        </header>
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <p className="text-base leading-loose text-slate-700 dark:text-slate-200">{HP_WELCOME}</p>
          <div className="flex gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">نام، شماره تماس، ایمیل یا هر اطلاعات هویتی دیگری از شما گرفته نمی‌شود.</p>
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
  const a = draft.answers;
  const pct = Math.round((step / (steps.length - 1)) * 100);

  return (
    <div className="w-full flex flex-col gap-5 py-2" ref={topRef}>
      <header className="space-y-2">
        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="پیشرفت">
          <div className="h-full bg-slate-900 dark:bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400" aria-live="polite">بخش {toPersianDigits(step + 1)} از {toPersianDigits(steps.length)} · {toPersianDigits(pct)}٪</p>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-amber-100">{current.title}</h1>
      </header>

      <div className="space-y-7">
        {current.id === 'profile' && (
          <div className="space-y-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">{T.profileHint}</p>
            {profileFields.map((p) => (
              <fieldset key={p.id} className="space-y-2.5">
                <legend className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">{p.text}</legend>
                {[...(p.id === 'P01' ? event.segments : p.options!), ''].map((opt) => (
                  <button key={opt || 'none'} type="button" aria-pressed={(a[p.id] ?? '') === opt} onClick={() => setAnswer(p.id, opt || null)} className={choice((a[p.id] ?? '') === opt)}>{opt || T.skip}</button>
                ))}
              </fieldset>
            ))}
          </div>
        )}

        {current.ids?.map((id) => <Likert key={id} id={id} text={HP_LIKERT.find((q) => q.id === id)!.text} labels={HP_LIKERT_LABELS} value={a[id] as number | undefined} onChange={(v) => setAnswer(id, v)} />)}

        {current.id === 'overall' && HP_SCALE_010.map((q) => <Scale010 key={q.id} text={q.text} ends={q.ends} value={a[q.id] as number | undefined} onChange={(v) => setAnswer(q.id, v)} />)}

        {current.id === 'journey' && (
          <div className="space-y-5">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{HP_JOURNEY_TITLE} {T.journeyHint}</p>
            {HP_JOURNEY.map((j, i) => (
              <fieldset key={j.id} className="space-y-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
                <legend className="px-1 text-base font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">{toPersianDigits(i + 1)}. {j.text}</legend>
                <div role="radiogroup" className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={a[j.id] === n} aria-label={`${toPersianDigits(n)}`} onClick={() => setAnswer(j.id, a[j.id] === n ? null : n)}
                      className={`min-h-[48px] rounded-xl border text-lg font-bold cursor-pointer transition ${a[j.id] === n ? 'bg-slate-900 text-amber-100 border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-amber-400'}`}>
                      {toPersianDigits(n)}
                    </button>
                  ))}
                </div>
                <button type="button" aria-pressed={a[j.id] === HP_NA} onClick={() => setAnswer(j.id, a[j.id] === HP_NA ? null : HP_NA)}
                  className={`w-full min-h-[44px] rounded-xl border text-sm font-medium cursor-pointer transition ${a[j.id] === HP_NA ? 'bg-slate-700 text-white border-slate-700' : 'border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400'}`}>
                  {HP_NA_LABEL}
                </button>
              </fieldset>
            ))}
          </div>
        )}

        {current.id === 'open' && (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">{T.openHint}</p>
            {HP_OPEN.map((q) => {
              const value = (a[q.id] as string | undefined) ?? '';
              return (
                <div key={q.id} className="space-y-1.5">
                  <label htmlFor={q.id} className="block text-base font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">{q.text}</label>
                  <textarea id={q.id} value={value} maxLength={q.max} rows={3} onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="w-full px-3.5 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <p className="text-[13px] text-slate-500 dark:text-slate-400 text-left" dir="ltr">{toPersianDigits(q.max - value.length)} {T.chars}</p>
                </div>
              );
            })}
          </>
        )}

        {isLast && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{T.reviewHint}</p>
            <ul className="space-y-2">
              {steps.slice(0, -1).map((s, i) => {
                const ok = complete(s);
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100 min-w-0">
                      {ok ? <Check className="w-4 h-4 shrink-0" aria-hidden="true" /> : <span className="w-4 h-4 shrink-0 rounded-full border-2 border-amber-500" aria-hidden="true" />}
                      <span className="truncate">{s.title}</span>
                      {!ok && <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold shrink-0">· ناقص</span>}
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
          <Button variant="primary" size="lg" className="flex-1" disabled={!complete(current)} onClick={() => go(step + 1)}>{T.next}</Button>
        )}
      </div>
      {!complete(current) && !isLast && <p className="text-[13px] text-slate-500 dark:text-slate-400 -mt-2">{T.required}</p>}
    </div>
  );
};
