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
// A flavored syrup is a sweetener, dosed like one (an ounce at most): it never inherits the range
// of the nectar or juice that shares its slot (a Tropical Itch takes passion fruit nectar by the
// glassful, never five ounces of passion fruit syrup). Coconut rum is an accent: half an ounce.
const DOSE_CAP = {"pastis":0.04,"absinthe":0.04,"angostura":0.18,"peychauds":0.12,"orange-bitters":0.12,"tiki-bitters":0.12,"mole-bitters":0.12,"saline":0.024,"almond-extract":0.012,"vanilla-extract":0.03,"orange-flower-water":0.012,"allspice-dram":0.5,"velvet-falernum":0.75,"falernum-syrup":0.75,"maraschino":0.5,"grenadine":[0.5,{"zombie":0.17,"mai-tai":0,"grog":0.17,"orgeat-punch":0.25,"resort-punch":1,"punch":0.75}],"green-chartreuse":0.75,"yellow-chartreuse":0.75,"campari":[0.75,{"bitter-tiki":1.5,"stirred":1}],"fernet":0.25,"scotch-islay":0.5,"cinnamon-syrup":0.75,"ginger-syrup":0.75,"blue-curacao":0.75,"melon-liqueur":1,"coffee-liqueur":1,"creme-de-cacao":0.75,"banana-liqueur":1,"coconut-rum":0.5,"rum-jamaican-white-overproof":0.75,"coffee":[0.75,{"hot":6}],"irish-cream":1,"amontillado-sherry":0.75,"triple-sec":1,"orange-curacao":1,"passion-fruit-syrup":[1,{"resort-punch":2}],"hibiscus-syrup":1,"raspberry-syrup":1,"guava-syrup":1,"pineapple-syrup":1,"orgeat":1,"honey-syrup":1,"dons-mix":1,"li-hing-mui-syrup":0.5,"vanilla-syrup":0.5,"maple-syrup":0.5,"lime-cordial":1,"fassionola":[1,{"resort-punch":2}]};
const OVERPROOF = new Set(['rum-demerara-overproof', 'rum-black-overproof', 'rum-overproof-white']);
export function doseCap(id, family, asked = false) {
  // Overproof is a seasoning or, at most, a short drink's whole base (a Cobra's Fang's 1½ oz).
  if (OVERPROOF.has(id)) return asked ? 2 : 1.5;
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

  // A promise may hold only on certain frames (Havana's Hotel Nacional promise is the fruit
  // daiquiri's; its No. 4 promise the frozen daiquiri's).
  const applies = (pr, a) => !(pr.when || []).length || (!!a && pr.when.includes(a.id));
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
    // The Tequila Sunrise is a resort cousin, not every colorful prayer's answer.
    if (a.id === 'sunrise-float' && !/sunrise/.test(intent.raw || '') && !(intent.spirits || []).some(x => /tequila/.test(x))) s -= 1.5;
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
    // What each reading promised the guest (dad's bourbon, Tokyo's yuzu, a first date served up):
    // a frame that can keep the promise answers better than one that can't.
    for (const pr of intent.promises || []) {
      if (!applies(pr, a)) continue;
      if ((pr.frames || []).length) s += pr.frames.includes(a.id) ? 1 : -1.5;
      if (pr.ids.length) s += pr.ids.some(id => canHold(a, id, intent, ctx)) ? 0.6 : -0.9;
      if (pr.up) s += (a.methods || []).includes('shake') && !a.creamy && !a.long ? 0.6 : -0.6;
    }
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
  // Can this frame take this bottle without breaking: a slot for it, a spirit it doesn't forbid,
  // or an open slot for its role.
  function canHold(a, id, intent, ctx) {
    if (!ingMap.has(id) || ctx.forbidden(id, intent) || archForbids(a, id)) return false;
    if (allIds(a).has(id) || !!slotFor(a, id) || roleOf(id) === 'base' || canAdd(a, id)) return true;
    // The ways placeIngredient works a bottle in without a slot: a liqueur or rich accent added,
    // a flavored syrup taking the plain syrup's job, a juice trading part of the main juice.
    const r = roleOf(id), specs = fittingSpecs(a);
    if (['modifier', 'accent', 'rich'].includes(r)) return true;
    if (r === 'sweet') return specs.some(sp => sp.lines.some(l => PLAIN_SYRUPS.has(l.id)));
    if (r === 'juice') return specs.some(sp => sp.lines.some(l => roleOf(l.id) === 'juice'));
    return false;
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
    let specs = fittingSpecs(a);
    // A named drink's other branches only (a Jungle Bird's specs that still pour pineapple).
    if (intent.specOnly) { const keep = specs.filter(intent.specOnly); if (keep.length) specs = keep; }
    if (src) lines = src.lines.map(l => ({ ...l, slot: slotOf(a, l.id), range: rangeOf(a, l.id) }));
    else if (specs.length) {
      const scored = specs.map((sp, i) => {
        let s = -0.25 * i + (sp.confidence === 'high' ? 0.3 : 0);
        // The canonical drink a concept points at (Havana's Daiquiri No. 4).
        if (((intent.specs || {})[a.id] || []).includes(sp.name)) s += 4;
        for (const l of sp.lines) if (ingMap.has(l.id)) s += 0.8 * Math.max(-2, Math.min(2, ctx.intentMatch(l.id, intent))) - (ctx.forbidden(l.id, intent) ? 1.5 : 0);
        // A spec whose look is a loud color (Blue Hawaiian blue, Midori green) answers only a prayer for it.
        for (const l of sp.lines) { const c = (ingMap.get(l.id) || {}).color; if (['blue', 'green'].includes(c) && intent.color !== c) s -= 2; }
        s += brightness(sp, intent);
        return { item: sp, s };
      });
      // A repeat prayer on the same frame starts from a different proven spec.
      // Only from the specs that suit the prayer (not a Blue Hawaiian stripped of its blue), and
      // among those the prayer's own tie-break picks, so two prayers on one frame differ.
      const sorted = [...scored].sort((x, y) => y.s - x.s);
      const fit = sorted.filter(x => x.s >= sorted[0].s - (intent.avoidSets && intent.avoidSets.length ? 5 : 1.5));
      // Praying again starts from the proven spec furthest from what the earlier prayers poured
      // (Vic's Navy Grog after Don's, Belanger's three-rum Painkiller after Pusser's), so the
      // second idea differs in its bottles, not by a quarter ounce.
      const ids = sp => new Set(sp.lines.filter(l => ingMap.has(l.id) && roleOf(l.id) !== 'aromatic').map(l => l.id));
      const near = sp => Math.max(0, ...(intent.avoidSets || []).map(set => { const A = ids(sp); const i = [...A].filter(x => set.has(x)).length; return i / (A.size + set.size - i || 1); }));
      // Of the specs far enough from what was poured before, the prayer's own pick (so every Mai Tai
      // prayed again doesn't land on the same edition); else the furthest.
      const far = fit.filter(x => near(x.item) < 0.6);
      const sp = specOffset > 0 && fit.length > 1 && intent.avoidSets && intent.avoidSets.length
        ? (far.length > 1 ? ctx.softPick(rng, far.map(x => ({ ...x })), 1.5, false) : [...fit].sort((x, y) => near(x.item) - near(y.item) || y.s - x.s)[0].item)
        : specOffset > 0 && fit.length > 1 ? ctx.softPick(rng, fit.slice(1).map(x => ({ ...x, s: 0 })), 1, true).item || fit[1].item
          : specOffset > 0 ? fit[0].item
            // A frame the prayer didn't name starts from any of its proven specs that suit the
            // prayer, chosen by the prayer itself: two prayers that land on the Zombie pour two
            // Zombies (Berry's 1934 decode, the Smuggler's Cove spec), not one twice.
            : greedy && !((intent.archetypes || {})[a.id] >= 0.5) && !((intent.fam || {})[a.family] >= 1) && fit.length > 1
              ? ctx.softPick(rng, sorted.filter(x => x.s >= sorted[0].s - 1.5).map(x => ({ ...x })), 0.8, false)
              : ctx.softPick(rng, scored, 0.6, greedy);
      lines = sp.lines.filter(l => ingMap.has(l.id)).map(l => ({ id: l.id, role: roleOf(l.id), oz: l.oz, unit: l.unit, amount: l.amount, float: !!l.float, sink: !!l.sink, crown: !!l.crown, slot: slotOf(a, l.id), range: rangeOf(a, l.id), fromSpec: sp.name, label: specLabel(l) }));
      // A sink has to be dense and a float light: a spec that marks rum as "sink" is describing
      // which half of a two-part pour it goes in, not physics.
      for (const l of lines) {
        const sg = ((ingMap.get(l.id) || {}).optics || {}).sg;
        if (l.sink && !(sg >= 1.08)) l.sink = false;
        if (l.float && !(sg <= 1.0)) l.float = false;
      }
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
      // A tiki sunrise is a rum sunrise unless the guest wants tequila.
      if (a.id === 'sunrise-float' && !(intent.spirits || []).some(x => /tequila/.test(x)) && !((intent.prefer || {})['tequila-blanco'] >= 1)) {
        for (const l of lines) if (l.id === 'tequila-blanco' && ingMap.has('rum-gold-column') && !ctx.forbidden('rum-gold-column', intent)) { l.id = 'rum-gold-column'; notes.push('gold rum rather than tequila: a tiki sunrise'); }
      }
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
    // A reading's promise comes first: the first bottle it names that this frame can hold, unless
    // one of its bottles is already poured.
    // A reading that names a spirit and a seasoning (a dragon's mezcal and chile) gets both.
    // A promise of all its bottles (heartbreak's amaro *and* Cherry Heering) pours each one the
    // frame can hold; a float promised (a promotion's Demerara 151) is floated, below, not poured in.
    const floatIds = new Set((intent.promises || []).flatMap(pr => Array.isArray(pr.float) ? pr.float : []));
    const promised = (intent.promises || []).filter(pr => applies(pr, a) && (pr.ids || []).length && (pr.all || !pr.ids.some(id => lines.some(l => l.id === id))))
      .flatMap(pr => { const ok = pr.ids.filter(id => !floatIds.has(id) && !lines.some(l => l.id === id) && canHold(a, id, intent, ctx)); return pr.all ? ok.slice(0, 3) : roleOf(ok[0]) === 'base' ? ok.slice(0, 2) : ok.slice(0, 1); });
    const heroes = [...new Set([...promised, ...Object.entries(intent.prefer || {}).filter(([id, w]) => w >= 1.25).sort((x, y) => y[1] - x[1]).map(([id]) => id)])]
      .filter(id => ingMap.has(id) && !lines.some(l => l.id === id) && !ctx.forbidden(id, intent) && !archForbids(a, id)).slice(0, 3).map(id => [id]);
    let heroSpirit = false;
    for (const [id] of heroes) {
      // A citrus hero shares the main citrus's pour (yuzu with the lime) rather than adding acid.
      if (roleOf(id) === 'sour' && lines.some(l => l.role === 'sour')) {
        const main = lines.filter(l => l.role === 'sour' && !l.req).sort((x, y) => y.oz - x.oz)[0];
        if (!main || main.oz < 0.75) continue;
        const half = Math.round(main.oz / 2 * 4) / 4;
        main.oz -= half; if (main.range) main.range = [Math.min(main.range[0], main.oz), main.range[1]];
        lines.push({ id, role: 'sour', oz: half, slot: main.slot, range: null, req: true });
        notes.push(`${shortName(id)} sharing the ${shortName(main.id)}'s pour`);
        continue;
      }
      if (roleOf(id) === 'base') {
        // One hero spirit per drink, and a rum hero in a rum drink takes over a pour rather than
        // splitting the base into a crowd.
        if (intent.spirits.includes(id) || heroSpirit) continue;
        const isRum = (ingMap.get(id) || {}).cat === 'rum';
        const rumBase = lines.some(l => l.role === 'base' && (ingMap.get(l.id) || {}).cat === 'rum' && !l.float);
        if (isRum && rumBase) {
          const sig = a.signature.filter(c => c.required);
          const target = lines.filter(l => l.role === 'base' && !l.req && !l.float && !l.sink && (ingMap.get(l.id) || {}).cat === 'rum')
            .find(l => !sig.some(c => c.anyOf.includes(l.id) && !c.anyOf.includes(id) && lines.filter(x => c.anyOf.includes(x.id)).length === 1));
          if (!target) continue;
          notes.push(`${shortName(id)} takes over from ${shortName(target.id)}`);
          target.id = id; target.req = true; target.range = null;
        } else swapInSpirits(a, lines, { ...intent, spirits: [id], avoidSpirits: new Set() }, ctx, notes);
        heroSpirit = true;
      }
      else {
        const before = new Set(lines);
        placeIngredient(a, lines, id, intent, ctx, notes, { add: true });
        for (const l of lines) if (!before.has(l) || l.id === id) l.hero = true;
      }
    }
    // Requested flavors still uncarried: swap a slot's filling, else open an optional slot.
    for (const [tag, w] of Object.entries(intent.tags).sort((x, y) => y[1] - x[1])) {
      if (w < 1.2 || NOT_A_FLAVOR.has(tag) || carried(lines, tag, ctx)) continue;
      // (A split base for a flavor comes later, only if no liqueur or syrup can carry it: a
      // floral prayer gets elderflower before it gets pisco.)
      const swap = trySwap(a, lines, tag, intent, ctx) || openFor(a, lines, tag, intent, ctx);
      if (swap) notes.push(swap);
    }
    // A flavor asked for plainly ("with mango") that no slot could carry: pour the bottle that
    // leads with it, worked in the way a bartender would.
    const explicit = t => (intent.tags[t] || 0) - ((intent.conceptTags || {})[t] || 0) * 0.6;
    // In a riff ("a Mai Tai but tropical") the modifier is the whole request: a lower bar.
    const bar = src || intent.riffBranch ? 1.0 : 1.5;
    for (const [tag] of Object.entries(intent.tags).sort((x, y) => y[1] - x[1])) {
      if (explicit(tag) < bar || NOT_A_FLAVOR.has(tag) || carried(lines, tag, ctx)) continue;
      const ids = lines.map(l => l.id);
      const pool = [...ingMap.values()].filter(i => i.role !== 'base' && i.role !== 'aromatic' && leads(i.id, tag) && ['common', 'specialty', 'homemade'].includes(i.avail)
        && !ctx.forbidden(i.id, intent) && !archForbids(a, i.id) && !ids.includes(i.id) && !ctx.conflicts(i.id, ids));
      // A short or stirred drink takes a flavor as a liqueur or syrup, never as a lengthener
      // (coffee liqueur in a nightcap, not six ounces of cold coffee).
      const long = a.long || lines.some(l => l.role === 'lengthener');
      // Stirred means no juice: a stirred drink takes the flavor as a syrup or liqueur.
      const stirred = (a.methods || [])[0] === 'stir' || a.family === 'stirred';
      const rank = i => (i.avail === 'common' ? 1 : 0) + (i.role === 'juice' ? 0.5 : 0) + (i.role === 'sweet' ? 0.3 : 0) + (i.role === 'modifier' && !long ? 0.6 : 0) - (i.role === 'lengthener' && !long ? 3 : 0);
      if (stirred) for (let i = pool.length - 1; i >= 0; i--) if (['juice', 'sour', 'lengthener'].includes(pool[i].role)) pool.splice(i, 1);
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
    // Only for a flavor the guest said outright: a concept's leanings don't add spirits.
    const said = t => (intent.tags[t] || 0) - ((intent.conceptTags || {})[t] || 0);
    for (const [tag] of Object.entries(intent.tags).sort((x, y) => y[1] - x[1])) {
      if (said(tag) < 1.5 || explicit(tag) < 2 || NOT_A_FLAVOR.has(tag) || lines.some(l => leads(l.id, tag))) continue;
      const split = splitBase(a, lines, tag, intent, ctx);
      if (split) { notes.push(split); break; }
    }
    topWithBubbles(a, lines, intent, ctx, notes);
    repair(a, lines, intent, ctx, rng, notes);
    trim(a, lines, intent, ctx, notes);
    capDoses(a, lines, intent);
    holdPromises(a, lines, intent, ctx, notes);
    return lines;
  }

  // The doses and the float a reading or a word promised, after everything else has been
  // placed and trimmed: bitter's three-quarters of an ounce of Campari, smoke's quarter ounce of
  // Islay, a promotion's Demerara 151 floated on top. A bottle the guest ruled out, or the
  // frame forbids, stays out; the card then says so.
  function holdPromises(a, lines, intent, ctx, notes) {
    for (const pr of intent.promises || []) {
      if (!applies(pr, a)) continue;
      // A promised bottle a trim took out (smoke's Islay) goes back in at its promised dose.
      const want = (pr.ids || []).filter(id => ingMap.has(id) && !ctx.forbidden(id, intent) && !archForbids(a, id) && !(Array.isArray(pr.float) && pr.float.includes(id)));
      const missing = pr.all ? want.filter(id => !lines.some(l => l.id === id)) : want.some(id => lines.some(l => l.id === id)) ? [] : want.slice(0, 1);
      for (const id of missing) {
        // A promised spirit (night's darker rum) takes over a rum pour nobody asked for.
        if (roleOf(id) === 'base' && !(pr.min || {})[id]) {
          const isRum = (ingMap.get(id) || {}).cat === 'rum';
          // Only a pour whose slot takes the promised spirit (the colada's rum slot may not).
          const fits = l => !l.slot || (slotOf(a, id) === l.slot) || [...a.signature, ...(a.optional || [])].some(c => (c.component || c.slot) === l.slot && accepts(c, id));
          const t = lines.find(l => l.role === 'base' && !l.req && !l.float && !l.sink && (!isRum || (ingMap.get(l.id) || {}).cat === 'rum') && fits(l));
          if (t) { notes.push(`${shortName(id)} takes over from ${shortName(t.id)}`); t.id = id; t.req = true; t.promised = true; }
          continue;
        }
        lines.push({ id, role: roleOf(id), oz: (pr.min || {})[id] || 0.5, slot: slotOf(a, id), range: null, req: true, promised: true });
        notes.push(`${shortName(id)} added`);
      }
      for (const [id, min] of Object.entries(pr.min || {})) {
        const l = lines.find(x => x.id === id && !x.garnish && !x.float);
        if (!l || (l.oz || 0) >= min - 0.01) continue;
        const cap = Math.max(min, doseCap(id, a.family, true));
        l.oz = Math.min(cap, min); l.req = true; l.promised = min;
        if (l.range) l.range = [Math.max(l.range[0], Math.min(min, l.range[1])), Math.max(l.range[1], min)];
      }
      // And the most it may pour (a royale's topper is an ounce and a half, so it fits the flute).
      for (const [id, max] of Object.entries(pr.max || {})) { const l = lines.find(x => x.id === id && !x.garnish); if (l && (l.oz || 0) > max) { l.oz = max; if (l.range) l.range = [Math.min(l.range[0], max), max]; } }
      for (const id of Array.isArray(pr.float) ? pr.float : []) {
        if (lines.some(l => l.float) || !ingMap.has(id) || ctx.forbidden(id, intent) || archForbids(a, id)) continue;
        const ing = ingMap.get(id);
        if (!(((ing.optics || {}).sg || 1) <= 1)) continue;
        lines.push({ id, role: roleOf(id), oz: OVERPROOF.has(id) ? 0.25 : 0.5, float: true, slot: 'float', range: null, req: true, promised: true });
        notes.push(`${shortName(id)} floated on top`);
        break;
      }
      // What keeps a promise is locked: a later twist or variation never trades it away.
      for (const l of lines) if ((pr.ids || []).includes(l.id) && (pr.all || l.id === (pr.ids || []).find(id => lines.some(x => x.id === id)))) { l.req = true; l.promised = l.promised || true; }
      // A bottle the promise rules out (bitter's Aperol) gives way to the one it promised.
      for (const id of pr.avoid || []) {
        const l = lines.find(x => x.id === id);
        const want = (pr.ids || []).find(x => ingMap.has(x) && !ctx.forbidden(x, intent) && !lines.some(y => y.id === x));
        if (!l) continue;
        if (want && roleOf(want) === roleOf(id)) { notes.push(`${shortName(want)} in place of ${shortName(id)}`); l.id = want; l.req = true; l.oz = Math.max(l.oz || 0, (pr.min || {})[want] || 0); }
        else if (!l.req || !(intent.ings[id] >= 1)) lines.splice(lines.indexOf(l), 1);
      }
    }
  }

  // Does a build keep what a reading or a word promised the guest? The bottles (any of them, or
  // all, at the promised dose), the service, the float, the strength, what it must not pour.
  // `weight` says how badly it broke: the promised bottles are the primary promise (1), each
  // other part counts half. A promise this pantry can't pour, or the guest ruled out, can't be broken.
  function promiseBreak(pr, { lines, svc = {}, A = {}, intent = {}, forbidden = () => false, chem = null }) {
    if (!applies(pr, A)) return 0;
    const poured = lines.filter(l => !l.garnish || l.muddled);
    const line = id => poured.find(l => l.id === id);
    let w = 0;
    const ids = (pr.ids || []).filter(id => ingMap.has(id) && !forbidden(id, intent));
    const okId = id => { const l = line(id); return !!l && ((l.oz || 0) >= ((pr.min || {})[id] || 0) - 0.02 || l.muddled); };
    if (ids.length && (pr.all ? !ids.every(okId) : !ids.some(okId))) w += 1;
    if (pr.up && !svc.wantUp && !svc.up) w += 0.5;
    if (pr.frozen && svc.method !== 'blend') w += 0.5;
    if (pr.stirred && svc.method !== 'stir') w += 0.5;
    if (pr.long && !poured.some(l => (ingMap.get(l.id) || {}).role === 'lengthener' && !l.float && (l.oz || 0) >= (pr.long === true ? 2 : pr.long) - 0.01)) w += 0.5;
    if (pr.float && !poured.some(l => l.float && (pr.float === true || pr.float.includes(l.id)))) w += 0.5;
    if (pr.layered && !poured.some(l => l.float || l.sink || l.crown)) w += 0.5;
    if (pr.flaming && !(intent.style && intent.style.flaming) && !A.flaming) w += 0.5;
    if (pr.abvMax && chem && chem.abv > pr.abvMax + 0.3) w += 1;
    if ((pr.avoid || []).some(id => line(id))) w += 0.5;
    // A promise only certain frames can keep (Havana's Cuban classics).
    if ((pr.frames || []).length && A.id && !pr.frames.includes(A.id)) w += 1;
    return w;
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
      if (l.fromSpec && !l.swapped && !l.grown) continue;
      const cap = doseCap(l.id, a.family, (intent.ings[l.id] || 0) >= 1);
      if ((l.oz || 0) > cap) { l.oz = cap; if (l.range) l.range = [Math.min(l.range[0], cap), Math.min(l.range[1], cap)]; }
    }
  }

  // A prayer that leans a bright color (a promotion's gold, a dragon's red, a floral pink) starts,
  // in a near-tie, from the proven spec that already pours that color: the Bitter Mai Tai's ounce
  // and a half of Campari, a Tropical Itch's passion fruit. A colorant is judged by its optics (a
  // saturated bottle of that hue that really dyes a drink), not by name. Never more than a nudge.
  const LEAN_HUE = { gold: [34, 62], orange: [15, 40], red: [340, 15], pink: [315, 20], purple: [255, 330] };
  function brightness(sp, intent) {
    const lean = intent.color ? null : intent.colorLean || intent.hueLean;
    const range = LEAN_HUE[lean];
    if (!range) return 0;
    let s = 0;
    for (const l of sp.lines) {
      const ing = ingMap.get(l.id), o = (ing && ing.optics) || {};
      if (!ing || l.garnish || !((o.tint || 0) >= 0.8) || ing.cat === 'rum' || (ing.role === 'base' && (ing.abv || 0) >= 30)) continue;
      const c = hueSat(o.hex);
      if (c && c.s >= 0.55 && c.l >= 0.25 && c.l <= 0.72 && (range[0] < range[1] ? c.h >= range[0] && c.h < range[1] : c.h >= range[0] || c.h < range[1])) s += 0.3 * Math.min(1, l.oz || 0);
    }
    return Math.min(0.6, s);
  }
  const hueSat = hex => {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return null;
    const n = parseInt(hex.slice(1), 16), [r, g, b] = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
    if (d < 0.06) return null;
    const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: h * 60, s: d / (1 - Math.abs(2 * l - 1) || 1), l };
  };

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
  // Seven poured ingredients at most (the research's "too many cooks" line), except the
  // Beachcomber heavyweights and bowls, whose canon runs to nine or ten.
  const capOf = a => Math.min(['zombie', 'orgeat-punch'].includes(a.family) || a.bowl ? 10 : 7, Math.max(5, (a.typicalCount || a.signature.length) + 2));
  // Seasonings (dashes, drops) don't count against the cap.
  const counted = lines => lines.filter(l => !l.garnish && l.role !== 'aromatic' && !(['bitters'].includes((ingMap.get(l.id) || {}).cat) || ['absinthe', 'pastis', 'saline'].includes(l.id)));

  // Trim a build back under the cap: drop optional extras the prayer didn't ask for, the
  // least wanted first, never a signature component that is the only one of its kind.
  // The research's family ceiling too (a daiquiri is five things, a colada six), but never below
  // what the archetype's own canonical specs pour.
  function capFor(a, ctx) {
    const famMax = ctx.maxComponents ? ctx.maxComponents(a.family) : null;
    if (!famMax) return capOf(a);
    return Math.max(Math.min(capOf(a), famMax), ...fittingSpecs(a).map(sp => counted(sp.lines.filter(l => ingMap.has(l.id)).map(l => ({ ...l, role: roleOf(l.id) }))).length));
  }
  function trim(a, lines, intent, ctx, notes, cap = capFor(a, ctx)) {
    const sig = a.signature.filter(c => c.required);
    // The last sweetener and the last acid are never trimmed: a drink with neither is a glass of rum.
    const needed = l => sig.some(c => c.anyOf.includes(l.id) && lines.filter(x => c.anyOf.includes(x.id)).length === 1) || lastOfJob(lines, l) || coreHeld(a, lines, l);
    // What the guest asked for by name stays; a concept's hero can go before it, but after the rest.
    const asked = l => (intent.ings[l.id] || 0) >= 1 || (intent.spirits || []).includes(l.id);
    while (counted(lines).length > cap) {
      let cands = counted(lines).filter(l => !l.req && !needed(l) && !l.float && !l.sink && !l.crown);
      if (!cands.length) cands = counted(lines).filter(l => l.hero && !asked(l) && !needed(l) && !l.float && !l.sink && !l.crown && counted(lines).filter(x => x.hero).length > 1);
      if (!cands.length) break;
      cands.sort((x, y) => (ctx.intentMatch(x.id, intent) - ctx.intentMatch(y.id, intent)) || ((x.twist ? 1 : 0) - (y.twist ? 1 : 0)) || (x.oz - y.oz));
      const drop = cands[0];
      lines.splice(lines.indexOf(drop), 1);
      notes.push(`left out the ${shortName(drop.id)} to keep it to ${cap} bottles`);
    }
  }

  // A spec's own word for a bottle, when the pantry lists it as that bottle's other name: Don's
  // "peach brandy" stays peach brandy on the card, not "Peach liqueur / schnapps".
  function specLabel(l) {
    const ing = ingMap.get(l.id);
    const alias = ing && ((ing.name || '').match(/\('([^']+)'\)/) || [])[1];
    if (!alias || !l.orig) return undefined;
    return plainName(l.orig) === plainName(alias) ? alias.charAt(0).toUpperCase() + alias.slice(1) : undefined;
  }

  // Identity cores (the archetypes' `cores`): a line that is the last of what makes the spec it
  // came from that drink (a Tortuga's second overproof, a Lava Flow's strawberry, a Jungle Bird's
  // pineapple, a Navy Grog's honey) is never varied, trimmed or folded away under that name.
  const plainName = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  function coreHeld(a, lines, l) {
    if (!(a.cores || []).length) return false;
    const from = [...new Set(lines.map(x => x.fromSpec).filter(Boolean))].map(n => ` ${plainName(n)} `);
    return a.cores.some(c => from.some(f => f.includes(` ${plainName(c.drink)} `))
      && c.needs.some(n => n.anyOf.includes(l.id) && lines.filter(x => !x.garnish && n.anyOf.includes(x.id)).length <= (n.count || 1)));
  }

  // The only line doing a job the balance depends on (the sole sweetener, the sole acid).
  const sweetens = id => { const i = ingMap.get(id) || {}; return i.role !== 'base' && (i.sugar || 0) >= 20; };
  const sours = id => ((ingMap.get(id) || {}).acid || 0) >= 2 && roleOf(id) !== 'aromatic';
  function lastOfJob(lines, l) {
    const body = lines.filter(x => !x.garnish && !x.float && !x.sink && x !== l);
    return (sweetens(l.id) && !body.some(x => sweetens(x.id))) || (sours(l.id) && !body.some(x => sours(x.id)));
  }

  // A slot's range belongs to the bottles it was written for: a syrup sharing a nectar's slot is
  // still dosed like a syrup (its cap), never the nectar's six ounces.
  function rangeOf(a, id) {
    const c = slotFor(a, id);
    if (!c || !c.ozRange) return null;
    const cap = doseCap(id, a.family);
    return cap < c.ozRange[1] ? [Math.min(c.ozRange[0], cap), cap] : c.ozRange;
  }
  // A nectar or juice slot stays nectar or juice: a refill keeps the line's job (a syrup never
  // takes a juice's place at a juice's dose, nor a juice a syrup's).
  const sameKind = (from, to) => (roleOf(from) === 'juice') === (roleOf(to) === 'juice');
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

  function placeIngredient(a, lines, id, intent, ctx, notes, { add = false } = {}) {
    const slot = slotFor(a, id);
    const others = lines.map(l => l.id);
    // One fizzy top is plenty: a new lengthener takes the old one's place.
    if (roleOf(id) === 'lengthener') {
      const old = lines.find(l => l.role === 'lengthener' && !l.req && !l.float && !l.sink);
      if (old) { notes.push(`${shortName(id)} in place of ${shortName(old.id)}`); old.id = id; old.req = true; return; }
    }
    if (slot) {
      const occupant = lines.find(l => l.slot === (slot.component || slot.slot) && !l.req);
      // A hero joins the drink; only a guest's own ask may push a bottle out of its slot, and a
      // sharp citrus never takes over a soft juice's volume.
      const sharpForSoft = occupant && (((ingMap.get(id).acid || 0) >= 2 && (ingMap.get(occupant.id).acid || 0) < 2) || (lastOfJob(lines, occupant) && !(sours(occupant.id) ? sours(id) : sweetens(id))));
      // A nectar or juice slot stays nectar or juice: the passion fruit nectar already pours the
      // passion fruit, so a syrup asked for on top of it isn't stirred in by the glassful.
      const kin = lines.find(l => l.slot === (slot.component || slot.slot) && !sameKind(l.id, id) && (roleOf(l.id) === 'juice' || roleOf(id) === 'juice'));
      if (kin && (ingMap.get(kin.id).flavors || [])[0] === (ingMap.get(id).flavors || [])[0]) return;
      if (!add && !sharpForSoft && occupant && (slot.maxCount || 1) <= lines.filter(l => l.slot === occupant.slot).length) {
        notes.push(`${shortName(id)} in place of ${shortName(occupant.id)}`);
        // A syrup taking a nectar's place pours the nectar's sugar, not its volume (six ounces
        // of nectar is about an ounce and a half of syrup), and never past a syrup's cap.
        const sug = x => (ingMap.get(x) || {}).sugar || 0;
        if (roleOf(occupant.id) !== roleOf(id) && sug(id) > sug(occupant.id) * 1.5 && sug(id) > 0) occupant.oz *= sug(occupant.id) / sug(id);
        occupant.id = id; occupant.role = roleOf(id); occupant.req = true;
        const r = rangeOf(a, id);
        if (r) occupant.oz = Math.max(r[0], Math.min(r[1], occupant.oz));
        occupant.range = r || occupant.range;
        if ((ingMap.get(id).acid || 0) >= 2) occupant.oz = Math.min(occupant.oz, 1);
        return;
      }
      if (ctx.conflicts(id, others)) {
        const clash = lines.find(l => ctx.conflicts(id, [l.id]) && !l.req);
        if (!clash) return;
        notes.push(`${shortName(id)} in place of ${shortName(clash.id)}`);
        clash.id = id; clash.role = roleOf(id); clash.req = true;
        return;
      }
      const r0 = rangeOf(a, id) || [0.5, 0.75];
      const r = (ingMap.get(id).acid || 0) >= 2 ? [Math.min(r0[0], 0.5), Math.min(r0[1], 1)] : r0;
      // Asked for by name, so it has to be tasted: dose toward the top of the slot's range.
      lines.push({ id, role: roleOf(id), oz: r[0] + (r[1] - r[0]) * 0.75, slot: slot.component || slot.slot, range: r, req: true });
      notes.push(`added ${shortName(id)}`);
      return;
    }
    // No slot for it, but the guest asked: work it in the way a bartender would, trading part of
    // the drink's main juice for a juice, or adding a modest pour of a liqueur or syrup.
    const role = roleOf(id);
    if (['juice', 'sour'].includes(role) && ((a.methods || [])[0] === 'stir' || a.family === 'stirred')) return;
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
      lines.push({ id, role: roleOf(id), oz: r[0] + (r[1] - r[0]) * 0.75, slot: o.slot, range: r, req: true, float: !!o.float || /\bfloat\b/.test(o.slot), sink: !!o.sink || /\bsink\b/.test(o.slot) });
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
      const keepsJob = id => !lastOfJob(lines, l) || (sours(l.id) ? sours(id) : sweetens(id));
      const alt = slot.anyOf.filter(id => ingMap.has(id) && !ctx.forbidden(id, intent) && !others.includes(id) && !ctx.conflicts(id, others) && ((ctx.ingVec[id] || {})[tag] || 0) >= 0.55 && keepsJob(id) && sameKind(l.id, id))[0];
      if (!alt) continue;
      const was = ingMap.get(l.id).name.toLowerCase().replace(/\s*\(.*\)/, '');
      l.id = alt; l.role = roleOf(alt); l.req = true; l.swapped = true;
      if (l.oz > doseCap(alt, a.family)) l.oz = doseCap(alt, a.family);
      if (l.range) l.range = rangeOf(a, alt) || l.range;
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
  function twist(a, lines, intent, ctx, rng, greedy, temperature = 0.6) {
    if (counted(lines).length >= capFor(a, ctx)) return null;
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
        // Nor one that leads with a flavor the guest steered away from (no sugar on "less sweet").
        const lead = ((ingMap.get(id) || {}).flavors || [])[0];
        if (lead && (intent.avoidTags || {})[lead] >= 0.5) continue;
        if ((intent.sweetness || 0) < 0 && ((ingMap.get(id) || {}).sugar || 0) >= 20 && roleOf(id) !== 'base') continue;
        // A dash is a seasoning, not a new drink: real twists come first.
        const seasoning = roleOf(id) === 'accent' || (ingMap.get(id) || {}).cat === 'bitters';
        options.push({ item: { o, id }, s: 2.2 * ctx.intentMatch(id, intent) + 0.6 * ctx.compat(id, ids) + (o.common ? 0.4 : 0) - (o.anyOf.indexOf(id) * 0.05) - (seasoning ? 1.5 : 0) });
      }
    }
    const pick = ctx.softPick(rng, options, temperature, greedy);
    if (!pick) return null;
    const r = pick.o.ozRange || [0.5, 0.75];
    // Accents (bitters, anise) go in at the light end of their range; everything else mid-range.
    const accent = ['accent'].includes(roleOf(pick.id)) || (ingMap.get(pick.id) || {}).cat === 'bitters';
    // A slot named for a float or a sink is one, whether or not the research flagged it.
    const fl = !!pick.o.float || /\bfloat\b/.test(pick.o.slot), sk = !!pick.o.sink || /\bsink\b/.test(pick.o.slot);
    lines.push({ id: pick.id, role: roleOf(pick.id), oz: accent ? r[0] : (r[0] + r[1]) / 2, slot: pick.o.slot, range: r, float: fl, sink: sk, twist: true });
    const nm = ingMap.get(pick.id).name.toLowerCase().replace(/\s*\(.*\)/, '');
    return fl ? `a ${nm} float` : sk ? `${nm} sunk to the bottom` : `${nm} in the ${pick.o.slot} slot`;
  }

  // A genuine variation inside the frame: refill one slot with a different allowed bottle.
  function vary(a, lines, intent, ctx, rng, greedy) {
    const slots = [...a.signature, ...(a.optional || [])];
    // The lengthener (coffee in a Coffee Grog, ginger beer in a Dark 'n Stormy) and the citrus are
    // what the drink is; variation happens in its modifiers, sweeteners, juices and spirits.
    const order = ['modifier', 'sweet', 'juice', 'accent', 'base'];
    const cands = lines.filter(l => !l.req && !l.garnish && l.slot && order.includes(l.role) && slots.some(c => (c.component || c.slot) === l.slot && c.anyOf.length > 1) && !coreHeld(a, lines, l));
    if (!cands.length) return null;
    // A variation changes a flavor before it changes a rum brand.
    const flavor = cands.filter(l => l.role !== 'base');
    const from = flavor.length ? flavor : cands;
    const victim = greedy ? [...cands].sort((x, y) => order.indexOf(x.role) - order.indexOf(y.role))[0] : from[Math.floor(rng() * from.length)];
    const slot = slots.find(c => (c.component || c.slot) === victim.slot);
    const others = lines.filter(l => l !== victim).map(l => l.id);
    const hot = id => (ingMap.get(id).abv || 0) >= 60;
    const keepsJob = id => !lastOfJob(lines, victim) || (sours(victim.id) ? sours(id) : sweetens(id));
    // Never back to a bottle this line already gave up (simple syrup → grenadine → simple syrup).
    const gone = new Set(victim.was || []);
    // A variation never weakens what the guest asked for: the bitter in "bitter" stays Campari,
    // never Aperol; a heard flavor's carrier only gives way to one that carries it as well.
    const heard = Object.entries(intent.tags || {}).filter(([t, w]) => w >= 1 && ((ctx.ingVec[victim.id] || {})[t] || 0) >= 0.4).map(([t]) => t);
    const keepsWord = id => heard.every(t => ((ctx.ingVec[id] || {})[t] || 0) >= ((ctx.ingVec[victim.id] || {})[t] || 0) - 0.05)
      // "Not too sweet" is a promise too: no swap that pours more sugar than the line it replaces.
      && !((intent.sweetness || 0) < 0 && ((ingMap.get(id) || {}).sugar || 0) > ((ingMap.get(victim.id) || {}).sugar || 0) + 5);
    const pool = slot.anyOf.filter(id => id !== victim.id && !gone.has(id) && ingMap.has(id) && !ctx.forbidden(id, intent) && !others.includes(id) && !ctx.conflicts(id, others) && keepsJob(id) && sameKind(victim.id, id) && keepsWord(id)
      && !(victim.role === 'base' && hot(id) && !hot(victim.id) && !((intent.strength || 0) > 0)));
    // A near-twin (triple sec for curaçao, one Jamaican rum for another) is no variation: a bottle
    // with its own voice comes first.
    const lead = id => ((ingMap.get(id) || {}).flavors || [])[0];
    const twin = id => (ingMap.get(victim.id).subs || []).includes(id) || (ingMap.get(id).subs || []).includes(victim.id) || (lead(id) && lead(id) === lead(victim.id) && ingMap.get(id).cat === ingMap.get(victim.id).cat);
    const pick = ctx.softPick(rng, pool.map(id => ({ item: id, s: 2 * ctx.intentMatch(id, intent) + ctx.compat(id, others) - (twin(id) ? 3 : 0) })), 1.2, greedy);
    if (!pick) return null;
    const was = ingMap.get(victim.id).name.toLowerCase().replace(/\s*\(.*\)/, '');
    victim.was = [...(victim.was || []), victim.id];
    victim.id = pick; victim.role = roleOf(pick); victim.swapped = true;
    const cap = doseCap(pick, a.family);
    if (victim.oz > cap) victim.oz = cap;
    if (victim.range) victim.range = rangeOf(a, pick) || victim.range;
    return `${ingMap.get(pick).name.toLowerCase().replace(/\s*\(.*\)/, '')} in place of ${was}`;
  }

  // Does a finished line-up still satisfy the archetype? (Used by tests and as a final guard.)
  // `waived`: components the guest ruled out entirely (orgeat in a nut-free Mai Tai, the rum in
  // a zero-proof drink). The drink is then honestly a cousin of the archetype, and the copy says so.
  // `doses`: also hold the identity core to the dose that makes it that drink (see coreMinimums).
  // Off for catalogue identification and historical specs, which are what they are.
  function satisfies(a, lines, asked = {}, isForbidden = null, { doses = false } = {}) {
    const ids = new Set(lines.filter(l => !l.garnish).map(l => l.id));
    const absent = a.signature.filter(c => c.required && ![...ids].some(id => accepts(c, id)));
    const waivedC = isForbidden ? absent.filter(c => c.anyOf.every(id => isForbidden(id))) : [];
    const missing = absent.filter(c => !waivedC.includes(c)).map(c => c.component);
    const banned = [...ids].filter(id => archForbids(a, id) && !((asked[id] || 0) >= 1.5));
    const underdosed = doses ? coreMinimums(a, lines).filter(m => (m.line.oz || 0) < m.min - 0.02).map(m => `${m.line.id} under ${m.min} oz (${m.why})`) : [];
    return { ok: !missing.length && !banned.length && !underdosed.length, missing, banned, underdosed, waived: waivedC.map(c => c.component) };
  }

  // The identity core at the dose that makes the drink what it says: a Mai Tai's orgeat is half
  // an ounce (two teaspoons is a rumor of almond), a Hot Buttered Rum's batter three-quarters, a
  // Hotel Nacional's apricot half an ounce, a swizzle's Angostura crown four dashes or more, and
  // Don's Mix, split into its parts, two of grapefruit to one of cinnamon.
  function coreMinimums(a, lines) {
    const live = lines.filter(l => !l.garnish && !l.muddled);
    const has = id => live.find(l => l.id === id);
    const out = [];
    const orgeat = has('orgeat');
    if (orgeat && (a.family === 'mai-tai' || a.id === 'hawaiian-mai-tai')) out.push({ line: orgeat, min: 0.5, why: "a Mai Tai's orgeat" });
    const batter = has('hot-buttered-rum-batter');
    if (batter) out.push({ line: batter, min: 0.75, why: 'the butter batter is the drink' });
    const apricot = has('apricot-liqueur');
    if (apricot && has('pineapple-juice') && has('lime') && ['daiquiri', 'punch', 'beachcomber-sour'].includes(a.family)) out.push({ line: apricot, min: 0.5, why: "a Hotel Nacional's apricot" });
    const ango = live.find(l => l.id === 'angostura' && !l.float && !l.sink);
    if (ango && a.family === 'swizzle' && (ango.oz || 0) < 0.3) out.push({ line: ango, min: 0.12, why: 'a swizzle crown is four dashes or more' });
    const gf = has('grapefruit'), cin = has('cinnamon-syrup');
    if (gf && cin && a.family === 'zombie') out.push({ line: gf, min: Math.round(2 * (cin.oz || 0) * 12) / 12, why: "Don's Mix is two of grapefruit to one of cinnamon" });
    return out;
  }

  // Can this archetype carry a flavor at all (its profile, or a slot's bottle)?
  const carries = (a, tag, intent, ctx) => (a.flavorProfile || []).includes(tag) || !!slotsCarry(a, tag, intent, ctx);
  return { byId, archetypes, scoreArchetype, compose, satisfies, coreMinimums, coreHeld, specLabel, slotOf, vary, repair, twist, capDoses, carries, promiseBreak, holdPromises };
}
