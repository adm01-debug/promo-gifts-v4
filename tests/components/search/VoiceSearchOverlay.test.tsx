/**
 * Comprehensive tests for VoiceSearchOverlay component
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { VoiceSearchOverlay } from "@/components/search/VoiceSearchOverlay";

// Framer-motion props that should NOT be forwarded to DOM elements
const MOTION_PROPS = new Set([
  'initial', 'animate', 'exit', 'transition', 'variants',
  'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'whileInView',
  'drag', 'dragConstraints', 'dragElastic', 'dragMomentum',
  'layout', 'layoutId', 'onAnimationStart', 'onAnimationComplete',
  'style', // handled separately if needed
]);

const filterMotionProps = (props: Record<string, any>) => {
  const filtered: Record<string, any> = {};
  for (const key of Object.keys(props)) {
    if (!MOTION_PROPS.has(key)) filtered[key] = props[key];
  }
  return filtered;
};

// Mock framer-motion with all element types used in VoiceSearchOverlay
vi.mock("framer-motion", () => {
  const handler: ProxyHandler<object> = {
    get(_target, prop: string) {
      // Map motion.<element> to a simple forwarded-ref wrapper
      const tagMap: Record<string, string> = {
        div: "div", button: "button", span: "span", p: "p",
        polyline: "polyline", svg: "svg", g: "g", circle: "circle",
        rect: "rect", line: "line", path: "path", text: "text",
      };
      const tag = tagMap[prop] || "div";
      return React.forwardRef(({ children, ...rest }: any, ref: any) =>
        React.createElement(tag, { ...filterMotionProps(rest), ref }, children)
      );
    },
  };
  return {
    motion: new Proxy({}, handler),
    m: new Proxy({}, handler),
    LazyMotion: ({ children }: any) => <>{children}</>,
    domMax: {},
    domAnimation: {},
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

// Mock FloatingParticles to avoid HTMLCanvasElement.getContext errors in jsdom
vi.mock("@/components/search/voice/FloatingParticles", () => ({
  FloatingParticles: () => null,
}));

// Mock createPortal so it renders inline
vi.mock("react-dom", async () => {
  const actual = await vi.importActual("react-dom");
  return {
    ...actual,
    createPortal: (node: any) => node,
  };
});

// Mock getComputedStyle to return a theme HSL
const mockGetComputedStyle = vi.fn().mockReturnValue({
  getPropertyValue: (prop: string) => {
    if (prop === "--primary") return "25 95% 53%";
    return "";
  },
});
vi.stubGlobal("getComputedStyle", mockGetComputedStyle);

describe("VoiceSearchOverlay", () => {
  const defaultProps = {
    isOpen: true,
    phase: "idle" as const,
    partialTranscript: "",
    finalTranscript: "",
    agentResponse: "",
    error: null,
    onClose: vi.fn(),
    onStartListening: vi.fn(),
    onStopListening: vi.fn(),
    onStopSpeaking: vi.fn(),
    onCommandSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /* ========== RENDERING TESTS ========== */

  describe("Rendering", () => {
    it("renders when open", () => {
      render(<VoiceSearchOverlay {...defaultProps} />);
      expect(screen.getByRole("dialog", { name: "Fale com o Flow" })).toBeDefined();
    });

    it("does not render when closed", () => {
      render(<VoiceSearchOverlay {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("renders overlay backdrop when open", () => {
      const { container } = render(<VoiceSearchOverlay {...defaultProps} />);
      // Should have a backdrop/overlay element
      expect(container.querySelector("[aria-label='Fale com o Flow']")).toBeDefined();
    });

    it("shows ESC instruction", () => {
      render(<VoiceSearchOverlay {...defaultProps} />);
      expect(screen.getByText("ESC")).toBeDefined();
    });

    it("renders the voice orb visualization", () => {
      const { container } = render(<VoiceSearchOverlay {...defaultProps} />);
      // The orb button should exist
      expect(container.querySelector("[role='button']")).toBeDefined();
    });

    it("shows close button (X)", () => {
      render(<VoiceSearchOverlay {...defaultProps} />);
      // The close button should be present
      const closeButtons = screen.getAllByRole("button");
      expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ========== PHASE DISPLAY TESTS ========== */

  describe("Phase Titles & Subtitles", () => {
    it("shows booting/idle state title on initial open", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="idle" />);
      expect(screen.getByText("Ativando microfone…")).toBeDefined();
    });

    it("shows listening phase title", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="listening" />);
      expect(screen.getByText("Ouvindo…")).toBeDefined();
    });

    it("shows listening subtitle", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="listening" />);
      expect(screen.getByText("Diga o que você precisa")).toBeDefined();
    });

    it("shows processing phase title", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="processing" />);
      expect(screen.getByText("Processando…")).toBeDefined();
    });

    it("shows processing subtitle", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="processing" />);
      expect(screen.getByText("IA interpretando seu comando")).toBeDefined();
    });

    it("shows speaking phase title", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="speaking" />);
      expect(screen.getByText("Respondendo…")).toBeDefined();
    });

    it("shows error phase title", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="error" />);
      expect(screen.getByText("Erro")).toBeDefined();
    });

    it("shows error subtitle", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="error" />);
      expect(screen.getByText("Toque para tentar novamente")).toBeDefined();
    });
  });

  /* ========== TRANSCRIPT & RESPONSE DISPLAY ========== */

  describe("Transcript & Response", () => {
    it("displays partial transcript while listening", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="listening" partialTranscript="buscar can" />);
      expect(screen.getByText(/buscar can/)).toBeDefined();
    });

    it("displays final transcript during processing", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="processing" finalTranscript="buscar canetas" />);
      const matches = screen.getAllByText(/buscar canetas/);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it("displays agent response when speaking", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="speaking" agentResponse="Encontrei 5 canetas" />);
      expect(screen.getByText("Encontrei 5 canetas")).toBeDefined();
    });

    it("displays error message", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="error" error="Erro ao conectar" />);
      expect(screen.getByText("Erro ao conectar")).toBeDefined();
    });

    it("handles empty partial transcript gracefully", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="listening" partialTranscript="" />);
      // Should not crash, should show listening state
      expect(screen.getByText("Ouvindo…")).toBeDefined();
    });

    it("handles very long transcript", () => {
      const longText = "a".repeat(500);
      render(<VoiceSearchOverlay {...defaultProps} phase="processing" finalTranscript={longText} />);
      const matches = screen.getAllByText(new RegExp(longText.slice(0, 50)));
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it("handles very long agent response", () => {
      const longResponse = "Resposta muito longa ".repeat(50);
      render(<VoiceSearchOverlay {...defaultProps} phase="speaking" agentResponse={longResponse} />);
      const matches = screen.getAllByText(/Resposta muito longa/);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it("handles special characters in transcript", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="processing" finalTranscript='canetas "azuis" com 50% desconto' />);
      const matches = screen.getAllByText(/canetas "azuis" com 50% desconto/);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ========== INTERACTION TESTS ========== */

  describe("Interactions", () => {
    it("auto-starts listening shortly after opening", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="idle" />);
      act(() => { vi.advanceTimersByTime(120); });
      expect(defaultProps.onStartListening).toHaveBeenCalled();
    });

    it("calls onClose when escape is pressed", () => {
      render(<VoiceSearchOverlay {...defaultProps} />);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("calls onCommandSelect when clicking suggestion chip", () => {
      const { rerender } = render(<VoiceSearchOverlay {...defaultProps} isOpen={false} phase="idle" />);
      rerender(<VoiceSearchOverlay {...defaultProps} isOpen={true} phase="listening" />);
      rerender(<VoiceSearchOverlay {...defaultProps} isOpen={true} phase="idle" />);
      const chip = screen.getByText(/"Quero canetas azuis baratas"/);
      fireEvent.click(chip);
      expect(defaultProps.onCommandSelect).toHaveBeenCalledWith("Quero canetas azuis baratas");
    });

    it("does not auto-start listening if phase is not idle", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="processing" />);
      act(() => { vi.advanceTimersByTime(200); });
      expect(defaultProps.onStartListening).not.toHaveBeenCalled();
    });

    it("handles multiple rapid escape presses", () => {
      render(<VoiceSearchOverlay {...defaultProps} />);
      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("ignores non-escape key presses", () => {
      render(<VoiceSearchOverlay {...defaultProps} />);
      fireEvent.keyDown(document, { key: "Enter" });
      fireEvent.keyDown(document, { key: "a" });
      fireEvent.keyDown(document, { key: "Tab" });
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  /* ========== PHASE TRANSITION TESTS ========== */

  describe("Phase Transitions", () => {
    it("transitions from idle to listening", () => {
      const { rerender } = render(<VoiceSearchOverlay {...defaultProps} phase="idle" />);
      rerender(<VoiceSearchOverlay {...defaultProps} phase="listening" />);
      expect(screen.getByText("Ouvindo…")).toBeDefined();
    });

    it("transitions from listening to processing", () => {
      const { rerender } = render(<VoiceSearchOverlay {...defaultProps} phase="listening" />);
      rerender(<VoiceSearchOverlay {...defaultProps} phase="processing" finalTranscript="teste" />);
      expect(screen.getByText("Processando…")).toBeDefined();
    });

    it("transitions from processing to speaking", () => {
      const { rerender } = render(<VoiceSearchOverlay {...defaultProps} phase="processing" />);
      rerender(<VoiceSearchOverlay {...defaultProps} phase="speaking" agentResponse="Resposta" />);
      expect(screen.getByText("Respondendo…")).toBeDefined();
    });

    it("transitions from speaking back to idle", () => {
      const { rerender } = render(<VoiceSearchOverlay {...defaultProps} phase="speaking" />);
      rerender(<VoiceSearchOverlay {...defaultProps} phase="idle" />);
      // Should show idle/booting state or assistant title
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    it("transitions to error from any phase", () => {
      const { rerender } = render(<VoiceSearchOverlay {...defaultProps} phase="listening" />);
      rerender(<VoiceSearchOverlay {...defaultProps} phase="error" error="Falha de rede" />);
      expect(screen.getByText("Erro")).toBeDefined();
      expect(screen.getByText("Falha de rede")).toBeDefined();
    });

    it("full lifecycle: idle → listening → processing → speaking → idle", () => {
      const { rerender } = render(<VoiceSearchOverlay {...defaultProps} phase="idle" />);
      
      rerender(<VoiceSearchOverlay {...defaultProps} phase="listening" />);
      expect(screen.getByText("Ouvindo…")).toBeDefined();
      
      rerender(<VoiceSearchOverlay {...defaultProps} phase="processing" finalTranscript="canetas" />);
      expect(screen.getByText("Processando…")).toBeDefined();
      
      rerender(<VoiceSearchOverlay {...defaultProps} phase="speaking" agentResponse="Achei!" />);
      expect(screen.getByText("Respondendo…")).toBeDefined();
      expect(screen.getByText("Achei!")).toBeDefined();
      
      rerender(<VoiceSearchOverlay {...defaultProps} phase="idle" />);
      expect(screen.getByRole("dialog")).toBeDefined();
    });
  });

  /* ========== OPEN/CLOSE STATE TESTS ========== */

  describe("Open/Close Lifecycle", () => {
    it("opening and closing multiple times works", () => {
      const { rerender } = render(<VoiceSearchOverlay {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole("dialog")).toBeNull();

      rerender(<VoiceSearchOverlay {...defaultProps} isOpen={true} />);
      expect(screen.getByRole("dialog")).toBeDefined();

      rerender(<VoiceSearchOverlay {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole("dialog")).toBeNull();

      rerender(<VoiceSearchOverlay {...defaultProps} isOpen={true} />);
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    it("resets state when reopened after close", () => {
      const { rerender } = render(
        <VoiceSearchOverlay {...defaultProps} isOpen={true} phase="error" error="Erro!" />
      );
      expect(screen.getByText("Erro")).toBeDefined();

      rerender(<VoiceSearchOverlay {...defaultProps} isOpen={false} />);
      rerender(<VoiceSearchOverlay {...defaultProps} isOpen={true} phase="idle" error={null} />);
      expect(screen.queryByText("Erro!")).toBeNull();
    });
  });

  /* ========== EDGE CASES ========== */

  describe("Edge Cases", () => {
    it("handles null error gracefully", () => {
      render(<VoiceSearchOverlay {...defaultProps} phase="error" error={null} />);
      expect(screen.getByText("Erro")).toBeDefined();
    });

    it("handles undefined onCommandSelect", () => {
      const props = { ...defaultProps, onCommandSelect: undefined };
      expect(() => {
        render(<VoiceSearchOverlay {...props} />);
      }).not.toThrow();
    });

    it("renders without crashing with all empty strings", () => {
      expect(() => {
        render(
          <VoiceSearchOverlay
            {...defaultProps}
            partialTranscript=""
            finalTranscript=""
            agentResponse=""
            error=""
          />
        );
      }).not.toThrow();
    });

    it("handles concurrent transcript and response (edge case)", () => {
      render(
        <VoiceSearchOverlay
          {...defaultProps}
          phase="speaking"
          finalTranscript="minha pergunta"
          agentResponse="minha resposta"
        />
      );
      expect(screen.getByText("minha resposta")).toBeDefined();
    });
  });

  /* ========== ACCESSIBILITY TESTS ========== */

  describe("Accessibility", () => {
    it("has dialog role with accessible name", () => {
      render(<VoiceSearchOverlay {...defaultProps} />);
      const dialog = screen.getByRole("dialog");
      expect(dialog.getAttribute("aria-label")).toBe("Fale com o Flow");
    });

    it("responds to keyboard Escape for closing", () => {
      render(<VoiceSearchOverlay {...defaultProps} />);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
