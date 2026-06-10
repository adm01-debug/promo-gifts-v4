# SPOT / Stricker — Catálogo Exaustivo de Campos de Produto (API / Webservice)

> **Fonte:** Webservice oficial Stricker `https://ws.spotgifts.com.br/api/v1SSL` (via `SPOT - MCP`) + cruzamento com os **3.612 SKUs já no Bronze** (`supplier_products_raw`).
> **Cliente:** 12869 · **Levantado:** jun/2026 (feeds ao vivo) · **Fill-rate:** calculado sobre os 3.612 SKUs do Bronze (snapshot Stricker `UpdateDate` ~12/2025).
> **Grão da base:** 1 linha = 1 SKU/variante (`{ProdReference}-{ColorCode}[-{Size}]`). 3.612 SKUs / 1.200 produtos-pai.

---

## 0. Os feeds e seus grãos

| Feed (MCP) | Grão | Chave | Conteúdo principal | Vol. aprox. | Limite/dia |
|---|---|---|---|---|---|
| `spot_ws_optionals_complete` | **Variante (SKU)** | `Sku` | **O feed-mãe**: ~230 campos — nome, cor, preço, descrição, físico, categorias, embalagem, personalização (8 posições), imagens, vídeo, tags | ~27 MB | 22 |
| `spot_ws_optionals` | Variante | `Sku` | Subconjunto do acima (cor, tamanho, capacidade, faixas de preço) | menor | 22 |
| `spot_ws_optionals_price` | Variante | `Sku` | Só faixas `MinQt/Price` | menor | 22 |
| `spot_ws_stocks` | **Variante (SKU)** | `Sku`/`WebSku` | **Estoque** + previsão de reposição (6 janelas) | ~3.612 linhas | 96 |
| `spot_ws_customization_tables` | **Código de tabela** | `TableCodeOption` | **Preço de personalização** por técnica (15 faixas + SLA + área máx.) | ~289 linhas | 22 |
| `spot_ws_customization_options` | Produto × posição | `ProdReference`+local | Possibilidades de impressão por produto (handling, hotspot, área) | ~36k / ~46 MB | 22 |
| `spot_ws_products_tree` | Produto-pai | `ProdReference` | Árvore: ref → SKUs → preços → opções de customização | grande | 22 |
| `spot_ws_colors` | Cor | `ColorCode` | 52 cores (código → descrição) | 52 | 22 |
| `spot_ws_product_types` | Tipo/subtipo | `TypeCode` | Taxonomia: 31 tipos com subtipos | 31 | 22 |
| `spot_ws_canceled_products` | Produto/SKU | ref | Descontinuados (para `is_active=false`) | — | 22 |
| `spot_get_stock_warehouses` *(site)* | Produto | `prod` | Estoque por armazém (público) | pequeno | — |

> **Regra de ouro:** quase tudo o que você pediu vem do **OptionalsComplete** (uma linha por SKU). As exceções são **estoque/reposição** (feed Stocks) e o **preço de personalização** (feed CustomizationTables). Cor e categoria têm tabelas de referência próprias (Colors, ProductTypes).

---

## 1. Mapa direto: o que você pediu → onde está

