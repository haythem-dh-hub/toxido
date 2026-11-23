import "server-only";

export async function readLimitedBody(request: Request, maximumBytes: number): Promise<Buffer | null> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maximumBytes) return null;
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, total);
  } catch {
    await reader.cancel().catch(() => undefined);
    return null;
  }
}
