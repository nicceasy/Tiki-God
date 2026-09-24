// Bar-friendly amounts: round to what a bartender can actually measure, then print it.

const FRACTIONS = [[0, ''], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];

export function fracString(x) {
  const whole = Math.floor(x + 1e-9);
  const rest = x - whole;
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(rest - f[0]) < Math.abs(rest - best[0])) best = f;
  if (Math.abs(rest - 1) < Math.abs(rest - best[0])) return String(whole + 1);
  if (!whole) return best[1] || '0';
  return `${whole}${best[1]}`;
}

// Snap an ounce amount to a measurable quantity. Returns {amount, unit, oz}.
export function snap(oz, ing, role) {
  const cat = ing.cat;
  if (role === 'aromatic') return { amount: null, unit: 'garnish', oz: 0 };
  if (ing.oz_per_piece) {
    const pieces = Math.max(0.5, Math.round((oz / ing.oz_per_piece) * 2) / 2);
    return { amount: pieces, unit: 'piece', oz: pieces * ing.oz_per_piece };
  }
  if (cat === 'bitters') {
    const dashes = Math.max(1, Math.min(8, Math.round(oz / 0.03)));
    return { amount: dashes, unit: 'dash', oz: dashes * 0.03 };
  }
  if (ing.id === 'absinthe' || ing.id === 'pastis' || ing.id === 'saline' || ing.id === 'orange-flower-water' || ing.id === 'vanilla-extract') {
    if (oz < 0.025) {
      const drops = Math.max(2, Math.min(12, Math.round(oz / 0.003)));
      return { amount: drops, unit: 'drop', oz: drops * 0.003 };
    }
    if (oz < 0.1) {
      const dashes = Math.max(1, Math.min(4, Math.round(oz / 0.03)));
      return { amount: dashes, unit: 'dash', oz: dashes * 0.03 };
    }
  }
  if (role === 'lengthener') {
    const v = Math.max(1, Math.round(oz * 2) / 2);
    return { amount: v, unit: 'oz', oz: v };
  }
  if (oz >= 0.375) {
    const v = Math.round(oz * 4) / 4;
    return { amount: v, unit: 'oz', oz: v };
  }
  if (oz >= 0.21) return { amount: 0.25, unit: 'oz', oz: 0.25 };
  if (oz >= 0.125) return { amount: 1, unit: 'tsp', oz: 1 / 6 };
  if (oz >= 0.06) return { amount: 0.5, unit: 'tsp', oz: 1 / 12 };
  const dashes = Math.max(1, Math.min(4, Math.round(oz / 0.03)));
  return { amount: dashes, unit: 'dash', oz: dashes * 0.03 };
}

const UNIT_WORDS = {
  oz: ['oz', 'oz'], tsp: ['tsp', 'tsp'], dash: ['dash', 'dashes'], drop: ['drop', 'drops'],
  piece: ['', ''], barspoon: ['barspoon', 'barspoons'], leaves: ['leaves', 'leaves'],
};

// Human string for an amount in oz or ml.
export function amountString(line, system = 'oz') {
  const { amount, unit, oz } = line;
  if (unit === 'garnish' || amount === null || amount === undefined) return '';
  if (system === 'ml' && unit === 'oz') {
    const ml = Math.round((oz * 30) / 2.5) * 2.5;
    return `${ml % 1 ? ml.toFixed(1) : ml} ml`;
  }
  if (system === 'ml' && unit === 'tsp') return `${Math.round(oz * 30 * 2) / 2} ml`;
  if (unit === 'oz' || unit === 'tsp') return `${fracString(amount)} ${unit}`;
  if (unit === 'piece') return fracString(amount);
  const [one, many] = UNIT_WORDS[unit] || [unit, unit];
  return `${amount} ${amount === 1 ? one : many}`;
}

export function pct(x, d = 1) {
  return `${(Math.round(x * 10 ** d) / 10 ** d).toFixed(d)}%`;
}