| Você pediu | Feed | Campo(s) | Exemplo real | Cobertura |
|---|---|---|---|---|
| **Nome** | OptionalsComplete | `Name` | `11103. Borracha branca em TPR` | 100% |
| **Variações** | OptionalsComplete | `Sku`/`WebSku` (variante), `ProdReference` (pai), `Multiplier` (múltiplo de venda) | `11110-105` / pai `11110` | 100% |
| **Cor** | OptionalsComplete + Colors | `ColorCode`, `ColorDesc1`, `ColorHex1` (+ `ColorDesc2`/`ColorHex2` p/ bicolor) | `103` · `Preto` · `#000000` | 100% (2ª cor: 0%) |
| **Valor R$** | OptionalsComplete | `MinQt1..15` / `Price1..15` (preço por faixa de qtd), `YourPrice` (preço líquido do distribuidor) | `Price1=0.342` (R$/un) | tier 1 a 5 ≥ 84%; `YourPrice` 9% |
| **Descrição** | OptionalsComplete | `Description`, `ShortDescription`, `SEOShortDescription` | `Borracha branca em TPR. Produto certificado…` | 100% |
| **Capacidade (ml)** | OptionalsComplete | `Capacity` (texto c/ unidade), `CapacityMah`, `CapacityGB` | `26 L`, `750 ml` | `Capacity` 21% (só onde aplica) |
| **Tamanho** | OptionalsComplete | `Size`, `SizeLengthCM`, `SizeWidthCM` (têxtil) · `CombinedSizes` (dimensões físicas) | `G` · 74×56 cm · `55 x 22 x 12 mm` | `Size` 18.7%; `CombinedSizes` 100% |
| **Peso** | OptionalsComplete | `Weight` (peso unit.), `BoxWeightKG` (peso caixa) · ⚠️ `WeightGr` = **gramatura têxtil** (g/m²), não peso | `Weight=1`; `BoxWeightKG=15` | 100% / 100% |
| **Estoque (variação)** | **Stocks** | `Quantity` | `1862` | feed dedicado |
| **Previsão de reposição (variação)** | **Stocks** | `NextQuantity1..6` + `NextDate1..6` (até 6 entradas futuras) · `NoReplenishment` (flag, no OptionalsComplete) | `NextQuantity1=500, NextDate1=2026-07-10` | feed dedicado |
| **Categorias** | OptionalsComplete + ProductTypes | `Type`/`TypeCode`, `SubType`/`SubTypeCode`, `Catalogs` | `Escrita`/`0031` · `Borrachas`/`1571` · `Stockout` | 100% / 99% |
| **Embalagem individual** | OptionalsComplete | `Packing`, `Repacking`, `BoxInnerQuantity`, `BoxQuantity`, `BoxVolume`, `BoxSizeM`, `Box{Length/Width/Height}MM`, `BoxWeightKG` | `Polybag` · `Sem polybag` · inner `20` · caixa `500` | 100% (Repacking 77%) |
| **Técnicas que o produto tem** | OptionalsComplete | `CustomizationTypes` (lista) + `CustomizationTypes1..8` (por posição) + `CustomizationDefaultType` | `Silk Screen, Tampografia, Laser, Transfer…` | 99.7% |
| **Valores de personalização** | **CustomizationTables** | `Price1..15` por `MinQt1..15` + `PriceByColor/Area/Stitches` + `Sla1..14` | TRS1-01-01: 1un=R$95 → 10000un=R$0,30 | feed dedicado |
| **Tamanhos de personalização** | OptionalsComplete + CustomizationTables | `Area1..8` (área de cada local, mm) + `TableMaxAreaCM`/`TableMaxAreaCM2` (área máx. da tabela) | `45 x 10` mm · `4 x 3` cm / `12` cm² | 99.7% |
| **Imagens (todos os tipos)** | OptionalsComplete | `MainImage`, `AllImageList`, `OptionalImage1/2`, `Area{n}Image`, `Component{n}Image`, `Location{n}Image`, `BoxImage`, `PouchImage`, `BagImage` + URL pattern (§7) | `11103_103.jpg` | Main/All 100% |
| **Vídeos** | OptionalsComplete | `VideoLink` (YouTube), `VideoLinkVimeo`, `Video360` | `https://youtu.be/hfmdUxZ6Kp8` | `VideoLink` 9.1% |
| **Tags** | OptionalsComplete | `KeyWords`, `Properties`, `Certificates`, `Catalogs`, flags `IsTextil`/`IsStockOut`/`NewProduct`/`PvcFree`/`OnlineExclusive`/`IsSeasonal` | `borrachas, kit escrita…` · `LED, Carregador wireless` | KeyWords 98.7% |
| **Extras úteis** | OptionalsComplete | `Brand`, `CountryOfOrigin`, `Materials`, `Taric` (NCM/HS), `Composition`, `CertificateFiles`, `RelatedReferences`, `InkColor`, `BatteryType`, `UpdateDate` | `hi!dea™` · `China` · `TPR` · `4016.92.00` | ver §2 |

