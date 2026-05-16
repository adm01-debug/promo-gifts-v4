import React from "react";
import { Helmet } from "react-helmet-async";

interface PageSEOProps {
  title: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
  ogImage?: string;
  ogType?: string;
  jsonLd?: Record<string, unknown>;
}

const BASE_URL = "https://criar-together-now.lovable.app";
const SITE_NAME = "Promo Gifts";
const DEFAULT_DESC = "Plataforma de Produtos completa para vendedores de brindes promocionais. Catálogo, orçamentos, simulador de preços e muito mais.";
const DEFAULT_OG_IMAGE = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e1261250-c70e-4278-b09c-68f108f6f3fb/id-preview-c11a0001--1be35a65-1f65-4c2b-9a79-7d563930aacd.lovable.app-1773315238298.png";

export const PageSEO = React.forwardRef<HTMLElement, PageSEOProps>(function PageSEO({ title, description, path, noIndex, ogImage, ogType, jsonLd }, _ref) {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const desc = description || DEFAULT_DESC;
  const url = path ? `${BASE_URL}${path}` : undefined;
  const image = ogImage || DEFAULT_OG_IMAGE;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content={ogType || "website"} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content="pt_BR" />
      {url && <meta property="og:url" content={url} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={image} />

      {url && <link rel="canonical" href={url} />}

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
});
