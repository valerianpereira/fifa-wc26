import { WC26Error } from '../errors.js';
import type { Provider } from './types.js';

interface Breaker { failures: number; openedAt: number | null }

const FAIL_THRESHOLD = 3;
const OPEN_MS = 5 * 60 * 1000;

export class ProviderRegistry {
  private breakers = new Map<string, Breaker>();
  constructor(private providers: Provider[]) {}

  private breaker(name: string): Breaker {
    let b = this.breakers.get(name);
    if (!b) { b = { failures: 0, openedAt: null }; this.breakers.set(name, b); }
    return b;
  }

  private isOpen(name: string): boolean {
    const b = this.breaker(name);
    if (b.openedAt == null) return false;
    if (Date.now() - b.openedAt < OPEN_MS) return true;
    b.openedAt = null; b.failures = 0;
    return false;
  }

  private recordFail(name: string) {
    const b = this.breaker(name);
    b.failures++;
    if (b.failures >= FAIL_THRESHOLD) b.openedAt = Date.now();
  }

  private recordOk(name: string) {
    const b = this.breaker(name);
    b.failures = 0; b.openedAt = null;
  }

  async call<T>(fn: (p: Provider) => Promise<T>): Promise<T> {
    const candidates = this.providers.filter((p) => p.isConfigured() && !this.isOpen(p.name));
    if (candidates.length === 0) {
      if (this.providers.length === 0 || !this.providers.some((p) => p.isConfigured())) {
        throw new WC26Error('NO_PROVIDER_CONFIGURED', 'no provider configured. run: wc26 config set apiKey <provider> <KEY>');
      }
      throw new WC26Error('PROVIDER_UNREACHABLE', 'all providers temporarily unavailable');
    }

    let lastErr: WC26Error | undefined;
    for (const p of candidates) {
      try {
        const out = await fn(p);
        this.recordOk(p.name);
        return out;
      } catch (e) {
        if (e instanceof WC26Error && e.code === 'NOT_FOUND') throw e;
        this.recordFail(p.name);
        lastErr = e instanceof WC26Error ? e : new WC26Error('PROVIDER_UNREACHABLE', String(e));
      }
    }
    throw new WC26Error('PROVIDER_UNREACHABLE', lastErr?.message ?? 'all providers failed');
  }
}