---

## 2. Feed-mãe OptionalsComplete — catálogo completo de campos

Fill-% = % dos 3.612 SKUs com o campo **preenchido** (não vazio).

### 2.1 Identidade / SKU
| Campo | Fill% | Exemplo |
|---|---|---|
| `Sku` | 100 | `11103-103` |
| `WebSku` | 100 | `11103-103` |
| `ProdReference` (produto-pai) | 100 | `11103` |
| `Multiplier` (múltiplo de venda) | 100 | `1` |
| `UpdateDate` | 100 | `12/15/2025 14:18:54` |
| `AvailableGross` | 100 | `true` |

### 2.2 Nome / descrição / SEO
| Campo | Fill% | Exemplo |
|---|---|---|
| `Name` | 100 | `11103. Borracha branca em TPR` |
| `ShortDescription` | 100 | `Borracha branca em TPR. Produto certificado…` |
| `Description` | 100 | (descrição longa) |
| `SEOName` | 100 | `11103` |
| `SEOShortDescription` | 100 | `11103. Borracha branca em TPR` |
| `SEOShortDescriptionCap` | 100 | `11103. BORRACHA BRANCA EM TPR` |

### 2.3 Cor
| Campo | Fill% | Exemplo |
|---|---|---|
| `ColorCode` | 100 | `103` |
| `ColorDesc1` | 100 | `Preto` |
| `ColorHex1` | 100 | `#000000` |
| `HasColors` | 100 | `true` |
| `ColorDesc2` / `ColorHex2` (bicolor) | 0 | `Cromado satinado` / — |

### 2.4 Preço (faixas por quantidade)
| Campo | Fill% | Exemplo |
|---|---|---|
| `MinQt1` / `Price1` | 100 / 100 | `1` / `0.342` |
| `MinQt2` / `Price2` | 90.8 | `510` / `2.09` |
| `MinQt3` / `Price3` | 90.8 | `2550` / `2.06` |
| `MinQt4` / `Price4` | 90.8 | `10100` / `2.04` |
| `MinQt5` / `Price5` | 84.6 | `1050` / `18.21` |
| `MinQt6..10` / `Price6..10` | 0 | (não usados no BR) |
| `YourPrice` (preço líquido distribuidor) | 9.2 | `0.342` |
| `Multiplier` | 100 | `1` |

> O preço do produto tem **até 5 faixas ativas** na operação BR. `YourPrice` (preço já com seu desconto de distribuidor) só vem preenchido em ~9% — para os demais, calcula-se a partir de `Price{n}` × condição comercial.

### 2.5 Físico / dimensões / peso
| Campo | Fill% | Exemplo |
|---|---|---|
| `CombinedSizes` (dimensões do produto) | 100 | `55 x 22 x 12 mm` |
| `Weight` (peso unitário) | 100 | `1` |
| `BoxWeightKG` | 100 | `15` |
| `BoxLengthMM` / `BoxWidthMM` / `BoxHeightMM` | 100 | `0.39` / `0.22` / `0.34` |
| `BoxVolume` | 100 | `0.029` |
| `BoxSizeM` (string LxWxH) | 99.8 | `0.390X0.220X0.340` |
| ⚠️ `WeightGr` (**gramatura têxtil**, g/m²) | 9.0 | `80 g/m²` |

