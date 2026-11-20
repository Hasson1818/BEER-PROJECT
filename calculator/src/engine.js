// The calculator's logic, apart from the page: who can get into which unit, and how well each fits the answers.
import { UNITS, PROFILES, DAPARS, MAA_ENVS } from './data.js';
import { QUESTIONS, TRAITS } from './questions.js';

/**
 * Can this player get into the unit by the numbers alone?
 * input: { gender: 'm'|'f', profile, dapar, hebrew, maa: { envId: 1..5 } | null }
 * Returns { ok, reasons: [text], pending: [text] }: reasons = what blocks, pending = what depends on data the player
 * didn't give (e.g. Yom HaMa'a scores) or on a selection still ahead.
 */
export function check(unit, input) {
  const reasons = [];
  const pending = [];
  const r = unit.req;
  const combatMan = input.gender === 'm' && input.profile >= 72;
  if (input.profile <= 21) reasons.push('פרופיל 21: פטור משירות');
  if (unit.gender && !unit.gender.includes(input.gender)) reasons.push(input.gender === 'f' ? 'לא פתוח לחיילות' : 'פתוח רק לחיילות');
  if (r.notCombatMen && combatMan) reasons.push('לא פתוח לבנים שמיועדים ללחימה');
  // Profile 70 (new, 09.2026) may try some combat roles that ask for 72, with a screening; whether it is already in
  // force is disputed, so it stays "pending".
  const try70 = input.profile === 70 && unit.profile70 && r.profile === 72;
  if (r.profile && input.profile < r.profile && !try70) reasons.push(`פרופיל ${r.profile}+`);
  if (try70) pending.push('פרופיל 70 (חדש מ־09.2026): מיון מיוחד, ולא ודאי שכבר בתוקף');
  const dapar = combatMan && r.daparCombatMen ? r.daparCombatMen : r.dapar;
  if (dapar && input.dapar < dapar) reasons.push(`דפ״ר ${dapar}+`);
  if (r.hebrew && input.hebrew != null && input.hebrew < r.hebrew) reasons.push(`עברית ${r.hebrew}+`);
  // Everyone takes Yom HaMa'a since 2021, but each role page says who its minimums are for: most mark them
  // "לבנות בלבד" (the default here), a few apply them to all (`maaFor: 'all'`). Research 20.11.2026.
  const maaApplies = (unit.maaFor ?? 'f') === 'all' || input.gender === 'f';
  if (r.maa && maaApplies) {
    for (const [env, min] of Object.entries(r.maa)) {
      const name = MAA_ENVS.find((e) => e.id === env)?.name ?? env;
      if (!input.maa) pending.push(`יום המא״ה: ${name} ${min}+`);
      else if ((input.maa[env] ?? 0) < min) reasons.push(`${name} ${min}+ ביום המא״ה`);
    }
  }
  if (unit.womenCombat && input.gender === 'f') pending.push('יום מיון לוחמות וטופס 16א (32 חודשי שירות)');
  if (unit.selection) pending.push(unit.selection);
  return { ok: reasons.length === 0, reasons, pending };
}

/** All units with their check, sorted: open first, then by category. */
export function evaluate(input) {
  return UNITS.map((unit) => ({ unit, ...check(unit, input) }));
}

/** How many units each profile × DAPAR pair opens (the rest of the input stays as given). */
export function grid(input) {
  return PROFILES.map((profile) => ({
    profile,
    cells: DAPARS.map((dapar) => UNITS.filter((u) => check(u, { ...input, profile, dapar, maa: input.maa }).ok).length),
  }));
}

/**
 * Fit between the answers and a unit, 0..100. Every answer sets a wish on one trait (0..3) and a weight;
 * a unit's distance from the wish on that trait costs points. "Doesn't matter" answers weigh nothing.
 */
export function fit(unit, answers) {
  let total = 0;
  let weights = 0;
  for (const q of QUESTIONS) {
    const a = answers[q.id];
    if (a == null) continue;
    const option = q.options[a];
    if (!option || (option.want == null && option.match == null)) continue;
    const w = option.weight ?? q.weight ?? 1;
    const value = unit.traits[q.trait];
    if (value == null) continue;
    if (option.match != null) {
      // A category (land / sea / air / cyber): a unit may list several.
      const list = Array.isArray(value) ? value : [value];
      total += w * (list.includes(option.match) ? 1 : 0);
    } else {
      const span = TRAITS[q.trait]?.max ?? 3;
      total += w * (1 - Math.abs(value - option.want) / span);
    }
    weights += w;
  }
  if (!weights) return 50;
  return Math.round((total / weights) * 100);
}

/** The top units among the ones the player can get into (or can try, with a selection). */
export function top(input, answers, count = 5) {
  return evaluate(input)
    .filter((e) => e.ok)
    .map((e) => ({ ...e, fit: fit(e.unit, answers) }))
    .sort((a, b) => b.fit - a.fit || (b.unit.req.dapar ?? 0) - (a.unit.req.dapar ?? 0))
    .slice(0, count);
}
