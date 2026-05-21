/**
 * Render tests for Auth page (592 lines)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../render-helpers";
import React from "react";

vi.mock("@/components/auth/CaptchaWidget", () => ({
  CaptchaWidget: () => <div data-testid="captcha" />,
}));

vi.mock("@/components/auth/PasswordStrengthIndicator", () => ({
  PasswordStrengthIndicator: () => <div data-testid="password-strength" />,
}));

vi.mock("@/components/auth/SessionGate", () => ({
  SessionGate: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/auth/SocialLoginButtons", () => ({
  SocialLoginButtons: () => <div data-testid="social-buttons" />,
}));

vi.mock("@/components/auth/TermsCheckbox", () => ({
  TermsCheckbox: () => <div data-testid="terms" />,
}));

vi.mock("@/components/auth/PasskeyLogin", () => ({
  PasskeyLogin: () => null,
}));

describe("Auth Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", async () => {
    const { default: Auth } = await import("@/pages/auth/Auth");
    renderWithProviders(<Auth />);
    expect(document.body).toBeTruthy();
  });
});
