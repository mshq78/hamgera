import { lazy } from 'react';
import { Compass, Scale, Users } from 'lucide-react';
import { TESTS_META } from '../../shared/tests';
import type { Registry } from './types';

/**
 * The tests hosted by هم‌گرا. Adding a test = a new folder under src/tests/, a handler in api/_lib/tests/,
 * and one entry here and in shared/tests.ts.
 */
export const REGISTRY: Registry = {
  masirnama: {
    meta: TESTS_META.masirnama,
    icon: Compass,
    Root: lazy(() => import('./masirnama/Root')),
    AdminResults: lazy(() => import('./masirnama/AdminResults')),
  },
  naghshnama: {
    meta: TESTS_META.naghshnama,
    icon: Users,
    Root: lazy(() => import('./naghshnama/Root')),
    ResultView: lazy(() => import('./naghshnama/ResultView')),
    AdminResults: lazy(() => import('./naghshnama/AdminResults')),
  },
  tasmimnama: {
    meta: TESTS_META.tasmimnama,
    icon: Scale,
    Root: lazy(() => import('./tasmimnama/Root')),
    ResultView: lazy(() => import('./tasmimnama/ResultView')),
    AdminResults: lazy(() => import('./tasmimnama/AdminResults')),
  },
};
