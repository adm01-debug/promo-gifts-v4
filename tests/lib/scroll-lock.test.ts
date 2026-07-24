import { describe, it, expect, afterEach } from "vitest";
import {
  hasOpenOverlay,
  releaseScrollLock,
  releaseScrollLockIfIdle,
  isBodyStuckInert,
  isRootInert,
  forceRootInteractive,
} from "@/lib/dom/scroll-lock";

function lockBody() {
  document.body.setAttribute("data-scroll-locked", "1");
  document.body.style.overflow = "hidden";
  document.body.style.paddingRight = "15px";
  document.body.style.pointerEvents = "none";
  document.documentElement.style.overflow = "hidden";
}

afterEach(() => {
  document.body.removeAttribute("data-scroll-locked");
  document.body.removeAttribute("style");
  document.documentElement.removeAttribute("style");
  document.body.innerHTML = "";
});

describe("scroll-lock helpers", () => {
  it("releaseScrollLock strips the inline pointer-events:none that blocks all clicks", () => {
    lockBody();
    expect(document.body.style.pointerEvents).toBe("none");

    releaseScrollLock();

    expect(document.body.style.pointerEvents).toBe("");
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.paddingRight).toBe("");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("hasOpenOverlay detects an open dialog and dropdown menu", () => {
    expect(hasOpenOverlay()).toBe(false);

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);
    expect(hasOpenOverlay()).toBe(true);

    dialog.setAttribute("data-state", "closed");
    expect(hasOpenOverlay()).toBe(false);

    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.setAttribute("data-state", "open");
    document.body.appendChild(menu);
    expect(hasOpenOverlay()).toBe(true);
  });

  it("releaseScrollLockIfIdle keeps the lock while an overlay is genuinely open", () => {
    lockBody();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);

    releaseScrollLockIfIdle();
    expect(document.body.style.pointerEvents).toBe("none");

    dialog.setAttribute("data-state", "closed");
    releaseScrollLockIfIdle();
    expect(document.body.style.pointerEvents).toBe("");
  });

  it("isBodyStuckInert flags a stuck inert body with no overlay open", () => {
    expect(isBodyStuckInert()).toBe(false);
    document.body.style.pointerEvents = "none";
    expect(isBodyStuckInert()).toBe(true);

    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.setAttribute("data-state", "open");
    document.body.appendChild(menu);
    expect(isBodyStuckInert()).toBe(false);
  });

  it("isRootInert detects a computed pointer-events:none on the root chain", () => {
    expect(isRootInert()).toBe(false);
    document.documentElement.style.pointerEvents = "none";
    expect(isRootInert()).toBe(true);

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);
    expect(isRootInert()).toBe(false); // legitimate open overlay → not "stuck"
  });

  it("forceRootInteractive restores interactivity on html and body", () => {
    document.documentElement.style.pointerEvents = "none";
    document.body.style.pointerEvents = "none";

    forceRootInteractive();

    expect(getComputedStyle(document.documentElement).pointerEvents).not.toBe("none");
    expect(getComputedStyle(document.body).pointerEvents).not.toBe("none");
    expect(isRootInert()).toBe(false);
  });
});
