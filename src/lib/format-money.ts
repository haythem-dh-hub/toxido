import type { Money } from "@/types/product";

export function formatMoney(money: Money) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: money.currency,
    maximumFractionDigits: 0,
  }).format(money.amount);
}
