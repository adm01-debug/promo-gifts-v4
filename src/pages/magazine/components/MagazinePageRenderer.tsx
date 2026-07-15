/**
 * MagazinePageRenderer — renderiza uma página aplicando o template,
 * as CSS variables de branding e as fontes do template.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Magazine, MagazinePage } from '@/types/magazine';
import { getTemplate } from './templates/TemplateRegistry';
import { MAGAZINE_CATEGORY_META } from './templates/chrome';
import { CategoryIcon } from '../utils/categoryIcons';
import { contrastRatio } from '../utils/contrast';

interface Props {
  magazine: Magazine;
  page: MagazinePage;
  /** Se preenchido, escala o conteúdo para caber neste contêiner (preview). */
  fitContainer?: boolean;
  /** Total de páginas — propagado aos templates para folio "05 / 24". */
  totalPages?: number;
}

/** Escolhe branco ou charcoal contra `bgHex` maximizando WCAG. */
function pickReadableInk(bgHex: string): '#1a1a1a' | '#ffffff' {
  const white = contrastRatio('#ffffff', bgHex);
  const dark = contrastRatio('#1a1a1a', bgHex);
  return dark > white ? '#1a1a1a' : '#ffffff';
}

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

/**
 * CoverPage — recipe da p.1 do catálogo Abreez 2026:
 * fundo categórico + still-life do 1º produto + logo em caixa branca top-left +
 * subtítulo serif all-caps top-right + palavra script cursivo na base.
 */
