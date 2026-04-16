/**
 * Service charge logic
 *
 * Service charge is configured per device profile, not globally.
 * This lets a bar terminal have SC disabled while a table terminal has it enabled.
 *
 * Config shape (deviceConfig.serviceCharge):
 * {
 *   enabled:   boolean   — master switch
 *   rate:      number    — percentage e.g. 12.5
 *   applyTo:   'all' | 'minCovers'
 *   minCovers: number    — only applies if covers >= this (when applyTo = 'minCovers')
 * }
 */

export const DEFAULT_SC = { enabled: true, rate: 12.5, applyTo: 'all', minCovers: 8 };

/**
 * Resolve whether service charge applies for this order.
 * Returns the rate as a decimal (e.g. 0.125) or 0 if not applicable.
 */
export function resolveServiceCharge({ deviceConfig, orderType, covers, waived }) {
  // Only on dine-in table service
  if (orderType !== 'dine-in') return 0;

  // Waived by staff for this order
  if (waived) return 0;

  const sc = deviceConfig?.serviceCharge || null;
  if (!sc?.enabled) return 0;

  // Covers threshold
  if (sc.applyTo === 'minCovers' && (covers || 1) < sc.minCovers) return 0;

  return (sc.rate || 0) / 100;
}

/**
 * Format service charge label for display
 */
export function serviceChargeLabel(sc) {
  if (!sc?.enabled) return null;
  const pct = sc.rate % 1 === 0 ? sc.rate : sc.rate.toFixed(1);
  if (sc.applyTo === 'minCovers') return `Service (${pct}%, ${sc.minCovers}+ covers)`;
  return `Service (${pct}%)`;
}
