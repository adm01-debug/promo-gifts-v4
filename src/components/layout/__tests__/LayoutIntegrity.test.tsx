import { describe, it, expect } from 'vitest';

describe('Layout Syntax Integrity', () => {
  it('Header should have valid JSX/Syntax', async () => {
    // This will fail at runtime if there are syntax errors or broken imports
    const module = await import('../Header');
    expect(module.Header).toBeDefined();
  }, 15000); // Header has a heavy dep tree — import takes ~5s in jsdom

  it('SidebarReorganized should have valid JSX/Syntax', async () => {
    const module = await import('../SidebarReorganized');
    expect(module.SidebarReorganized).toBeDefined();
  });

  it('MainLayout should have valid JSX/Syntax', async () => {
    const module = await import('../MainLayout');
    expect(module.MainLayout).toBeDefined();
  });
});
