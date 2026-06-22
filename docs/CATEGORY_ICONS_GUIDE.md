# Guia de Ícones de Categoria — Promo Gifts v4

> **Data:** 2026-06-22 | **Versão:** 2.0 | **lucide-react:** ^0.309.0

---

## 1. Visão Geral

O sistema usa **ícones SVG Lucide** para representar as categorias de produtos nos badges da UI.
A migração foi feita em 22/06/2026, substituindo os emojis anteriores por componentes vetoriais consistentes e profissionais.

### Por que Lucide e não emoji?

| Aspecto | Emoji | Lucide SVG |
|---------|-------|------------|
| Renderização | Fonte do OS (Windows ≠ Mac ≠ Android) | Idêntico em qualquer plataforma |
| Tamanho | Irregular (cada emoji é diferente) | Controlado por `size` prop |
| Cor | Não aceita CSS | Herda `color`/`stroke` |
| Acessibilidade | Varia por leitor de tela | `aria-hidden` padronizado |
| Bundle | Zero (texto Unicode) | Tree-shaking (import individual) |

---

## 2. Arquitetura do Sistema

```
DB: category_icons.icon (text — nome Lucide PascalCase)
              │
              ▼
  getCategoryIcon(name, icons)  ← useCategoryIcons() hook
  [4-pass fuzzy match → string]
              │
              ▼
    <CategoryIcon value="Coffee" size={14} />
              │
       ICON_MAP lookup
              │
     ┌───────┴───────┐
     │               │
  Found in map   Not found
     │               │
  <Coffee />    <span>emoji</span>
    (SVG)        (fallback legado)
```

### Arquivos-chave

| Arquivo | Papel |
|---------|-------|
| `src/components/ui/CategoryIcon.tsx` | Componente + ICON_MAP (todos os ícones) |
| `src/hooks/products/useCategoryIcons.ts` | Hook React Query + `getCategoryIcon()` + KEYWORD_ICONS |
| `src/components/products/ProductCategoryBadges.tsx` | Usa CategoryIcon nos badges do produto |
| Banco: `category_icons` | Fonte de verdade — 412 registros |
| Banco: `categories.icon` | Campo sincronizado de `category_icons` |

---

## 3. Tabela Completa de Mapeamentos

> **Pesquisa rápida:** CTRL+F + nome da categoria ou tipo de produto.

### 3.1 Bar / Bebidas / Gourmet

| Ícone Lucide | Categorias cobertas | Palavras-chave |
|-------------|--------------------|-----------------|
| `Coffee` | Canécas, Xícaras, Café, Chá, Chimarrão, Cuia, Mateira | caneca, xícara, café, chá, chimarrão, cuia, tereré, erva |
| `Wine` | Taças, Kit Vinho, Kit Caipirinha, Kit Drink, Coqueteleira, Espumante | taça, vinho, caipirinha, gin, drink, coquetel, shakeira |
| `Beer` | Tulipa, Porta Garrafa Cerveja | cerveja, tulipa, chopp |
| `GlassWater` | Copos (todos os tipos) | copo, cantil |
| `ChefHat` | Fondue, Queijo, Kit Gourmet | fondue, queijo, gourmet |
| `Flame` | Kit Churrasco, Velas Aromáticas | churrasco, vela |
| `Utensils` | Talheres, Bowl, Petisqueira, Pizza, Comedouros Pet | tábua, talher, bowl, petisqueira, pizza, alimentos |

### 3.2 Tecnologia / Eletrônicos

| Ícone Lucide | Categorias cobertas | Palavras-chave |
|-------------|--------------------|-----------------|
| `Cpu` | Tecnologia / Eletrônicos (genérico) | tecnologia |
| `Laptop` | Mochila Notebook | notebook, laptop |
| `Monitor` | Desktop, Monitor | — |
| `Mouse` | Mouse Pad, Desk Pad, Apoio Teclado | mouse |
| `Keyboard` | Teclado | teclado |
| `Smartphone` | Celular, Suporte | celular, smartphone |
| `Headphones` | Fone de Ouvido | fone |
| `Speaker` | Caixa de Som | caixa de som |
| `HardDrive` | Pen Drive | pendrive |
| `Battery` | Carregador Portátil (Powerbank) | carregador, powerbank |
| `Plug` | Cabos, Adaptadores | cabo |
| `Zap` | Massageador Elétrico, itens elétricos gerais | elétrico |

