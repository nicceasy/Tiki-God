// Archetype composer: builds a drink the way a tiki bartender riffs. An archetype
// (data/archetypes.json) is a proven structure: its signature components must all be there
// (a colada is rum + pineapple + coconut, or it isn't a colada), each component may only be
// filled from the ingredients that satisfy it, and every dose stays inside the archetype's
// ranges. The prayer steers *which* bottle fills each slot, which optional slots open, how the
// doses lean, and what goes on top: the "Mr. Potato Head" method of swapping parts on a proven
// frame. Nothing outside the archetype's slots can get in, so the label always tells the truth.

const ROLE_KNOB = { base: 'strength', sweet: 'sweetness', sour: 'tartness' };
// The archetype a family word means when nothing else narrows it.
const FAMILY_CANON = {
  colada: 'pina-colada', daiquiri: 'daiquiri', grog: 'navy-grog', swizzle: 'trinidad-swizzle', punch: 'planters-punch', zombie: 'zombie',
  'mai-tai': 'mai-tai', 'orgeat-punch': 'scorpion', buck: 'dark-n-stormy', 'resort-punch': 'hurricane', 'bitter-tiki': 'bitter-tiki-sour',
  stirred: 'rum-old-fashioned', hot: 'hot-buttered-rum', 'beachcomber-sour': 'beachcomber-spice-sour',
};
const SOLO_GARNISH_FLAVOR = { mint: 'mint', nutmeg: 'nutmeg', cinnamon: 'cinnamon' };
// Impressions of the whole drink rather than flavors a bottle carries: never a reason to swap
// one ingredient for another (a "warm" prayer must not trade coffee for hot water).
// Most an accent may pour in one drink (from the technique research: data/technique-rules.json
// doseCaps), with per-family exceptions. An ounce of allspice dram is a writer who never tasted it.
const DOSE_CAP = {"pastis":0.04,"absinthe":0.04,"angostura":0.18,"peychauds":0.12,"orange-bitters":0.12,"tiki-bitters":0.12,"mole-bitters":0.12,"saline":0.024,"almond-extract":0.012,"vanilla-extract":0.03,"orange-flower-water":0.012,"allspice-dram":0.5,"velvet-falernum":0.75,"falernum-syrup":0.75,"maraschino":0.5,"grenadine":[0.5,{"zombie":0.17,"mai-tai":0,"grog":0.17,"orgeat-punch":0.25,"resort-punch":1,"punch":0.75}],"green-chartreuse":0.75,"yellow-chartreuse":0.75,"campari":[0.75,{"bitter-tiki":1.5,"stirred":1}],"fernet":0.25,"scotch-islay":0.5,"cinnamon-syrup":0.75,"ginger-syrup":0.75,"blue-curacao":0.75,"melon-liqueur":1,"coffee-liqueur":1,"creme-de-cacao":0.75,"banana-liqueur":1,"coconut-rum":[1.5,{"colada":0.5}],"rum-jamaican-white-overproof":0.75,"coffee":[0.75,{"hot":6}],"irish-cream":1,"amontillado-sherry":0.75};
export function doseCap(id, family, asked = false) {
  const c = DOSE_CAP[id];
  if (c === undefined) return Infinity;
  const cap = Array.isArray(c) ? (c[1][family] ?? c[0]) : c;
  return asked ? Math.max(cap * 2, cap + 0.25) : cap;
}
const PLAIN_SYRUPS = new Set(['simple-syrup', 'rich-simple', 'demerara-syrup', 'cane-syrup', 'agave-syrup']);
const NOT_A_FLAVOR = new Set(['sweet', 'tart', 'light', 'crisp', 'dry', 'rich', 'boozy', 'warm', 'fruity', 'tropical', 'citrus', 'creamy', 'effervescent']);

