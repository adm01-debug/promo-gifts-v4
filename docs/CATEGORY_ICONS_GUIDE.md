# Sistema de Ícones de Categorias

> **Última atualização:** 2026-06-22  
> **Versão:** 4.0 (pós-migração completa Emoji → Lucide + 48 correções)

## Arquitetura

```
DB: category_icons.icon (text, nome PascalCase Lucide)
              ↓ useCategoryIcons() hook (React Query, 30min stale)
              ↓ getCategoryIcon(name, icons) — 4-pass pipeline
              ↓ CategoryIcon.tsx — ICON_MAP lookup → SVG ou <span>
```

## Pipeline de Resolução (getCategoryIcon)

| Pass | Fonte | Exemplo |
|------|-------|----------|
| 1 | Busca exata em `category_icons` | "Canecas" → `Coffee` |
| 2 | Busca parcial (contém) | "Canecas \| Vidro" → `Coffee` |
| 3 | `KEYWORD_ICONS` (mapa estático) | "caneca" → `Coffee` |
| 4 | Primeira palavra no banco | "Kit" → busca no banco |
| - | Fallback | `📦` (emoji Package) |

## ICON_MAP — Referência completa

### Bebidas / Bar / Gourmet
| Ícone | Uso principal |
|-------|---------------|
| `Coffee` | Canecas, xícaras, café, chá, chimarrão, cuia, terere |
| `Wine` | Taças, vinho, caipirinha, gin, espumante, coqueteleira |
| `Beer` | Cerveja, tulipa, chopp |
| `GlassWater` | Copos, cantil, bebidas genéricas |
| `ChefHat` | Fondue, queijo, gourmet, artigos culinários premium |
| `Utensils` | Talheres, bowl, petisqueira, pizza, tabuleiro |
| `Flame` | Churrasco, velas aromáticas |

### Tecnologia
| Ícone | Uso principal |
|-------|---------------|
| `Smartphone` | Celular, suporte de celular |
| `Laptop` | **Mochila notebook** (bolsa para notebook) |
| `Monitor` | Desktop, tela |
| `Cpu` | Tecnologia genérica, eletrônicos |
| `Mouse` | Mouse pad, desk pad |
| `Keyboard` | Teclado, **apoio de teclado** |
| `Headphones` | Fone de ouvido |
| `Speaker` | **Caixa de som** |
| `HardDrive` | Pen drive, HD externo |
| `Battery` | Powerbank, carregador portátil |
| `Plug` | Cabos, adaptadores |
| `Zap` | Massageador elétrico, elétrico genérico |

### Papelaria / Escritório
| Ícone | Uso principal |
|-------|---------------|
| `Pen` | Canetas (genérico) |
| `PenLine` | Canetas premium, porta-caneta |
| `Pencil` | Lápis, lapiseiras |
| `Notebook` | Cadernos, blocos, cadernetas, **Bambu\|Cortiça** |
| `BookOpen` | Livros, catálogos |
| `Calendar` | Agendas, calendários |
| `ClipboardList` | Papelaria genérica |
| `Calculator` | Calculadoras |
| `Paperclip` | Clipes, prendedores |

### Bolsas / Acessórios / Viagem
| Ícone | Uso principal |
|-------|---------------|
| `Backpack` | Mochilas (todas exceto Notebook e Anti-furto) |
| `ShoppingBag` | Necessaire, frasqueira, pochete |
| `Briefcase` | Kit executivo, pasta trabalho |
| `Wallet` | Carteiras |
| `Luggage` | **Malas**, bolsas de viagem, kit viagem |

### Vestuário / Calçados
| Ícone | Uso principal |
|-------|---------------|
| `Shirt` | Camisetas, roupas, jaquetas |
| `Glasses` | Óculos de sol, óculos |
| `Layers` | **Toalhas** (banho, rosto, praia, fitness), **roupões**, mantas, cobertores |

### Ferramentas
| Ícone | Uso principal |
|-------|---------------|
| `Wrench` | Ferramentas genéricas, chave, alicate |
| `Hammer` | Martelo |
| `Ruler` | Trenas, réguas |
| `Scissors` | Cutelaria, facas, escovas, pentes (grooming) |
| `Flashlight` | **Lanternas** |
| `Lamp` | **Luminárias**, abajur |
| `Key` | Chaveiros |
| `Pin` | Pins, bottons, broches |
| `Lock` | **Mochila anti-furto**, segurança |

### Esportes / Bem-estar
| Ícone | Uso principal |
|-------|---------------|
| `Dumbbell` | Academia, fitness, **lazer**, corrida, calçados esportivos |
| `Trophy` | Troféus, premiações |
| `Award` | Premiações, placas, certificados |
| `Medal` | Medalhas |
| `Crown` | Premium, première, VIP, **Chaveiros Premium** |
| `Star` | Genérico premium |
| `CircleDot` | Esportes de bola: **futebol**, **vôlei**, basquete |
| `Umbrella` | **Guarda-chuva**, **guarda-sol** |

