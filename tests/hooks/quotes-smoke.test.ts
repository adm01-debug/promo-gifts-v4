/**
 * Smoke tests para hooks de orçamentos que dependem de muitos contextos.
 */
import "../components/render-helpers";
import { vi } from "vitest";

// Mock contextos não cobertos pelos mocks globais
vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ currentOrg: null, organizations: [], isLoading: false }),
  OrganizationProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { useQuotes } from "@/hooks/quotes";
import { smokeHook } from "./_helpers/smoke-template";

smokeHook("useQuotes", () => useQuotes());
