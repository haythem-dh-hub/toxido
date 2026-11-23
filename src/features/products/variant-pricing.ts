import type { Money } from "../../types/product";

export function moneyFromMillimes(priceMillimes: number): Money {
  return { amount: priceMillimes / 1000, currency: "TND" };
}

export function cartLineTotal(unitPrice: Money, quantity: number): Money {
  return { ...unitPrice, amount: unitPrice.amount * quantity };
}
