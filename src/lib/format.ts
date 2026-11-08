import type { PaymentArrangement } from '../domain/types';

/** Formats a credit amount, e.g. 1 → "1 crédito", 1.5 → "1,5 créditos". */
export function formatCredits(amount: number): string {
  const abs = Math.abs(amount);
  const n = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/0+$/, '').replace('.', ',');
  const sign = amount < 0 ? '−' : '';
  return `${sign}${n} ${abs === 1 ? 'crédito' : 'créditos'}`;
}

/**
 * Formats ARS cents as "$ 8.000" (es-AR grouping). Implemented manually instead of
 * Intl.NumberFormat so output is identical on every Hermes/ICU build.
 */
export function formatARS(cents: number): string {
  const pesos = Math.round(cents / 100);
  const grouped = Math.abs(pesos)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${pesos < 0 ? '−' : ''}$ ${grouped}`;
}

/** Human summary of a payment arrangement, e.g. "1 crédito + $ 2.000". */
export function formatPayment(p: PaymentArrangement): string {
  switch (p.mode) {
    case 'credits':
      return formatCredits(p.creditAmount ?? 0);
    case 'money':
      return formatARS(p.moneyAmountCents ?? 0);
    case 'mixed':
      return `${formatCredits(p.creditAmount ?? 0)} + ${formatARS(p.moneyAmountCents ?? 0)}`;
  }
}

export const paymentModeLabel: Record<PaymentArrangement['mode'], string> = {
  credits: 'Solo créditos',
  money: 'Solo dinero',
  mixed: 'Mixto',
};

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
