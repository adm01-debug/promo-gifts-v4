# Open Graph Image — Self-hosted

Este diretório deve conter:

## `/public/og-image.png`

- **Dimensões:** 1200 × 630 px (padrão Facebook/LinkedIn)
- **Peso máximo:** 200 KB (recomendado < 100 KB se usar WebP)
- **Conteúdo:** Branding Promo Gifts — tema galaxy/blue, logo, tagline
- **Formato:** PNG (com versão `og-image.webp` opcional)

## Como gerar

### Opção A — Screenshot da landing
1. Acessar `https://www.promogifts.com.br` em viewport 1920×1080.
2. Capturar área 1200×630 do hero/landing.
3. Otimizar com [squoosh.app](https://squoosh.app) ou:
   ```bash
   npx @squoosh/cli --webp '{"quality":82}' og-image.png
   npx @squoosh/cli --oxipng '{"level":6}' og-image.png
   ```

### Opção B — Design dedicado
1. Criar no Canva/Figma usando paleta atual:
   - Background: `#020617`
   - Brand primary: `#1e40af`
   - Brand glow: `#3b82f6`
   - Fonts: Outfit (display), Plus Jakarta Sans (texto)
2. Incluir: logo Promo Gifts + tagline "Catálogo Inteligente de Brindes Corporativos"
3. Exportar PNG 1200×630 → otimizar.

## Validação após upload

```bash
# 1. Smoke test do header
curl -I https://www.promogifts.com.br/og-image.png
# Esperado: HTTP/2 200 + Content-Type: image/png + Cache-Control imutável

# 2. Validador Facebook
# https://developers.facebook.com/tools/debug/?q=https%3A%2F%2Fwww.promogifts.com.br

# 3. Validador Twitter
# https://cards-dev.twitter.com/validator
```

## Cache headers

Já configurado em `vercel.json`:
```
Cache-Control: public, max-age=31536000, immutable
```

> **Status:** placeholder. Substituir por arquivo binário real antes do merge final.