### 3.3 Papelaria / Escritório

| Ícone Lucide | Categorias cobertas | Palavras-chave |
|-------------|--------------------|-----------------|
| `PenLine` | Canetas, Porta-Caneta | caneta |
| `Pencil` | Lápis, Lapiseiras | lápis, lapiseira |
| `Notebook` | Cadernos, Cadernetas, Blocos, Tipo Moleskine, Papelaria | caderno, bloco, papelaria |
| `Calendar` | Agendas, Calendários | agenda, calendário |
| `Calculator` | Calculadoras | calculadora |
| `Paperclip` | Clips | clips |
| `ClipboardList` | Papelaria genérica (fallback) | — |

### 3.4 Bolsas / Acessórios / Viagem

| Ícone Lucide | Categorias cobertas | Palavras-chave |
|-------------|--------------------|-----------------|
| `Backpack` | Mochilas (todos os tipos) | mochila, sacochila |
| `Luggage` | Malas, Bolsas de Viagem, Kit Viagem, Viagem | mala, viagem |
| `Briefcase` | Kit Executivo, Pasta Trabalho | pasta, executivo |
| `ShoppingBag` | Necessaire, Frasqueira, Pochete | necessaire, frasqueira, pochete |
| `Wallet` | Carteiras | carteira |
| `Recycle` | Sacolas Ecobag (todos os tipos) | sacola, ecobag |

### 3.5 Vestuário / Calçados

| Ícone Lucide | Categorias cobertas | Palavras-chave |
|-------------|--------------------|-----------------|
| `Shirt` | Camisetas, Roupas, Colete, Jaqueta, Moletão | camisa, camiseta, roupa |
| `Glasses` | Óculos de Sol | óculos |
| `Dumbbell` | Calçados Esportivos, Chinelos, Sandálias, Botinas | calçado, chinelo, botina, sandália |
| `Sun` | Chapéus (Palha, Juta, Ecoflex), Guarda-Sol, Viseiras | chapéu, viseira |
| `Tag` | Bonés, Lenços, Echarpe, Cachecol | boné, lenço, echarpe |
| `Layers` | Mantas, Cobertores, Toalhas | manta, cobertor, toalha |

### 3.6 Ferramentas

| Ícone Lucide | Categorias cobertas | Palavras-chave |
|-------------|--------------------|-----------------|
| `Flashlight` | Lanternas | lanterna |
| `Lamp` | Luminárias | luminária, lâmpada |
| `Key` | Chaveiros (todos) | chaveiro, mosquetão |
| `Pin` | Pins, Bottons, Broches | pin, botton, broche |
| `Lock` | Mochila Anti Furto | anti furto, cadeado |
| `Wrench` | Ferramentas, Chaveiros Multi Funcional | ferramenta, alicate |
| `Hammer` | Martelo | martelo |
| `Ruler` | Trenas | trena |
| `Scissors` | Cutelaria, Facas, Canivetes, Escovas/Pentes | faca, cutelaria, canivete, escova |

### 3.7 Esportes / Bem-Estar / Relógios

| Ícone Lucide | Categorias cobertas | Palavras-chave |
|-------------|--------------------|-----------------|
| `Dumbbell` | Academia, Fitness, Corrida, Shakeira | academia, fitness, corrida |
| `CircleDot` | Futebol, Vôlei (esportes de bola) | bola, futebol, vôlei, basquete |
| `Umbrella` | Guarda-Chuva, Guarda-Sol | guarda-chuva, chuva |
| `Watch` | Relógio de Pulso | pulso, pulseira |
| `Clock` | Relógio de Parede | relógio (genérico) |
| `AlarmClock` | Relógio de Mesa, Despertador | despertador, mesa |
| `Trophy` | Motivacional, Premiações | troféu |
| `Award` | Placas, Certificados | placa, certificado |
| `Medal` | Medalhas | medalha |
| `Crown` | Premium, Canetas Premium | premium, vip |

### 3.8 Saúde / Beleza / Higiene