export function createComposer({ archetypes, ingMap, model }) {
  const byId = Object.fromEntries(archetypes.map(a => [a.id, a]));
  const roleOf = id => (ingMap.get(id) || {}).role;

  const lerp = (r, t) => r[0] + (r[1] - r[0]) * Math.max(0, Math.min(1, t));
  const knob = (intent, role) => {
    const k = ROLE_KNOB[role];
    return k ? Math.max(-2, Math.min(2, intent[k] || 0)) : 0;
  };

  // How well this archetype can answer the prayer, and whether it can be built at all.
  function scoreArchetype(a, intent, ctx) {
    const why = [];
    let s = Math.log(1 + (a.weight || 1)) * 0.25;
    // Hard feasibility: every required component needs at least one allowed ingredient.
    const st = intent.style;
    for (const c of a.signature) {
      if (!c.required) continue;
      // Zero-proof: the spirit components give way to a stand-in body (see zeroProof below).
      if (st.zeroProof && c.anyOf.every(id => roleOf(id) === 'base')) continue;
      const ok = c.anyOf.some(id => ingMap.has(id) && (!ctx.forbidden(id, intent) || (st.zeroProof && ctx.naSwap[id] && !ctx.forbidden(ctx.naSwap[id], intent))));
      if (!ok) return { a, s: -Infinity, why: [`can't make the ${c.component}`] };
    }
    if (st.zeroProof) {
      // Without the spirit, a drink needs juice, coconut or spice to stand on.
      if (['stirred'].includes(a.family) || a.id === 'ti-punch' || /overproof|nuclear|bitters-base/.test(a.id)) s -= 6;
      if (a.creamy || a.long || ['colada', 'resort-punch', 'punch', 'orgeat-punch', 'buck'].includes(a.family)) s += 2;
      if (a.zeroProof === true || /zero-proof/.test(a.id)) s += 3;
    }
    const has = m => (a.methods || []).includes(m);
    if (st.hot && !has('hot')) return { a, s: -Infinity, why: ['not a hot drink'] };
    if (!st.hot && (a.methods || [])[0] === 'hot') s -= 6;
    if (st.zeroProof && a.zeroProof === false) return { a, s: -Infinity, why: ['no zero-proof version'] };
    // A frame that is alcohol-free by definition answers only a zero-proof prayer ("low ABV" isn't "no ABV").
    if (!st.zeroProof && /zero-proof/.test(a.id)) return { a, s: -Infinity, why: ['zero-proof only'] };
    if (st.frozen) s += has('blend') ? 2 : -2.5;
    if (st.creamy === true) s += a.creamy ? 3 : -1;
    if (st.creamy === false && a.creamy) return { a, s: -Infinity, why: ['creamy'] };
    if (st.bitter) s += (a.flavorProfile || []).includes('bitter') ? 2.5 : -0.5;
    if (st.long) s += a.long ? 1.5 : -0.5;
    if (st.bowl) s += a.bowl ? 3 : 0;
    if (st.stirred) s += has('stir') ? 4 : -2;
    if (st.flaming) s += a.flaming ? 1.5 : 0;
    if (st.layered) s += a.layered ? 2 : 0.2;
    // Every proven spec is a loud color the guest didn't ask for (a Blue Hawaiian when they
    // wanted a lazy Sunday): a weaker answer.
    const specs = fittingSpecs(a);
    if (specs.length && specs.every(sp => sp.lines.some(l => { const c = (ingMap.get(l.id) || {}).color; return ['blue', 'green'].includes(c) && intent.color !== c; }))) s -= 2;
    // Family words ("a colada", "something like a grog") and concept affinities from the prayer.
    s += 1.8 * (intent.fam[a.family] || 0);
    // "A colada" means the Piña Colada's frame before it means a Lava Flow's.
    if ((intent.fam[a.family] || 0) > 0 && FAMILY_CANON[a.family] === a.id) s += 0.5 * Math.min(3, intent.fam[a.family]);
    s += 2.2 * ((intent.archetypes || {})[a.id] || 0);
    // Flavor fit: the archetype's own profile, plus what its slots can carry.
    const profile = new Set(a.flavorProfile || []);
    for (const [t, w0] of Object.entries(intent.tags)) {
      if (w0 <= 0) continue;
      // Impressions ("citrus", "light") weigh little: every sour is citrus.
      const w = NOT_A_FLAVOR.has(t) ? w0 * 0.3 : w0;
      if (profile.has(t)) { s += 0.9 * w; continue; }
      if (NOT_A_FLAVOR.has(t)) continue;
      const carry = slotsCarry(a, t, intent, ctx);
      if (carry) s += 0.55 * w;
      else if (w >= 1.2) { s -= 1.2 * w; why.push(`no slot for ${t}`); }
    }
    for (const [t, w] of Object.entries(intent.avoidTags)) if (profile.has(t)) s -= 1.5 * w;
    // Strength and sweetness leanings.
    const abvMid = a.ratios && a.ratios.abvAfterDilution ? (a.ratios.abvAfterDilution[0] + a.ratios.abvAfterDilution[1]) / 2 : 13;
    // Strength asks: a gentle prayer leans hard toward long, low drinks; a strong one toward
    // heavyweights (capped, so "strong" doesn't mean a neat Ti' Punch every time).
    const k = intent.strength || 0;
    s += k < 0 ? 0.8 * k * ((abvMid - 12) / 3) : 0.8 * k * ((Math.min(abvMid, 22) - 13) / 4);
    if ((intent.strength || 0) <= -1 && st.long !== false) s += a.long ? 1.2 : 0;
    // "Three rums": an archetype whose specs already layer that many rums answers it best.
    if (intent.rumCount) {
      const bases = (a.canonicalSpecs || []).map(sp => sp.lines.filter(l => roleOf(l.id) === 'base' && !l.float).length);
      const most = bases.length ? Math.max(...bases) : a.signature.filter(c => c.anyOf.some(id => roleOf(id) === 'base')).length;
      s += most >= intent.rumCount ? 2.5 : most >= 2 ? 0.5 : -2;
    }
    s -= 0.25 * (intent.complexity || 0) < 0 ? (a.signature.length > 5 ? 1 : 0) : 0;
    // Bottles the prayer leans toward that the archetype can hold.
    for (const [id, w] of Object.entries(intent.prefer || {})) if (allIds(a).has(id)) s += 0.35 * Math.min(2, w);
    // Requested ingredients the archetype can't hold count against it.
    for (const [id, w] of Object.entries(intent.ings)) {
      if (w < 1) continue;
      if (ingMap.get(id) && ingMap.get(id).cat === 'rum') continue;
      if (!allIds(a).has(id) && !slotFor(a, id) && !canAdd(a, id)) s -= 0.8 * w;
      else s += 0.4 * w;
    }
    return { a, s, why };
  }

  // A slot accepts its own bottles, plus a recognised stand-in for one of them (blue curaçao is
  // orange curaçao dyed blue; coconut milk can do cream of coconut's job). Spirits don't
  // stand in for each other this way: the base is what the archetype says it is.
  const subsOf = id => { const i = ingMap.get(id); return i && i.role !== 'base' ? (i.subs || []) : []; };
  const accepts = (c, id) => c.anyOf.includes(id) || subsOf(id).some(x => c.anyOf.includes(x))
    // A plain-sugar component (rock candy syrup) is satisfied by any syrup doing that job.
    || (c.anyOf.length > 0 && c.anyOf.every(x => PLAIN_SYRUPS.has(x)) && (ingMap.get(id) || {}).role === 'sweet' && (ingMap.get(id) || {}).cat === 'syrup')
    || ((ingMap.get(id) || {}).cat === 'spirit' && c.anyOf.length > 0 && c.anyOf.every(x => (ingMap.get(x) || {}).cat === 'spirit'));
  const slotFor = (a, id) => [...a.signature, ...(a.optional || [])].find(c => c.anyOf.includes(id)) || [...a.signature, ...(a.optional || [])].find(c => accepts(c, id));

  const allIdsCache = new Map();
  function allIds(a) {
    if (!allIdsCache.has(a.id)) allIdsCache.set(a.id, new Set([...a.signature, ...(a.optional || [])].flatMap(c => c.anyOf)));
    return allIdsCache.get(a.id);
  }
  function canAdd(a, id) {
    const r = roleOf(id);
    return (a.optional || []).some(o => o.anyOf.length === 0 && o.roles && o.roles.includes(r));
  }
  function slotsCarry(a, tag, intent, ctx) {
    for (const id of allIds(a)) {
      if (!ingMap.has(id) || ctx.forbidden(id, intent)) continue;
      if ((ctx.ingVec[id] || {})[tag] >= 0.55) return id;
    }
    return a.signature.some(c => c.anyOf.some(id => roleOf(id) === 'base')) ? splitCarrier(a, [], tag, intent, ctx) : null;
  }

  function pickFor(cands, intent, ctx, chosen, rng, greedy, prefer = []) {
    const scored = cands.filter(id => ingMap.has(id) && !ctx.forbidden(id, intent) && !chosen.includes(id) && !ctx.conflicts(id, chosen)).map(id => {
      let s = 2.4 * ctx.intentMatch(id, intent) + 0.5 * ctx.compat(id, chosen);
      const i = prefer.indexOf(id);
      if (i >= 0) s += Math.max(0, 2.6 - i * 0.55); // canonical choices first, unless the prayer pulls elsewhere
      const ing = ingMap.get(id);
      if (ing.avail === 'specialty') s -= 0.3;
      if (ing.avail === 'homemade' && !['simple-syrup', 'rich-simple', 'demerara-syrup', 'honey-syrup'].includes(id)) s -= intent.style.simple ? 1.5 : 0.2;
      return { item: id, s };
    });
    return ctx.softPick(rng, scored, 0.7, greedy);
  }

  // Build a drink on an archetype the way a bartender riffs: start from one of its proven specs
  // (the one that best fits the prayer), then swap parts inside the archetype's slots: the
  // requested spirit takes over the base, requested flavors refill the slot that can carry them,
  // forbidden or avoided bottles give way to an allowed alternative, and the signature is
  // checked last. Archetypes without specs are filled slot by slot.
  function compose(a, intent, ctx, rng, greedy, notes, src = null, specOffset = 0) {
    let lines;
    const specs = fittingSpecs(a);
    if (src) lines = src.lines.map(l => ({ ...l, slot: slotOf(a, l.id), range: rangeOf(a, l.id) }));
    else if (specs.length) {
      const scored = specs.map((sp, i) => {
        let s = -0.25 * i + (sp.confidence === 'high' ? 0.3 : 0);
        for (const l of sp.lines) if (ingMap.has(l.id)) s += 0.8 * Math.max(-2, Math.min(2, ctx.intentMatch(l.id, intent))) - (ctx.forbidden(l.id, intent) ? 1.5 : 0);
        // A spec whose look is a loud color (Blue Hawaiian blue, Midori green) answers only a prayer for it.
        for (const l of sp.lines) { const c = (ingMap.get(l.id) || {}).color; if (['blue', 'green'].includes(c) && intent.color !== c) s -= 2; }
        return { item: sp, s };
      });
      // A repeat prayer on the same frame starts from a different proven spec.
      const sp = specOffset > 0 && scored.length > 1 ? [...scored].sort((x, y) => y.s - x.s)[specOffset % scored.length].item : ctx.softPick(rng, scored, 0.6, greedy);
      lines = sp.lines.filter(l => ingMap.has(l.id)).map(l => ({ id: l.id, role: roleOf(l.id), oz: l.oz, unit: l.unit, amount: l.amount, float: !!l.float, sink: !!l.sink, crown: !!l.crown, slot: slotOf(a, l.id), range: rangeOf(a, l.id), fromSpec: sp.name }));
      // Two-part specs (a Miami Vice's two halves) list a bottle twice; the card lists it once.
      for (let i = lines.length - 1; i >= 0; i--) {
        // The same spirit in both halves is one line (it isn't layered; the halves are).
        const j = lines.findIndex(x => x.id === lines[i].id && (roleOf(x.id) === 'base' ? !x.float && !lines[i].float : !!x.float === !!lines[i].float && !!x.sink === !!lines[i].sink));
        if (j >= 0 && j < i) { if (lines[j].sink !== lines[i].sink) lines[j].sink = false; lines[j].oz = (lines[j].oz || 0) + (lines[i].oz || 0); if (lines[j].amount !== undefined && lines[i].amount !== undefined && lines[j].unit === lines[i].unit) lines[j].amount += lines[i].amount; lines.splice(i, 1); }
      }
      // Mint the archetype is built on (blended into a Missionary's Downfall, muddled in a Mojito)
      // is an ingredient, not a garnish.
      for (const l of lines) if (l.role === 'aromatic' && ['leaves', 'sprig'].includes(l.unit) && a.signature.some(c => c.required && c.anyOf.includes(l.id))) { l.muddled = true; l.amount = l.amount || 8; l.unit = 'leaves'; if (l.amount < 6) l.amount = 8; }
      notes.push(`spec:${sp.name}`);
    } else lines = fillSlots(a, intent, ctx, rng, greedy);

    // What the guest named is locked in before anything gets swapped for novelty.
    for (const l of lines) if ((intent.ings[l.id] || 0) >= 1) l.req = true;
    if (intent.style.zeroProof) zeroProof(a, lines, intent, ctx, notes);
    replaceForbidden(a, lines, intent, ctx, notes);
    swapInSpirits(a, lines, intent, ctx, notes);
    if (intent.rumCount) layerRums(a, lines, intent, ctx, notes);
    // Explicit ingredient asks ("passion fruit", "falernum"): refill a slot or open an optional one.
    for (const [id, w] of Object.entries(intent.ings).sort((x, y) => y[1] - x[1])) {
      if (w < 1 || lines.some(l => l.id === id) || !ingMap.has(id) || ctx.forbidden(id, intent) || (ingMap.get(id).role === 'base')) continue;
      placeIngredient(a, lines, id, intent, ctx, notes);
    }
    // A concept's hero bottle (weighted to be seen: Tokyo's Japanese whisky, a dragon's pitaya)
    // goes in like an ask, up to two of them, if the frame can hold it without breaking.
    const heroes = Object.entries(intent.prefer || {}).filter(([id, w]) => w >= 1.25 && ingMap.has(id) && !lines.some(l => l.id === id) && !ctx.forbidden(id, intent) && !archForbids(a, id))
      .sort((x, y) => y[1] - x[1]).slice(0, 2);
    for (const [id] of heroes) {
      if (roleOf(id) === 'base') { if (!intent.spirits.includes(id)) swapInSpirits(a, lines, { ...intent, spirits: [id], avoidSpirits: new Set() }, ctx, notes); }
      else placeIngredient(a, lines, id, intent, ctx, notes);
    }
    // Requested flavors still uncarried: swap a slot's filling, else open an optional slot.
    for (const [tag, w] of Object.entries(intent.tags).sort((x, y) => y[1] - x[1])) {
      if (w < 1.2 || NOT_A_FLAVOR.has(tag) || carried(lines, tag, ctx)) continue;
      const swap = trySwap(a, lines, tag, intent, ctx) || openFor(a, lines, tag, intent, ctx) || splitBase(a, lines, tag, intent, ctx);
      if (swap) notes.push(swap);
    }
    // A flavor asked for plainly ("with mango") that no slot could carry: pour the bottle that
    // leads with it, worked in the way a bartender would.
    const explicit = t => (intent.tags[t] || 0) - ((intent.conceptTags || {})[t] || 0) * 0.6;
    // In a riff ("a Mai Tai but tropical") the modifier is the whole request: a lower bar.
    const bar = src ? 1.0 : 1.5;
    for (const [tag] of Object.entries(intent.tags).sort((x, y) => y[1] - x[1])) {
      if (explicit(tag) < bar || NOT_A_FLAVOR.has(tag) || carried(lines, tag, ctx)) continue;
      const ids = lines.map(l => l.id);
      const pool = [...ingMap.values()].filter(i => i.role !== 'base' && i.role !== 'aromatic' && leads(i.id, tag) && ['common', 'specialty', 'homemade'].includes(i.avail)
        && !ctx.forbidden(i.id, intent) && !archForbids(a, i.id) && !ids.includes(i.id) && !ctx.conflicts(i.id, ids));
      const rank = i => (i.avail === 'common' ? 1 : 0) + (i.role === 'juice' ? 0.5 : 0) + (i.role === 'sweet' ? 0.3 : 0);
      pool.sort((x, y) => rank(y) - rank(x));
      // Best of all: a flavored syrup takes the plain syrup's job (passion fruit syrup for the
      // rock candy in a Mai Tai), so the balance holds and nothing is bolted on.
      const plain = lines.find(l => PLAIN_SYRUPS.has(l.id) && !l.req);
      const syrup = pool.find(i => i.role === 'sweet');
      if (plain && syrup) {
        notes.push(`${shortName(syrup.id)} in place of the ${shortName(plain.id)} for ${tag.replace('-', ' ')}`);
        plain.id = syrup.id; plain.req = true; plain.oz = Math.max(plain.oz, 0.5); plain.range = null;
      } else if (pool[0]) placeIngredient(a, lines, pool[0].id, intent, ctx, notes);
    }
    // A flavor the guest leaned on hard ("smoky", "funky") and the drink only hints at gets a
    // split base: the modern tiki move of trading part of the rum for a spirit that *is* that flavor.
    for (const [tag] of Object.entries(intent.tags).sort((x, y) => y[1] - x[1])) {
      if (explicit(tag) < 2 || NOT_A_FLAVOR.has(tag) || lines.some(l => leads(l.id, tag))) continue;
      const split = splitBase(a, lines, tag, intent, ctx);
      if (split) { notes.push(split); break; }
    }
    topWithBubbles(a, lines, intent, ctx, notes);
    repair(a, lines, intent, ctx, rng, notes);
    trim(a, lines, intent, ctx, notes);
    capDoses(a, lines, intent);
    return lines;
  }

  // A celebration wants bubbles: a sour or punch that the prayer leans toward sparkling wine (or
  // soda, or ginger beer) gets topped with it, the way an Air Mail tops a daiquiri. Creamy,
  // frozen, hot and stirred drinks are left alone; a drink already fizzing needs nothing.
  const TOPPERS = ['sparkling-wine', 'soda-water', 'ginger-beer'];
  function topWithBubbles(a, lines, intent, ctx, notes) {
    if (lines.some(l => TOPPERS.includes(l.id) || ['ginger-ale', 'tonic', 'cola', 'lemon-lime-soda'].includes(l.id))) return;
    const st = intent.style;
    if (a.creamy || st.creamy || st.frozen || st.hot || st.stirred || ['blend', 'hot', 'stir'].includes((a.methods || [])[0])) return;
    const fizzy = (intent.tags.effervescent || 0) >= 1.4;
    const want = TOPPERS.map(id => ({ id, w: (intent.ings[id] || 0) * 1.5 + ((intent.prefer || {})[id] || 0) })).filter(x => x.w >= 1.2 && ingMap.has(x.id) && !ctx.forbidden(x.id, intent)).sort((x, y) => y.w - x.w)[0]
      || (fizzy && !ctx.forbidden('soda-water', intent) ? { id: intent.style.zeroProof ? 'soda-water' : 'sparkling-wine' } : null);
    if (!want || ctx.forbidden(want.id, intent) || archForbids(a, want.id)) return;
    lines.push({ id: want.id, role: roleOf(want.id), oz: want.id === 'sparkling-wine' ? 2 : 2, slot: 'top', range: null, req: true, top: true });
    notes.push(`topped with ${shortName(want.id)}`);
  }

  // Accents stay accents: anything over its cap comes down to it (canonical spec doses excepted).
  function capDoses(a, lines, intent) {
    for (const l of lines) {
      if (l.fromSpec && !l.swapped) continue;
      const cap = doseCap(l.id, a.family, (intent.ings[l.id] || 0) >= 1);
      if ((l.oz || 0) > cap) { l.oz = cap; if (l.range) l.range = [Math.min(l.range[0], cap), Math.min(l.range[1], cap)]; }
    }
  }

  // A canonical spec that doesn't carry the archetype's own signature is a variant (a modern
  // bar's rewrite); building from it would mean bolting the missing parts back on, so the
  // composer starts only from specs that already are what the label says.
  const specCache = new Map();
  function fittingSpecs(a) {
    if (!specCache.has(a.id)) {
      const all = (a.canonicalSpecs || []).filter(sp => sp.lines && sp.lines.some(l => ingMap.has(l.id)));
      const fit = all.filter(sp => satisfies(a, sp.lines.filter(l => ingMap.has(l.id))).ok);
      specCache.set(a.id, fit.length ? fit : all);
    }
    return specCache.get(a.id);
  }

  // How many bottles a build may hold: the archetype's typical count plus room for the prayer's
  // twist, never past ten (a Zombie's nine is already a lot of bottles for a home bar).
  const capOf = a => Math.min(10, Math.max(5, (a.typicalCount || a.signature.length) + 2));
  const counted = lines => lines.filter(l => !l.garnish && l.role !== 'aromatic');

  // Trim a build back under the cap: drop optional extras the prayer didn't ask for, the
  // least wanted first, never a signature component that is the only one of its kind.
  function trim(a, lines, intent, ctx, notes, cap = capOf(a)) {
    const sig = a.signature.filter(c => c.required);
    const needed = l => sig.some(c => c.anyOf.includes(l.id) && lines.filter(x => c.anyOf.includes(x.id)).length === 1);
    while (counted(lines).length > cap) {
      const cands = counted(lines).filter(l => !l.req && !needed(l) && !l.float && !l.sink && !l.crown);
      if (!cands.length) break;
      cands.sort((x, y) => (ctx.intentMatch(x.id, intent) - ctx.intentMatch(y.id, intent)) || ((x.twist ? 1 : 0) - (y.twist ? 1 : 0)) || (x.oz - y.oz));
      const drop = cands[0];
      lines.splice(lines.indexOf(drop), 1);
      notes.push(`left out the ${shortName(drop.id)} to keep it to ${cap} bottles`);
    }
  }

  function rangeOf(a, id) {
    const c = slotFor(a, id);
    return c && c.ozRange ? c.ozRange : null;
  }
  const shortName = id => ingMap.get(id).name.toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

  function fillSlots(a, intent, ctx, rng, greedy) {
    const lines = [];
    const chosen = () => lines.map(l => l.id);
    for (const c of a.signature) {
      if (!c.required && !wantOptional(c, intent, ctx)) continue;
      for (let i = 0; i < (c.count || 1); i++) {
        const id = pickFor(c.anyOf, intent, ctx, chosen(), rng, greedy, c.anyOf);
        if (!id) break;
        const r = c.ozRange || [0.5, 0.75];
        const k = knob(intent, roleOf(id));
        const mid = (r[0] + r[1]) / 2;
        lines.push({ id, role: roleOf(id), oz: k > 0 ? mid + (r[1] - mid) * k / 2 : mid + (mid - r[0]) * k / 2, slot: c.component, range: r, float: !!c.float, sink: !!c.sink, crown: !!c.crown });
      }
    }
    return lines;
  }

  // Zero-proof: each spirit gives way to a stand-in with body (cold strong black tea for the
  // first, the drink's own juice for the rest), and every liqueur to its alcohol-free twin
  // (velvet falernum → falernum syrup, curaçao → fresh orange). The volume stays, so the
  // drink keeps its size and shape.
  function zeroProof(a, lines, intent, ctx, notes) {
    let tea = false;
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      const ing = ingMap.get(l.id);
      if (!ing || !(ing.abv > 0) || ing.cat === 'bitters') continue;
      if (ing.role === 'base') {
        if (l.float || l.sink) { lines.splice(i, 1); continue; }
        if (!tea && !ctx.forbidden('black-tea', intent) && !a.creamy) {
          notes.push(`cold strong black tea stands in for the ${shortName(l.id)}`);
          l.id = 'black-tea'; l.role = 'juice'; l.req = true; l.range = null; l.slot = 'zero-proof body'; tea = true;
          continue;
        }
        const juice = lines.find(x => ['juice'].includes(x.role) && x.id !== 'black-tea');
        if (juice) { juice.oz += l.oz * 0.6; notes.push(`more ${shortName(juice.id)} in place of the ${shortName(l.id)}`); }
        lines.splice(i, 1);
        continue;
      }
      const alt = ctx.naSwap[l.id];
      if (alt && ingMap.has(alt) && !ctx.forbidden(alt, intent) && !lines.some(x => x.id === alt)) {
        notes.push(`${shortName(alt)} in place of ${shortName(l.id)}`);
        l.id = alt; l.role = roleOf(alt);
      }
    }
    // The spirit's bite has to come from somewhere: a creamy or juicy build with no acid gets lime.
    if (!lines.some(l => (ingMap.get(l.id) || {}).acid >= 2) && ingMap.has('lime') && !ctx.forbidden('lime', intent)) {
      lines.push({ id: 'lime', role: 'sour', oz: 0.5, slot: 'zero-proof bite', range: [0.25, 0.75], req: true });
      notes.push('fresh lime for the bite the rum would have given');
    }
  }

  // "Three rums": layer rums by job the way Don did (a clean column rum for body, a funky
  // Jamaican for flavor, a dark Demerara for depth), splitting the existing base rather than
  // adding volume.
  const RUM_JOBS = [['rum-white-column', 'rum-gold-column', 'rum-blended-light'], ['rum-jamaican-aged', 'rum-jamaican-pot', 'rum-jamaican-dark'], ['rum-demerara', 'rum-barbados', 'rum-agricole-vieux'], ['rum-demerara-overproof', 'rum-black-blended']];
  function layerRums(a, lines, intent, ctx, notes) {
    const rums = () => lines.filter(l => (ingMap.get(l.id) || {}).cat === 'rum' && !l.float && !l.sink);
    let guard = 0;
    while (rums().length < intent.rumCount && guard++ < 4) {
      const have = rums();
      if (!have.length) return;
      const ids = lines.map(l => l.id);
      const jobOf = id => RUM_JOBS.findIndex(j => j.includes(id));
      const missingJob = RUM_JOBS.find((j, i) => !have.some(r => jobOf(r.id) === i));
      const pick = missingJob && missingJob.find(id => ingMap.has(id) && !ctx.forbidden(id, intent) && !archForbids(a, id) && !ids.includes(id) && !ctx.conflicts(id, ids));
      if (!pick) return;
      const lead = have.sort((x, y) => y.oz - x.oz)[0];
      if (lead.oz < 1) return;
      const share = Math.max(0.5, Math.round(lead.oz / 3 * 4) / 4);
      lead.oz -= share;
      if (lead.range) lead.range = [Math.min(lead.range[0], lead.oz), lead.range[1]];
      lines.push({ id: pick, role: 'base', oz: share, slot: lead.slot, range: null, req: true });
      notes.push(`${shortName(pick)} as another rum in the blend`);
    }
  }

  // Bottles the archetype or the guest rules out give way to an allowed alternative in the same slot.
  function replaceForbidden(a, lines, intent, ctx, notes) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      if (!ctx.forbidden(l.id, intent)) continue;
      const slot = [...a.signature, ...(a.optional || [])].find(c => (c.component || c.slot) === l.slot);
      const others = lines.filter(x => x !== l).map(x => x.id);
      const alt = slot && slot.anyOf.find(id => ingMap.has(id) && !ctx.forbidden(id, intent) && !others.includes(id) && !ctx.conflicts(id, others));
      if (alt) { notes.push(`${shortName(alt)} in place of ${shortName(l.id)}`); l.id = alt; l.role = roleOf(alt); }
      else { notes.push(`left out the ${shortName(l.id)}`); lines.splice(i, 1); }
    }
  }

  // A requested spirit takes over the base: all of it if the guest said "only", else the lead pour.
  function swapInSpirits(a, lines, intent, ctx, notes) {
    const want = [...(intent.spirits || []).filter(x => x !== 'rum'), ...Object.keys(intent.ings).filter(id => (ingMap.get(id) || {}).cat === 'rum' && intent.ings[id] >= 1)]
      .filter(id => ingMap.has(id) && !ctx.forbidden(id, intent) && !lines.some(l => l.id === id));
    if (!want.length) return;
    const bases = lines.filter(l => l.role === 'base' && !l.float).sort((x, y) => y.oz - x.oz);
    const only = intent.avoidSpirits && intent.avoidSpirits.has('rum') || / only | just /.test(` ${(intent.raw || '').toLowerCase()} `);
    if (only && bases.length) {
      const total = bases.reduce((s, l) => s + l.oz, 0);
      const keep = bases[0];
      for (const b of bases.slice(1)) lines.splice(lines.indexOf(b), 1);
      notes.push(`${shortName(want[0])} for all of the base`);
      keep.id = want[0]; keep.role = 'base'; keep.oz = Math.min(total, 2.25); keep.req = true;
      return;
    }
    // Take over a base pour the signature doesn't depend on; if every base is load-bearing
    // (the 151 *is* a Cobra's Fang), split the lead pour instead of losing what defines the drink.
    const sig = a.signature.filter(c => c.required);
    const sole = l => sig.some(c => c.anyOf.includes(l.id) && lines.filter(x => c.anyOf.includes(x.id)).length === 1);
    const catOf = id => (ingMap.get(id) || {}).cat;
    // Same job: the component lists it, or it's a "non-rum spirit" component and this is a spirit.
    const sameJob = (l, id) => sig.some(c => c.anyOf.includes(l.id) && (c.anyOf.includes(id) || (catOf(id) === 'spirit' && c.anyOf.every(x => catOf(x) === 'spirit'))));
    for (const id of want) {
      // Full takeover when the base isn't load-bearing, or when the new spirit does the same job
      // (tequila for the gin in a Saturn: the passion-fruit sour accepts either).
      const target = bases.find(l => !l.req && lines.includes(l) && (!sole(l) || sameJob(l, id)));
      if (target) { notes.push(`${shortName(id)} takes over from ${shortName(target.id)}`); target.id = id; target.req = true; target.range = null; continue; }
      const lead = bases.find(l => lines.includes(l)) || null;
      if (lead && lead.oz >= 1) {
        const share = Math.max(0.75, Math.round(lead.oz / 2 * 4) / 4);
        lead.oz = Math.max(0.5, lead.oz - share);
        if (lead.range) lead.range = [Math.min(lead.range[0], lead.oz), lead.range[1]];
        lines.push({ id, role: 'base', oz: share, req: true, slot: lead.slot, range: null, split: true });
        notes.push(`split the base: ${shortName(id)} with the ${shortName(lead.id)}`);
      } else lines.push({ id, role: 'base', oz: 0.75, req: true, slot: 'base' });
    }
  }

  function placeIngredient(a, lines, id, intent, ctx, notes) {
    const slot = slotFor(a, id);
    const others = lines.map(l => l.id);
    // One fizzy top is plenty: a new lengthener takes the old one's place.
    if (roleOf(id) === 'lengthener') {
      const old = lines.find(l => l.role === 'lengthener' && !l.req && !l.float && !l.sink);
      if (old) { notes.push(`${shortName(id)} in place of ${shortName(old.id)}`); old.id = id; old.req = true; return; }
    }
    if (slot) {
      const occupant = lines.find(l => l.slot === (slot.component || slot.slot) && !l.req);
      if (occupant && (slot.maxCount || 1) <= lines.filter(l => l.slot === occupant.slot).length) {
        notes.push(`${shortName(id)} in place of ${shortName(occupant.id)}`);
        occupant.id = id; occupant.role = roleOf(id); occupant.req = true;
        return;
      }
      if (ctx.conflicts(id, others)) {
        const clash = lines.find(l => ctx.conflicts(id, [l.id]) && !l.req);
        if (!clash) return;
        notes.push(`${shortName(id)} in place of ${shortName(clash.id)}`);
        clash.id = id; clash.role = roleOf(id); clash.req = true;
        return;
      }
      const r = slot.ozRange || [0.5, 0.75];
      // Asked for by name, so it has to be tasted: dose toward the top of the slot's range.
      lines.push({ id, role: roleOf(id), oz: r[0] + (r[1] - r[0]) * 0.75, slot: slot.component || slot.slot, range: r, req: true });
      notes.push(`added ${shortName(id)}`);
      return;
    }
    // No slot for it, but the guest asked: work it in the way a bartender would, trading part of
    // the drink's main juice for a juice, or adding a modest pour of a liqueur or syrup.
    const role = roleOf(id);
    if (role === 'juice') {
      const main = lines.filter(l => l.role === 'juice' && !l.req).sort((x, y) => y.oz - x.oz)[0];
      const oz = main ? Math.min(1.5, Math.max(0.75, Math.round(main.oz / 3 * 4) / 4)) : 1;
      if (main) { main.oz -= oz; if (main.range) main.range = [Math.min(main.range[0], main.oz), main.range[1]]; }
      lines.push({ id, role, oz, slot: 'asked', range: null, req: true });
      notes.push(main ? `${oz} oz of the ${shortName(main.id)} traded for ${shortName(id)}` : `added ${shortName(id)}`);
    } else if (role === 'sweet' && lines.some(l => PLAIN_SYRUPS.has(l.id) && !l.req)) {
      // A flavored syrup takes the plain syrup's job, so the balance holds.
      const plain = lines.find(l => PLAIN_SYRUPS.has(l.id) && !l.req);
      notes.push(`${shortName(id)} in place of the ${shortName(plain.id)}`);
      plain.id = id; plain.req = true; plain.oz = Math.max(plain.oz, 0.5); plain.range = null;
    } else if (['modifier', 'sweet', 'accent', 'rich'].includes(role)) {
      const oz = role === 'accent' ? 0.06 : role === 'rich' ? 0.75 : 0.5;
      lines.push({ id, role, oz, slot: 'asked', range: null, req: true });
      notes.push(`added ${shortName(id)}`);
    }
  }

  function openFor(a, lines, tag, intent, ctx) {
    const ids = lines.map(l => l.id);
    for (const o of a.optional || []) {
      if (lines.filter(l => l.slot === o.slot).length >= (o.maxCount || 1)) continue;
      const id = o.anyOf.find(x => ingMap.has(x) && !ctx.forbidden(x, intent) && !ids.includes(x) && !ctx.conflicts(x, ids) && ((ctx.ingVec[x] || {})[tag] || 0) >= 0.55);
      if (!id) continue;
      const r = o.ozRange || [0.5, 0.75];
      lines.push({ id, role: roleOf(id), oz: r[0] + (r[1] - r[0]) * 0.75, slot: o.slot, range: r, req: true, float: !!o.float, sink: !!o.sink });
      return `added ${shortName(id)} for ${tag.replace('-', ' ')}`;
    }
    return null;
  }

  const leads = (id, tag) => ((ingMap.get(id) || {}).flavors || [])[0] === tag;
  const archForbids = (a, id) => (a.forbidden || []).includes(id) || (a.forbidden || []).includes(`cat:${(ingMap.get(id) || {}).cat}`);
  // Spirits that are a flavor outright (mezcal for smoke, Jamaican pot still for funk).
  function splitCarrier(a, lines, tag, intent, ctx) {
    const ids = lines.map(l => l.id);
    const pool = [...ingMap.values()].filter(i => i.role === 'base' && leads(i.id, tag) && ['common', 'specialty'].includes(i.avail)
      && !ctx.forbidden(i.id, intent) && !archForbids(a, i.id) && !ids.includes(i.id) && !ctx.conflicts(i.id, ids));
    pool.sort((x, y) => (ctx.intentMatch(y.id, intent) + (y.avail === 'common' ? 0.3 : 0)) - (ctx.intentMatch(x.id, intent) + (x.avail === 'common' ? 0.3 : 0)));
    return pool[0] ? pool[0].id : null;
  }
  function splitBase(a, lines, tag, intent, ctx) {
    const bases = lines.filter(l => l.role === 'base' && !l.float && !l.sink).sort((x, y) => y.oz - x.oz);
    if (!bases.length) return null;
    const id = splitCarrier(a, lines, tag, intent, ctx);
    if (!id) return null;
    const sig = a.signature.filter(c => c.required);
    const sole = l => sig.some(c => c.anyOf.includes(l.id) && lines.filter(x => c.anyOf.includes(x.id)).length === 1);
    const spare = bases.slice(1).reverse().find(l => !l.req && !sole(l));
    const nm = shortName(id);
    if (spare) {
      const was = shortName(spare.id);
      if (spare.oz < 0.5) { bases[0].oz = Math.max(1, bases[0].oz - (0.5 - spare.oz)); spare.oz = 0.5; }
      spare.id = id; spare.req = true; spare.range = null;
      return `${nm} in place of ${was} for ${tag.replace('-', ' ')}`;
    }
    const lead = bases[0];
    const share = Math.min(0.75, Math.round(lead.oz / 2 * 4) / 4);
    if (share < 0.5) return null;
    lead.oz -= share;
    if (lead.range) lead.range = [Math.min(lead.range[0], lead.oz), lead.range[1]];
    lines.push({ id, role: 'base', oz: share, slot: lead.slot, range: null, req: true, split: true });
    return `split the base with ${nm} for ${tag.replace('-', ' ')}`;
  }

  function wantOptional(c, intent, ctx) {
    return c.anyOf.some(id => ingMap.has(id) && !ctx.forbidden(id, intent) && ctx.intentMatch(id, intent) >= 1.2);
  }
  function carried(lines, tag, ctx) {
    return lines.some(l => ((ctx.ingVec[l.id] || {})[tag] || 0) >= 0.55);
  }
  function slotOf(a, id) {
    const c = slotFor(a, id);
    return c ? (c.component || c.slot) : null;
  }
  function trySwap(a, lines, tag, intent, ctx) {
    const slots = [...a.signature, ...(a.optional || [])];
    for (const l of lines) {
      if (l.req || l.locked) continue;
      const slot = slots.find(c => (c.component || c.slot) === l.slot);
      if (!slot) continue;
      const others = lines.filter(x => x !== l).map(x => x.id);
      const alt = slot.anyOf.filter(id => ingMap.has(id) && !ctx.forbidden(id, intent) && !others.includes(id) && !ctx.conflicts(id, others) && ((ctx.ingVec[id] || {})[tag] || 0) >= 0.55)[0];
      if (!alt) continue;
      const was = ingMap.get(l.id).name.toLowerCase().replace(/\s*\(.*\)/, '');
      l.id = alt; l.role = roleOf(alt); l.req = true; l.swapped = true;
      if (l.oz > doseCap(alt, a.family)) l.oz = doseCap(alt, a.family);
      return `${ingMap.get(alt).name.toLowerCase().replace(/\s*\(.*\)/, '')} in place of ${was} for ${tag.replace('-', ' ')}`;
    }
    return null;
  }

  // Put back any signature component a riff lost (a Mai Tai without curaçao isn't a Mai Tai).
  function repair(a, lines, intent, ctx, rng, notes) {
    const ids = () => lines.filter(l => !l.garnish).map(l => l.id);
    for (const c of a.signature) {
      if (!c.required || ids().some(id => accepts(c, id))) continue;
      const id = pickFor(c.anyOf, intent, ctx, ids(), rng, true, c.anyOf);
      if (!id) continue;
      const r = c.ozRange || [0.5, 0.75];
      lines.push({ id, role: roleOf(id), oz: (r[0] + r[1]) / 2, slot: c.component, range: r });
      notes.push(`kept the ${c.component} (${ingMap.get(id).name.toLowerCase().replace(/\s*\(.*\)/, '')}) that makes it a ${a.name}`);
    }
    // Remove anything the archetype forbids, unless the guest asked for it by name: a blue
    // Mai Tai is a purist's red flag, but it's the guest's drink.
    for (let i = lines.length - 1; i >= 0; i--) {
      if ((intent.ings[lines[i].id] || 0) >= 1.5) continue;
      if (archForbids(a, lines[i].id)) lines.splice(i, 1);
    }
  }

  // A twist that makes a classic-shaped build the guest's own: open the optional slot that best
  // answers the prayer (a fruit, a spice, a float), before ever swapping a core bottle.
  function twist(a, lines, intent, ctx, rng, greedy) {
    if (counted(lines).length >= capOf(a)) return null;
    const ids = lines.map(l => l.id);
    const options = [];
    for (const o of a.optional || []) {
      if (lines.filter(l => l.slot === o.slot).length >= (o.maxCount || 1)) continue;
      for (const id of o.anyOf) {
        if (!ingMap.has(id) || ctx.forbidden(id, intent) || ids.includes(id) || ctx.conflicts(id, ids)) continue;
        // A twist you can't taste (two drops of saline, a dash of water) isn't a twist, and one
        // that fights the color the guest asked for (grenadine in a blue drink) is no twist either.
        if (['saline', 'water', 'hot-water'].includes(id) && ctx.intentMatch(id, intent) < 1) continue;
        const c = (ingMap.get(id) || {}).color;
        if (intent.color && c && !['white'].includes(c) && c !== intent.color) continue;
        options.push({ item: { o, id }, s: 2.2 * ctx.intentMatch(id, intent) + 0.6 * ctx.compat(id, ids) + (o.common ? 0.4 : 0) - (o.anyOf.indexOf(id) * 0.05) });
      }
    }
    const pick = ctx.softPick(rng, options, 0.6, greedy);
    if (!pick) return null;
    const r = pick.o.ozRange || [0.5, 0.75];
    // Accents (bitters, anise) go in at the light end of their range; everything else mid-range.
    const accent = ['accent'].includes(roleOf(pick.id)) || (ingMap.get(pick.id) || {}).cat === 'bitters';
    lines.push({ id: pick.id, role: roleOf(pick.id), oz: accent ? r[0] : (r[0] + r[1]) / 2, slot: pick.o.slot, range: r, float: !!pick.o.float, sink: !!pick.o.sink, twist: true });
    const nm = ingMap.get(pick.id).name.toLowerCase().replace(/\s*\(.*\)/, '');
    return pick.o.float ? `a ${nm} float` : pick.o.sink ? `${nm} sunk to the bottom` : `${nm} in the ${pick.o.slot} slot`;
  }

  // A genuine variation inside the frame: refill one slot with a different allowed bottle.
  function vary(a, lines, intent, ctx, rng, greedy) {
    const slots = [...a.signature, ...(a.optional || [])];
    // The lengthener (coffee in a Coffee Grog, ginger beer in a Dark 'n Stormy) and the citrus are
    // what the drink is; variation happens in its modifiers, sweeteners, juices and spirits.
    const order = ['modifier', 'sweet', 'juice', 'accent', 'base'];
    const cands = lines.filter(l => !l.req && !l.garnish && l.slot && order.includes(l.role) && slots.some(c => (c.component || c.slot) === l.slot && c.anyOf.length > 1));
    if (!cands.length) return null;
    const victim = greedy ? [...cands].sort((x, y) => order.indexOf(x.role) - order.indexOf(y.role))[0] : cands[Math.floor(rng() * cands.length)];
    const slot = slots.find(c => (c.component || c.slot) === victim.slot);
    const others = lines.filter(l => l !== victim).map(l => l.id);
    const pool = slot.anyOf.filter(id => id !== victim.id && ingMap.has(id) && !ctx.forbidden(id, intent) && !others.includes(id) && !ctx.conflicts(id, others));
    const pick = ctx.softPick(rng, pool.map(id => ({ item: id, s: 2 * ctx.intentMatch(id, intent) + ctx.compat(id, others) })), 0.6, greedy);
    if (!pick) return null;
    const was = ingMap.get(victim.id).name.toLowerCase().replace(/\s*\(.*\)/, '');
    victim.id = pick; victim.role = roleOf(pick); victim.swapped = true;
    const cap = doseCap(pick, a.family);
    if (victim.oz > cap) victim.oz = cap;
    return `${ingMap.get(pick).name.toLowerCase().replace(/\s*\(.*\)/, '')} in place of ${was}`;
  }

  // Does a finished line-up still satisfy the archetype? (Used by tests and as a final guard.)
  // `waived`: components the guest ruled out entirely (orgeat in a nut-free Mai Tai, the rum in
  // a zero-proof drink). The drink is then honestly a cousin of the archetype, and the copy says so.
  function satisfies(a, lines, asked = {}, isForbidden = null) {
    const ids = new Set(lines.filter(l => !l.garnish).map(l => l.id));
    const absent = a.signature.filter(c => c.required && ![...ids].some(id => accepts(c, id)));
    const waivedC = isForbidden ? absent.filter(c => c.anyOf.every(id => isForbidden(id))) : [];
    const missing = absent.filter(c => !waivedC.includes(c)).map(c => c.component);
    const banned = [...ids].filter(id => archForbids(a, id) && !((asked[id] || 0) >= 1.5));
    return { ok: !missing.length && !banned.length, missing, banned, waived: waivedC.map(c => c.component) };
  }

  // Can this archetype carry a flavor at all (its profile, or a slot's bottle)?
  const carries = (a, tag, intent, ctx) => (a.flavorProfile || []).includes(tag) || !!slotsCarry(a, tag, intent, ctx);
  return { byId, archetypes, scoreArchetype, compose, satisfies, slotOf, vary, repair, twist, capDoses, carries };
}
