# CompanyListAvatar — SSOT do avatar de empresa em listas

`src/components/shared/CompanyListAvatar.tsx` é o **único ponto de entrada**
para renderizar a logo de uma empresa em qualquer listagem do app
(Carrinhos, Orçamentos, Clientes, etc.). Ele encapsula:

- **Tamanho responsivo:** `lg` (40px) no desktop, `md` (32px) em `< sm`,
  evitando overflow em telas pequenas sem quebrar a altura da linha.
- **Ring padrão:** `ring-1 ring-border` embutido.
- **Fallback:** iniciais + `Building2` quando não há `logoUrl` — herdado
  do `AvatarLogo` base.

> ⚠️ **Não importe `AvatarLogo` direto** em `src/pages/**` nem em
> componentes `*List*` / `*Cell*` / `*Row*`. Existe regra ESLint
> `no-restricted-imports` que bloqueia o import e aponta para este wrapper.

## Uso padrão (responsivo — lg desktop / md mobile)

```tsx
import { CompanyListAvatar } from '@/components/shared/CompanyListAvatar';

<CompanyListAvatar
  name={cart.company_name}
  logoUrl={cart.company_logo_url}
/>
```

## Override: forçar tamanho fixo

Reservado para exceções (ex.: card compacto que nunca muda). Aceita apenas
`md` ou `lg` — outros tamanhos exigem discussão de design antes de virarem
variantes.

```tsx
// Fixo em 32px (nunca cresce no desktop)
<CompanyListAvatar name="Acme" logoUrl={url} size="md" />

// Fixo em 40px (nunca encolhe no mobile — só se você tiver certeza)
<CompanyListAvatar name="Acme" logoUrl={url} size="lg" />
```

## Override: className extra

`className` é anexado *depois* do preset — use para opacidade, animação,
margens, etc. **Não** use para tentar mudar `w-*` / `h-*` (isso é o papel
da prop `size`).

```tsx
<CompanyListAvatar
  name="Acme"
  logoUrl={url}
  className="opacity-50 transition-opacity hover:opacity-100"
/>
```

## Estado de loading

```tsx
<CompanyListAvatar
  name={quote.client_name}
  logoUrl={quote.logo_url}
  isLoading={logoLoading}
/>
```

## Precisa de um tamanho novo?

Adicione a variante em `CompanyListAvatar.tsx` **e** exponha via prop
`size`. Depois migre todos os call-sites — não faça override inline com
`className="w-12 h-12"`.

## Regra ESLint

Bloco dedicado em `eslint.config.js` restringe imports de `AvatarLogo`
em:

- `src/pages/**/*.{ts,tsx}`
- `src/components/**/*List*.{ts,tsx}`
- `src/components/**/*Cell*.{ts,tsx}`
- `src/components/**/*Row*.{ts,tsx}`

Ficam de fora: o próprio wrapper, a implementação base, testes.

## Testes

`src/components/shared/__tests__/CompanyListAvatar.responsive.test.tsx`
cobre: `md`, `lg`, default responsivo (`lg` + `max-sm:!w-8`),
preservação de `className` extra e render com `logoUrl`.
