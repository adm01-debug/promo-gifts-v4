/**
 * Barrel `@/hooks/auth` — SSOT de re-exports dos hooks de autenticação/segurança.
 */
export { useRBAC, type RoleName, type Role, type Permission } from './useRBAC';
export { use2FA } from './use2FA';
export { useAccessSecurity } from './useAccessSecurity';
export type {
  IpWhitelistEntry,
  CountryWhitelistEntry,
  AccessBlockedLog,
  AccessSecuritySettings,
} from './useAccessSecurity';
export { useLoginAttempts, useLoginAttemptStats, type LoginAttempt } from './useLoginAttempts';
export { usePasswordResetRequests, type PasswordResetRequest } from './usePasswordResetRequests';
export { useStepUpAuth, type StepUpAction } from './useStepUpAuth';
