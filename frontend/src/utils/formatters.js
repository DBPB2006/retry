/**
 * Safe formatting utilities for dates, currency, and prices.
 * Prevents "Invalid Date" and bare "₹" symbols across the application.
 */

/**
 * Safely format an ISO date string or timestamp into Indian locale format.
 * Returns 'Date unavailable' if missing, null, or invalid.
 */
export function formatDate(dateString) {
  if (!dateString) return 'Date unavailable';
  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) return 'Date unavailable';
  return parsed.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Safely format a monetary amount into INR (₹).
 * Returns 'Unavailable' if amount is null, undefined, empty, or not a valid number.
 * Never outputs a bare "₹" symbol without an amount.
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || amount === '') {
    return 'Unavailable';
  }
  const numeric = Number(amount);
  if (isNaN(numeric)) {
    return 'Unavailable';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}
