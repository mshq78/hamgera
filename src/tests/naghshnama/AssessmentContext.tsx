import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { InProgressAssessment, NaghshnamaResult, ResponseA, ResponseB, ResponseC, SubmitPayload } from './types';
import { SECTION_A_ITEMS, SECTION_B_SCENARIOS, SECTION_C_MINIGAMES } from './data';
import { generateRandomOrdersForSession } from './randomize';
import { generateTrackingCode } from './utils';
import { useTestRuntime } from '@/core/runtime/TestRuntime';
import { SyncStatus, useShellSync } from '@/core/shell/ShellContext';

export type SubmitFailureKind = 'offline' | 'closed' | 'server';

export class SubmitError extends Error {
  constructor(public readonly kind: SubmitFailureKind) {
    super(kind);
  }
}

type Orders = Pick<InProgressAssessment, 'randomOrdersA' | 'randomOrdersB' | 'randomOrdersC'>;

interface AssessmentContextType {
  ready: boolean;
  trackingCode: string;
  indexA: number;
  indexB: number;
  indexC: number;
  randomOrdersA: Orders['randomOrdersA'];
  randomOrdersB: Orders['randomOrdersB'];
  randomOrdersC: Orders['randomOrdersC'];
  responsesA: ResponseA[];
  responsesB: ResponseB[];
  responsesC: ResponseC[];
  /** An unfinished draft exists on this device. */
  hasSavedProgress: boolean;
  /** Set once the server stored the session: the result to show, or null when results are hidden. */
  submitted: { result: NaghshnamaResult | null } | null;

  startAssessment: () => void;
  /** Returns the route (inside this test) where the participant stopped. */
  resumeAssessment: () => string;
  recordResponseA: (response: ResponseA) => boolean; // true when section A is finished
  recordResponseB: (response: ResponseB) => boolean;
  recordResponseC: (response: ResponseC) => boolean;
  /** Throws SubmitError when the server did not store the session; the draft stays on the device. */
  finalizeAssessment: () => Promise<NaghshnamaResult | null>;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);
const DRAFT = 'progress';

const ROUTE_OF: Record<InProgressAssessment['currentStep'], string> = {
  sectionA: '/section-a',
  break: '/break',
  sectionB: '/section-b',
  sectionC: '/section-c',
  review: '/review',
};

function freshDraft(): InProgressAssessment {
  const orders = generateRandomOrdersForSession(SECTION_A_ITEMS, SECTION_B_SCENARIOS, SECTION_C_MINIGAMES);
  return {
    sessionId: '',
    trackingCode: generateTrackingCode(),
    startedAt: new Date().toISOString(),
    currentStep: 'sectionA',
    currentIndexA: 0,
    currentIndexB: 0,
    currentIndexC: 0,
    ...orders,
    responsesA: [],
    responsesB: [],
    responsesC: [],
  };
}

export const AssessmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { drafts, newSessionId, submit } = useTestRuntime();
  const [draft, setDraft] = useState<InProgressAssessment | null>(null);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [submitted, setSubmitted] = useState<AssessmentContextType['submitted']>(null);
  const [sync, setSync] = useState<SyncStatus>('idle');
  useShellSync(sync);
  const ref = useRef<InProgressAssessment | null>(null);

  const commit = useCallback(
    (next: InProgressAssessment) => {
      ref.current = next;
      setDraft(next);
      setSaved(true);
      drafts.write(DRAFT, next);
    },
    [drafts]
  );

  useEffect(() => {
    const existing = drafts.read<InProgressAssessment | null>(DRAFT, null);
    if (existing) {
      ref.current = existing;
      setDraft(existing);
      setSaved(true);
    }
    setReady(true);
  }, [drafts]);

  const startAssessment = useCallback(() => {
    commit({ ...freshDraft(), sessionId: newSessionId() });
  }, [commit, newSessionId]);

  const resumeAssessment = useCallback(() => (ref.current ? ROUTE_OF[ref.current.currentStep] : '/'), []);

  const record = useCallback(
    <K extends 'A' | 'B' | 'C'>(section: K, response: ResponseA | ResponseB | ResponseC, total: number, nextStep: InProgressAssessment['currentStep'], thisStep: InProgressAssessment['currentStep']): boolean => {
      const d = ref.current;
      if (!d) return false;
      const idxKey = `currentIndex${section}` as const;
      const respKey = `responses${section}` as const;
      const responses = [...(d[respKey] as unknown[]), response];
      const isLast = d[idxKey] >= total - 1;
      commit({
        ...d,
        [respKey]: responses,
        [idxKey]: isLast ? d[idxKey] : d[idxKey] + 1,
        currentStep: isLast ? nextStep : thisStep,
      } as InProgressAssessment);
      return isLast;
    },
    [commit]
  );

  const recordResponseA = useCallback((r: ResponseA) => record('A', r, SECTION_A_ITEMS.length, 'break', 'sectionA'), [record]);
  const recordResponseB = useCallback((r: ResponseB) => record('B', r, SECTION_B_SCENARIOS.length, 'sectionC', 'sectionB'), [record]);
  const recordResponseC = useCallback((r: ResponseC) => record('C', r, SECTION_C_MINIGAMES.length, 'review', 'sectionC'), [record]);

  const finalizeAssessment = useCallback(async (): Promise<NaghshnamaResult | null> => {
    const d = ref.current;
    if (!d) throw new SubmitError('server');
    const payload: SubmitPayload = {
      trackingCode: d.trackingCode,
      startedAt: d.startedAt,
      finishedAt: new Date().toISOString(),
      responsesA: d.responsesA,
      responsesB: d.responsesB,
      responsesC: d.responsesC,
    };
    setSync('saving');
    const res = await submit({ sessionId: d.sessionId, startedAt: d.startedAt, payload });
    if (!res.ok) {
      setSync('error');
      throw new SubmitError(res.reason === 'offline' ? 'offline' : res.reason === 'closed' ? 'closed' : 'server');
    }
    drafts.remove(DRAFT);
    ref.current = null;
    setDraft(null);
    setSaved(false);
    setSubmitted({ result: res.result });
    setSync('saved');
    setTimeout(() => setSync('idle'), 2500);
    return res.result;
  }, [drafts, submit]);

  const value = useMemo<AssessmentContextType>(
    () => ({
      ready,
      trackingCode: draft?.trackingCode ?? '',
      indexA: draft?.currentIndexA ?? 0,
      indexB: draft?.currentIndexB ?? 0,
      indexC: draft?.currentIndexC ?? 0,
      randomOrdersA: draft?.randomOrdersA ?? {},
      randomOrdersB: draft?.randomOrdersB ?? {},
      randomOrdersC: draft?.randomOrdersC ?? {},
      responsesA: draft?.responsesA ?? [],
      responsesB: draft?.responsesB ?? [],
      responsesC: draft?.responsesC ?? [],
      hasSavedProgress: saved && !!draft && draft.responsesA.length + draft.responsesB.length + draft.responsesC.length > 0,
      submitted,
      startAssessment,
      resumeAssessment,
      recordResponseA,
      recordResponseB,
      recordResponseC,
      finalizeAssessment,
    }),
    [ready, draft, saved, submitted, startAssessment, resumeAssessment, recordResponseA, recordResponseB, recordResponseC, finalizeAssessment]
  );

  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>;
};

export const useAssessment = (): AssessmentContextType => {
  const context = useContext(AssessmentContext);
  if (!context) throw new Error('useAssessment must be used within an AssessmentProvider');
  return context;
};
