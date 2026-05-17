import { describe, it, expect } from 'vitest';

describe('Layout Syntax Integrity', () => {
  it('Header syntax should be valid', async () => {
    const { Header } = await import('../Header');
    expect(Header).toBeDefined();
  });

  it('SidebarReorganized syntax should be valid', async () => {
    const { SidebarReorganized } = await import('../SidebarReorganized');
    expect(SidebarReorganized).toBeDefined();
  });
});
