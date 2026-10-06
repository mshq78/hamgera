import { runUnit } from './unit.js';
import { runJalali } from './jalali.js';
import { runApi } from './api.js';
import { runServerImports } from './serverImports.js';
import { runMasirnama } from './masirnama.js';
import { runNaghshnama } from './naghshnama.js';
import { runTasmimnama } from './tasmimnama.js';

const results = [...(await runUnit()), ...runServerImports(), ...runJalali(), ...runMasirnama(), ...runNaghshnama(), ...runTasmimnama(), ...(await runApi())];
results.filter((r) => !r.passed).forEach((r) => console.error(`FAIL: ${r.name} -> ${r.message}`));
const failed = results.filter((r) => !r.passed).length;
console.log(`${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
