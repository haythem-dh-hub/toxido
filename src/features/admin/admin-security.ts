export const DATABASE_ORDER_STATUSES = ["pending", "confirmed", "cancelled", "fulfilled"] as const;
export type DatabaseOrderStatus = typeof DATABASE_ORDER_STATUSES[number];

export function isAllowedAdminId(userId: unknown, configuredIds: string | undefined): boolean {
  if (typeof userId !== "string" || !configuredIds) return false;
  return configuredIds.split(",").some((id) => id.trim() === userId);
}

export function isDatabaseOrderStatus(value: unknown): value is DatabaseOrderStatus {
  return typeof value === "string" && DATABASE_ORDER_STATUSES.includes(value as DatabaseOrderStatus);
}

export function isSafeProductSlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isValidMillimePrice(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

export function isValidStock(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 2_147_483_647;
}
