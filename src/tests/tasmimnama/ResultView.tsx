import React from 'react';
import { ResultBody } from './features/result/ResultScreen';
import { useTestRuntime } from '@/core/runtime/TestRuntime';
import type { TasmimnamaResult } from './types';

/** The stored result, shown from the hub when the admin lets participants see it. */
export default function ResultView({ result }: { result: TasmimnamaResult }) {
  const { exit } = useTestRuntime();
  return <ResultBody result={result} onClose={exit} />;
}