### 2.6 Capacidade
| Campo | Fill% | Exemplo |
|---|---|---|
| `Capacity` (texto + unidade) | 21.1 | `26 L`, `750 ml` |
| `CapacityMah` (bateria) | 45.5 | `0` (valor real só p/ powerbanks) |
| `CapacityGB` (memória) | 78.0 | `0` (valor real só p/ pen drives) |
| `HasCapacitys` | 100 | ⚠️ sempre `false` — **não confiável**, use `Capacity` |

### 2.7 Tamanho (têxtil)
| Campo | Fill% | Exemplo |
|---|---|---|
| `Size` | 18.7 | `G` |
| `SizeLengthCM` | 18.7 | `74` |
| `SizeWidthCM` | 18.7 | `56` |
| `HasSizes` | 100 | `false` |

### 2.8 Categorias / taxonomia
| Campo | Fill% | Exemplo |
|---|---|---|
| `Type` / `TypeCode` | 100 | `Escrita` / `0031` |
| `SubType` / `SubTypeCode` | 100 / 99.1 | `Borrachas` / `1571` |
| `Catalogs` (catálogos comerciais) | 100 | `Stockout`, `SPOT`, `Our Nature`, `Novidades`, `Últimas Chegadas` |

### 2.9 Embalagem / logística
| Campo | Fill% | Exemplo |
|---|---|---|
| `Packing` | 58.8 | `Polybag` |
| `Repacking` | 76.8 | `Sem polybag` |
| `BoxInnerQuantity` (qtd embalagem interna) | 100 | `20` |
| `BoxQuantity` (qtd caixa master) | 100 | `500` |

### 2.10 Personalização — 8 posições (blocos repetidos `{n}` = 1..8)
Cada produto expõe até 8 posições de impressão. Fill-% por posição:

| Posição `n` | Fill% (Area{n}) |
|---|---|
| 1 | 99.7 |
| 2 | 86.8 |
| 3 | 64.3 |
| 4 | 51.9 |
| 5 | 35.6 |
| 6 | 30.1 |
| 7 | 24.5 |
| 8 | 22.4 |

Campos por posição `n`:
| Campo | O que é | Exemplo |
|---|---|---|
| `Area{n}` | Tamanho da área de impressão (mm) | `45 x 10` |
| `Component{n}` | Componente do produto | `Borracha`, `Bateria portátil` |
| `Location{n}` | Local no componente | `Superior`, `Verso` |
| `ComposedLocation{n}` | Componente + local | `Borracha - Superior` |
| `CustomizationTypes{n}` | Técnica(s) disponíveis nessa posição | `Silk Screen`, `Laser, Tampografia` |
| `MaxColors{n}` | Máx. de cores | `1` |
| `HandlingCosts{n}` | Custo de manuseio | `0.0` |
| `TableCodes{n}` | Código(s) de técnica | `SCR1`, `LSR1, PDP2` |
| `TableFullCode{n}` | Código completo da tabela | `SCR1-01` |
| `TableCodesOptions{n}` | Opções de tabela aplicáveis | `TRS1-01-01, TRS1-01-02, …` |
| `Area{n}Image` | Imagem da zona (picotado) | `11103_1_1_1.png` |
| `Component{n}Image` | Imagem do componente | `11103_103_C1.png` |
| `Location{n}Image` | Imagem do local | `11103_103_C1_L1.png` |

**Resumo de personalização (nível produto):**
| Campo | Fill% | Exemplo |
|---|---|---|
| `CustomizationTypes` (todas as técnicas) | 99.7 | `Silk Screen` |
| `CustomizationTables` / `CustomizationTableOptions` | 99.7 | `SCR1-01` / `SCR1-01-01` |
| `CustomizationDefaultType` / `CustomizationDefaultTable` | 94.2 | `Silk Screen` / `SCR1-01-01` |
| `DefaultCustomization` (descrição padrão) | 94.2 | `Borracha - Superior (Silk Screen - 45 x 10)` |
| `ProductComponents` / `ProductComponentLocations` / `ProductComposedLocations` | 99.7 | `Borracha` / `Superior` / `Borracha - Superior` |
| `MaxColors` (global) | 41.6 | `1` |
| `DefaultCustomizationHandlingCosts` | 100 | `0` |

