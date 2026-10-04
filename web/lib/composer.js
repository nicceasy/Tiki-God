// Archetype composer: builds a drink the way a tiki bartender riffs. An archetype
// (data/archetypes.json) is a proven structure: its signature components must all be there
// (a colada is rum + pineapple + coconut, or it isn't a colada), each component may only be
// filled from the ingredients that satisfy it, and every dose stays inside the archetype's
// ranges. The prayer steers *which* bottle fills each slot, which optional slots open, how the
// doses lean, and what goes on top: the "Mr. Potato Head" method of swapping parts on a proven
// frame. Nothing outside the archetype's slots can get in, so the label always tells the truth.

const ROLE_KNOB = { base: 'strength', sweet: 'sweetness', sour: 'tartness' };
const SOLO_GARNISH_FLAVOR = { mint: 'mint', nutmeg: 'nutmeg', cinnamon: 'cinnamon' };

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
    for (const c of a.signature) {
      if (!c.required) continue;
      const ok = c.anyOf.some(id => ingMap.has(id) && !ctx.forbidden(id, intent));
      if (!ok) return { a, s: -Infinity, why: [`can't make the ${c.component}`] };
    }
    const st = intent.style;
    const has = m => (a.methods || []).includes(m);
    if (st.hot && !has('hot')) return { a, s: -Infinity, why: ['not a hot drink'] };
    if (!st.hot && (a.methods || [])[0] === 'hot') s -= 6;
    if (st.zeroProof && a.zeroProof === false) return { a, s: -Infinity, why: ['no zero-proof version'] };
    if (st.frozen) s += has('blend') ? 2 : -2.5;
    if (st.creamy === true) s += a.creamy ? 3 : -1;
    if (st.creamy === false && a.creamy) return { a, s: -Infinity, why: ['creamy'] };
    if (st.bitter) s += (a.flavorProfile || []).includes('bitter') ? 2.5 : -0.5;
    if (st.long) s += a.long ? 1.5 : -0.5;
    if (st.bowl) s += a.bowl ? 3 : 0;
    if (st.stirred) s += has('stir') ? 4 : -2;
    if (st.flaming) s += a.flaming ? 1.5 : 0;
    if (st.layered) s += a.layered ? 2 : 0.2;
    // Family words ("a colada", "something like a grog") and concept affinities from the prayer.
    s += 1.8 * (intent.fam[a.family] || 0);
    s += 2.2 * ((intent.archetypes || {})[a.id] || 0);
    // Flavor fit: the archetype's own profile, plus what its slots can carry.
    const profile = new Set(a.flavorProfile || []);
    for (const [t, w] of Object.entries(intent.tags)) {
      if (w <= 0) continue;
      if (profile.has(t)) { s += 0.9 * w; continue; }
      const carry = slotsCarry(a, t, intent, ctx);
      if (carry) s += 0.55 * w;
      else if (w >= 1.2) { s -= 1.2 * w; why.push(`no slot for ${t}`); }
    }
    for (const [t, w] of Object.entries(intent.avoidTags)) if (profile.has(t)) s -= 1.5 * w;
    // Strength and sweetness leanings.
    const abvMid = a.ratios && a.ratios.abvAfterDilution ? (a.ratios.abvAfterDilution[0] + a.ratios.abvAfterDilution[1]) / 2 : 13;
    s += 0.35 * (intent.strength || 0) * ((abvMid - 13) / 4);
    s -= 0.25 * (intent.complexity || 0) < 0 ? (a.signature.length > 5 ? 1 : 0) : 0;
    // Requested ingredients the archetype can't hold count against it.
    for (const [id, w] of Object.entries(intent.ings)) {
      if (w < 1) continue;
      if (ingMap.get(id) && ingMap.get(id).cat === 'rum') continue;
      if (!allIds(a).has(id) && !canAdd(a, id)) s -= 0.8 * w;
      else s += 0.4 * w;
    }
    return { a, s, why };
  }

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
    return null;
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
  function compose(a, intent, ctx, rng, greedy, notes, src = null) {
    let lines;
    const specs = (a.canonicalSpecs || []).filter(sp => sp.lines && sp.lines.length);
    if (src) lines = src.lines.map(l => ({ ...l, slot: slotOf(a, l.id), range: rangeOf(a, l.id) }));
    else if (specs.length) {
      const scored = specs.map((sp, i) => {
        let s = -0.25 * i + (sp.confidence === 'high' ? 0.3 : 0);
        for (const l of sp.lines) if (ingMap.has(l.id)) s += 0.8 * Math.max(-2, Math.min(2, ctx.intentMatch(l.id, intent))) - (ctx.forbidden(l.id, intent) ? 1.5 : 0);
        return { item: sp, s };
      });
      const sp = ctx.softPick(rng, scored, 0.6, greedy);
      lines = sp.lines.filter(l => ingMap.has(l.id)).map(l => ({ id: l.id, role: roleOf(l.id), oz: l.oz, unit: l.unit, float: !!l.float, sink: !!l.sink, crown: !!l.crown, slot: slotOf(a, l.id), range: rangeOf(a, l.id), fromSpec: sp.name }));
      notes.push(`spec:${sp.name}`);
    } else lines = fillSlots(a, intent, ctx, rng, greedy);

    replaceForbidden(a, lines, intent, ctx, notes);
    swapInSpirits(a, lines, intent, ctx, notes);
    // Explicit ingredient asks ("passion fruit", "falernum"): refill a slot or open an optional one.
    for (const [id, w] of Object.entries(intent.ings).sort((x, y) => y[1] - x[1])) {
      if (w < 1 || lines.some(l => l.id === id) || !ingMap.has(id) || ctx.forbidden(id, intent) || (ingMap.get(id).role === 'base')) continue;
      placeIngredient(a, lines, id, intent, ctx, notes);
    }
    // Requested flavors still uncarried: swap a slot's filling, else open an optional slot.
    for (const [tag, w] of Object.entries(intent.tags).sort((x, y) => y[1] - x[1])) {
      if (w < 1.2 || carried(lines, tag, ctx)) continue;
      const swap = trySwap(a, lines, tag, intent, ctx) || openFor(a, lines, tag, intent, ctx);
      if (swap) notes.push(swap);
    }
    repair(a, lines, intent, ctx, rng, notes);
    return lines;
  }

  function rangeOf(a, id) {
    const c = [...a.signature, ...(a.optional || [])].find(x => x.anyOf.includes(id));
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
    want.forEach((id, i) => {
      const target = bases[i];
      if (target) { notes.push(`${shortName(id)} takes over from ${shortName(target.id)}`); target.id = id; target.req = true; }
      else lines.push({ id, role: 'base', oz: 0.75, req: true, slot: 'base' });
    });
  }

  function placeIngredient(a, lines, id, intent, ctx, notes) {
    const slots = [...a.signature, ...(a.optional || [])];
    const slot = slots.find(c => c.anyOf.includes(id));
    const others = lines.map(l => l.id);
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
      lines.push({ id, role: roleOf(id), oz: (r[0] + r[1]) / 2, slot: slot.component || slot.slot, range: r, req: true });
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
      lines.push({ id, role: roleOf(id), oz: (r[0] + r[1]) / 2, slot: o.slot, range: r, req: true, float: !!o.float, sink: !!o.sink });
      return `added ${shortName(id)} for ${tag.replace('-', ' ')}`;
    }
    return null;
  }

  function wantOptional(c, intent, ctx) {
    return c.anyOf.some(id => ingMap.has(id) && !ctx.forbidden(id, intent) && ctx.intentMatch(id, intent) >= 1.2);
  }
  function carried(lines, tag, ctx) {
    return lines.some(l => ((ctx.ingVec[l.id] || {})[tag] || 0) >= 0.55);
  }
  function slotOf(a, id) {
    const c = [...a.signature, ...(a.optional || [])].find(x => x.anyOf.includes(id));
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
      l.id = alt; l.role = roleOf(alt); l.req = true;
      return `${ingMap.get(alt).name.toLowerCase().replace(/\s*\(.*\)/, '')} in place of ${was} for ${tag.replace('-', ' ')}`;
    }
    return null;
  }

  // Put back any signature component a riff lost (a Mai Tai without curaçao isn't a Mai Tai).
  function repair(a, lines, intent, ctx, rng, notes) {
    const ids = () => lines.filter(l => !l.garnish).map(l => l.id);
    for (const c of a.signature) {
      if (!c.required || c.anyOf.some(id => ids().includes(id))) continue;
      const id = pickFor(c.anyOf, intent, ctx, ids(), rng, true, c.anyOf);
      if (!id) continue;
      const r = c.ozRange || [0.5, 0.75];
      lines.push({ id, role: roleOf(id), oz: (r[0] + r[1]) / 2, slot: c.component, range: r });
      notes.push(`kept the ${c.component} (${ingMap.get(id).name.toLowerCase().replace(/\s*\(.*\)/, '')}) that makes it a ${a.name}`);
    }
    // Remove anything the archetype forbids.
    for (let i = lines.length - 1; i >= 0; i--) {
      const ing = ingMap.get(lines[i].id);
      if ((a.forbidden || []).includes(lines[i].id) || (a.forbidden || []).includes(`cat:${ing && ing.cat}`)) lines.splice(i, 1);
    }
  }

  // A twist that makes a classic-shaped build the guest's own: open the optional slot that best
  // answers the prayer (a fruit, a spice, a float), before ever swapping a core bottle.
  function twist(a, lines, intent, ctx, rng, greedy) {
    const ids = lines.map(l => l.id);
    const options = [];
    for (const o of a.optional || []) {
      if (lines.filter(l => l.slot === o.slot).length >= (o.maxCount || 1)) continue;
      for (const id of o.anyOf) {
        if (!ingMap.has(id) || ctx.forbidden(id, intent) || ids.includes(id) || ctx.conflicts(id, ids)) continue;
        options.push({ item: { o, id }, s: 2.2 * ctx.intentMatch(id, intent) + 0.6 * ctx.compat(id, ids) + (o.common ? 0.4 : 0) - (o.anyOf.indexOf(id) * 0.05) });
      }
    }
    const pick = ctx.softPick(rng, options, 0.6, greedy);
    if (!pick) return null;
    const r = pick.o.ozRange || [0.5, 0.75];
    lines.push({ id: pick.id, role: roleOf(pick.id), oz: (r[0] + r[1]) / 2, slot: pick.o.slot, range: r, float: !!pick.o.float, sink: !!pick.o.sink, twist: true });
    const nm = ingMap.get(pick.id).name.toLowerCase().replace(/\s*\(.*\)/, '');
    return pick.o.float ? `a ${nm} float` : pick.o.sink ? `${nm} sunk to the bottom` : `${nm} in the ${pick.o.slot} slot`;
  }

  // A genuine variation inside the frame: refill one slot with a different allowed bottle.
  function vary(a, lines, intent, ctx, rng, greedy) {
    const slots = [...a.signature, ...(a.optional || [])];
    const cands = lines.filter(l => !l.req && !l.garnish && l.slot && slots.some(c => (c.component || c.slot) === l.slot && c.anyOf.length > 1));
    if (!cands.length) return null;
    const order = ['modifier', 'sweet', 'juice', 'accent', 'base', 'sour'];
    const victim = greedy ? [...cands].sort((x, y) => order.indexOf(x.role) - order.indexOf(y.role))[0] : cands[Math.floor(rng() * cands.length)];
    const slot = slots.find(c => (c.component || c.slot) === victim.slot);
    const others = lines.filter(l => l !== victim).map(l => l.id);
    const pool = slot.anyOf.filter(id => id !== victim.id && ingMap.has(id) && !ctx.forbidden(id, intent) && !others.includes(id) && !ctx.conflicts(id, others));
    const pick = ctx.softPick(rng, pool.map(id => ({ item: id, s: 2 * ctx.intentMatch(id, intent) + ctx.compat(id, others) })), 0.6, greedy);
    if (!pick) return null;
    const was = ingMap.get(victim.id).name.toLowerCase().replace(/\s*\(.*\)/, '');
    victim.id = pick; victim.role = roleOf(pick);
    return `${ingMap.get(pick).name.toLowerCase().replace(/\s*\(.*\)/, '')} in place of ${was}`;
  }

  // Does a finished line-up still satisfy the archetype? (Used by tests and as a final guard.)
  function satisfies(a, lines) {
    const ids = new Set(lines.filter(l => !l.garnish).map(l => l.id));
    const missing = a.signature.filter(c => c.required && !c.anyOf.some(id => ids.has(id))).map(c => c.component);
    const banned = [...ids].filter(id => (a.forbidden || []).includes(id) || (a.forbidden || []).includes(`cat:${(ingMap.get(id) || {}).cat}`));
    return { ok: !missing.length && !banned.length, missing, banned };
  }

  return { byId, archetypes, scoreArchetype, compose, satisfies, slotOf, vary, repair, twist };
}
