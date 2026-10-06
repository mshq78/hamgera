import React, { useState } from 'react';
import { useTestNavigate } from '@/core/runtime/TestRuntime';
import { SubmitError, useQuiz } from '../../QuizContext';
import { uiContent } from '../../content/ui.fa';
import { OptionRow } from '../../components/OptionRow';
import { Button } from '@/core/components/Button';

export const TiebreakScreen: React.FC = () => {
  const navigate = useTestNavigate();
  const { tiebreakQuestion, tiebreakOptionIds, selectTiebreakAnswer, finalizeQuiz } = useQuiz();
  const [failure, setFailure] = useState<null | 'offline' | 'closed' | 'server'>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only the options that stand for the tied characters (the server says which); a direct visit shows all.
  const options = tiebreakOptionIds.length > 0 ? tiebreakQuestion.options.filter((o) => tiebreakOptionIds.includes(o.id)) : tiebreakQuestion.options;

  const handleSelectOption = (optId: string) => {
    setSelectedId(optId);
    selectTiebreakAnswer(optId);
  };

  const handleSubmit = async () => {
    if (!selectedId || isSubmitting) return;
    setIsSubmitting(true);
    setFailure(null);
    try {
      const res = await finalizeQuiz();
      if (res.kind === 'tiebreak_required') setFailure('server'); // the chosen option could not break the tie
      else navigate(res.result ? '/reveal' : '/done', { replace: true });
    } catch (err) {
      if (!(err instanceof SubmitError)) console.error(err);
      setFailure(err instanceof SubmitError ? err.kind : 'server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-220px)] flex flex-col justify-between py-6 px-4 sm:px-6 max-w-xl mx-auto">

      <main className="my-auto py-8 text-right space-y-6">
        <div>
          <span className="text-sm font-semibold text-[var(--accent-gold)] block mb-2">
            {uiContent.tiebreak.smallLineAbove}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-[1.6]">
            {uiContent.tiebreak.question}
          </h1>
        </div>

        <div role="radiogroup" aria-label="گزینه‌های تصمیم نهایی" className="space-y-3.5 pt-2">
          {options.map((opt, idx) => (
            <OptionRow
              key={opt.id}
              id={opt.id}
              code={opt.code}
              text={opt.text}
              selected={selectedId === opt.id}
              onSelect={() => handleSelectOption(opt.id)}
              index={idx}
            />
          ))}
        </div>

        <div className="pt-6 space-y-2">
          {failure && (
            <p role="alert" className="text-xs text-center text-amber-800 dark:text-amber-300">
              {failure === 'offline' ? uiContent.review.errorOffline : failure === 'closed' ? uiContent.review.errorClosed : uiContent.review.errorServer}
            </p>
          )}
          <Button
            variant="primary"
            fullWidth
            disabled={!selectedId}
            isLoading={isSubmitting}
            onClick={handleSubmit}
            className="text-lg py-3.5"
          >
            {uiContent.tiebreak.submitButton}
          </Button>
        </div>
      </main>

      <footer className="py-2 text-center text-xs text-transparent select-none">
        .
      </footer>
    </div>
  );
};
