import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { QUESTIONS } from './questions';
import { CONSENT_VERSION, QUESTION_SET_VERSION } from './config';
import { ClientMeta, InProgressSurvey, SubmitPayload } from './types';
import { countChars } from './countChars';
import { useTestRuntime } from '@/core/runtime/TestRuntime';
import { SyncStatus, useShellSync } from '@/core/shell/ShellContext';

export type SubmitFailureKind = 'offline' | 'closed' | 'server';

export class SubmitError extends Error {
  constructor(public readonly kind: SubmitFailureKind) {
    super(kind);
  }
}

interface SurveyContextValue {
  ready: boolean;
  participantFirstName: string;
  isSubmitted: boolean;
  consentAccepted: boolean;
  answers: Record<string, string>;
  metaByQuestion: Record<string, ClientMeta>;
  completedOrders: Set<number>;
  currentOrder: number;
  isOffline: boolean;
  acceptConsent: () => void;
  saveAnswer: (questionId: string, text: string, meta: ClientMeta, isStageComplete: boolean) => void;
  setCurrentOrder: (order: number) => void;
  /** Throws SubmitError when the server did not store the session; the draft is kept on the device. */
  submitFinal: () => Promise<void>;
}

const SurveyContext = createContext<SurveyContextValue | null>(null);
const DRAFT = 'progress';

export const SurveyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, drafts, isOffline, newSessionId, submit } = useTestRuntime();
  const [progress, setProgress] = useState<InProgressSurvey | null>(null);
  const [completedOrders, setCompletedOrders] = useState<Set<number>>(new Set());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  useShellSync(syncStatus);

  // Latest draft for synchronous reads inside callbacks.
  const progressRef = useRef<InProgressSurvey | null>(null);
  const commit = useCallback(
    (next: InProgressSurvey) => {
      progressRef.current = next;
      setProgress(next);
      drafts.write(DRAFT, next);
    },
    [drafts]
  );

  // Resume an existing draft or start a new one.
  useEffect(() => {
    const existing =
      drafts.read<InProgressSurvey | null>(DRAFT, null) ?? {
        sessionId: newSessionId(),
        consent: null,
        startedAt: new Date().toISOString(),
        currentOrder: 1,
        answers: {},
        meta: {},
      };
    progressRef.current = existing;
    setProgress(existing);
    drafts.write(DRAFT, existing);
    setCompletedOrders(
      new Set(QUESTIONS.filter((q) => countChars(existing.answers[q.id] ?? '').count >= q.minChars).map((q) => q.order))
    );
    setReady(true);
  }, [drafts, newSessionId]);

  const acceptConsent = useCallback(() => {
    const p = progressRef.current;
    if (!p) return;
    commit({ ...p, consent: { version: CONSENT_VERSION, acceptedAt: new Date().toISOString() }, currentOrder: 1 });
  }, [commit]);

  const saveAnswer = useCallback(
    (questionId: string, text: string, meta: ClientMeta, isStageComplete: boolean) => {
      const p = progressRef.current;
      if (!p) return;
      commit({ ...p, answers: { ...p.answers, [questionId]: text }, meta: { ...p.meta, [questionId]: meta } });
      if (isStageComplete) {
        const q = QUESTIONS.find((x) => x.id === questionId);
        if (q) setCompletedOrders((prev) => new Set(prev).add(q.order));
      }
    },
    [commit]
  );

  const setCurrentOrder = useCallback(
    (order: number) => {
      const p = progressRef.current;
      if (p && p.currentOrder !== order) commit({ ...p, currentOrder: order });
    },
    [commit]
  );

  const submitFinal = useCallback(async () => {
    const p = progressRef.current;
    if (!p || !p.consent) throw new SubmitError('server');
    const payload: SubmitPayload = {
      questionSetVersion: QUESTION_SET_VERSION,
      consentVersion: p.consent.version,
      consentAcceptedAt: p.consent.acceptedAt,
      startedAt: p.startedAt,
      finishedAt: new Date().toISOString(),
      answers: QUESTIONS.map((q) => ({
        questionId: q.id,
        text: (p.answers[q.id] ?? '').trim(),
        clientMeta: p.meta[q.id] ?? {
          activeTimeMs: 0,
          pasteEvents: 0,
          pastedChars: 0,
          editCount: 0,
          revisions: [],
          timestamp: new Date().toISOString(),
          questionSetVersion: QUESTION_SET_VERSION,
        },
      })),
    };

    setSyncStatus('saving');
    const res = await submit({ sessionId: p.sessionId, startedAt: p.startedAt, payload });
    // "already" = this person's answers are stored (for example from another device): same outcome as success.
    if (!res.ok && res.reason !== 'already') {
      setSyncStatus('error');
      throw new SubmitError(res.reason === 'offline' ? 'offline' : res.reason === 'closed' ? 'closed' : 'server');
    }
    // Purge answers and revision telemetry from the device.
    drafts.remove(DRAFT);
    progressRef.current = null;
    setProgress(null);
    setIsSubmitted(true);
    setSyncStatus('saved');
    setTimeout(() => setSyncStatus('idle'), 2500);
  }, [drafts, submit]);

  const value: SurveyContextValue = {
    ready,
    isSubmitted,
    participantFirstName: user.firstName,
    consentAccepted: !!progress?.consent,
    answers: progress?.answers ?? {},
    metaByQuestion: progress?.meta ?? {},
    completedOrders,
    currentOrder: progress?.currentOrder ?? 1,
    isOffline,
    acceptConsent,
    saveAnswer,
    setCurrentOrder,
    submitFinal,
  };

  return <SurveyContext.Provider value={value}>{children}</SurveyContext.Provider>;
};

export function useSurvey(): SurveyContextValue {
  const ctx = useContext(SurveyContext);
  if (!ctx) throw new Error('useSurvey must be used within SurveyProvider');
  return ctx;
}
