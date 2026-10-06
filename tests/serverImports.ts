import fs from 'node:fs';
import path from 'node:path';
import { createChecker } from './harness.js';

/**
 * Vercel runs api/ as native Node ESM, which does not resolve extension-less relative imports
 * ("./config" → "./config.ts"). Every file reachable from api/ must import siblings with an explicit ".js".
 * (This broke the first deployment; the tests run under tsx, which is lenient, so they could not notice.)
 */
export function runServerImports() {
  const { results, check } = createChecker();
  const seen = new Set<string>();
  const offenders: string[] = [];

  const resolve = (from: string, spec: string) => {
    const base = path.normalize(path.join(path.dirname(from), spec.replace(/\.js$/, '')));
    return ['.ts', '.tsx'].map((e) => base + e).find((f) => fs.existsSync(f));
  };
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s*['"](\.[^'"]*)['"]|import\(\s*['"](\.[^'"]*)['"]/g)) {
      const spec = m[1] ?? m[2];
      if (!spec.endsWith('.js')) offenders.push(`${file}: ${spec}`);
      const target = resolve(file, spec);
      if (target) walk(target);
    }
    if (/from\s*['"]@\//.test(src)) offenders.push(`${file}: imports the browser alias "@/"`);
  };

  fs.readdirSync('api').filter((f) => f.endsWith('.ts')).forEach((f) => walk(path.join('api', f)));
  check('server files were found', seen.size > 15, `${seen.size}`);
  check('server: every relative import has an explicit .js extension', offenders.length === 0, offenders.join('; '));
  return results;
}
