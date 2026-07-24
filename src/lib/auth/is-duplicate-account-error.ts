export function isDuplicateAccountError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('already been registered') ||
    normalized.includes('already exists') ||
    normalized.includes('user already registered') ||
    normalized.includes('duplicate key value')
  );
}
