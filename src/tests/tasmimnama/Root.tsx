import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { Check } from 'lucide-react';
import { QuizProvider, useQuiz } from './QuizContext';
import { TestNavigate, useTestRuntime } from '@/core/runtime/TestRuntime';
import { LoadingSkeleton } from '@/core/components/StateViews';
import { uiContent } from './content/ui.fa';
import { IntroScreen } from './features/intro/IntroScreen';
import { QuestionScreen } from './features/questionnaire/QuestionScreen';
import { ReviewScreen } from './features/review/ReviewScreen';
import { TiebreakScreen } from './features/tiebreak/TiebreakScreen';
import { RevealScreen } from './features/reveal/RevealScreen';
import { ResultBody } from './features/result/ResultScreen';

const Ready: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { ready } = useQuiz();
  return ready ? <>{children}</> : <LoadingSkeleton lines={4} />;
};

const ResultRoute: React.FC = () => {
  const { submitted } = useQuiz();
  const { exit } = useTestRuntime();
  if (!submitted?.result) return <TestNavigate to="/" replace />;
  return <ResultBody result={submitted.result} onClose={exit} />;
};

const DoneScreen: React.FC = () => {
  const { submitted } = useQuiz();
  const { exit } = useTestRuntime();
  if (!submitted) return <TestNavigate to="/" replace />;
  return (
    <div className="w-full py-16 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center mb-6 text-amber-800 dark:text-amber-300">
        <Check className="w-8 h-8" aria-hidden="true" />
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-amber-100 mb-4">{uiContent.review.doneTitle}</h1>
      <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300 max-w-md">{uiContent.review.doneBody}</p>
      <button type="button" onClick={exit} className="mt-6 text-sm text-slate-500 hover:text-amber-600 cursor-pointer">{uiContent.result.backToHub}</button>
    </div>
  );
};

export default function Root() {
  return (
    <QuizProvider>
      <Ready>
        <Routes>
          <Route path="/" element={<IntroScreen />} />
          <Route path="/q/:index" element={<QuestionScreen />} />
          <Route path="/review" element={<ReviewScreen />} />
          <Route path="/tiebreak" element={<TiebreakScreen />} />
          <Route path="/reveal" element={<RevealScreen />} />
          <Route path="/result" element={<ResultRoute />} />
          <Route path="/done" element={<DoneScreen />} />
          <Route path="*" element={<TestNavigate to="/" replace />} />
        </Routes>
      </Ready>
    </QuizProvider>
  );
}
