export function calculateQuoteTotal(
  laborAmount: number,
  materialAmount: number,
  otherAmount: number,
): number {
  return roundCurrency(laborAmount + materialAmount + otherAmount);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}
