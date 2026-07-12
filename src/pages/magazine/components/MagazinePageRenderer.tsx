/**
 * MagazinePageRenderer — renderiza uma página aplicando o template,
 * as CSS variables de branding e as fontes do template.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Magazine, MagazinePage } from '@/types/magazine';
import { getTemplate } from './templates/TemplateRegistry';

interface Props {
  magazine: Magazine;
  page: MagazinePage;
  /** Se preenchido, escala o conteúdo para caber neste contêiner (preview). */
  fitContainer?: boolean;
  /** Total de páginas — propagado aos templates para folio "05 / 24". */
  totalPages?: number;
}

import { MAGAZINE_CATEGORY_META } from './templates/chrome';

/* Fontes carregadas via @fontsource em magazine.css — sem CDN externa. */

export function MagazinePageRenderer({ magazine, page, fitContainer, totalPages }: Props) {
  const template = getTemplate(magazine.templateId);
  const Component = template.Component;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!fitContainer) return;
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setScale(w / 1920);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitContainer]);

  const style = useMemo<CSSProperties>(() => {
    const b = magazine.branding.colors;
    const fallback = template.defaultColors;
    const categoryHex = magazine.branding.category
      ? MAGAZINE_CATEGORY_META[magazine.branding.category].hex
      : MAGAZINE_CATEGORY_META.technology.hex;
    return {
      '--mag-primary': b.primary || fallback.primary,
      '--mag-secondary': b.secondary || fallback.secondary,
      '--mag-text': b.text || fallback.text,
      '--mag-category-color': categoryHex,
      '--mag-heading': `'${template.fonts.heading}', 'Playfair Display', serif`,
      '--mag-body': `'${template.fonts.body}', 'Inter', 'Outfit', system-ui, sans-serif`,
    } as CSSProperties;
  }, [magazine.branding.colors, magazine.branding.category, template]);

  const content =
    page.kind === 'cover' ? (
      <CoverPage magazine={magazine} />
    ) : page.kind === 'back-cover' ? (
      <BackCoverPage magazine={magazine} />
    ) : page.kind === 'section' ? (
      <SectionPage title={page.sectionTitle ?? ''} />
    ) : (
      <Component magazine={magazine} page={page} totalPages={totalPages} />
    );

  if (!fitContainer) {
    return (
      <div className="mag-scope" style={style}>
        {content}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="mag-preview-wrapper mag-scope" style={style}>
      <div style={{ transform: `scale(${scale})`, width: 1920, height: 2716 }}>{content}</div>
    </div>
  );
}

function CoverPage({ magazine }: { magazine: Magazine }) {
  const hero = magazine.items[0];
  const heroImage = hero?.productSnapshot.image_url;
  return (
    <div
      className="mag-page relative flex flex-col justify-between"
      style={{ background: 'var(--mag-primary)', color: '#fff' }}
    >
      {heroImage && (
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.35 }}
        />
      )}
      <div className="relative flex items-center gap-8 p-16">
        {magazine.branding.clientLogoUrl && (
          <img
            src={magazine.branding.clientLogoUrl}
            alt="logo"
            className="h-40 w-40 rounded-full bg-white object-contain p-3"
          />
        )}
        <div>
          <div className="text-3xl uppercase tracking-[0.4em] opacity-80" style={{ fontFamily: 'var(--mag-body)' }}>
            Catálogo
          </div>
          {magazine.branding.clientName && (
            <div className="mt-2 text-4xl" style={{ fontFamily: 'var(--mag-body)' }}>
              {magazine.branding.clientName}
            </div>
          )}
        </div>
      </div>
      <div className="relative p-16">
        <h1
          className="leading-[0.95]"
          style={{ fontFamily: 'var(--mag-heading)', fontSize: 260, letterSpacing: '-0.03em' }}
        >
          {magazine.title}
        </h1>
        {magazine.subtitle && (
          <p className="mt-8 max-w-[1400px] text-4xl opacity-90" style={{ fontFamily: 'var(--mag-body)' }}>
            {magazine.subtitle}
          </p>
        )}
      </div>
      <div className="relative flex items-center justify-between px-16 pb-16 text-2xl uppercase tracking-widest opacity-70">
        <span style={{ fontFamily: 'var(--mag-body)' }}>Promo Gifts</span>
        <span style={{ fontFamily: 'var(--mag-body)' }}>{new Date().getFullYear()}</span>
      </div>
    </div>
  );
}

function BackCoverPage({ magazine }: { magazine: Magazine }) {
  return (
    <div
      className="mag-page flex flex-col items-center justify-center gap-10 p-24 text-center"
      style={{ background: 'var(--mag-primary)', color: '#fff' }}
    >
      <div className="text-3xl uppercase tracking-[0.5em] opacity-80">Obrigado</div>
      <div className="text-6xl" style={{ fontFamily: 'var(--mag-heading)' }}>
        Fale com a Promo Gifts
      </div>
      {magazine.branding.clientName && (
        <div className="text-3xl opacity-90">Preparado exclusivamente para {magazine.branding.clientName}</div>
      )}
      <div className="mt-12 text-2xl opacity-70">promogifts.com.br</div>
    </div>
  );
}

function SectionPage({ title }: { title: string }) {
  return (
    <div
      className="mag-page flex items-center justify-center"
      style={{ background: 'var(--mag-primary)', color: '#fff' }}
    >
      <h2
        className="text-center"
        style={{ fontFamily: 'var(--mag-heading)', fontSize: 200, letterSpacing: '-0.02em' }}
      >
        {title}
      </h2>
    </div>
  );
}
