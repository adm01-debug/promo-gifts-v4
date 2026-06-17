/**
 * Utilities for rendering [[PRODUTO:id:nome:imageUrl?]] as rich product cards.
 * Converts product link syntax to markdown links before ReactMarkdown processes them,
 * then uses a custom <a> component to render them as styled product cards with images.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCdnUrl } from '@/utils/image-utils';

// Matches [[PRODUTO:id:name]] and [[PRODUTO:id:name:imageUrl]]
const PRODUCT_LINK_REGEX = /\[\[PRODUTO:([^:\]]+):([^:\]]+)(?::([^\]]+))?\]\]/g;
const PRODUCT_HREF_PREFIX = 'produto://';

/**
 * Pre-process markdown content: convert [[PRODUTO:id:nome:image?]] to
 * standard markdown links with a special protocol encoding image data.
 */
export function preprocessProductLinks(content: string): string {
  return content.replace(PRODUCT_LINK_REGEX, (_, id, name, imageUrl) => {
    if (imageUrl) {
      // Encode image URL in a fragment so it survives markdown parsing
      return `[🔗 ${name}](${PRODUCT_HREF_PREFIX}${id}#img=${encodeURIComponent(imageUrl)})`;
    }
    return `[🔗 ${name}](${PRODUCT_HREF_PREFIX}${id})`;
  });
}

/**
 * Custom <a> component for ReactMarkdown that renders product links
 * as styled cards with images and navigation, while passing through regular links.
 */
export function ProductAwareLink({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  // Detect product links — both produto:// protocol AND /produto/ paths
  const isProductProtocol = href?.startsWith(PRODUCT_HREF_PREFIX);
  const isProductPath = href?.match(/^\/produto\/([a-f0-9-]+)/i);

  if (isProductProtocol || isProductPath) {
    let productId: string;
    let imageUrl: string | null = null;

    if (isProductProtocol && href) {
      const urlPart = href.slice(PRODUCT_HREF_PREFIX.length);
      const [id, fragment] = urlPart.split('#');
      productId = id;
      if (fragment?.startsWith('img=')) {
        try {
          imageUrl = decodeURIComponent(fragment.slice(4));
        } catch {
          /* ignore */
        }
      }
    } else if (isProductPath?.[1]) {
      productId = isProductPath[1];
    } else {
      productId = '';
    }

    // Extract name from children (strip the 🔗 emoji)
    const name =
      typeof children === 'string'
        ? children.replace(/^🔗\s*/, '')
        : String(children ?? '').replace(/^🔗\s*/, '');

    const proxiedImage = imageUrl && !imgError ? getCdnUrl(imageUrl, 'card') : null;

    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          navigate(`/produto/${productId}`);
        }}
        className={cn(
          'my-1 inline-flex items-center gap-2 rounded-xl',
          'bg-card hover:bg-accent/50',
          'text-[12px] font-medium transition-all duration-200',
          'border border-border/40 hover:border-primary/30',
          'cursor-pointer shadow-sm hover:shadow-md',
          proxiedImage ? 'p-1 pr-3' : 'px-2.5 py-1.5',
        )}
        title={`Ver produto: ${name}`}
      >
        {proxiedImage ? (
          <img
            src={proxiedImage}
            alt={name}
            className="h-10 w-10 flex-shrink-0 rounded-lg bg-muted/30 object-contain"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="bg-primary/8 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md">
            <Package className="h-3 w-3 text-primary/60" />
          </div>
        )}
        <span className="max-w-[200px] truncate text-foreground/90">{name}</span>
        <ChevronRight className="h-3 w-3 flex-shrink-0 text-primary/50" />
      </button>
    );
  }

  // Regular link — render as normal anchor, but internal links stay in same tab
  const isInternal = href?.startsWith('/');
  if (isInternal) {
    return (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          if (href) navigate(href);
        }}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  );
}
