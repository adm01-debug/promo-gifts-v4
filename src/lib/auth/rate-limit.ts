/**
 * Client-side login rate limiter / brute force protection.
 * Tracks failed attempts per email in sessionStorage and blocks
 * further attempts after MAX_ATTEMPTS within the time window.
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'login_attempts';

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

function getRecords(): Record<string, AttemptRecord> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveRecords(records: Record<string, AttemptRecord>) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function checkLoginAllowed(email: string): { allowed: boolean; remainingSeconds: number } {
  const records = getRecords();
  const record = records[email.toLowerCase()];
  if (!record) return { allowed: true, remainingSeconds: 0 };

  if (record.lockedUntil) {
    const now = Date.now();
    if (now < record.lockedUntil) {
      return { allowed: false, remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
    }
    // Lockout expired — reset
    delete records[email.toLowerCase()];
    saveRecords(records);
    return { allowed: true, remainingSeconds: 0 };
  }

  return { allowed: true, remainingSeconds: 0 };
}

export function recordFailedAttempt(email: string): { locked: boolean; remainingSeconds: number } {
  const records = getRecords();
  const key = email.toLowerCase();
  const now = Date.now();
  let record = records[key];

  if (!record || now - record.firstAttemptAt > LOCKOUT_MS) {
    record = { count: 1, firstAttemptAt: now, lockedUntil: null };
  } else {
    record.count++;
  }

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    records[key] = record;
    saveRecords(records);
    return { locked: true, remainingSeconds: Math.ceil(LOCKOUT_MS / 1000) };
  }

  records[key] = record;
  saveRecords(records);
  return { locked: false, remainingSeconds: 0 };
}

export function clearLoginAttempts(email: string) {
  const records = getRecords();
  delete records[email.toLowerCase()];
  saveRecords(records);
}
