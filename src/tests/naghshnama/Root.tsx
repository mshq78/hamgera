import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { Check } from 'lucide-react';
import { AssessmentProvider, useAssessment } from './AssessmentContext';
import { TestNavigate, useTestRuntime } from '@/core/runtime/TestRuntime';
import { useShellProgress } from '@/core/shell/ShellContext';
import { LoadingSkeleton } from '@/core/components/StateViews';
import { UI_STRINGS } from './content/ui.fa';
import { StartScreen } from './features/start/StartScreen';
import { SectionAView } from './features/sectionA/SectionAView';
import { BreakScreen } from './features/break/BreakScreen';
import { SectionBView } from './features/sectionB/SectionBView';
import { SectionCView } from './features/sectionC/SectionCView';
import { ReviewScreen } from './features/review/ReviewScreen';
import { RevealScreen } from './features/reveal/RevealScreen';
import { ReportBody } from './features/report/ReportView';

const TOTAL_STEPS = 30;

/** Calm progress bar over the 30 steps (A: 1–18, B: 19–27, C: 28–30). */
const Progress: React.FC<{ step: number }> = ({ step }) => {
  useShellProgress(step, TOTAL_STEPS);
  return null;
};

/** The questions need a draft; without one (e.g. a direct link) the participant goes back to the intro. */
const NeedsDraft: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { ready, trackingCode } = useAssessment();
  if (!ready) return <LoadingSkeleton lines={4} />;
  if (!trackingCode) return <TestNavigate to="/" replace />;
  return <>{children}</>;
};

const ReportRoute: React.FC = () => {
  const { submitted } = useAssessment();
  const { user, exit } = useTestRuntime();
  if (!submitted?.result) return <TestNavigate to="/" replace />;
  return <ReportBody result={submitted.result} participantName={`${user.firstName} ${user.lastName}`.trim()} onClose={exit} />;
};

const DoneScreen: React.FC = () => {
  const { submitted } = useAssessment();
  const { exit } = useTestRuntime();
  if (!submitted) return <TestNavigate to="/" replace />;
  return (
    <div className="w-full py-16 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center mb-6 text-amber-800 dark:text-amber-300">
        <Check className="w-8 h-8" aria-hidden="true" />
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-amber-100 mb-4">{UI_STRINGS.review.doneTitle}</h1>
      <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300 max-w-md">{UI_STRINGS.review.doneBody}</p>
      <button type="button" onClick={exit} className="mt-6 text-sm text-slate-500 hover:text-amber-600 cursor-pointer">{UI_STRINGS.common.restart}</button>
    </div>
  );
};

const Routing: React.FC = () => {
  const { indexA, indexB, indexC } = useAssessment();
  return (
    <Routes>
      <Route path="/" element={<StartScreen />} />
      <Route path="/section-a" element={<NeedsDraft><Progress step={indexA + 1} /><SectionAView /></NeedsDraft>} />
      <Route path="/break" element={<NeedsDraft><BreakScreen /></NeedsDraft>} />
      <Route path="/section-b" element={<NeedsDraft><Progress step={18 + indexB + 1} /><SectionBView /></NeedsDraft>} />
      <Route path="/section-c" element={<NeedsDraft><Progress step={27 + indexC + 1} /><SectionCView /></NeedsDraft>} />
      <Route path="/review" element={<NeedsDraft><ReviewScreen /></NeedsDraft>} />
      <Route path="/reveal" element={<RevealScreen />} />
      <Route path="/report" element={<ReportRoute />} />
      <Route path="/done" element={<DoneScreen />} />
      <Route path="*" element={<TestNavigate to="/" replace />} />
    </Routes>
  );
};

export default function Root() {
  return (
    <AssessmentProvider>
      <Routing />
    </AssessmentProvider>
  );
}
