import React from 'react';
import { Helmet } from 'react-helmet-async';

interface PageSEOProps {
  title: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
  ogImage?: string;
  ogType?: string;
  jsonLd?: Record<string, unknown>;
}

/**
 * BASE_URL é lido em runtime via VITE_PUBLIC_URL (definida no Vercel).
 * Fallback hardcoded para o domínio próprio garante que mesmo sem env var
 * o canonical sai correto. NUNCA voltar a apontar para *.lovable.app.
 */
const BASE_URL =
  (import.meta.env.VITE_PUBLIC_URL as string | undefined) ?? 'https://www.promogifts.com.br';
const SITE_NAME = 'Promo Gifts';
const DEFAULT_DESC =
  'Plataforma de Produtos completa para vendedores de brindes promocionais. Catálogo, orçamentos, simulador de preços e muito mais.';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;

/**
 * Concatena o nome do site ao título sem duplicar quando o título já contém
 * "Promo Gifts" (resolve o bug M1 de "Login | Promo Gifts | Promo Gifts").
 */
function buildTitle(title: string): string {
  if (!title) return SITE_NAME;
  if (title === SITE_NAME) return SITE_NAME;
  if (title.includes(SITE_NAME)) return title;
  return `${title} | ${SITE_NAME}`;
}

export const PageSEO = React.forwardRef<HTMLElement, PageSEOProps>(
  ({ title, description, path, noIndex, ogImage, ogType, jsonLd }, _ref) => {
    const fullTitle = buildTitle(title);
    const desc = description || DEFAULT_DESC;
    const url = path ? `${BASE_URL}${path}` : BASE_URL;
    const image = ogImage || DEFAULT_OG_IMAGE;

    return (
      <Helmet>
        <title>{fullTitle}</title>
        <meta name="description" content={desc} />
        {noIndex && <meta name="robots" content="noindex, nofollow" />}

        {/* Open Graph */}
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={desc} />
        <meta property="og:type" content={ogType || 'website'} />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:image" content={image} />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:url" content={url} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={fullTitle} />
        <meta name="twitter:description" content={desc} />
        <meta name="twitter:image" content={image} />
        <meta name="twitter:url" content={url} />

        <link rel="canonical" href={url} />

        {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
      </Helmet>
    );
  },
);