| Ícone Lucide | Categorias cobertas | Palavras-chave |
|-------------|--------------------|-----------------|
| `Sparkles` | Espelhos, Kit Maquiagem, Beleza, Festas | espelho, maquiagem, festas |
| `Pill` | Porta Comprimido | comprimido, remédio |
| `Heart` | Saúde genérico, Massageadores, Bebê | saúde, massageador, bebê |
| `Droplets` | Higiene, Banho, Kit Spa, Baldes, Roupão | banho, spa |
| `Thermometer` | Garrafa Térmica, Bolsa Térmica, Caixa Térmica, Coolers | térmica, cooler |

### 3.9 Natureza / Eco / Agro

| Ícone Lucide | Categorias cobertas | Palavras-chave |
|-------------|--------------------|-----------------|
| `Sprout` | Agro, Kit Cultivo, Lápis Semente | agro, cultivo, semente, broto |
| `Leaf` | Ecológico genérico, Canetas Eco, Couro Ecológico | eco, ecológico, madeira |
| `Recycle` | Sacola Ecobag | reciclado, ecobag |
| `TreePine` | Bambu, Madeira, Cortiça | bambu, madeira, cortiça |
| `Flower2` | Plantas, Vasos, Porta Perfume | planta, vaso, flor |

### 3.10 Pet / Casa / Outros

| Ícone Lucide | Categorias cobertas | Palavras-chave |
|-------------|--------------------|-----------------|
| `PawPrint` | TUDO de pet: cama, coleira, ração, casinha, brinquedo, identificador | pet, cachorro, gato, coleira |
| `Image` | Porta-Retrato, Quadros | retrato, quadro |
| `Home` | Casa genérico | casa |
| `CreditCard` | Crachá, Credencial, Cordão de Crachá | crachá, credencial |
| `Car` | Veículos, Acessórios Automotivos | veículo, carro, auto |
| `Gift` | Brindes (Sicredi, Cresol, Unimed) | brinde, presente |
| `Package` | Embalagens, Caixas, Marmitas, Etojos (default) | embalagem, caixa, marmita |
| `Star` | Chaveiros Premium (star genérico) | estrela |
| `Circle` | Porta-Copo (itens circulares) | porta-copo |

---

## 4. Como Adicionar um Novo Ícone

### Passo a passo

1. **Pesquise** o ícone em https://lucide.dev — use o nome exato (PascalCase)
2. **Verifique** se está disponível em lucide-react ^0.309.0
3. **Adicione o import** em `CategoryIcon.tsx`:
   ```tsx
   import { NomeDoIcone } from 'lucide-react';
   ```
4. **Adicione ao ICON_MAP** em `CategoryIcon.tsx`:
   ```tsx
   NomeDoIcone, // breve descrição da categoria
   ```
5. **Adicione ao KEYWORD_ICONS** em `useCategoryIcons.ts` (se novo tipo de produto):
   ```ts
   'palavra-chave': 'NomeDoIcone',
   ```
6. **Atualize o banco** via SQL no Supabase:
   ```sql
   UPDATE category_icons SET icon = 'NomeDoIcone'
   WHERE category_name IN ('Categoria Exata 1', 'Categoria Exata 2');
   ```
7. **Atualize esta tabela** na seção 3 acima
8. **Sync** `categories.icon` (opcional mas recomendado):
   ```sql
   UPDATE categories c SET icon = ci.icon
   FROM category_icons ci
   WHERE lower(ci.category_name) = lower(c.name);
   ```

### Checklist

- [ ] Import adicionado em CategoryIcon.tsx
- [ ] Entrada no ICON_MAP
- [ ] KEYWORD_ICONS atualizado (se necessário)
- [ ] `category_icons` atualizado no banco
- [ ] `categories.icon` sincronizado
- [ ] Esta doc atualizada (seção 3)

---

## 5. Boas Práticas de Seleção de Ícone

### Regra de ouro: o ícone deve ser reconhecível em 14px

| ✅ Bom match | ❌ Match ruim |
|-------------|---------------|
| `Coffee` para canecas | `Package` para canecas |
| `Luggage` para malas | `Briefcase` para malas |
| `Pill` para porta comprimido | `Heart` para porta comprimido |
| `Flashlight` para lanternas | `Zap` para lanternas |
| `Glasses` para óculos | `Sparkles` para óculos |
| `CircleDot` para futebol | `Circle` para futebol |
| `AlarmClock` para rel. mesa | `Watch` para rel. mesa |