### Relógios / Tempo
| Ícone | Uso principal |
|-------|---------------|
| `Watch` | Relógio de pulso (analógico, digital) |
| `Clock` | **Relógio de parede** |
| `AlarmClock` | **Relógio de mesa**, despertador |

### Jogos / Entretenimento
| Ícone | Uso principal |
|-------|---------------|
| `Gamepad2` | Jogos eletrônicos |
| `Dices` | Dominó, dados, jogos de tabuleiro |

### Saúde / Beleza
| Ícone | Uso principal |
|-------|---------------|
| `Sparkles` | Espelhos, maquiagem, beleza, **maleta de maquiagem** |
| `Pill` | **Porta-comprimido**, farmácia |
| `Heart` | Saúde genérico, bem-estar, massageador |
| `Droplets` | Higiene, banho, spa, balde de gelo |
| `Thermometer` | **Térmicos**: garrafa, bolsa, caixa, sacola, cooler |

### Natureza / Eco
| Ícone | Uso principal |
|-------|---------------|
| `Leaf` | Eco genérico, madeira eco, couro eco, **Erva Mate** |
| `Sprout` | **Agro**, kit cultivo, **lápis semente** |
| `Recycle` | Sacolas ecobag, reciclados |
| `TreePine` | Bambu, madeira, floresta, **Bambu\|Cortiça** |
| `Sun` | Chapéus, praia, verão, **viseiras** |
| `Flower2` | Flores, vasos, plantas |

### Pet
| Ícone | Uso principal |
|-------|---------------|
| `PawPrint` | TUDO de pet: cama, coleira, ração, brinquedo, **bebedouro**, **comedouro**, **kit higiene** |

### Casa / Decoração
| Ícone | Uso principal |
|-------|---------------|
| `Home` | Casa genérico, decoração |
| `Image` | **Porta-retrato**, quadros, fotos |
| `Car` | **Veículos**, automotivo |

### Embalagens / Geral
| Ícone | Uso principal |
|-------|---------------|
| `Package` | Embalagens, marmitas, caixas (default) |
| `Circle` | Porta-copos (items circulares) |
| `Gift` | Brindes corporativos (Sicoob, Sicredi, Unimed, Cresol) |
| `Tag` | Acessórios genéricos, bonés, lenços, **placas** |
| `CreditCard` | Crachás, cordão de crachá, identificação |

---

## Correções realizadas (histórico)

### Fase 1 — Migração Emoji → Lucide (412 registros, commit f425e552)
Todos os 412 registros convertidos de emojis para nomes PascalCase.

### Fase 2 — 32 Correções Semânticas (commit 0519c137, bugfix f49d0360)

| Categoria | Era | Virou |
|-----------|-----|-------|
| Lanternas | Droplets | **Flashlight** |
| Luminárias | Droplets | **Lamp** |
| Calculadoras | Notebook | **Calculator** |
| Porta Comprimido | Package | **Pill** |
| Malas | ShoppingBag | **Luggage** |
| Óculos de Sol | Star | **Glasses** |
| Futebol | CircleDot | CircleDot (corrigido) |
| Vôlei | CircleDot | CircleDot (corrigido) |
| Veículos | Package | **Car** |
| Mochila Anti Furto | Backpack | **Lock** |
| Guarda Chuva | Droplets | **Umbrella** |
| Guarda Sol | Droplets | **Umbrella** |
| Garrafa Térmica | GlassWater | **Thermometer** |
| Garrafas \| Isotérmica | GlassWater | **Thermometer** |
| Bolsa Térmica | Droplets | **Thermometer** |
| Caixa \| Térmica | Package | **Thermometer** |
| Coolers | Droplets | **Thermometer** |
| Agro | Leaf | **Sprout** |
| Kit Cultivo | Gift | **Sprout** |
| Lápis Semente | Pencil | **Sprout** |
| Tecnologia \| Eletrônicos | Smartphone | **Cpu** |
| Mochila Notebook | Backpack | **Laptop** |
| Porta \| Retrato | Package | **Image** |
| Relógios \| Mesa | Clock | **AlarmClock** |
| Relógio \| Parede \| Plástico | Watch | **Clock** |
| Relógios \| Parede | Watch | **Clock** |
| Viseiras | Sun | Sun (corrigido) |
| Acessórios | Watch | **Tag** |
| Chaveiros \| Premium | Star | **Crown** |
| Motivacional \| Premiações | Trophy | Trophy (corrigido) |
| Mochila Executiva | Package | **Backpack** |
| Manta \| Mini Cobertor | Droplets | **Layers** |

