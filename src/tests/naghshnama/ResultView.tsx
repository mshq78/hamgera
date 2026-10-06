import React from 'react';
import { ReportBody } from './features/report/ReportView';
import { useTestRuntime } from '@/core/runtime/TestRuntime';
import type { NaghshnamaResult } from './types';

/** The stored result, shown from the hub when the admin lets participants see it. */
export default function ResultView({ result }: { result: NaghshnamaResult }) {
  const { user, exit } = useTestRuntime();
  return <ReportBody result={result} participantName={`${user.firstName} ${user.lastName}`.trim()} onClose={exit} />;
}
