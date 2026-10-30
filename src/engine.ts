export type AngleMode = 'deg' | 'rad';

export type EvalResult = { ok: true; value: number } | { ok: false; error: string };

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'const'; name: string }
  | { kind: 'func'; name: string }
  | { kind: 'op'; name: string }
  | { kind: 'open' }
  | { kind: 'close' };

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

type FunctionSpec = { arity: number; apply: (args: number[], mode: AngleMode) => number };

const toRadians = (mode: AngleMode) => (mode === 'deg' ? Math.PI / 180 : 1);

const FUNCTIONS: Record<string, FunctionSpec> = {
  sin: { arity: 1, apply: ([x], m) => Math.sin(x * toRadians(m)) },
  cos: { arity: 1, apply: ([x], m) => Math.cos(x * toRadians(m)) },
  tan: { arity: 1, apply: ([x], m) => Math.tan(x * toRadians(m)) },
  asin: { arity: 1, apply: ([x], m) => Math.asin(x) / toRadians(m) },
  acos: { arity: 1, apply: ([x], m) => Math.acos(x) / toRadians(m) },
  atan: { arity: 1, apply: ([x], m) => Math.atan(x) / toRadians(m) },
  sqrt: { arity: 1, apply: ([x]) => Math.sqrt(x) },
  cbrt: { arity: 1, apply: ([x]) => Math.cbrt(x) },
  ln: { arity: 1, apply: ([x]) => Math.log(x) },
  log: { arity: 1, apply: ([x]) => Math.log10(x) },
  log2: { arity: 1, apply: ([x]) => Math.log2(x) },
  exp: { arity: 1, apply: ([x]) => Math.exp(x) },
  abs: { arity: 1, apply: ([x]) => Math.abs(x) },
  hypot: { arity: 2, apply: ([x, y]) => Math.hypot(x, y) },
  root: { arity: 2, apply: ([x, n]) => Math.sign(x) * Math.pow(Math.abs(x), 1 / n) },
  pow: { arity: 2, apply: ([x, y]) => Math.pow(x, y) },
  min: { arity: 2, apply: ([x, y]) => Math.min(x, y) },
  max: { arity: 2, apply: ([x, y]) => Math.max(x, y) },
};

// name -> [precedence, rightAssociative]
const OPERATORS: Record<string, [number, boolean]> = {
  '+': [1, false],
  '-': [1, false],
  'u-': [1.5, true],
  '*': [2, false],
  '/': [2, false],
  mod: [2, false],
  '^': [3, true],
  '!': [5, false],
  '%': [5, false],
};

const wordPattern = /[a-z]+/g;

function tokenize(input: string): Token[] {
  const source = input.toLowerCase().replace(/\s+/g, '');
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    if (ch >= '0' && ch <= '9') {
      let j = i;
      let seenDot = false;
      while (j < source.length) {
        const c = source[j]!;
        if (c >= '0' && c <= '9') j++;
        else if (c === '.' && !seenDot) {
          seenDot = true;
          j++;
        } else break;
      }
      // Scientific notation is only read when "e" is followed by digits, so "2e"
      // still means two times the constant.
      const exponent = /^e[+-]?\d+/.exec(source.slice(j))?.[0];
      if (exponent) j += exponent.length;
      const text = source.slice(i, j);
      if (text === '.') throw new SyntaxError('Malformed number');
      tokens.push({ kind: 'num', value: Number(text) });
      i = j;
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'open' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'close' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ kind: 'op', name: ',' });
      i++;
      continue;
    }
    if (ch === '*' && source[i + 1] === '*') {
      tokens.push({ kind: 'op', name: '^' });
      i += 2;
      continue;
    }
    const operators = '+-*/^%!';
    if (operators.includes(ch)) {
      tokens.push({ kind: 'op', name: ch });
      i++;
      continue;
    }
    if (/[a-z]/.test(ch)) {
      const word = wordPattern.exec(source.slice(i));
      if (!word || word.index !== 0) throw new SyntaxError(`Unknown token near "${ch}"`);
      const name = word[0];
      // The regex is global and stateful: reset it so the next scan starts fresh.
      wordPattern.lastIndex = 0;
      if (FUNCTIONS[name]) tokens.push({ kind: 'func', name });
      else if (CONSTANTS[name] !== undefined) tokens.push({ kind: 'const', name });
      else if (OPERATORS[name]) tokens.push({ kind: 'op', name });
      else throw new SyntaxError(`Unknown name "${name}"`);
      i += name.length;
      continue;
    }
    throw new SyntaxError(`Unexpected character "${ch}"`);
  }
  return tokens;
}

