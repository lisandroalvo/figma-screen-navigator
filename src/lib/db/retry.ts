/**
 * Limited retry for IDEMPOTENT DB operations against transient connection
 * failures (CONNECT_TIMEOUT / connection reset / terminated). Used by the Figma
 * indexers, whose single pooled connection can be closed by idle_timeout during
 * long getFile() calls and then fail to reconnect under pooler load. Only
 * connection-level errors are retried — never semantic/data errors. Bounded
 * attempts, increasing backoff. Logs module/op/attempt; never secrets.
 */
const TRANSIENT = /CONNECT_TIMEOUT|ECONNRESET|ETIMEDOUT|ENOTFOUND|EPIPE|connection.*(closed|reset|terminated|ended)|terminating connection|Connection terminated/i;

function isTransient(err: unknown): boolean {
  const e = err as { message?: string; code?: string; cause?: { code?: string; message?: string } };
  const hay = `${e?.code ?? ""} ${e?.message ?? ""} ${e?.cause?.code ?? ""} ${e?.cause?.message ?? ""}`;
  return TRANSIENT.test(hay);
}

export async function withDbRetry<T>(
  op: () => Promise<T>,
  ctx: { module: string; op: string; attempts?: number },
): Promise<T> {
  const maxAttempts = ctx.attempts ?? 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === maxAttempts) throw err;
      const delay = 500 * attempt; // 500ms, 1000ms, …
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   [db-retry] module="${ctx.module}" op="${ctx.op}" attempt ${attempt}/${maxAttempts} failed (${msg.slice(0, 80)}); retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// Transient Figma fetch failures — large files (e.g. Org Profile) can have their
// socket "terminated" mid-download, or hit "fetch failed"/network resets.
const FIGMA_TRANSIENT = /terminated|fetch failed|socket hang up|premature close|other side closed|network|und_err|ECONNRESET|ETIMEDOUT|ENOTFOUND|EPIPE|Figma API (429|5\d\d)/i;

function isFigmaTransient(err: unknown): boolean {
  const e = err as { message?: string; code?: string; cause?: { code?: string; message?: string } };
  const hay = `${e?.code ?? ""} ${e?.message ?? ""} ${e?.cause?.code ?? ""} ${e?.cause?.message ?? ""}`;
  return FIGMA_TRANSIENT.test(hay);
}

/** Limited retry for an idempotent Figma read (e.g. getFile) against transient
 *  network/large-file failures. Longer backoff; bounded attempts. */
export async function withFigmaRetry<T>(
  op: () => Promise<T>,
  ctx: { module: string; op: string; attempts?: number },
): Promise<T> {
  const maxAttempts = ctx.attempts ?? 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (!isFigmaTransient(err) || attempt === maxAttempts) throw err;
      const delay = 2000 * attempt; // 2s, 4s, …
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   [figma-retry] module="${ctx.module}" op="${ctx.op}" attempt ${attempt}/${maxAttempts} failed (${msg.slice(0, 80)}); retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
