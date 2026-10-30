// Runs the engine directly under Node, which strips the TypeScript types from
// the imported module. There is no test runner in this project on purpose.
import { evaluate, formatNumber } from '../src/engine.ts';

const values = [
  ['2+3*4', 14, 'rad'],
  ['(2+3)*4', 20, 'rad'],
  ['2^3^2', 512, 'rad'],
  ['2^-1', 0.5, 'rad'],
  ['2*-1', -2, 'rad'],
  ['-2^2', -4, 'rad'],
  ['-2+3', 1, 'rad'],
  ['sin(30)', 0.5, 'deg'],
  ['cos(60)', 0.5, 'deg'],
  ['tan(45)', 1, 'deg'],
  ['sin(pi/2)', 1, 'rad'],
  ['√(16)', 4, 'rad'],
  ['5!', 120, 'rad'],
  ['50%', 0.5, 'rad'],
  ['2(3+4)', 14, 'rad'],
  ['2(3+4', 14, 'rad'],
  ['π', Math.PI, 'rad'],
  ['2π', 2 * Math.PI, 'rad'],
  ['π2', 2 * Math.PI, 'rad'],
  ['(1)(2)', 2, 'rad'],
  ['hypot(3,4)', 5, 'rad'],
  ['root(8,3)', 2, 'rad'],
  ['ln(e)', 1, 'rad'],
  ['log(100)', 2, 'rad'],
  ['10 mod 3', 1, 'rad'],
  ['1/8+1/8+1/4', 0.5, 'rad'],
  ['(2+3)', 5, 'rad'],
  ['1e13', 1e13, 'rad'],
  ['1/1e13', 1e-13, 'rad'],
  ['2e', 2 * Math.E, 'rad'],
  ['2e3', 2000, 'rad'],
];

const rejected = ['2+', '(2+3))', 'foo(3)', '', '*3', '1++', '()'];

const displayed = [
  ['0.1+0.2', '0.3'],
  ['1/3', '0.333333333333'],
  ['2^40', '1.09951162778e+12'],
  ['1e13', '1e+13'],
  ['1/1e13', '1e-13'],
  ['2+2', '4'],
  ['sqrt(2)', '1.41421356237'],
];

let passed = 0;
const failures = [];

const check = (label, condition) => {
  if (condition) passed++;
  else failures.push(label);
};

for (const [source, want, mode] of values) {
  const result = evaluate(source, mode);
  const close = result.ok && Math.abs(result.value - want) <= 1e-9 * Math.max(1, Math.abs(want));
  check(`value ${source}`, close);
}

for (const source of rejected) {
  check(`reject ${JSON.stringify(source)}`, !evaluate(source, 'rad').ok);
}

for (const [source, want] of displayed) {
  const result = evaluate(source, 'rad');
  check(`display ${source}`, result.ok && formatNumber(result.value) === want);
}

for (const [source] of displayed) {
  const result = evaluate(source, 'rad');
  if (!result.ok) continue;
  const text = formatNumber(result.value);
  const again = evaluate(text, 'rad');
  check(`round-trip ${text}`, again.ok && Math.abs(again.value - result.value) <= Math.abs(result.value) / 1e9);
}

for (const label of failures) console.error(`FAIL ${label}`);
console.log(`${passed + failures.length} assertions, ${failures.length} failed`);
process.exit(failures.length > 0 ? 1 : 0);
