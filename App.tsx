import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, Vibration } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { evaluate, formatNumber, type AngleMode } from './src/engine';

type Tone = 'digit' | 'operator' | 'function' | 'accent' | 'danger';

type Key = {
  label: string;
  insert?: string;
  action?: 'clear' | 'backspace' | 'equals' | 'mode' | 'answer';
  tone?: Tone;
  span?: number;
};

const KEYS: Key[][] = [
  [
    { label: 'AC', action: 'clear', tone: 'danger' },
    { label: '⌫', action: 'backspace', tone: 'function' },
    { label: '(', tone: 'function' },
    { label: ')', tone: 'function' },
    { label: '%', insert: '%', tone: 'function' },
  ],
  [
    { label: 'sin', insert: 'sin(', tone: 'function' },
    { label: 'cos', insert: 'cos(', tone: 'function' },
    { label: 'tan', insert: 'tan(', tone: 'function' },
    { label: 'ln', insert: 'ln(', tone: 'function' },
    { label: 'log', insert: 'log(', tone: 'function' },
  ],
  [
    { label: '√', insert: '√(', tone: 'function' },
    { label: '^', insert: '^', tone: 'function' },
    { label: '!', insert: '!', tone: 'function' },
    { label: 'π', insert: 'π', tone: 'function' },
    { label: 'e', insert: 'e', tone: 'function' },
  ],
  [
    { label: '7', insert: '7', tone: 'digit' },
    { label: '8', insert: '8', tone: 'digit' },
    { label: '9', insert: '9', tone: 'digit' },
    { label: '÷', insert: '÷', tone: 'operator' },
    { label: '×', insert: '×', tone: 'operator' },
  ],
  [
    { label: '4', insert: '4', tone: 'digit' },
    { label: '5', insert: '5', tone: 'digit' },
    { label: '6', insert: '6', tone: 'digit' },
    { label: '−', insert: '−', tone: 'operator' },
    { label: '+', insert: '+', tone: 'operator' },
  ],
  [
    { label: '1', insert: '1', tone: 'digit' },
    { label: '2', insert: '2', tone: 'digit' },
    { label: '3', insert: '3', tone: 'digit' },
    { label: '.', insert: '.', tone: 'digit' },
    { label: '=', action: 'equals', tone: 'accent' },
  ],
  [
    { label: '0', insert: '0', tone: 'digit', span: 2 },
    { label: 'ANS', action: 'answer', tone: 'function' },
    { label: 'mod', insert: ' mod ', tone: 'function' },
    { label: 'DEG', action: 'mode', tone: 'function' },
  ],
];

const isOperator = (token: string) => '+-−×÷*/^%!'.includes(token.trim());

const Calculator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [expression, setExpression] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [mode, setMode] = useState<AngleMode>('deg');
  const [showingAnswer, setShowingAnswer] = useState(false);

  const preview = useMemo(() => {
    if (showingAnswer) return null;
    const result = evaluate(expression, mode);
    return result.ok ? formatNumber(result.value) : null;
  }, [expression, mode, showingAnswer]);

  function append(current: string, token: string): string {
    if (token === '.' && !/[0-9]$/.test(current)) return `${current}0.`;
    if (!current && token === '%') return '1%';
    return current + token;
  }

  function press(key: Key) {
    const token = key.insert ?? key.label;

    if (key.action === 'clear') {
      setExpression('');
      setAnswer(null);
      setShowingAnswer(false);
      return;
    }
    if (key.action === 'backspace') {
      setShowingAnswer(false);
      setExpression((current) => current.slice(0, -1));
      return;
    }
    if (key.action === 'mode') {
      setMode((current) => (current === 'deg' ? 'rad' : 'deg'));
      return;
    }
    if (key.action === 'answer') {
      if (answer === null) return;
      setShowingAnswer(false);
      setExpression((current) => (showingAnswer || !current ? answer : current + answer));
      return;
    }
    if (key.action === 'equals') {
      const result = evaluate(expression, mode);
      if (!result.ok) return;
      if (Platform.OS !== 'web') Vibration.vibrate(12);
      setAnswer(formatNumber(result.value));
      setShowingAnswer(true);
      return;
    }

    if (showingAnswer && answer !== null) {
      setShowingAnswer(false);
      setExpression(isOperator(token) ? answer + token : token);
      return;
    }
    setExpression((current) => append(current, token));
  }

  const shown = showingAnswer && answer !== null ? answer : expression;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.display}>
        <View style={styles.displayHeader}>
          <Text style={styles.badge}>{mode === 'deg' ? 'DEG' : 'RAD'}</Text>
          {answer !== null ? <Text style={styles.badge}>ANS {answer}</Text> : null}
        </View>
        <Text
          style={[styles.expression, shown.length > 15 ? styles.expressionTight : null]}
          numberOfLines={2}
        >
          {shown || '0'}
        </Text>
        <Text style={styles.preview} numberOfLines={1}>
          {preview === null || showingAnswer ? '' : `= ${preview}`}
        </Text>
      </View>

      <View style={[styles.keypad, { paddingBottom: insets.bottom + 10 }]}>
        {KEYS.map((row) => (
          <View key={row.map((key) => key.label).join('-')} style={styles.row}>
            {row.map((key) => {
              const tone = key.tone ?? 'digit';
              return (
                <Pressable
                  key={key.label}
                  onPress={() => press(key)}
                  style={({ pressed }) => [
                    styles.key,
                    keyStyles[tone],
                    { flexGrow: key.span ?? 1 },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.label, labelStyles[tone]]}>
                    {key.action === 'mode' ? (mode === 'deg' ? 'DEG' : 'RAD') : key.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
};

const colors = {
  screen: '#0b0d12',
  digit: '#161b23',
  operator: '#242c39',
  function: '#1b222d',
  accent: '#ff9f0a',
  danger: '#3a2226',
  text: '#f2f4f8',
  dim: '#8b95a7',
};

const keyStyles: Record<Tone, ViewStyle> = {
  digit: { backgroundColor: colors.digit },
  operator: { backgroundColor: colors.operator },
  function: { backgroundColor: colors.function },
  accent: { backgroundColor: colors.accent },
  danger: { backgroundColor: colors.danger },
};

const labelStyles: Record<Tone, TextStyle> = {
  digit: { fontSize: 26, fontWeight: '400' },
  operator: { fontSize: 26, fontWeight: '400' },
  function: { fontSize: 18, color: colors.dim, fontWeight: '500' },
  accent: { fontSize: 28, color: colors.screen, fontWeight: '600' },
  danger: { fontSize: 20, color: '#ff6961', fontWeight: '600' },
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screen },
  display: { paddingHorizontal: 20, paddingTop: 10 },
  displayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { color: colors.dim, fontSize: 13, letterSpacing: 1.2, fontWeight: '600' },
  expression: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '200',
    textAlign: 'right',
    marginTop: 12,
    minHeight: 58,
  },
  expressionTight: { fontSize: 30, lineHeight: 38 },
  preview: { color: colors.accent, fontSize: 23, fontWeight: '300', textAlign: 'right', minHeight: 30 },
  keypad: { flex: 1, paddingHorizontal: 10, paddingTop: 10, gap: 9 },
  row: { flex: 1, flexDirection: 'row', gap: 9 },
  key: { flexBasis: 0, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.55 },
  label: { color: colors.text },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Calculator />
    </SafeAreaProvider>
  );
}
