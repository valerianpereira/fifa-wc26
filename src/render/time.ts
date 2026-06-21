export function detectTimeZone(): string {
  const override = process.env.WC26_TZ?.trim();
  if (override) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: override });
      return override;
    } catch {
      // fall through to auto-detect
    }
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function formatKickoff(iso: string, tz: string = detectTimeZone()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toISOString().replace('T', ' ').replace(/:\d{2}\.\d{3}Z$/, '');
  }
}

export function tzLabel(tz: string = detectTimeZone()): string {
  return tz || 'UTC';
}
