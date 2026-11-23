import { timingSafeEqual } from "node:crypto";

export function isAuthorizedCronRequest(
  request: Request,
  configuredSecret = process.env.CRON_SECRET,
): boolean {
  const secret = configuredSecret?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return false;
  const token = header.slice(7).trim();
  if (!token) return false;
  const expected = Buffer.from(secret, "utf8");
  const received = Buffer.from(token, "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
