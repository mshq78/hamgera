import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QUESTIONS, TIEBREAK_QUESTION, Question, TiebreakQuestion } from './content/questions';
import { Draft, SubmitPayload, TasmimnamaResult } from './types';
import { useTestRuntime } from '@/core/runtime/TestRuntime';
import { SyncStatus, useShellSync } from '@/core/shell/ShellContext';
import { toPersianDigits } from '@/core/utils/number';

export type SubmitOutcome =
  | { kind: 'completed'; result: TasmimnamaResult | null }
  | { kind: 'tiebreak_required'; options: string[] };

export type SubmitFailureKind = 'offline' | 'closed' | 'server';

export class SubmitError extends Error {
  constructor(public readonly kind: SubmitFailureKind) {
    super(kind);
  }
}

interface QuizContextType {
  ready: boolean;
  questions: Question[];
  tiebreakQuestion: TiebreakQuestion;
  answers: Record<string, string>;
  tiebreakAnswer: string | null;
  /** Which tie-break options to offer (those standing for the tied characters); filled by the server. */
  tiebreakOptionIds: string[];
  selectAnswer: (questionId: number, optionId: string) => void;
  selectTiebreakAnswer: (optionId: string) => void;
  allAnswered: boolean;
  answeredCount: number;
  /** Sends the answers. Resolves with 'tiebreak_required' when the extra question is needed; throws SubmitError otherwise. */
  finalizeQuiz: () => Promise<SubmitOutcome>;
  trackingCode: string;
  /** Set once the server stored the session. `result` is null when the admin hides results. */
  submitted: { result: TasmimnamaResult | null } | null;
  returnToReview: boolean;
  setReturnToReview: (val: boolean) => void;
}

const QuizContext = createContext<QuizContextType | null>(null);
const DRAFT = 'progress';

function newTrackingCode(): string {
  return `${toPersianDigits(Math.floor(1000 + Math.random() * 9000))}-BF7K`;
}

export const QuizProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { drafts, newSessionId, submit } = useTestRuntime();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ready, setReady] = useState(false);
  const [submitted, setSubmitted] = useState<QuizContextType['submitted']>(null);
  const [returnToReview, setReturnToReview] = useState(false);
  const [tiebreakOptionIds, setTiebreakOptionIds] = useState<string[]>([]);
  const [sync, setSync] = useState<SyncStatus>('idle');
  useShellSync(sync);
  const ref = useRef<Draft | null>(null);

  const commit = useCallback(
    (next: Draft) => {
      ref.current = next;
      setDraft(next);
      drafts.write(DRAFT, next);
    },
    [drafts]
  );

  useEffect(() => {
    const existing =
      drafts.read<Draft | null>(DRAFT, null) ?? {
        sessionId: newSessionId(),
        trackingCode: newTrackingCode(),
        startedAt: new Date().toISOString(),
        answers: {},
        tiebreakAnswer: null,
      };
    ref.current = existing;
    setDraft(existing);
    setReady(true);
  }, [drafts, newSessionId]);

  const selectAnswer = useCallback(
    (questionId: number, optionId: string) => {
      const d = ref.current;
      if (!d) return;
      commit({ ...d, answers: { ...d.answers, [questionId]: optionId } });
      setSync('saved');
      setTimeout(() => setSync('idle'), 1500);
    },
    [commit]
  );

  const selectTiebreakAnswer = useCallback(
    (optionId: string) => {
      const d = ref.current;
      if (d) commit({ ...d, tiebreakAnswer: optionId });
    },
    [commit]
  );

  const finalizeQuiz = useCallback(async (): Promise<SubmitOutcome> => {
    const d = ref.current;
    if (!d) throw new SubmitError('server');
    const payload: SubmitPayload = {
      trackingCode: d.trackingCode,
      startedAt: d.startedAt,
      finishedAt: new Date().toISOString(),
      answers: d.answers,
      tiebreakAnswer: d.tiebreakAnswer,
    };
    setSync('saving');
    const res = await submit({ sessionId: d.sessionId, startedAt: d.startedAt, payload });
    if (!res.ok) {
      setSync('idle');
      if (res.reason === 'tiebreak') {
        const options: string[] = Array.isArray(res.details?.options) ? res.details!.options : [];
        setTiebreakOptionIds(options);
        return { kind: 'tiebreak_required', options };
      }
      throw new SubmitError(res.reason === 'offline' ? 'offline' : res.reason === 'closed' ? 'closed' : 'server');
    }
    drafts.remove(DRAFT);
    ref.current = null;
    setDraft(null);
    setSubmitted({ result: res.result });
    setSync('saved');
    setTimeout(() => setSync('idle'), 2000);
    return { kind: 'completed', result: res.result };
  }, [drafts, submit]);

  const answers = draft?.answers ?? {};
  const answeredCount = QUESTIONS.filter((q) => answers[q.id]).length;

  const value = useMemo<QuizContextType>(
    () => ({
      ready,
      questions: QUESTIONS,
      tiebreakQuestion: TIEBREAK_QUESTION,
      answers,
      tiebreakAnswer: draft?.tiebreakAnswer ?? null,
      tiebreakOptionIds,
      selectAnswer,
      selectTiebreakAnswer,
      allAnswered: answeredCount === QUESTIONS.length,
      answeredCount,
      finalizeQuiz,
      trackingCode: draft?.trackingCode ?? '',
      submitted,
      returnToReview,
      setReturnToReview,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, draft, submitted, returnToReview, tiebreakOptionIds, selectAnswer, selectTiebreakAnswer, finalizeQuiz]
  );

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
};

export const useQuiz = () => {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error('useQuiz must be used within a QuizProvider');
  return ctx;
};