### Prioridade de correspondência

1. **Objeto exato** → `Pill`, `Beer`, `Umbrella`
2. **Objeto similar** → `Coffee` para chimarrão (não tem mate)
3. **Função/uso** → `Dumbbell` para calçados esportivos
4. **Domínio** → `PawPrint` para tudo que for pet
5. **Genérico** → `Package` como último recurso

### Ícones a evitar como genérico

| Ícone | Motivo |
|-------|--------|
| `Tag` | Visualmente fraco; use apenas para acessórios sem ícone melhor |
| `Heart` | Reserve para saúde/bem-estar; não use em "qualquer coisa" |
| `Circle` | Reserve para porta-copo e itens literalmente circulares |
| `Star` | Reserve para prêmios ou "chaveiro premium" sem opção melhor |
| `Package` | Só como fallback final — indica que falta mapeamento |

---

## 6. Ícones Disponíveis no ICON_MAP

> Todos esses nomes são válidos em `category_icons.icon`:

```
AlarmClock  Award       Backpack    Battery    Beer        Beef
BookOpen    Briefcase   Calculator  Calendar   Car         ChefHat
Circle      CircleDot   ClipboardList Clock    Coffee      Cpu
CreditCard  Crown       Dices       Droplets   Dumbbell    Flame
Flashlight  Flower2     Gamepad2    Gift       Glasses     GlassWater
Hammer      HardDrive   Headphones  Heart      Home        Image
Key         Keyboard    Lamp        Laptop     Layers      Leaf
Lock        Luggage     Medal       Monitor    Mouse       Notebook
Package     Paperclip   PawPrint    Pen        PenLine     Pencil
Pill        Pin         Plug        Recycle    Ruler       Scissors
Shirt       ShoppingBag Smartphone  Sparkles   Speaker     Sprout
Star        Sun         Tag         Thermometer TreePine   Trophy
Umbrella    Utensils    Wallet      Watch      Wine        Wrench
Zap
```

**Total: 60 ícones mapeados** (lucide-react ^0.309.0)

---

## 7. Queries SQL Úteis

```sql
-- Ver estado atual de todos os ícones
SELECT icon, COUNT(*) as qtd,
       array_agg(category_name ORDER BY category_name) as categorias
FROM category_icons
GROUP BY icon ORDER BY qtd DESC;

-- Verificar % de migração para Lucide
SELECT
  COUNT(*) FILTER (WHERE icon ~ '^[A-Z][a-z]') AS lucide_svg,
  COUNT(*) FILTER (WHERE icon !~ '^[A-Z][a-z]') AS emoji_legado,
  ROUND(COUNT(*) FILTER (WHERE icon ~ '^[A-Z][a-z]') * 100.0 / COUNT(*), 1) AS pct
FROM category_icons;

-- Categorias sem match no DB (usam KEYWORD_ICONS como fallback)
SELECT name, icon FROM categories
WHERE name NOT IN (SELECT category_name FROM category_icons WHERE is_active = true)
ORDER BY name;

-- Sync categories.icon a partir de category_icons
UPDATE categories c
SET icon = ci.icon
FROM category_icons ci
WHERE lower(trim(ci.category_name)) = lower(trim(c.name))
  AND ci.icon IS NOT NULL
  AND ci.icon != COALESCE(c.icon, '');
```

---

## 8. Histórico de Migrações

| Data | Versão | O que mudou |
|------|--------|-------------|
| 2026-06-22 | 2.0 | Migração completa: 412/412 emojis → Lucide. Bug "bottle" corrigido. CategoryIcon.tsx criado. |
| 2026-06-22 | 2.1 | 17 novos ícones adicionados ao ICON_MAP. 32 correções semânticas no banco. Doc criada. |
| — | 1.0 | Sistema original com emojis em text simples via `<span>` |

---

## 9. Referências

- Pesquisa de ícones: https://lucide.dev
- Changelog lucide-react: https://github.com/lucide-icons/lucide/releases
- Banco (Supabase): https://supabase.com/dashboard/project/doufsxqlfjyuvxuezpln/editor — tabela `category_icons`
- Código: `src/components/ui/CategoryIcon.tsx`
- Hook: `src/hooks/products/useCategoryIcons.ts`