### 2.11 Imagens
| Campo | Fill% | Exemplo |
|---|---|---|
| `MainImage` | 100 | `11103_103.jpg` |
| `AllImageList` (lista CSV) | 100 | `11103_103.jpg` |
| `OptionalImage1` | 99.5 | `11103_103.jpg` |
| `BoxImage` | 13.1 | `51162_160-box.jpg` |
| `PouchImage` | 2.9 | `51348_103-pouch.jpg` |
| `Area{n}Image` / `Component{n}Image` / `Location{n}Image` | ver §2.10 | png da zona/componente/local |
| `BagImage`, `OptionalImage2`, `AditionalImageList` | 0 | — |

### 2.12 Vídeos
| Campo | Fill% | Exemplo |
|---|---|---|
| `VideoLink` (YouTube) | 9.1 | `https://youtu.be/hfmdUxZ6Kp8` |
| `VideoLinkVimeo` | 0 | — |
| `Video360` | 0 | — |

### 2.13 Tags / propriedades / flags
| Campo | Fill% | Exemplo |
|---|---|---|
| `KeyWords` | 98.7 | `91917, borrachas, kit escrita, kits de escrita…` |
| `Properties` | 57.2 | `Fornecido em caixa de oferta, LED, Carregador wireless` |
| `Certificates` | 61.3 | `Ftalatos, EN71` |
| `IsTextil` | 100 | `false` |
| `IsStockOut` | 100 | `true` |
| `NewProduct` | 100 | `false` |
| `PvcFree` | 100 | `false` |
| `OnlineExclusive` | 100 | `false` |
| `IsSeasonal` | 100 | `false` |
| `NoReplenishment` | 100 | `false` |

### 2.14 Origem / fiscal / materiais / outros
| Campo | Fill% | Exemplo |
|---|---|---|
| `Brand` | 100 | `hi!dea™` (tb. Branve, Ekston, Cerruti 1881) |
| `CountryOfOrigin` | 97.5 | `China` |
| `Materials` | 96.0 | `TPR` |
| `Taric` (NCM/HS) | 100 | `4016.92.00` |
| `CertificateFiles` | 67.3 | `cert_30500.zip` |
| `RelatedReferences` (relacionados) | 67.2 | `22901, 22905, 22906, 22907` |
| `Composition` | 1.6 | `Componentes entregues em separado` |
| `InkColor` | 1.7 | `Preto` |
| `BatteryType` | 0.8 | `Inclui 2 pilhas AAA` |

### 2.15 Campos 100% vazios no acervo BR (reservados/outros mercados)
`AditionalImageList`, `BagImage`, `ColorDesc2`, `ColorHex2`, `Gender`, `MaxHandlingCost`, `MinQt6..10`, `Price6..10`, `OptionalImage2`, `OtherDetails`, `PaperGramage`, `PaperSize`, `ProductCare`, `RefillType`, `SeasonalStartDate`, `SeasonalEndDate`, `SeasonalOccasion`, `Video360`, `VideoLinkVimeo`.

---

## 3. Feed Stocks — estoque e reposição (por SKU)

`spot_ws_stocks(ref=…)` → exemplo real (SKU `11110-105`):

| Campo | Tipo | Exemplo | Significado |
|---|---|---|---|
| `Sku` / `WebSku` | string | `11110-105` | Chave da variante |
| `Quantity` | int | `1862` | **Estoque disponível agora** |
| `NextQuantity1..6` | int/null | `null` | Qtd das próximas 6 entradas de reposição |
| `NextDate1..6` | date/"" | `""` | Data de cada entrada futura |
| `Country` | string/null | `null` | País do estoque |