function insertImplicitMultiplication(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (const token of tokens) {
    const previous = out[out.length - 1];
    const endsValue =
      previous !== undefined &&
      (previous.kind === 'num' || previous.kind === 'const' || previous.kind === 'close');
    const startsValue =
      token.kind === 'num' || token.kind === 'const' || token.kind === 'func' || token.kind === 'open';
    if (endsValue && startsValue) out.push({ kind: 'op', name: '*' });
    out.push(token);
  }
  return out;
}

function toPostfix(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const stack: Token[] = [];
  let expectOperand = true;

  const pushOperator = (name: string) => {
    const [precedence, rightAssociative] = OPERATORS[name]!;
    for (;;) {
      const top = stack[stack.length - 1];
      if (!top || top.kind !== 'op' || top.name === ',' || top.name === '(') break;
      const [topPrecedence] = OPERATORS[top.name]!;
      if (topPrecedence > precedence || (topPrecedence === precedence && !rightAssociative)) {
        output.push(stack.pop()!);
      } else break;
    }
    stack.push({ kind: 'op', name });
  };

  for (const token of tokens) {
    if (token.kind === 'num' || token.kind === 'const') {
      output.push(token);
      expectOperand = false;
      continue;
    }
    if (token.kind === 'func') {
      if (!expectOperand) throw new SyntaxError('Missing operator');
      stack.push(token);
      expectOperand = true;
      continue;
    }
    if (token.kind === 'open') {
      stack.push(token);
      expectOperand = true;
      continue;
    }
    if (token.kind === 'close') {
      if (expectOperand) throw new SyntaxError('Incomplete expression');
      let seenOpen = false;
      while (stack.length) {
        const top = stack.pop()!;
        if (top.kind === 'open') {
          seenOpen = true;
          break;
        }
        output.push(top);
      }
      if (!seenOpen) throw new SyntaxError('Unmatched ")"');
      const next = stack[stack.length - 1];
      if (next && next.kind === 'func') output.push(stack.pop()!);
      expectOperand = false;
      continue;
    }
    const name = token.name;
    if (name === '-') {
      if (expectOperand) {
        // Prefix minus never drains the stack: it binds looser than the operator
        // before it, so "2*–1" must stay 2*(-1) rather than (2*)-1.
        stack.push({ kind: 'op', name: 'u-' });
        continue;
      }
      pushOperator('-');
      expectOperand = true;
      continue;
    }
    if (name === '+') {
      if (expectOperand) continue;
      pushOperator('+');
      expectOperand = true;
      continue;
    }
    if (name === '!' || name === '%') {
      if (expectOperand) throw new SyntaxError(`"${name}" needs a value before it`);
      output.push(token);
      continue;
    }
    if (name === ',') {
      while (stack.length && stack[stack.length - 1]!.kind === 'op') output.push(stack.pop()!);
      if (!stack.length) throw new SyntaxError('Misplaced ","');
      continue;
    }
    if (!OPERATORS[name]) throw new SyntaxError(`Unknown operator "${name}"`);
    pushOperator(name);
    expectOperand = true;
  }

  if (expectOperand) throw new SyntaxError('Incomplete expression');

  while (stack.length) {
    const top = stack.pop()!;
    if (top.kind === 'open') throw new SyntaxError('Unmatched "("');
    output.push(top);
  }
  return output;
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new SyntaxError('"!" needs a whole number');
  let result = 1;
  for (let k = 2; k <= n; k++) result *= k;
  return result;
}

