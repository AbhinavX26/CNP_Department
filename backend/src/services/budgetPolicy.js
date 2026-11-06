/**
 * Budget routing for material requests (pure functions, no I/O).
 *
 * A submission whose total is within the limit goes to the project's faculty
 * mentor; above it, or if any item has no price, it goes to the project admin.
 * The limit lives in MATERIAL_REQUEST_BUDGET_LIMIT (default 5000).
 */

export const DEFAULT_BUDGET_LIMIT = 5000;
/** Minimum length of the written justification when a submission goes to the admin. */
export const MIN_JUSTIFICATION_LENGTH = 50;

export function getBudgetLimit(env = process.env) {
  const parsed = Number(env.MATERIAL_REQUEST_BUDGET_LIMIT);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_BUDGET_LIMIT;
}

/** Round to paise so floating point never decides a route. */
const money = (n) => Math.round(n * 100) / 100;

/**
 * @param {Array<{quantity:number, unitCost:number|null|undefined}>} lines
 * @returns {{ total:number|null, hasUnpriced:boolean, lineTotals:Array<number|null> }}
 */
export function priceLines(lines) {
  let total = 0;
  let hasUnpriced = false;
  const lineTotals = lines.map((line) => {
    if (line.unitCost === null || line.unitCost === undefined || !Number.isFinite(Number(line.unitCost))) {
      hasUnpriced = true;
      return null;
    }
    const lineTotal = money(Number(line.unitCost) * line.quantity);
    total = money(total + lineTotal);
    return lineTotal;
  });
  return { total: hasUnpriced ? null : total, hasUnpriced, lineTotals };
}

/**
 * @returns {{ route:'mentor'|'admin', reason:string }}
 */
export function decideRoute({ total, hasUnpriced, hasMentor, limit }) {
  if (hasUnpriced) return { route: 'admin', reason: 'unpriced_item' };
  if (total > limit) return { route: 'admin', reason: 'over_budget' };
  if (!hasMentor) return { route: 'admin', reason: 'no_mentor' };
  return { route: 'mentor', reason: 'within_budget' };
}

/** The long-form justification is required exactly when the budget limit is crossed. */
export function needsJustification(routeDecision) {
  return routeDecision.reason === 'over_budget';
}