### Fase 3 — 17 Correções Adicionais (sessão 2026-06-22)

| Categoria | Era | Virou | Motivo |
|-----------|-----|-------|--------|
| Bebedouro \| Pet | Droplets | **PawPrint** | É produto pet |
| Comedouros \| Pet | Utensils | **PawPrint** | É produto pet |
| Kit Higiene \| Pet | Sparkles | **PawPrint** | É produto pet |
| Mochila Esportiva | Dumbbell | **Backpack** | É mochila |
| Caixa de Som | Headphones | **Speaker** | Caixa ≠ fone |
| Apoio Teclado | Mouse | **Keyboard** | Suporte de teclado |
| Sacola Térmica | Recycle | **Thermometer** | É bolsa térmica |
| Térmicos \| Costúraveis | Droplets | **Thermometer** | Produto térmico |
| Lazer | Droplets | **Dumbbell** | Lazer = esporte |
| Bambu \| Cortiça | Notebook | **TreePine** | Material eco |
| Maleta \| Maquiagem | Briefcase | **Sparkles** | É maleta de make |
| Kit Toalha | Droplets | **Layers** | Toalha = camadas |
| Roupão \| Atoalhado | Droplets | **Layers** | Roupão = camadas |
| Roupão \| Microfibra | Droplets | **Layers** | Roupão = camadas |
| Toalha \| Banho | Droplets | **Layers** | Toalha = camadas |
| Toalha \| Rosto | Sparkles | **Layers** | Toalha = camadas |
| Toalhas \| Praia | Droplets | **Layers** | Toalha = camadas |

---

## Como adicionar um novo ícone

1. Verificar se o ícone existe em [lucide.dev](https://lucide.dev)
2. **VERIFICAR VERSÃO**: confirmar que existe em `lucide-react ^0.309.0`
   - Consultar: https://github.com/lucide-icons/lucide/releases
   - Ícones adicionados após v0.309 **NÃO** podem ser importados
   - Exemplo de exclusão: `Beef` (adicionado em v0.357, incompativel)
3. Adicionar import em `src/components/ui/CategoryIcon.tsx`
4. Adicionar entrada no `ICON_MAP` de `CategoryIcon.tsx`
5. Atualizar `category_icons` no banco:
   ```sql
   UPDATE category_icons SET icon = 'NomeDoIcone'
   WHERE category_name = 'Nome da Categoria';

   UPDATE categories SET icon = 'NomeDoIcone'
   WHERE name = 'Nome da Categoria';
   ```
6. Atualizar `KEYWORD_ICONS` em `useCategoryIcons.ts` se necessário
   - Keywords **compostas** (multi-palavra) devem ficar na seção `COMPOSTOS` (topo do arquivo)
   - Isso garante que `'kit viagem'` seja checado antes de `'kit'`
7. Documentar neste guia

---

## Estado atual do banco (2026-06-22)

```
category_icons: 412/412 registros — 100% Lucide PascalCase válido
Ícones únicos:  66
Divergelcias:   0 (categories.icon = category_icons.icon em 100%)
Smoke tests:    30/30 PASS
Build Vercel:   Passando (commit fb6afb1)
```

### Distribuição dos grupos principais

| Ícone | Qtd | Principal uso |
|-------|-----|---------------|
| Coffee | 45 | Canecas, chimarrão, café/chá |
| Wine | 38 | Taças, vinho, caipirinha |
| Utensils | 26 | Talheres, bowl, petisqueiras |
| Leaf | 19 | Produtos eco |
| ChefHat | 17 | Fondue, queijo, gourmet |
| GlassWater | 16 | Copos, cantil |
| Backpack | 13 | Mochilas |
| Notebook | 13 | Cadernos, blocos |
| PawPrint | 11 | Tudo pet |
| Dumbbell | 11 | Esportes, lazer |
| Tag | 11 | Bonés, acessórios genéricos |

---

## Queries úteis

```sql
-- Verificar integridade
SELECT COUNT(*), COUNT(*) FILTER (WHERE icon !~ '^[A-Z][a-zA-Z0-9]+$') AS invalidos
FROM category_icons;

-- Categorias por ícone
SELECT icon, COUNT(*) AS qtd,
       array_agg(category_name ORDER BY category_name) AS categorias
FROM category_icons GROUP BY icon ORDER BY qtd DESC;

-- Divergencias entre tabelas
SELECT c.name, c.icon AS cat_icon, ci.icon AS ci_icon
FROM categories c
JOIN category_icons ci ON lower(trim(ci.category_name)) = lower(trim(c.name))
WHERE c.icon != ci.icon;

-- Smoke tests
SELECT * FROM fn_run_smoke_tests() WHERE result NOT LIKE '%PASS%';
```