function CoverPage({ magazine }: { magazine: Magazine }) {
  const hero = magazine.items[0];
  const heroImage = hero?.productSnapshot.image_url;
  const categoryHex = magazine.branding.category
    ? MAGAZINE_CATEGORY_META[magazine.branding.category].hex
    : MAGAZINE_CATEGORY_META.technology.hex;
  const ink = pickReadableInk(categoryHex);
  const isDarkInk = ink === '#1a1a1a';
  return (
    <div
      className="mag-page relative flex flex-col overflow-hidden"
      style={{
        background: 'var(--mag-category-color, var(--mag-brand-green, #2e4a3a))',
        color: ink,
      }}
    >
      {heroImage && (
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.55, mixBlendMode: 'luminosity' }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: isDarkInk
            ? 'linear-gradient(180deg,rgba(255,255,255,0.15) 0%,transparent 40%,rgba(255,255,255,0.35) 100%)'
            : 'linear-gradient(180deg,rgba(0,0,0,0.15) 0%,transparent 40%,rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* Top-left: logo do cliente em caixa branca */}
      <div className="relative flex items-start justify-between p-16">
        <div className="rounded-md bg-white p-4 shadow-sm">
          {magazine.branding.clientLogoUrl ? (
            <img
              src={magazine.branding.clientLogoUrl}
              alt={magazine.branding.clientName ?? 'Cliente'}
              className="h-24 w-56 object-contain"
            />
          ) : (
            <div
              className="flex h-24 w-56 items-center justify-center text-3xl font-black uppercase tracking-widest"
              style={{ color: 'var(--mag-category-color)', fontFamily: 'var(--mag-heading)' }}
            >
              {magazine.branding.clientName?.slice(0, 12) ?? 'PROMO'}
            </div>
          )}
        </div>

        {/* Top-right: subtítulo serif all-caps + ícone categórico */}
        <div className="flex flex-col items-end gap-4">
          <CategoryIcon
            category={magazine.branding.category ?? null}
            size={72}
            aria-hidden
            style={{ opacity: 0.9 }}
          />
          <div
            className="text-right text-4xl font-bold uppercase leading-tight tracking-[0.2em]"
            style={{ fontFamily: 'var(--mag-heading)' }}
          >
            {new Date().getFullYear()}<br />
            COLEÇÃO
          </div>
        </div>
      </div>

      {/* Título principal ao centro-inferior */}
      <div className="relative flex flex-1 flex-col justify-end p-16">
        <h1
          className="leading-[0.95]"
          style={{ fontFamily: 'var(--mag-heading)', fontSize: 220, letterSpacing: '-0.03em' }}
        >
          {magazine.title}
        </h1>
        {magazine.subtitle && (
          <p className="mt-8 max-w-[1400px] text-4xl opacity-90" style={{ fontFamily: 'var(--mag-body)' }}>
            {magazine.subtitle}
          </p>
        )}
      </div>

      {/* Script cursivo na base */}
      <div className="relative flex items-end justify-between p-16">
        <div className="text-2xl uppercase tracking-widest opacity-80" style={{ fontFamily: 'var(--mag-body)' }}>
          Promo Gifts · {new Date().getFullYear()}
        </div>
        <div
          className="mag-script leading-none"
          style={{ fontSize: 180, opacity: 0.95 }}
        >
          catálogo
        </div>
      </div>
    </div>
  );
}

/**
 * BackCoverPage — recipe da p.378 do Abreez: fundo verde categórico +
 * dotmap pattern + título "OBRIGADO" + info do cliente + contato.
 */
function BackCoverPage({ magazine }: { magazine: Magazine }) {
  return (
    <div
      className="mag-page relative flex flex-col items-center justify-center gap-10 overflow-hidden p-24 text-center text-white"
      style={{ background: 'var(--mag-category-color, var(--mag-brand-green, #2e4a3a))' }}
    >
      <div
        aria-hidden
        className="mag-dotmap-bg absolute inset-0 opacity-40"
      />
      <div className="relative">
        <div className="text-4xl uppercase tracking-[0.5em] opacity-90">Obrigado</div>
        <h2
          className="mt-6 text-8xl font-bold"
          style={{ fontFamily: 'var(--mag-heading)' }}
        >
          Fale com a Promo Gifts
        </h2>
        {magazine.branding.clientName && (
          <div className="mt-6 text-3xl opacity-90">
            Preparado exclusivamente para <strong>{magazine.branding.clientName}</strong>
          </div>
        )}
        <div className="mt-16 flex items-center justify-center gap-8 text-2xl uppercase tracking-widest opacity-80">
          <span>promogifts.com.br</span>
          <span aria-hidden>·</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * SectionPage — recipe da p.6 do Abreez: 3 colunas (4 imagens à esquerda,
 * moldura branca central, torre tipográfica vertical à direita).
 */
function SectionPage({ title }: { title: string }) {
  return (
    <div
      className="mag-page grid grid-cols-3 overflow-hidden"
      style={{ background: 'white' }}
    >
      {/* Coluna 1 — placeholder 4 imagens (produção real injeta fotos) */}
      <div className="grid grid-rows-4 gap-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="w-full"
            style={{
              background: `color-mix(in srgb, var(--mag-category-color) ${20 + i * 15}%, black)`,
            }}
          />
        ))}
      </div>

      {/* Coluna 2 — moldura branca central */}
      <div className="flex items-center justify-center p-8">
        <div
          className="flex h-4/5 w-full flex-col items-center justify-between p-8 text-center"
          style={{ border: '1px solid var(--mag-category-color)' }}
        >
          <div className="text-8xl opacity-70" style={{ color: 'var(--mag-category-color)' }}>◊</div>
          <div>
            <h2
              className="text-4xl font-bold leading-tight"
              style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-primary)' }}
            >
              {title}
            </h2>
          </div>
          <div
            className="text-lg uppercase tracking-[0.4em] opacity-60"
            style={{ fontFamily: 'var(--mag-body)' }}
          >
            Coleção
          </div>
        </div>
      </div>

      {/* Coluna 3 — torre tipográfica vertical */}
      <div className="flex items-center justify-center">
        <div
          className="text-7xl font-black uppercase leading-[0.9] tracking-[0.4em]"
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontFamily: 'var(--mag-heading)',
            color: 'var(--mag-category-color)',
          }}
        >
          {title.toUpperCase().slice(0, 20)}
        </div>
      </div>
    </div>
  );
}
