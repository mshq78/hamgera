import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { SurveyProvider, useSurvey } from './SurveyContext';
import { TestNavigate } from '@/core/runtime/TestRuntime';
import { useShellProgress } from '@/core/shell/ShellContext';
import { LoadingSkeleton } from '@/core/components/StateViews';
import { QUESTIONS } from './questions';
import { StartScreen } from './features/StartScreen';
import { QuestionRoute } from './features/QuestionScreen';
import { ReviewScreen } from './features/ReviewScreen';
import { DoneScreen } from './features/DoneScreen';

/** Access control: consent first, then the questions; after submission only the thank-you page exists. */
const Gate: React.FC<{ requireConsent?: boolean; children: React.ReactNode }> = ({ requireConsent, children }) => {
  const { ready, isSubmitted, consentAccepted } = useSurvey();
  if (!ready) return <LoadingSkeleton lines={4} />;
  if (isSubmitted) return <TestNavigate to="/done" replace />;
  if (requireConsent && !consentAccepted) return <TestNavigate to="/" replace />;
  return <>{children}</>;
};

const DoneGate: React.FC = () => {
  const { ready, isSubmitted } = useSurvey();
  if (!ready) return <LoadingSkeleton lines={2} />;
  return isSubmitted ? <DoneScreen /> : <TestNavigate to="/" replace />;
};

const Routing: React.FC = () => {
  const { pathname } = useLocation();
  const match = pathname.match(/\/q\/(\d+)$/);
  const step = match ? Number(match[1]) : 0;
  const onQuestion = step >= 1 && step <= QUESTIONS.length;
  // The calm progress bar is shown on question pages only.
  return (
    <>
      {onQuestion && <Progress step={step} />}
      <Routes>
        <Route path="/" element={<Gate><StartScreen /></Gate>} />
        <Route path="/q/:order" element={<Gate requireConsent><QuestionRoute /></Gate>} />
        <Route path="/review" element={<Gate requireConsent><ReviewScreen /></Gate>} />
        <Route path="/done" element={<DoneGate />} />
        <Route path="*" element={<TestNavigate to="/" replace />} />
      </Routes>
    </>
  );
};

const Progress: React.FC<{ step: number }> = ({ step }) => {
  useShellProgress(step, QUESTIONS.length);
  return null;
};

export default function Root() {
  return (
    <SurveyProvider>
      <Routing />
    </SurveyProvider>
  );
}
