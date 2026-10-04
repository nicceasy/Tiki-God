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
  // Whole fruit by the piece: halves for one or less (half a banana), whole pieces past two
  // (four strawberries, never three and a half).
  if (ing.oz_per_piece) {
    const n = oz / ing.oz_per_piece;
    const pieces = n >= 1.75 ? Math.max(2, Math.round(n)) : Math.max(0.5, Math.round(n * 2) / 2);
    return { amount: pieces, unit: 'piece', oz: pieces * ing.oz_per_piece };
  }
  // Bitters as a base (a Trinidad Sour's ounce and a half of Angostura) are poured, not dashed.
  if (cat === 'bitters' && oz >= 0.3) { const v = Math.round(oz * 4) / 4; return { amount: v, unit: 'oz', oz: v }; }
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
  // Long components snap to the half-ounce a bartender pours them by: juices past an ounce and a
  // half, creams past an ounce (no 3¾ oz of pineapple, no 3¼ oz of orange).
  if ((role === 'juice' && oz > 1.5 + 1e-6) || (role === 'rich' && oz > 1 + 1e-6)) {
    const v = Math.round(oz * 2) / 2;
    return { amount: v, unit: 'oz', oz: v };
  }
  if (oz >= 0.375) {
    const v = Math.round(oz * 4) / 4;
    return { amount: v, unit: 'oz', oz: v };
  }
  // Between a quarter and three-eighths, two teaspoons: rounding a balanced third of an ounce
  // down to a quarter undoes the balance.
  if (oz >= 0.3) return { amount: 2, unit: 'tsp', oz: 1 / 3 };
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

// Whole fruit and eggs read the way a recipe says them: "½ ripe banana", "2 strawberries",
// "1 egg white". The amount comes from amountString; this is the noun that follows it.
const PIECES = {
  banana: ['ripe banana', 'ripe bananas'], strawberry: ['strawberry', 'strawberries'], 'egg-white': ['egg white', 'egg whites'],
  'egg-whole': ['whole egg', 'whole eggs'], cucumber: ['cucumber slice', 'cucumber slices'], 'ginger-fresh': ['coin of fresh ginger', 'coins of fresh ginger'],
};
export function pieceName(id, name, amount) {
  const p = PIECES[id];
  if (!p) return name;
  return amount > 1 ? p[1] : p[0];
}

export function pct(x, d = 1) {
  return `${(Math.round(x * 10 ** d) / 10 ** d).toFixed(d)}%`;
}