function evaluatePostfix(postfix: Token[], mode: AngleMode): number {
  const stack: number[] = [];
  for (const token of postfix) {
    if (token.kind === 'num') {
      stack.push(token.value);
      continue;
    }
    if (token.kind === 'const') {
      stack.push(CONSTANTS[token.name]!);
      continue;
    }
    if (token.kind === 'func') {
      const spec = FUNCTIONS[token.name]!;
      const args = stack.splice(stack.length - spec.arity, spec.arity);
      if (args.length !== spec.arity || args.some((a) => a === undefined)) {
        throw new SyntaxError(`${token.name}() needs ${spec.arity} argument(s)`);
      }
      stack.push(spec.apply(args as number[], mode));
      continue;
    }
    if (token.kind !== 'op') throw new SyntaxError('Malformed expression');
    if (token.name === 'u-') {
      const x = stack.pop();
      if (x === undefined) throw new SyntaxError('Incomplete expression');
      stack.push(-x);
      continue;
    }
    if (token.name === '!' || token.name === '%') {
      const x = stack.pop();
      if (x === undefined) throw new SyntaxError('Incomplete expression');
      stack.push(token.name === '!' ? factorial(x) : x / 100);
      continue;
    }
    const y = stack.pop();
    const x = stack.pop();
    if (y === undefined || x === undefined) throw new SyntaxError('Incomplete expression');
    switch (token.name) {
      case '+':
        stack.push(x + y);
        break;
      case '-':
        stack.push(x - y);
        break;
      case '*':
        stack.push(x * y);
        break;
      case '/':
        stack.push(x / y);
        break;
      case '^':
        stack.push(Math.pow(x, y));
        break;
      case 'mod':
        stack.push(x % y);
        break;
      default:
        throw new SyntaxError(`Unknown operator "${token.name}"`);
    }
  }
  if (stack.length !== 1) throw new SyntaxError('Incomplete expression');
  return stack[0]!;
}

export function formatNumber(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
  if (value === 0) return '0';
  const magnitude = Math.abs(value);
  if (magnitude >= 1e12 || magnitude < 1e-9) return trimZeros(value.toExponential(11), true);
  const rounded = Number(value.toPrecision(12));
  return trimZeros(String(rounded), false);
}

function trimZeros(text: string, hasExponent: boolean): string {
  const mantissa = hasExponent ? text.slice(0, text.indexOf('e')) : text;
  const suffix = hasExponent ? text.slice(text.indexOf('e')) : '';
  if (!mantissa.includes('.')) return text;
  return `${mantissa.replace(/\.?0+$/, '')}${suffix}`;
}

const ALIASES: [string, string][] = [
  ['×', '*'],
  ['÷', '/'],
  ['−', '-'],
  ['√', 'sqrt'],
  ['π', 'pi'],
  ['mod', 'mod'],
];

export function normalise(input: string): string {
  let out = input;
  for (const [from, to] of ALIASES) out = out.split(from).join(to);
  return out;
}

// The keypad opens a parenthesis with every function, so an expression is usually
// complete before the user presses ")" — treat those trailing opens as implicit.
function closeOpenParens(text: string): string {
  const unmatched = (text.match(/\(/g) ?? []).length - (text.match(/\)/g) ?? []).length;
  return unmatched > 0 ? text + ')'.repeat(unmatched) : text;
}

export function evaluate(input: string, mode: AngleMode = 'rad'): EvalResult {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Empty' };
  try {
    const value = evaluatePostfix(toPostfix(insertImplicitMultiplication(tokenize(closeOpenParens(normalise(text))))), mode);
    if (Number.isNaN(value)) return { ok: false, error: 'Undefined result' };
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Cannot evaluate' };
  }
}
