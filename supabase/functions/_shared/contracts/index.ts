/**
 * supabase/functions/_shared/contracts/index.ts
 *
 * Barrel export do pacote de contratos.
 */

export {
  type ContractError,
  type ContractErrorCode,
  type FieldIssue,
  invalidJsonResponse,
  missingBodyResponse,
  unsupportedVersionResponse,
  validationErrorResponse,
  zodErrorToFieldIssues,
  zodValidationErrorResponse,
} from "./errors.ts";

export {
  resolveContractVersion,
  type ResolvedVersion,
  type VersionConfig,
  type VersionResolution,
} from "./versioning.ts";

export {
  type ContractSchemas,
  parseContract,
  type ParseOptions,
  type ParseResult,
} from "./parse.ts";

// Re-export do Zod para padronizar o pinning em todo o repo
export { z } from "https://esm.sh/zod@3.23.8";
