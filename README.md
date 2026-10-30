# Calculator

**A scientific calculator for the phone, with an expression parser instead of `eval`.**

Built with Expo SDK 58, React Native 0.88 and TypeScript in strict mode. One screen, no storage, no backend, no network permission: the whole app is a keypad and a parser.

## What it does

- `sin` `cos` `tan` `ln` `log` `√` `^` `!` `%` `hypot` `root` `mod`, plus `π` and `e`
- DEG/RAD toggle, live preview of the result while you type, and `ANS` to reuse the last result
- Implicit multiplication: `2(3+4)` is `14`, `π2` is `2π`
- Unmatched parentheses close themselves, because the keypad opens one every time you press a function — `sin(30` + `=` is a valid expression
- Scientific notation is understood (`1e-13`), and only when `e` is followed by digits, so `2e` still means two times the constant

## How the parser works

`src/engine.ts` is plain TypeScript with no dependencies and no `eval`:

1. **Tokenise** numbers, names, operators and parentheses.
2. **Insert implicit multiplication** between adjacent values (`2π`, `3!`, `(1)(2)`).
3. **Shunting-yard** into postfix order, with a precedence table that separates prefix minus from infix minus so `-2^2` is `-4` and `2^-1` is `0.5`.
4. **Evaluate** the postfix queue.

Results are formatted to twelve significant digits, with trailing zeros trimmed and exponential notation outside `[1e-9, 1e12)`.

## Run it

```bash
npm install
npx expo start
```

Then open it in Expo Go, or in a browser at the printed LAN address (the web target is supported).

If you start the packager with `--lan`, Expo Go still requires the CLI on your computer to be signed in to the same Expo account as the phone (`npx expo login`). The browser route has no such check.

## Quality gates

```bash
npm run check       # 52 engine assertions
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint with the shared Expo config
```

`scripts/engine-check.mjs` imports the parser and runs it under Node directly, so the engine is covered without pulling in a test runner: precedence and associativity, degree mode, implicit multiplication, error rejection, and the exact strings the display produces. This project was built in an afternoon and has no CI.

## Known limits

- No expression history and no memory registers beyond `ANS`
- Layout is portrait-first; landscape squeezes the keypad rather than reflowing it
- `Vibration` is skipped on web, where react-native-web does not implement it

## License

MIT — see [LICENSE](LICENSE).
