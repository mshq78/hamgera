import React, { useState } from 'react';
import { useTestNavigate } from '@/core/runtime/TestRuntime';
import { SubmitError, useAssessment } from '../../AssessmentContext';
import { UI_STRINGS } from '../../content/ui.fa';
import { Button } from '@/core/components/Button';
import { formatSeconds } from '../../utils';
import { CheckCircle2, ShieldCheck, Sparkles, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export const ReviewScreen: React.FC = () => {
  const navigate = useTestNavigate();
  const { responsesA, responsesB, responsesC, finalizeAssessment } = useAssessment();
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [failure, setFailure] = useState<null | 'offline' | 'closed' | 'server'>(null);

  // Compute total duration
  const totalDurationMs =
    responsesA.reduce((sum, r) => sum + r.responseTimeMs, 0) +
    responsesB.reduce((sum, r) => sum + r.responseTimeMs, 0) +
    responsesC.reduce((sum, r) => sum + r.responseTimeMs, 0);

  const handleFinalize = async () => {
    setIsFinalizing(true);
    setFailure(null);
    try {
      const result = await finalizeAssessment();
      // The reveal animation leads to the report; when the admin hides results there is only a thank-you page.
      navigate(result ? '/reveal' : '/done', { replace: true });
    } catch (err) {
      if (!(err instanceof SubmitError)) console.error(err);
      setFailure(err instanceof SubmitError ? err.kind : 'server');
      setIsFinalizing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] flex flex-col justify-between py-4 select-none space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 text-center"
      >
        <div className="w-16 h-16 rounded-3xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto shadow-sm">
          <ShieldCheck className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            {UI_STRINGS.review.badge}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            {UI_STRINGS.review.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
            {UI_STRINGS.review.description}
          </p>
        </div>

        {/* Completed Checkpoints */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-sm max-w-md mx-auto text-right space-y-3">
          <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
            <CheckCircle2 className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{UI_STRINGS.review.checklistA}</span>
          </div>

          <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
            <CheckCircle2 className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{UI_STRINGS.review.checklistB}</span>
          </div>

          <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
            <CheckCircle2 className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{UI_STRINGS.review.checklistC}</span>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{UI_STRINGS.review.timeTaken}</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {formatSeconds(totalDurationMs)}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Final Action */}
      <div className="pt-4 max-w-md mx-auto w-full space-y-3">
        {failure && (
          <p role="alert" className="text-xs text-amber-800 dark:text-amber-300 text-center">
            {failure === 'offline' ? UI_STRINGS.review.errorOffline : failure === 'closed' ? UI_STRINGS.review.errorClosed : UI_STRINGS.review.errorServer}
          </p>
        )}
        <Button
          variant="primary"
          size="lg"
          isLoading={isFinalizing}
          onClick={handleFinalize}
          className="w-full"
          leftIcon={<Sparkles className="w-5 h-5" />}
        >
          {UI_STRINGS.review.confirmAndReveal}
        </Button>
      </div>
    </div>
  );
};
