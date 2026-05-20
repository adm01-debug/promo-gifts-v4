/**
 * Render tests for ExpertChatDialog (663 lines)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../render-helpers";
import React from "react";

vi.mock("@/hooks/intelligence/useExpertConversations", () => ({
  useExpertConversations: vi.fn().mockReturnValue({
    conversations: [],
    isLoading: false,
    createConversation: vi.fn().mockResolvedValue("conv-1"),
    updateConversationTitle: vi.fn(),
    deleteConversation: vi.fn(),
    fetchMessages: vi.fn().mockResolvedValue([]),
    saveMessage: vi.fn(),
  }),
}));

vi.mock("@/lib/external-db", () => ({
  fetchPromobrindProducts: vi.fn().mockResolvedValue([]),
}));

describe("ExpertChatDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders closed state without crashing", async () => {
    const { ExpertChatDialog } = await import("@/components/expert/ExpertChatDialog");
    renderWithProviders(
      <ExpertChatDialog isOpen={false} onClose={vi.fn()} />
    );
    expect(document.body).toBeTruthy();
  }, 15000);

  it("renders open state", async () => {
    const { ExpertChatDialog } = await import("@/components/expert/ExpertChatDialog");
    renderWithProviders(
      <ExpertChatDialog
        isOpen={true}
        onClose={vi.fn()}
        clientId="c1"
        clientName="Cliente Teste"
      />
    );
    expect(document.body).toBeTruthy();
  });
});
