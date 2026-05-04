type ExpiringEntry = {
  expiresAt: number
}

const sessionBlacklist = new Map<string, ExpiringEntry>()
const seenJtis = new Map<string, ExpiringEntry>()

function purgeExpiredEntries(entries: Map<string, ExpiringEntry>, now: number) {
  for (const [key, entry] of entries) {
    if (entry.expiresAt < now) entries.delete(key)
  }
}

function recordEntry(
  entries: Map<string, ExpiringEntry>,
  key: string,
  ttlMs: number
) {
  const now = Date.now()
  purgeExpiredEntries(entries, now)
  entries.set(key, { expiresAt: now + ttlMs })
}

function hasUnexpiredEntry(entries: Map<string, ExpiringEntry>, key: string) {
  const entry = entries.get(key)
  if (!entry) return false

  if (entry.expiresAt < Date.now()) {
    entries.delete(key)
    return false
  }

  return true
}

export function blacklistSession(sid: string, ttlMs: number): void {
  recordEntry(sessionBlacklist, sid, ttlMs)
}

export function isSessionBlacklisted(sid: string): boolean {
  return hasUnexpiredEntry(sessionBlacklist, sid)
}

export function recordJti(jti: string, ttlMs: number): void {
  recordEntry(seenJtis, jti, ttlMs)
}

export function isJtiSeen(jti: string): boolean {
  return hasUnexpiredEntry(seenJtis, jti)
}
