// A transparent character heuristic, not a provider tokenizer or billing meter.
// Counts Unicode code points; never retains the input text.
export function estimateText(text) {
  let cyrillic = 0, other = 0;
  for (const char of text) {
    if (/\p{Script=Cyrillic}/u.test(char)) cyrillic++;
    else other++;
  }
  return {
    chars: cyrillic + other,
    cyrillic_chars: cyrillic,
    other_chars: other,
    total: Math.ceil(cyrillic / 1.7 + other / 4),
    range_low: Math.floor(cyrillic / 2 + other / 5),
    range_high: Math.ceil(cyrillic + other / 2),
  };
}

export function fromSamples(samples) {
  const sum = key => samples.reduce((n, s) => n + s[key], 0);
  return {
    source: 'estimated', total: sum('total'),
    range_low: sum('range_low'), range_high: sum('range_high'),
    scope: 'observed_text', method: 'characters-v1',
    evidence: 'Доступные тексты запросов, ответов и инструментов; кириллица / 1.7, остальные символы / 4. Скрытый и повторно переданный контекст может быть не учтён. Это не billing usage.',
  };
}

export function fromJournal(work, decisions, usage) {
  const fragments = [work.task, work.result];
  for (const d of decisions) fragments.push(d.context, d.choice, d.alternatives, d.reason, d.consequences);
  for (const u of usage) fragments.push(u.name, u.purpose);
  const count = estimateText(fragments.filter(Boolean).join('\n'));
  return {
    source: 'estimated', total: count.total,
    range_low: count.range_low, range_high: count.range_high,
    scope: 'journal_only', method: 'characters-v1',
    evidence: 'Только сохранившиеся тексты задачи, результата, решений и инструментов. Исходная переписка недоступна; расход всей сессии по этим данным оценить нельзя. Архивные копии original_sources не учитываются.',
  };
}

export function describeTokens(tokens) {
  if (tokens.source === 'reported') return `Токены: ${tokens.total} (точные данные usage).`;
  if (tokens.source !== 'estimated') return 'Точное количество токенов неизвестно; для оценки пока нет текста.';
  const range = tokens.range_low === undefined ? '' : ` (ориентир ${tokens.range_low}–${tokens.range_high})`;
  const scope = tokens.scope === 'journal_only'
    ? 'Оценка только текста журнала, не расхода всей сессии: старая переписка не сохранена.'
    : tokens.scope === 'observed_text'
      ? 'По доступному тексту общения; скрытый и повторный контекст может быть не учтён.'
      : `Охват и метод: ${tokens.evidence}`;
  return `Точное количество токенов неизвестно, но примерно ${tokens.total}${range}. ${scope}`;
}
