import type { Money } from "@/types/product";

export function formatMoney(money: Money) {
  const locale = money.currency === "TND" ? "fr-TN" : money.currency === "NGN" ? "en-NG" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: money.currency === "TND" ? 3 : 0,
  }).format(money.amount);
}
