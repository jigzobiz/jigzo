import { PACK_OPTIONS } from '../config/packages';

/**
 * Calculates local plan and upgrade prices based on recipients list.
 */
export function packageForRecipientCount(count) {
  // Cap count bounds
  const cleanCount = Math.max(1, count);
  const matched = PACK_OPTIONS.find(p => cleanCount <= p.limit);
  // Default fallback to celebration package if count exceeds limit
  return matched || PACK_OPTIONS[PACK_OPTIONS.length - 1];
}

export function formatPrice(num) {
  return typeof num === 'number' ? `$${num.toFixed(0)}` : num;
}
