import React from 'react';
import { useTestNavigate } from '@/core/runtime/TestRuntime';
import { testIntroContent } from '../../content/testIntro.fa';
import { Button } from '@/core/components/Button';

export const IntroScreen: React.FC = () => {
  const navigate = useTestNavigate();

  const handleStart = () => {
    navigate('/q/1');
  };

  return (
    <div className="min-h-[calc(100vh-220px)] flex flex-col justify-between py-6 px-4 sm:px-6 max-w-xl mx-auto">

      {/* Main Content Area */}
      <main className="my-auto py-8 sm:py-12 space-y-6 text-right">
        {/* Decorative subtle gold rule */}
        <div className="w-12 h-[2px] bg-[var(--accent-gold)]" aria-hidden="true" />

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[var(--text-primary)] leading-[1.3] tracking-tight">
          {testIntroContent.title}
        </h1>

        <div className="space-y-4 pt-2 prose-persian">
          {testIntroContent.paragraphs.map((paragraph, idx) => (
            <p
              key={idx}
              className="text-[17px] sm:text-[18px] leading-[1.75] text-[var(--text-secondary)]"
            >
              {paragraph}
            </p>
          ))}
        </div>

        <div className="pt-6">
          <Button
            variant="primary"
            fullWidth
            onClick={handleStart}
            className="text-lg py-3.5"
          >
            {testIntroContent.startButton}
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="pt-6 pb-2 text-center text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)]/40">
        تجربهٔ یادگیری و خودشناسی رهبری سازمانی
      </footer>
    </div>
  );
};
