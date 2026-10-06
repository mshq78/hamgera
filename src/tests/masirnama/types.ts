export interface Question {
  id: string;
  text: string;
  minChars: number;
  maxChars: number;
  order: number;
}

export interface QuestionRevision {
  savedAt: string;
  text: string;
}

export interface ClientMeta {
  activeTimeMs: number;
  pasteEvents: number;
  pastedChars: number;
  editCount: number;
  revisions: QuestionRevision[];
  timestamp: string;
  questionSetVersion: string;
}

export interface AnswerRecord {
  questionId: string;
  text: string;
  clientMeta: ClientMeta;
}

/** Analysis report as returned by /api/analysis. All labels and levels come from the server. */
export interface AnalysisResult {
  version: string;
  model: string;
  method: 'ai' | 'rules' | 'manual';
  methodText: string;
  createdAt: string;
  status: 'ok' | 'insufficient_data';
  statusText: string;
  indicators: {
    code: string;
    title: string;
    score: number | null;
    itemCount: number;
    thinEvidence: boolean;
    evidence: { questionId: string; score: number; confidence: number; text: string }[];
  }[];
  composite: { title: string; score: number | null; levelCode: string | null; levelTitle: string | null };
  questions: {
    questionId: string;
    usable: boolean;
    flagText: string;
    ratings: { code: string; title: string; score: number; confidence: number; evidence: string }[];
    signals: string[];
  }[];
  flags: string[];
  report: {
    summary: string;
    motivation_sources: string;
    meaning_source: string;
    main_barrier: string;
    growth_path: string;
    alignment: string;
    future_connection: string;
    conversation_topics: string[];
  } | null;
}

export interface AnalysisSummary {
  sessionId: string;
  version: string;
  status: string;
  createdAt: string;
  score: number | null;
  level: string | null;
  method?: 'ai' | 'rules' | 'manual';
}

/** Manual rating form: indicators per question are served by the API. */
export interface ManualFormSpec {
  scale: string;
  questions: { questionId: string; indicators: { code: string; title: string; anchors: string }[] }[];
  suggested: { questionId: string; usable: boolean; flag: string; ratings: { code: string; score: number; evidence: string }[] }[];
}

export interface ManualQuestionRating {
  questionId: string;
  usable: boolean;
  flag?: 'irrelevant' | 'too_vague' | 'nonsense';
  ratings: { code: string; score: number; evidence: string }[];
}

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

/** The payload the participant flow sends with the final submission (POST /api/sessions → `payload`). */
export interface SubmitPayload {
  questionSetVersion: string;
  consentVersion: string;
  consentAcceptedAt: string;
  startedAt: string;
  finishedAt: string;
  answers: AnswerRecord[];
}

/** What the server stores for a session of this test (the sanitised payload). */
export type SessionData = SubmitPayload;

/** The draft kept on the device until the final submission succeeds. */
export interface InProgressSurvey {
  sessionId: string;
  consent: { version: string; acceptedAt: string } | null;
  startedAt: string;
  currentOrder: number;
  answers: Record<string, string>;
  meta: Record<string, ClientMeta>;
}
