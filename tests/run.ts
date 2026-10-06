import { runUnit } from './unit.js';
import { runJalali } from './jalali.js';
import { runApi } from './api.js';
import { runMasirnama } from './masirnama.js';

const results = [...(await runUnit()), ...runJalali(), ...runMasirnama(), ...(await runApi())];
results.filter((r) => !r.passed).forEach((r) => console.error(`FAIL: ${r.name} -> ${r.message}`));
const failed = results.filter((r) => !r.passed).length;
console.log(`${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
