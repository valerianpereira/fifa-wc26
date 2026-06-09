export interface JsonOpts { stale?: boolean; reason?: string }
export function renderJson(data: unknown, opts: JsonOpts = {}): string {
  return JSON.stringify({ stale: !!opts.stale, ...(opts.reason ? { reason: opts.reason } : {}), data });
}