---

## 4. Feed CustomizationTables — preço de personalização

`spot_ws_customization_tables(ref="TRS1")` → técnica **Transfer**, 24 opções. Estrutura:

| Campo | Exemplo | Significado |
|---|---|---|
| `CustomizationTypeName` | `Transfer` | Nome da técnica |
| `TableCode` / `TableCodeOption` / `TableFullcode` | `TRS1-01` / `TRS1-01-01` / `TRS1-01` | Códigos |
| `PriceByColor` / `PriceByArea` / `PriceByStitches` | `true` / `false` / `false` | **Modelo de cobrança** |
| `MaxColors` | `1` | Máx. de cores dessa opção |
| `TableMaxAreaCM` / `TableMaxAreaCM2` | `4 x 3` / `12` | **Área máx. de gravação** |
| `MinQt1..15` / `Price1..15` | `1`→`95` … `10000`→`0,30` | **15 faixas de preço (R$)** |
| `Sla1..14` | `2`,`3`,`5`… | Prazo de produção (dias) |

**Exemplo de curva (TRS1-01-01, 1 cor, área 4×3 cm):**
1un R$95 · 2 R$47,25 · 5 R$18,90 · 10 R$9,45 · 25 R$4,41 · 50 R$3,05 · 100 R$1,70 · 250 R$0,88 · 500 R$0,58 · 1000 R$0,44 · 5000 R$0,32 · 10000 R$0,30.

---

## 5. Feed CustomizationOptions (documentado via spec)

> ⚠️ Requer aprovação manual no cliente MCP. Campos conforme documentação do webservice:

| Campo | Significado |
|---|---|
| `ProdReference` | Produto |
| `ServiceCode` | Código do serviço de personalização |
| `Component` / `Location` | Componente e local de impressão |
| `HandlingCost` | Custo de manuseio da combinação |
| `TableCode` / `TableMaxAreaCM2` | Tabela de preço aplicável + área máx. |
| `HotSpot` | Coordenadas do ponto de impressão (editor visual) — **dado exclusivo deste feed** |
| `MinQt1..15` / `Price` | Faixas de preço |

---

## 6. Tabelas de referência

### 6.1 Cores — `spot_ws_colors` (52)
Exemplos: `103 Preto`, `106 Branco`, `104 Azul`, `114 Azul royal`, `109 Verde`, `105 Vermelho`, `108 Amarelo`, `113 Cinza`, `160 Natural`, `110 Transparente`, `107 Cromado`, `117 Dourado`, `100 Sortido`

> ⚠️ **Códigos legados duplicados:** `03`/`103` = "Preto", `13`/`124` = "Azul claro", `61`/`110` = "Transparente". Normalizar no de-para (`supplier_colors`).

### 6.2 Tipos / categorias — `spot_ws_product_types` (31 tipos)
Famílias principais: `Escrita`, `Escritório`, `Tecnologia`, `Squeezes & Copos`, `Casa/Restaurante & Bar`, `Mochilas/Malas & Pastas`, `Sacolas & Bolsas Térmicas`, `Pessoal & Viagem`, `Chaveiros & Porta-cartões`, `Criança & Escolar`, `Esporte & Ar Livre`, `Sol & Chuva`, `Agendas`, `Máscaras`, `SUCO` (têxtil/T-Shirts, TypeCode 23), `Stockout`, `Últimas Chegadas`, `Exclusivos`.

> ⚠️ **Dois esquemas de código coexistem:** novo (`0028`–`0040`) e legado (`2`–`12`). Ex.: "Escrita" = `0031` **e** `2`. Mapear ambos para a categoria canônica.

---

## 7. Padrões de URL de imagem (todos os tipos)

**Base:** `https://www.spotgifts.com.br/fotos/produtos/`

