import { describe, it, expect } from 'vitest';

describe('Layout Integrity Tests', () => {
  it('Header should import without syntax errors', async () => {
    // Dynamic import will throw if there are syntax errors (parentheses, JSX mismatch)
    const module = await import('../Header');
    expect(module.Header).toBeDefined();
    console.log('✅ Header syntax is valid');
  });

  it('SidebarReorganized should import without syntax errors', async () => {
    // Dynamic import will throw if there are syntax errors (parentheses, JSX mismatch)
    const module = await import('../SidebarReorganized');
    expect(module.SidebarReorganized).toBeDefined();
    console.log('✅ SidebarReorganized syntax is valid');
  });

  it('Components should be memoized properly', async () => {
    const { Header } = await import('../Header');
    const { SidebarReorganized } = await import('../SidebarReorganized');
    
    // Check if they are React components
    expect(typeof Header).toBe('object'); // React.memo returns an object
    expect(typeof SidebarReorganized).toBe('object');
  });
});
