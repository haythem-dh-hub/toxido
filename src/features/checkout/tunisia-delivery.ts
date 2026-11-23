export const TUNISIAN_GOVERNORATES = [
  "Ariana", "Beja", "Ben Arous", "Bizerte", "Gabes", "Gafsa", "Jendouba", "Kairouan",
  "Kasserine", "Kebili", "Kef", "Mahdia", "Manouba", "Medenine", "Monastir", "Nabeul",
  "Sfax", "Sidi Bouzid", "Siliana", "Sousse", "Tataouine", "Tozeur", "Tunis", "Zaghouan",
] as const;

export const DOMESTIC_DELIVERY_FEE_MILLIMES = 7_000;

export function normalizeTunisiaGovernorate(value: unknown): (typeof TUNISIAN_GOVERNORATES)[number] | null {
  if (typeof value !== "string") return null;
  return TUNISIAN_GOVERNORATES.find((name) => name.toLowerCase() === value.trim().toLowerCase()) ?? null;
}

export function calculateDomesticOrderTotalMillimes(subtotalMillimes: number, discountMillimes = 0): number {
  if (!Number.isSafeInteger(subtotalMillimes) || subtotalMillimes < 0 ||
      !Number.isSafeInteger(discountMillimes) || discountMillimes < 0 || discountMillimes > subtotalMillimes) {
    throw new RangeError("Invalid millime subtotal or discount.");
  }
  return subtotalMillimes - discountMillimes + DOMESTIC_DELIVERY_FEE_MILLIMES;
}
