import { render, screen, fireEvent } from '@testing-library/react';
import { OptimizedImage } from '../OptimizedImage';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// JSDOM does not implement IntersectionObserver. Without this mock,
// OptimizedImage's useEffect (priority=false path) throws on mount.
// The previous assumption "mock is global in setupFiles" was fragile —
// we make it explicit here so this file is self-contained.
// JSDOM não implementa IntersectionObserver e o componente o instancia com `new`.
// Vitest recente exige um construtor real (class), não vi.fn().mockReturnValue/arrow.
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}
window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

describe('OptimizedImage', () => {
  const defaultProps = {
    src: 'https://example.com/image.jpg',
    alt: 'Test Image',
    blurAmount: 20,
    zoomAmount: 1.1,
    duration: 500,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a shimmer or placeholder when loading', () => {
    render(<OptimizedImage {...defaultProps} />);

    // With generic src (no LQIP generated), the main <img> is the only img element.
    // It renders with src=undefined (not in view) + inline style with filter:blur
    const img = screen.getByRole('img', { hidden: true });
    expect(img).toBeInTheDocument();
    expect(img).toHaveStyle('filter: blur(20px)');
  });

  it('applies fade-in, removes blur and resets zoom after onLoad', () => {
    render(<OptimizedImage {...defaultProps} />);

    const img = screen.getByAltText('Test Image');

    // Initial state (loading)
    expect(img).toHaveClass('opacity-0');
    expect(img).toHaveStyle(`filter: blur(${defaultProps.blurAmount}px)`);
    expect(img).toHaveStyle(`transform: scale(${defaultProps.zoomAmount})`);
    expect(img).toHaveStyle(`transition-duration: ${defaultProps.duration}ms`);

    // Simulate image load
    fireEvent.load(img);

    // Final state (loaded)
    expect(img).toHaveClass('opacity-100');
    expect(img).toHaveClass('scale-100');
    expect(img).toHaveClass('blur-0');
    expect(img).toHaveStyle('filter: none');
    expect(img).toHaveStyle('transform: scale(1)');
  });

  it('handles custom configuration correctly', () => {
    const customProps = { ...defaultProps, blurAmount: 50, zoomAmount: 1.5, duration: 1000 };
    render(<OptimizedImage {...customProps} />);

    const img = screen.getByAltText('Test Image');
    expect(img).toHaveStyle('filter: blur(50px)');
    expect(img).toHaveStyle('transform: scale(1.5)');
    expect(img).toHaveStyle('transition-duration: 1000ms');
  });

  it('shows error state when image fails to load', () => {
    render(<OptimizedImage {...defaultProps} />);
    fireEvent.error(screen.getByAltText('Test Image'));
    expect(screen.getByText('Erro ao carregar')).toBeInTheDocument();
  });

  it('uses lqip if provided', () => {
    const lqip = 'data:image/png;base64,lqip-data';
    render(<OptimizedImage {...defaultProps} lqip={lqip} />);
    const placeholder = document.querySelector(`img[src="${lqip}"]`);
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute('aria-hidden', 'true');
  });

  it('detects Cloudflare Images (imagedelivery.net) and generates /thumbnail path', () => {
    const cfSrc = 'https://imagedelivery.net/abc123/product-id/public';
    render(<OptimizedImage {...defaultProps} src={cfSrc} />);

    expect(document.querySelector('[data-detection-rule="cloudflare"]')).toBeInTheDocument();
    const placeholder = document.querySelector('img[aria-hidden="true"]');
    expect(placeholder).toHaveAttribute(
      'src',
      'https://imagedelivery.net/abc123/product-id/thumbnail',
    );
  });

  it('handles Cloudflare edge cases: trailing slashes and query strings', () => {
    const { unmount } = render(
      <OptimizedImage
        {...defaultProps}
        src="https://imagedelivery.net/abc123/product-id/public/"
      />,
    );
    expect(document.querySelector('img[aria-hidden="true"]')).toHaveAttribute(
      'src',
      'https://imagedelivery.net/abc123/product-id/thumbnail',
    );
    unmount();

    render(
      <OptimizedImage
        {...defaultProps}
        src="https://imagedelivery.net/abc123/product-id/public?v=123"
      />,
    );
    expect(document.querySelector('img[aria-hidden="true"]')).toHaveAttribute(
      'src',
      'https://imagedelivery.net/abc123/product-id/thumbnail',
    );
  });

  it('emits console.info only when debug is true or in development', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const cfSrc = 'https://imagedelivery.net/abc123/product-id/public';

    const { unmount } = render(<OptimizedImage {...defaultProps} src={cfSrc} debug={false} />);
    expect(spy).not.toHaveBeenCalled();
    unmount();

    render(<OptimizedImage {...defaultProps} src={cfSrc} debug={true} />);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[OptimizedImage] Cloudflare Image detected'),
    );
    spy.mockClear();

    render(<OptimizedImage {...defaultProps} src="https://example.com/image.jpg" debug={true} />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('detects Unsplash images and generates tiny thumbnail', () => {
    render(
      <OptimizedImage
        {...defaultProps}
        src="https://images.unsplash.com/photo-123456?auto=format&fit=crop&q=80"
      />,
    );
    expect(document.querySelector('[data-detection-rule="unsplash"]')).toBeInTheDocument();
    const src = document.querySelector('img[aria-hidden="true"]')?.getAttribute('src');
    expect(src).toContain('w=50');
    expect(src).toContain('q=10');
    expect(src).toContain('blur=10');
  });

  it('detects Supabase storage images and generates thumbnail params', () => {
    render(
      <OptimizedImage
        {...defaultProps}
        src="https://abc.supabase.co/storage/v1/object/public/products/image.jpg"
      />,
    );
    expect(document.querySelector('[data-detection-rule="supabase"]')).toBeInTheDocument();
    const src = document.querySelector('img[aria-hidden="true"]')?.getAttribute('src');
    expect(src).toContain('width=50');
    expect(src).toContain('quality=10');
  });

  describe('blurhash prop — cor dominante como placeholder', () => {
    it('aplica backgroundColor do blurhash ao container enquanto carregando', () => {
      // "00TI:j" → DC=0xFF0000 → rgb(255,0,0) vermelho puro
      const { container } = render(<OptimizedImage {...defaultProps} blurhash="00TI:j" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle('background-color: rgb(255, 0, 0)');
    });

    it('remove backgroundColor do container após onLoad', () => {
      const { container } = render(<OptimizedImage {...defaultProps} blurhash="00TI:j" />);
      const wrapper = container.firstChild as HTMLElement;
      const img = screen.getByAltText('Test Image');

      expect(wrapper).toHaveStyle('background-color: rgb(255, 0, 0)');

      fireEvent.load(img);

      // Após carregar, backgroundColor deve ser undefined (sem cor)
      expect(wrapper).not.toHaveStyle('background-color: rgb(255, 0, 0)');
    });

    it('sem blurhash → sem backgroundColor no container', () => {
      const { container } = render(<OptimizedImage {...defaultProps} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.backgroundColor).toBe('');
    });

    it('blurhash null → sem backgroundColor no container', () => {
      const { container } = render(<OptimizedImage {...defaultProps} blurhash={null} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.backgroundColor).toBe('');
    });

    it('blurhash inválido (muito curto) → sem backgroundColor', () => {
      const { container } = render(<OptimizedImage {...defaultProps} blurhash="ab" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.backgroundColor).toBe('');
    });
  });
});