| Tipo | Padrão | Exemplo |
|---|---|---|
| Produto (cor + vista) | `{iderp}_{cor}-{view}.jpg` | `81198_103-box.jpg` |
| Principal / lista | valor de `MainImage` / `AllImageList` | `11103_103.jpg` |
| Caixa | `{iderp}_{cor}-box.jpg` (`BoxImage`) | `51162_160-box.jpg` |
| Pouch / saco | `{iderp}_{cor}-pouch.jpg` (`PouchImage`) | `51348_103-pouch.jpg` |
| Componente | `{iderp}_{cor}_C{n}.png` (`Component{n}Image`) | `11104_105_C1.png` |
| Local | `{iderp}_{cor}_C{n}_L{n}.png` (`Location{n}Image`) | `11104_105_C1_L2.png` |
| Zona de impressão (picotado) | `picotado/{prod}/{iderp}_{comp}_{loc}_{view}.png` | `picotado/1824/81198_1_1_1.png` |

> Os campos trazem só o **nome do arquivo**; a URL completa = base + nome.

---

## 8. Gotchas para o ETL (resumo)

1. **`HasCapacitys` é sempre `false`** — não use como flag; confie em `Capacity` (texto) não-vazio.
2. **`CapacityMah`/`CapacityGB` vêm "0"** na maioria; valor real só para powerbanks/pen drives.
3. **`WeightGr` ≠ peso** — é **gramatura têxtil** (`80 g/m²`). Peso unitário é `Weight`.
4. **`Weight=1`** é ambíguo — para frete, prefira `BoxWeightKG`/`BoxVolume`.
5. **Mojibake** em alguns textos (`Ã˜`→`Ø`) — sanitizar UTF-8 na padronização.
6. **`BoxSizeM`** usa metros como string com casing misto — usar `Box*MM` numéricos.
7. **Cores e tipos têm códigos legados duplicados** — normalizar no de-para.
8. **`YourPrice` esparso (9%)** — fallback via `Price{n}` + condição comercial.
9. **Só 5 faixas de preço ativas** no BR (`6..10` vazias).
10. **`Catalogs`** define o agrupamento comercial (SPOT, Our Nature, Novidades, Últimas Chegadas, Stockout).

---

## 9. Cobertura do acervo (snapshot Bronze)

- **3.612 SKUs** / **1.200 produtos-pai** / **49 cores** em uso / **18 categorias** ativas / **151 subtipos**.
- Marcas: `hi!dea™`, `Branve`, `Ekston`, `Cerruti 1881` (entre outras).
- Têxteis (`IsTextil=true`): ~**683** SKUs. Com vídeo (`VideoLink`): ~**9%**.
- *Snapshot reflete dados Stricker de ~dez/2025 (`UpdateDate`).*

---

## 10. Onde cada feed aterra no Bronze (arquitetura atual)

| Feed | Destino no Bronze | RPC de gravação |
|---|---|---|
| OptionalsComplete | `supplier_products_raw.raw_data` (1 linha/SKU) | `insert_supplier_product_raw` |
| Stocks | `supplier_products_raw.stock_data` (mesma linha do SKU) | `upsert_supplier_stock_raw` |
| CustomizationTables | `supplier_customization_raw` (1 linha/`table_code_option`) | `upsert_supplier_customization_raw` |
| Colors | de-para `supplier_colors` | (mapeamento) |
| ProductTypes | de-para `supplier_category_mappings` | (mapeamento) |
| CanceledProducts | varredura → `status='skipped'` / `is_active=false` | (sweep no fim do lote) |
| CustomizationOptions | *(opcional — HotSpot p/ editor)* | a definir |

---

*Documento gerado a partir dos feeds ao vivo do webservice SPOT (jun/2026) + enumeração de campos sobre os 3.612 SKUs no Bronze. Cliente 12869.*  
*Repo: `adm01-debug/promo-gifts-v4` · `medallion/fornecedores/SPOT/SPOT_CATALOGO_CAMPOS_API.md`*
