import { forwardRef } from 'react';

/**
 * Skip links for accessibility (WCAG 2.1 AA)
 * Allows keyboard users to skip to main areas of the page
 */

interface SkipLink {
  href: string;
  label: string;
}

const defaultLinks: SkipLink[] = [
  { href: '#main-content', label: 'Pular para o conteúdo principal' },
  { href: '#main-navigation', label: 'Ir para a navegação' },
  { href: '#search', label: 'Ir para a busca' },
];

interface SkipToContentProps {
  links?: SkipLink[];
}

export const SkipToContent = forwardRef<HTMLDivElement, SkipToContentProps>(
  ({ links = defaultLinks }, ref) => {
    return (
      <div ref={ref} className="skip-links">
        {links.map((link, index) => (
          <a
            key={index}
            href={link.href}
            className="sr-only transition-all duration-200 focus:not-sr-only focus:absolute focus:z-[9999] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            style={{ top: `${1 + index * 3}rem`, left: '1rem' }}
          >
            {link.label}
          </a>
        ))}
      </div>
    );
  },
);

SkipToContent.displayName = 'SkipToContent';

// Simple single skip link for basic usage
export const SkipLink = forwardRef<HTMLAnchorElement, Partial<SkipLink>>(
  ({ href = '#main-content', label = 'Pular para o conteúdo principal' }, ref) => {
    return (
      <a
        ref={ref}
        href={href}
        className="sr-only transition-all duration-200 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      >
        {label}
      </a>
    );
  },
);

SkipLink.displayName = 'SkipLink';
