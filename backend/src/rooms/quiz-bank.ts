// 跨语言 PK 抢答题库（MVP）：每题多语言版本，按成员母语下发。correct = 正确选项下标。
export interface QuizQuestion {
  id: string;
  correct: number;
  prompt: Record<string, string>;
  options: Record<string, string[]>;
}

const L = (zh: string, en: string, es: string, ar: string) => ({ zh, en, es, ar });

export const QUIZ_BANK: QuizQuestion[] = [
  {
    id: 'q1',
    correct: 1,
    prompt: L('二加二等于几？', 'What is 2 + 2?', '¿Cuánto es 2 + 2?', 'كم يساوي ٢ + ٢؟'),
    options: { zh: ['3', '4', '5'], en: ['3', '4', '5'], es: ['3', '4', '5'], ar: ['٣', '٤', '٥'] },
  },
  {
    id: 'q2',
    correct: 1,
    prompt: L('海洋通常是什么颜色？', 'What color is the ocean?', '¿De qué color es el mar?', 'ما لون المحيط؟'),
    options: {
      zh: ['红色', '蓝色', '绿色'],
      en: ['Red', 'Blue', 'Green'],
      es: ['Rojo', 'Azul', 'Verde'],
      ar: ['أحمر', 'أزرق', 'أخضر'],
    },
  },
];

export function localizedQuestion(q: QuizQuestion, lang: string): { prompt: string; options: string[] } {
  return { prompt: q.prompt[lang] ?? q.prompt.en, options: q.options[lang] ?? q.options.en };
}
