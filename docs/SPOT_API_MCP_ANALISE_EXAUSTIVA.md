# Análise Exaustiva — API/MCP Spot (Stricker)

> **Gerado em:** 2026-06-06  
> **Última validação:** 2026-06-06 (exaustiva — todos os tipos de produto)  
> **Produtos de exemplo usados:**  
> - `51102` — KISO (caneta esferográfica em plástico)  
> - `94550` — SHOW (garrafa térmica aço inox 510 mL)  
> - `30511` — GOIABA WOMEN WH (camiseta feminina têxtil)  
> - `66190` — SPECT A5 (agenda em tecido poliéster)  
> **Status API:** Conectada ✅  
> **Limite diário:** 22 chamadas/dia (feeds gerais) | 96 chamadas/dia (stocks)

---

## Índice

1. [Feeds / Endpoints Disponíveis](#1-feeds--endpoints-disponíveis)
2. [Campos — Produto-Pai](#2-campos--produto-pai-products--productstree)
3. [Campos — Variante](#3-campos--variante-optionals--optionalscomplete)
4. [Campos — Estoque](#4-campos--estoque-stocks)
5. [Personalização — Localizações e Técnicas](#5-personalização--localizações-e-técnicas)
6. [Personalização — Preços Detalhados](#6-personalização--preços-detalhados-customizationoptions)
7. [Tabelas Genéricas de Personalização](#7-tabelas-genéricas-de-personalização-customizationtables)
8. [Imagens — Tipologia Completa](#8-imagens--tipologia-completa)
9. [Vídeos](#9-vídeos)
10. [Cores — Catálogo Completo (52 cores)](#10-cores--catálogo-completo-52-cores)
11. [Categorias — 31 Tipos Principais](#11-categorias--31-tipos-principais-e-subtypes)
12. [Exemplo Real — Caneta KISO 51102](#12-exemplo-real--caneta-kiso-51102)
13. [Exemplo Real — Garrafa SHOW 94550](#13-exemplo-real--garrafa-show-94550)
14. [Exemplo Real — Preços de Personalização](#14-exemplo-real--preços-de-personalização-51102)
15. [Exemplo Real — Têxtil GOIABA WOMEN 30511](#15-exemplo-real--têxtil-goiaba-women-30511)
16. [Exemplo Real — Agenda SPECT A5 66190](#16-exemplo-real--agenda-spect-a5-66190)
17. [Limitações e Campos Ausentes](#17-limitações-e-campos-ausentes)
18. [Mapa Completo de Campos](#18-mapa-completo-de-campos-síntese)
19. [Recomendações de Uso](#19-recomendações-de-uso)

---

## 1. Feeds / Endpoints Disponíveis

| Feed | Ferramenta MCP | Limite/dia | Volume | Obs |
|---|---|---|---|---|
| `products` | `spot_ws_products` | 22 | ~1.200 produtos | Produto-pai com dados gerais |
| `optionals` | `spot_ws_optionals` | 22 | ~3.612 variantes | Variantes com preços e localiz. de impressão |
| `optionalscomplete` | `spot_ws_optionals_complete` | 22 | ~27 MB bulk | ⭐ **Mais completo** — pai + variante + personaliz. |
| `optionalsPrice` | `spot_ws_optionals_price` | 22 | — | Preços focados por variante |
| `productsTree` | `spot_ws_products_tree` | 22 | — | Árvore aninhada completa (componentes/locais) |
| `stocks` | `spot_ws_stocks` | **96** | ~3.612 SKUs | Estoque em tempo quase-real |
| `colors` | `spot_ws_colors` | 22 | 52 cores | Tabela de cores com código e nome |
| `productTypes` | `spot_ws_product_types` | 22 | 31 tipos | Categorias e subcategorias |
| `customizationOptions` | `spot_ws_customization_options` | 22 | ~35.936 / ~46 MB | Preços detalhados de personalização por produto |
| `customizationTables` | `spot_ws_customization_tables` | 22 | — | Tabelas genéricas de preço por técnica |
| `canceledproducts` | `spot_ws_canceled_products` | 22 | — | Produtos removidos do catálogo |
| Download bulk | `spot_ws_download` | — | — | Todos os feeds em json/csv/xml via AccessKey |
| Status WS | `spot_ws_status` | — | — | AccessKey, token cache, contadores diários |
| Busca site | `spot_search_products` | pública | 5 resultados | Busca por texto no catálogo |
| Estoque por armazém | `spot_get_stock_warehouses` | — | — | ⚠️ Requer sessão logada |
| Personalizações HTML | `spot_get_personalizations` | — | — | ⚠️ Requer sessão logada (`prod` + `iderp`) |
| Produtos relacionados | `spot_get_related` | — | — | HTML de relacionados por IDs |

---

## 2. Campos — Produto-Pai (`products` / `productsTree`)

### 2.1 Identificação e Nomenclatura

| Campo | Tipo | Exemplo (caneta) | Exemplo (garrafa) | Obs |
|---|---|---|---|---|
| `ProdReference` | string | `"51102"` | `"94550"` | **Chave primária** do produto |
| `Name` | string | `"KISO. Esferográfica"` | `"SHOW. Garrafa térmica..."` | Nome completo |
| `SEOName` | string | `"KISO"` | `"SHOW"` | Nome curto / nome de linha/marca |
| `Description` | string | `"Esferográfica em ABS com acabamento brilhante... ø11 x 136 mm"` | `"Garrafa térmica em aço inox... (510 mL)"` | Descrição longa; **inclui dimensões** |
| `ShortDescription` | string | `"Esferográfica em ABS com acabamento brilhante..."` | — | Descrição curta (sem dimensões) |
| `SEOShortDescription` | string | `"KISO. Esferográfica"` | — | Descrição SEO curta |
| `SEOShortDescriptionCap` | string | `"KISO. ESFEROGRÁFICA"` | — | Versão em caps para SEO |
| `Brand` | string | `"hi!dea™"` | — | Marca do produto |
| `KeyWords` | string | `"81102, esferográfica, caneta, canetas..."` | — | Tags / palavras-chave para SEO (CSV) |
| `UpdateDate` | string | `"12/17/2025 09:24:27"` | — | Data da última atualização no sistema Spot |

### 2.2 Código Fiscal

| Campo | Tipo | Exemplo | Obs |
|---|---|---|---|
| `Taric` | string | `"96081000"` | **NCM / Código Taric** — crucial para NF |

### 2.3 Categorização

| Campo | Tipo | Exemplo (caneta) | Exemplo (garrafa) | Obs |
|---|---|---|---|---|
| `Type` | string | `"Escrita"` | `"Squeezes & Copos"` | |
| `TypeCode` | string | `"0031"` | `"10"` | |
| `SubType` | string | `"Esferográficas em Plástico"` | `"Garrafas"` | |
| `SubTypeCode` | string | `"0134"` | `"1010"` | |
| `Catalogs` | string | `"Stockout,Stockout"` | — | Catálogos em que o produto aparece |
| `IsSeasonal` | bool | `false` | — | |
| `SeasonalOccasion` | string | `""` | — | Ex: "Natal", "Dia dos Pais" |
| `SeasonalStartDate` | string | `""` | — | |
| `SeasonalEndDate` | string | `""` | — | |
| `OnlineExclusive` | bool | `false` | — | Exclusivo para venda online |
| `NewProduct` | bool | `false` | — | Marcado como novo no catálogo |
| `IsStockOut` | bool | `true` | — | Produto em situação de stockout |

### 2.4 Dimensões Físicas do Produto

| Campo | Tipo | Exemplo (caneta) | Exemplo (garrafa) | Obs |
|---|---|---|---|---|
| `CombinedSizes` | string | `"ø11 x 136 mm"` | `"ø67 x 255 mm \| Caixa: 75 x 75 x 275 mm"` | Dimensões produto (e caixa quando disponível) |
| `Weight` | number | `1` | `334` | **Peso unitário em gramas** |
| `WeightGr` | string | `""` | `""` | Sempre vazio — usar `Weight` |

### 2.5 Dimensões da Embalagem de Embarque (Caixa Mestra)

| Campo | Tipo | Exemplo (caneta) | Exemplo (garrafa) | Obs |
|---|---|---|---|---|
| `BoxLengthMM` | number | `0.63` | — | Comprimento em **metros** (nome engana) |
| `BoxWidthMM` | number | `0.3` | — | Largura em **metros** |
| `BoxHeightMM` | number | `0.16` | — | Altura em **metros** |
| `BoxSizeM` | string | `"0.63x0.30x0.16"` | `"0.400X0.400X0.300"` | Dimensões formatadas (metros) |
| `BoxWeightKG` | number | `9.62` | `8.9` | Peso bruto da caixa em KG |
| `BoxVolume` | number | `0.03` | — | Volume em m³ |
| `BoxQuantity` | number | `0` | — | Quantidade por caixa mestra |
| `BoxInnerQuantity` | number | `50` | — | Quantidade por caixa interna |
| `Multiplier` | number | `1` | — | Múltiplo mínimo de pedido |

### 2.6 Material, Composição e Origem

| Campo | Tipo | Exemplo (caneta) | Exemplo (garrafa) | Obs |
|---|---|---|---|---|
| `Materials` | string | `""` | `"Aço inox"` | Material principal |
| `Composition` | string | `""` | `""` | Composição detalhada (geralmente vazio) |
| `CountryOfOrigin` | string | `""` | `""` | País de origem (frequentemente vazio) |
| `PvcFree` | bool | `false` | — | Livre de PVC |
| `IsTextil` | bool | `false` | — | É produto têxtil |
| `Properties` | string | `"Escrita a azul"` | — | Propriedades funcionais |
| `ProductCare` | string | `""` | — | Instruções de cuidado |

### 2.7 Embalagem Individual

| Campo | Tipo | Exemplo (caneta) | Exemplo (garrafa) | Obs |
|---|---|---|---|---|
| `Packing` | string | `""` | `"Polybag"` / `"Bolsa"` | Tipo de embalagem individual |
| `Repacking` | string | `""` | — | Reembalagem disponível |

### 2.8 Certificações

| Campo | Tipo | Exemplo | Obs |
|---|---|---|---|
| `Certificates` | string | `"MSDS"` | Nome(s) dos certificados |
| `CertificateFiles` | string/null | `null` | Nome do arquivo de certificado (ex: `"cert_30511.zip"`); geralmente null |

### 2.9 Campos Específicos por Tipo de Produto

| Campo | Tipo de produto | Exemplo preenchido | Obs |
|---|---|---|---|
| `Capacitys` | Garrafas/Copos | `"510 mL"` / `"560 mL"` | Capacidades disponíveis no produto-pai |
| `Sizes` | Têxteis | `"S, M, L, XL"` | Tamanhos disponíveis |
| `CapacityMah` | Baterias/Power Banks | `""` | Capacidade em mAh — **campo existe mas pode estar vazio** |
| `CapacityGB` | USB / Flash | `"0"` | Capacidade em GB — valor `"0"` quando não aplicável |
| `RefillType` | Canetas | `""` | Tipo de recarga |
| `BatteryType` | Eletrônicos | `""` | Tipo de bateria |
| `InkColor` | Canetas | `""` | Cor da tinta |
| `PaperSize` | Agendas/Blocos | `""` | ⚠️ **Sempre vazio na prática** — ver `Description`/`Properties` |
| `PaperGramage` | Agendas/Blocos | `""` | ⚠️ **Sempre vazio na prática** — gramagem está na `Description` ("70 g/m²") |
| `OtherDetails` | Todos | `""` | Detalhes adicionais |
| `Gender` | Têxteis | `""` | ⚠️ **Campo sempre vazio** mesmo em têxteis femininos — não confiável |

### 2.10 Flags de Variação

| Campo | Tipo | Exemplo | Obs |
|---|---|---|---|
| `HasColors` | bool | `true` | Produto tem variações de cor |
| `HasSizes` | bool | `false` | Produto tem variações de tamanho |
| `HasCapacitys` | bool | `false` | Produto tem variações de capacidade |
| `Colors` | string | `"Azul, Azul claro, Preto, Transparente, Verde, Vermelho"` | Lista de cores disponíveis |
| `AvailableGross` | bool | `true` | Disponível para compra sem personalização |
| `DefaultCustomizationIncludedInPrice` | bool | `false` | Personalização padrão já incluída no preço |

### 2.11 Preços (Produto-Pai / `productsTree`)

| Campo | Tipo | Obs |
|---|---|---|
| `YourPrice` | number | Preço para o revendedor na menor quantidade |
| `ScalePrices[]` | array | Lista de `{MinQt, Price, Sla}` — até 10 faixas |
| `ScalePrices[].MinQt` | number | Quantidade mínima da faixa |
| `ScalePrices[].Price` | number | Preço por unidade nessa faixa |
| `ScalePrices[].Sla` | string/null | SLA em dias úteis |
| `PriceByCapacity` | null | Preço varia por capacidade (campo reservado) |

### 2.12 Personalização — Resumo no Produto-Pai

| Campo | Tipo | Exemplo | Obs |
|---|---|---|---|
| `CustomizationTypes` | string | `"Tampografia, Silk Screen Circular"` | Técnicas disponíveis (CSV) |
| `CustomizationDefaultType` | string | `"Silk Screen Circular"` | Técnica padrão |
| `CustomizationTables` | string | `"PDP1-01, SRC1-01"` | Tabelas de preço disponíveis |
| `CustomizationDefaultTable` | string | `"SRC1-01-01"` | Tabela/opção padrão |
| `CustomizationTableOptions` | string | `"PDP1-01-01, PDP1-01-02, PDP1-01-03, SRC1-01-01"` | Todas as opções disponíveis |
| `CustomizationDefault` | string | `"Esferográfica - Corpo (Silk Screen Circular - 40 x 25)"` | Descrição da personalização padrão |
| `CustomizationDefaultTableMaxColors` | number | `0` | Max cores da tabela padrão (0 = sem limite fixo) |
| `DefaultCustomizationHandlingCosts` | number | `0` | Custo de manuseio da personaliz. padrão |
| `DefaultCustomizationPrintingLines` | string | `"51102_1_1_1.png"` | Imagem com guia visual de impressão |
| `CustomizationTablesMaxColors` | string | `"3, 1"` | Max cores por tabela (no `productsTree`) |
| `CustomizationTableOptionsMaxColors` | string | `"1, 2, 3, 1"` | Max cores por opção |
| `CustomizationTableOptionsHandlingCosts` | string | — | Custos de manuseio por opção |
| `ProductComponents` | string | `"Esferográfica"` | Componentes imprimíveis |
| `ProductDefaultComponent` | string | `"Esferográfica"` | Componente padrão |
| `ProductComponentLocations` | string | `"Corpo, Clipe"` | Localizações disponíveis |
| `ProductComponentDefaultLocation` | string | `"Corpo"` | Localização padrão |
| `ProductComponentDefaultLocationAreaMM` | string | `"40 x 25"` | Área padrão em mm |
| `ProductComposedLocations` | string | `"Esferográfica - Corpo, Esferográfica - Clipe"` | Localizações compostas |

### 2.13 Imagens (Produto-Pai)

| Campo | Tipo | Exemplo | Obs |
|---|---|---|---|
| `MainImage` | string | `"51102_set.jpg"` | Imagem principal do produto |
| `BoxImage` | string | `""` | Imagem da caixa de embalagem |
| `BagImage` | string | `""` | Imagem do saco |
| `PouchImage` | string | `""` | Imagem da bolsa |
| `AditionalImageList` | string/null | `null` | Imagens adicionais (CSV) |
| `AllImageList` | string | `"51102_set.jpg, 51102_103.jpg, 51102_104.jpg..."` | **Todas** as imagens do produto (CSV) |

### 2.14 Vídeos (Produto-Pai)

| Campo | Tipo | Obs |
|---|---|---|
| `Video360` | string | Link de vídeo 360° (frequentemente vazio) |
| `VideoLink` | string | Link YouTube (frequentemente vazio) |
| `VideoLinkVimeo` | string | Link Vimeo (frequentemente vazio) |

### 2.15 Produtos Relacionados e Status Geral

| Campo | Tipo | Obs |
|---|---|---|
| `RelatedReferences` | string | Referências de produtos relacionados (CSV) |
| `CertificateFiles` | string/null | Nome do arquivo de certificado; geralmente null |
| `NoReplenishment` | bool | `false` = haverá reposição; `true` = descontinuado |

---

## 3. Campos — Variante (`optionals` / `optionalscomplete`)

### 3.1 Identificação da Variante

| Campo | Tipo | Exemplo (regular) | Exemplo (têxtil) | Obs |
|---|---|---|---|---|
| `Sku` | string | `"51102-103"` | `"30511-106-G"` | SKU completo da variante |
| `WebSku` | string | `"51102-103"` | `"30511-106-G"` | SKU web (geralmente igual ao `Sku`) |
| `ProdReference` | string | `"51102"` | `"30511"` | Referência do produto-pai |

> ⚠️ **FORMATO DO SKU É DIFERENTE POR TIPO:**  
> - **Produtos regulares:** `{ProdReference}-{ColorCode}` → ex: `"51102-103"`  
> - **Têxteis** (`IsTextil=true`): `{ProdReference}-{ColorCode}-{Size}` → ex: `"30511-106-G"`  
> O mesmo padrão de 3 partes aparece no feed `stocks`. **Crucial para o JOIN entre feeds.**

### 3.2 Cor (até 2 cores por variante)

| Campo | Tipo | Exemplo | Obs |
|---|---|---|---|
| `ColorCode` | string | `"103"` | Código da cor |
| `ColorDesc1` | string | `"Preto"` | Nome da cor 1 |
| `ColorHex1` | string | `"#000000"` | Hex da cor 1 |
| `ColorDesc2` | string | `""` | Nome da cor 2 (em produtos bicolor) |
| `ColorHex2` | string | `""` | Hex da cor 2 |

### 3.3 Tamanho e Capacidade

| Campo | Tipo | Exemplo (caneta) | Exemplo (garrafa) | Exemplo (têxtil) | Obs |
|---|---|---|---|---|---|
| `Size` | string | `""` | `""` | `"G"` / `"M"` / `"P"` / `"GG"` | Tamanho; preenchido em `IsTextil=true` |
| `Capacity` | string | `""` | `"510 mL"` | `""` | **Capacidade da variante** (garrafas/copos) |
| `SizeLengthCM` | number/null | `null` | `null` | `64` (tamanho G) | **Comprimento em cm — preenchido em têxteis** |
| `SizeWidthCM` | number/null | `null` | `null` | `47` (tamanho G) | **Largura em cm — preenchido em têxteis** |
| `CombinedSizes` | string | `"ø11 x 136 mm"` | `"ø67 x 255 mm..."` | `"Tamanhos: P, M, G, GG"` | Herdado do pai; em têxteis lista tamanhos |

> **Medidas por tamanho (têxtil 30511-GOIABA):**  
> P = 60×41 cm | M = 62×44 cm | G = 64×47 cm | GG = 66×50 cm  
> Cada variante-tamanho tem seus próprios valores de `SizeLengthCM`/`SizeWidthCM`.

### 3.4 Preços da Variante (até 10 faixas)

| Campo | Tipo | Exemplo | Obs |
|---|---|---|---|
| `YourPrice` | number | `0.5` | Preço base (= Price1 geralmente) |
| `MinQt1` | number | `1` | Qtd mínima faixa 1 |
| `Price1` | number | `0.5` | Preço/unid faixa 1 |
| `MinQt2..10` | number/null | — | Quantidades das faixas 2 a 10 |
| `Price2..10` | number/null | — | Preços das faixas 2 a 10 |
| `MaxColors` | null | — | Max cores de personalização (global) |
| `MaxHandlingCost` | null | — | Custo máx de manuseio (global) |

### 3.5 Imagens da Variante

| Campo | Tipo | Exemplo | Obs |
|---|---|---|---|
| `OptionalImage1` | string | `"51102_103.jpg"` | Foto do produto nesta cor |
| `OptionalImage2` | string | `""` | Segunda foto da variante |

### 3.6 Status da Variante

| Campo | Tipo | Exemplo | Obs |
|---|---|---|---|
| `IsStockOut` | bool | `true` | Sem estoque |
| `OnlineExclusive` | bool | `false` | Exclusivo online |
| `NewProduct` | bool | `false` | Novo no catálogo |
| `NoReplenishment` | bool | `false` | Sem previsão de reposição |
| `LastSale` | bool | `true` | Último lote disponível (em `productsTree`) |

### 3.7 Localização de Impressão por Variante (até 8 locais)

Para cada local de impressão (numerado 1 a 8):

| Campo | Tipo | Exemplo (loc 1) | Obs |
|---|---|---|---|
| `Component{N}` | string | `"Esferográfica"` | Componente do produto |
| `Component{N}Image` | string | `"51102_103_C1.png"` | Foto do componente nesta cor |
| `Location{N}` | string | `"Corpo"` | Nome da localização |
| `ComposedLocation{N}` | string | `"Esferográfica - Corpo"` | Localização composta |
| `Location{N}Image` | string | `"51102_103_C1_L1.png"` | Foto da localização nesta cor |
| `Area{N}` | string | `"45 x 6"` | Área de impressão em mm (larg x alt) |
| `Area{N}Image` | string | `"51102_1_1_2.png"` | Imagem da área com overlay |
| `TableCodes{N}` | string | `"PDP1"` | Família de tabela de técnica |
| `TableCodesOptions{N}` | string | `"PDP1-01-01, PDP1-01-02, PDP1-01-03"` | Todas as opções de tabela |
| `MaxColors{N}` | string | `"0"` | Max cores (0 = sem limite fixo) |
| `CustomizationTypes{N}` | string | `"Tampografia"` | Técnica de personalização |
| `HandlingCosts{N}` | string | `"0,0"` | Custo de manuseio |
| `TableFullCode{N}` | string | `"PDP1-01"` | Código completo da tabela |

**Campos extras em `optionalscomplete` (herdam do pai):**  
`Name`, `SEOName`, `Description`, `ShortDescription`, `SEOShortDescription`, `SEOShortDescriptionCap`, `IsTextil`, `HasColors`, `HasSizes`, `HasCapacitys`, `MainImage`, `BoxImage`, `BagImage`, `PouchImage`, `AditionalImageList`, `AllImageList`, `CombinedSizes`, `Gender`, `DefaultCustomizationIncludedInPrice`, `AvailableGross`, `BoxLengthMM`, `BoxWidthMM`, `BoxHeightMM`, `BoxSizeM`, `BoxWeightKG`, `BoxVolume`, `BoxQuantity`, `BoxInnerQuantity`, `Multiplier`, `Taric`, `Type`, `TypeCode`, `SubType`, `SubTypeCode`, `Brand`, `CountryOfOrigin`, `PvcFree`, `Properties`, `ProductCare`, `WeightGr`, `Certificates`, `Composition`, `Packing`, `Repacking`, `RefillType`, `BatteryType`, `Materials`, `PaperSize`, `PaperGramage`, `CapacityMah`, `CapacityGB`, `InkColor`, `OtherDetails`, `KeyWords`, `RelatedReferences`, `Video360`, `VideoLink`, `VideoLinkVimeo`, `ProductComponents`, `ProductDefaultComponent`, `ProductComponentLocations`, `ProductComponentDefaultLocation`, `ProductComponentDefaultLocationAreaMM`, `ProductComposedLocations`, `CustomizationTypes`, `CustomizationDefaultType`, `CustomizationTables`, `CustomizationDefaultTable`, `CustomizationTableOptions`, `DefaultCustomization`, `CustomizationDefaultTableMaxColors`, `DefaultCustomizationHandlingCosts`, `DefaultCustomizationPrintingLines`, `IsSeasonal`, `SeasonalOccasion`, `SeasonalStartDate`, `SeasonalEndDate`, `Weight`, `CertificateFiles`, `Catalogs`, `UpdateDate`, `NoReplenishment`, `CustomizationDefaultShortTable`.

---

## 4. Campos — Estoque (`stocks`)

> Feed especial: **96 chamadas/dia** (vs 22 para os demais). Fonte da "esteira quente".

| Campo | Tipo | Exemplo (garrafa 94550) | Obs |
|---|---|---|---|
| `Sku` | string | `"94550-105"` | SKU da variante |
| `WebSku` | string | `"94550-105"` | SKU web |
| `Quantity` | number | `2098` | **Estoque atual disponível** |
| `NextQuantity1` | number/null | `null` | Qtd da 1ª reposição prevista |
| `NextDate1` | string | `""` | Data da 1ª reposição (AAAA-MM-DD) |
| `NextQuantity2` | number/null | `null` | Qtd da 2ª reposição |
| `NextDate2` | string | `""` | Data da 2ª reposição |
| `NextQuantity3` | number/null | `null` | Qtd da 3ª reposição |
| `NextDate3` | string | `""` | Data da 3ª reposição |
| `NextQuantity4` | number/null | `null` | Qtd da 4ª reposição |
| `NextDate4` | string | `""` | Data da 4ª reposição |
| `NextQuantity5` | number/null | `null` | Qtd da 5ª reposição |
| `NextDate5` | string | `""` | Data da 5ª reposição |
| `NextQuantity6` | number/null | `null` | Qtd da 6ª reposição |
| `NextDate6` | string | `""` | Data da 6ª reposição |
| `Country` | null | `null` | País do armazém (sempre null = armazém único) |

> **Previsão de reposição:** Até **6 datas futuras** com quantidades previstas por variante.  
> Quando `NextDate{N}` está vazio e `NextQuantity{N}` é null, não há reposição prevista para essa posição.

**Exemplo de estoque da garrafa 94550 (7 variantes/cores):**

| SKU | Cor (código) | Estoque |
|---|---|---|
| `94550-105` | Vermelho (105) | 2.098 |
| `94550-106` | Branco (106) | 5.954 |
| `94550-114` | Azul royal (114) | 3.445 |
| `94550-119` | Verde claro (119) | 318 |
| `94550-127` | Cromado satinado (127) | 9.832 |
| `94550-147` | Chumbo (147) | 5.416 |
| `94550-157` | Cobre (157) | 1.598 |

---

## 5. Personalização — Localizações e Técnicas

### 5.1 Estrutura da Árvore de Personalização (`productsTree`)

O `productsTree` retorna a estrutura aninhada completa:

```text
produto
└── Components[]                     ← componentes imprimíveis
    ├── Name (ex: "Esferográfica")
    ├── Default (bool)
    ├── ComponentImages[]            ← foto do componente por cor
    │   ├── MainImage
    │   └── ColorCode
    └── Locations[]                  ← localizações de impressão
        ├── Name (ex: "Corpo", "Clipe")
        ├── Default (bool)
        ├── LocationID
        ├── LocationImages[]         ← foto da localização por cor
        │   ├── MainImage
        │   └── ColorCode
        └── CustomizationAreas[]     ← áreas de impressão
            ├── AreaName (ex: "40 x 25")
            ├── WidthMM, HeightMM
            ├── Default (bool)
            └── ProductCustomizationTables[]   ← técnicas disponíveis
                ├── CustomizationTypeName
                ├── TableCode
                ├── PriceByColor (bool)
                ├── HandlingCost
                ├── MaxColors
                ├── MainImage
                ├── Default (bool)
                ├── HotSpots[]              ← coordenadas overlay
                │   ├── Type ("RectAngle")
                │   ├── OriginX ("left")
                │   ├── OriginY ("top")
                │   ├── Top, Left, Width, Height (px)
                └── ProductCustomizationTableOptions[]
                    ├── TableCodeOption (ex: "SRC1-01-01")
                    ├── Colors (número de cores)
                    ├── AreaCM, AreaCM2
                    ├── Default (bool)
                    ├── ServiceCode
                    └── ScalePrices[]
                        ├── MinQt
                        ├── Price (custo de personaliz. por unid)
                        └── Sla (dias úteis)
```

### 5.2 Técnicas de Personalização Identificadas

| Código | Técnica | Obs |
|---|---|---|
| `PDP1` | Tampografia | Impressão por pressão; até 5 cores; preço por cor |
| `SRC1` | Silk Screen Circular | Serigrafia em superfícies circulares; até 3 cores |
| `TRS1` | Transfer | Validado em têxteis (ex: 30511 GOIABA WOMEN) |
| `TXP5` | Silk Screen Têxtil | Serigrafia específica para têxteis; validado em 30511 |
| — | Bordado | Suportado via `MaxStitches` + `AditionalStitches` |
| — | Gravação a Laser | Aparece em outros produtos do catálogo |
| — | Digital (UV/DTG) | Aparece em outros produtos do catálogo |

---

## 6. Personalização — Preços Detalhados (`customizationOptions`)

> ~35.936 itens no bulk total; ~46 MB. Use sempre filtrado por `ref`.

Por cada combinação Produto + Técnica + Localização + Opção, até **15 faixas de preço**:

| Campo | Tipo | Exemplo | Obs |
|---|---|---|---|
| `ProdReference` | string | `"51102"` | |
| `ServiceCode` | string | `"51102.16.27.PDP1-01-01"` | **Código único** da combinação |
| `Capacity` | string | `""` | Capacidade (se aplicável) |
| `Component` | string | `"Esferográfica"` | Componente a personalizar |
| `Location` | string | `"Corpo"` | Localização |
| `HandlingCost` | number | `0` | Custo de manuseio (€) |
| `CustomizationTypeName` | string | `"Tampografia"` | Técnica |
| `TableCode` | string | `"PDP1-01"` | Família de tabela |
| `TableCodeOption` | string | `"PDP1-01-01"` | Opção específica (1 cor, 2 cores, etc.) |
| `IsDefault` | bool | `false` | É a opção padrão do produto |
| `MaxColors` | number | `1` | Máx de cores desta opção |
| `AllowFullColor` | bool | `false` | Permite full color/CMYK |
| `LocationMaxPrintingAreaMM` | string | `"45 x 6"` | Área máxima nesta localização (mm) |
| `TableMaxAreaCM` | string | `"99.9 x 99.9"` | Área máxima da tabela (cm) |
| `TableMaxAreaCM2` | string | `"9980,01"` | Área máxima em cm² |
| `MaxStitches` | number | `0` | Máx pontos de bordado |
| `AditionalStitches` | number | `0` | Pontos adicionais de bordado |
| `AreaImage` | string | `"51102_1_1_2.png"` | Imagem com hotspot |
| `MinQt1..15` | number | `1, 2, 3, 4, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000` | Qtds das 15 faixas |
| `Price1..15` | number | ver tabela abaixo | Custo de personaliz. por unid em cada faixa |
| `HandlingCostCode` | null | `null` | Código do custo de manuseio |
| `HotSpot1Type` | string | `"RectAngle"` | Forma do hotspot (sempre RectAngle) |
| `HotSpot1OriginX` | string | `"left"` | Origem X |
| `HotSpot1OriginY` | string | `"top"` | Origem Y |
| `HotSpot1Top` | number | `196.1` | Posição topo (px) |
| `HotSpot1Left` | number | `238.81` | Posição esquerda (px) |
| `HotSpot1Width` | number | `21.73` | Largura (px) |
| `HotSpot1Height` | number | `181.12` | Altura (px) |
| `HotSpot2*` | number/null | `0`/null | Segundo hotspot (se houver 2 áreas) |
| `TableFullcode` | string | `"PDP1-01"` | Código completo da tabela |
| `ComponentID` | number | `103` | ID interno do componente |
| `LocationID` | number | `47` | ID interno da localização |

---

## 7. Tabelas Genéricas de Personalização (`customizationTables`)

Preços base por técnica (sem vínculo a produto específico):

| Campo | Tipo | Obs |
|---|---|---|
| `CustomizationTypeName` | string | `"Tampografia"` / `"Silk Screen Circular"` |
| `TableCode` | string | `"PDP1-01"` |
| `TableCodeOption` | string | `"PDP1-01-01"` (1 cor), `"PDP1-01-02"` (2 cores), etc. |
| `PriceByColor` | bool | `true` = preço varia por número de cores |
| `PriceByArea` | bool | `false` = não é por área |
| `PriceByStitches` | bool | `false` = não é por pontos |
| `MaxColors` | number | 1, 2, 3, 4, ou 5 |
| `TableMaxAreaCM` | string | `"99,9 x 99,9"` |
| `TableMaxAreaCM2` | string | `"9980,01"` |
| `MaxStitches` | number | `0` |
| `AditionalStitches` | number | `0` |
| `MinQt1..15` | number | Quantidades das 15 faixas |
| `Price1..15` | number | Preços base da técnica por faixa |
| `Sla1..15` | string | SLA em dias úteis: `"2"`, `"3"`, `"5"`, `"6"`, `"8"`, `"10"`, `"50"`, `""` |
| `TableFullcode` | string | `"PDP1-01"` |

**Tabela PDP1 (Tampografia) — Preços base por número de cores:**

| Opção | MaxColors | Qt=1 | Qt=10 | Qt=100 | Qt=1000 | Qt=10000 | SLA Qt=1 |
|---|---|---|---|---|---|---|---|
| PDP1-01-01 | 1 cor | €95,00 | €9,45 | €1,05 | €0,19 | €0,13 | 2 dias |
| PDP1-01-02 | 2 cores | €161,00 | €16,07 | €1,79 | €0,34 | €0,13 | 2 dias |
| PDP1-01-03 | 3 cores | €236,00 | €23,63 | €2,63 | €0,51 | €0,13 | 2 dias |
| PDP1-01-04 | 4 cores | €359,00 | €35,91 | €3,99 | €0,76 | €0,13 | 2 dias |

**Tabela SRC1 (Silk Screen Circular) — Preços base:**

| Opção | MaxColors | Qt=1 | Qt=10 | Qt=100 | Qt=1000 | Qt=10000 | SLA Qt=1 |
|---|---|---|---|---|---|---|---|
| SRC1-01-01 | 1 cor | €74,00 | €7,35 | €2,18 | €0,29 | €0,10 | 2 dias |
| SRC1-01-02 | 2 cores | €84,00 | €10,40 | €3,12 | €0,44 | €0,10 | 2 dias |

> ⚠️ Os preços nas `customizationOptions` (por produto) podem diferir levemente das `customizationTables` (genéricas) devido a ajuste de `HandlingCost` por produto.

---

## 8. Imagens — Tipologia Completa

| Tipo | Campo | Nomenclatura | Exemplo | Uso |
|---|---|---|---|---|
| Set (produto geral) | `MainImage` | `{ref}_set.jpg` | `51102_set.jpg` | Foto principal sem cor específica |
| Por cor — produto | `AllImageList` / `OptionalImage1` | `{ref}_{colorCode}.jpg` | `51102_103.jpg` | Produto na cor específica |
| Caixa de embalagem | `BoxImage` | `{ref}_box.jpg` | — | Embalagem caixa |
| Saco de embalagem | `BagImage` | `{ref}_bag.jpg` | — | Embalagem saco |
| Bolsa de embalagem | `PouchImage` | `{ref}_pouch.jpg` | — | Embalagem bolsa |
| Fotos adicionais | `AditionalImageList` | variável | — | Outras fotos do produto |
| Lista completa | `AllImageList` | CSV | `51102_set.jpg, 51102_103.jpg, 51102_104.jpg, 51102_105.jpg, 51102_109.jpg, 51102_110-a.jpg, 51102_124.jpg` | Todas as imagens |
| Componente por cor | `Component{N}Image` | `{ref}_{color}_C{N}.png` | `51102_103_C1.png` | Visão do componente na cor |
| Localização por cor | `Location{N}Image` | `{ref}_{color}_C{N}_L{M}.png` | `51102_103_C1_L1.png` | Componente + local de impressão na cor |
| Área de impressão | `Area{N}Image` | `{ref}_{comp}_{loc}_{area}.png` | `51102_1_1_2.png` | Overlay com área delimitada |
| HotSpot overlay | `AreaImage` (customizationOptions) | `{ref}_{comp}_{loc}_{area}.png` | `51102_1_1_1.png` | Com coordenadas para montagem visual |
| Guia de impressão | `DefaultCustomizationPrintingLines` | — | `51102_1_1_1.png` | Linhas guia de impressão padrão |

### Estrutura de Nomenclatura de Imagens (convenção)

```text
{ref}_set.jpg               — foto do set/produto geral
{ref}_{colorCode}.jpg       — produto na cor (ex: 51102_103.jpg = preto)
{ref}_{colorCode}_C{N}.png  — componente N na cor
{ref}_{colorCode}_C{N}_L{M}.png  — localização M do componente N na cor
{ref}_{comp}_{loc}_{area}.png    — área de impressão
```

> **URL base:** `https://www.spotgifts.com.br/`  
> **Atenção:** O domínio `spotgifts.com.br` não permite CORS direto do browser — é necessário usar proxy.

---

## 9. Vídeos

| Campo | Feed disponível | Preenchimento | Obs |
|---|---|---|---|
| `Video360` | `products`, `optionalscomplete`, `productsTree` | Raramente | Link de vídeo 360° |
| `VideoLink` | `products`, `optionalscomplete`, `productsTree` | Raramente | YouTube |
| `VideoLinkVimeo` | `products`, `optionalscomplete`, `productsTree` | Raramente | Vimeo |

> Vídeos existem no schema mas são raros — a grande maioria dos produtos tem esses campos **vazios**.

---

## 10. Cores — Catálogo Completo (52 cores)

| Código | Nome | Código | Nome |
|---|---|---|---|
| 100 | Sortido | 101 | Marron |
| 102 | Rosa | 103 | Preto |
| 104 | Azul | 105 | Vermelho |
| 106 | Branco | 107 | Cromado |
| 108 | Amarelo | 109 | Verde |
| 110 | Transparente | 111 | Marron claro |
| 112 | Rosa claro | 113 | Cinza |
| 114 | Azul royal | 115 | Bordô |
| 116 | Branco pastel | 117 | Dourado |
| 118 | Amarelo escuro | 119 | Verde claro |
| 121 | Marron escuro | 123 | Cinza claro |
| 124 | Azul claro | 127 | Cromado satinado |
| 128 | Laranja | 129 | Verde escuro |
| 131 | Bege | 132 | Roxo |
| 133 | Cinza escuro | 134 | Azul marinho |
| 137 | Dourado satinado | 142 | Lilás |
| 143 | Preto/Cromado satinado | 144 | Turquesa |
| 147 | Chumbo | 148 | Amarelo limão |
| 149 | Verde tropa | 150 | Natural claro |
| 154 | Azul aqua | 157 | Cobre |
| 160 | Natural | 164 | Azul pastel |
| 167 | Champanhe | 168 | Salmão |
| 169 | Verde turquesa | 170 | Natural escuro |
| 183 | Cinza claro mesclado | 191 | Camel |
| 196 | Branco mesclado | 03 | Preto (legado) |
| 13 | AZUL CLARO (legado) | 61 | TRANSPARENTE (legado) |

> O campo `ColorHex1` na variante (feed `optionals`/`optionalscomplete`) traz o hex real da cor.  
> O feed `colors` traz apenas código + nome.

---

## 11. Categorias — 31 Tipos Principais e SubTypes

| TypeCode | Tipo | Subtypes (exemplos) |
|---|---|---|
| 2 | Escrita | Esferográficas, Roller em Metal, Lápis, Conjuntos, Estojos |
| 3 | Tecnologia | Carregadores, Mini Colunas, Baterias, Memórias Flash, Auscultadores |
| 4 | Escritório | Agendas, Blocos, Pastas, Papelaria, Notas Adesivas |
| 5 | Mochilas, Malas & Pastas | Mochilas, Trolleys, Sacos, Pastas para PC/Tablet |
| 6 | Pessoal & Viagem | Bolsas Cosméticos, Utilitários Viagem, Anti-estress, Manicura |
| 7 | Chaveiros & Porta-Cartões | Porta-Chaves, Lanyards, Porta-Cartões, Lanternas |
| 8 | Casa, Restaurante & Bar | Artigos Vinho, Utilitários Cozinha, Barbecue, Aventais |
| 9 | Sacolas & Bolsas Térmicas | Bolsas Térmicas, Sacos Algodão, Non-woven |
| 10 | Squeezes & Copos | Canecas, Garrafas, Canecas Térmicas, Shakers, Termos |
| 11 | Sol & Chuva | Guarda-Chuvas, Bonés, Chapéus, Toalhas de Praia |
| 12 | Criança & Escolar | Lápis, Borrachas, Mochilas, Produtos para Colorir |
| 19 | Stockout | Produtos temporariamente sem estoque |
| 20 | Últimas Chegadas | Agendas (novidades) |
| 23 | SUCO | T-Shirts |
| 3300 | Agendas | Agendas |
| 9999 | Exclusivos | Outros Produtos exclusivos |
| 0028 | Esporte & Ar Livre | Ferramentas, Navalhas, Mantas, Toalhas, Bolas |
| 0029 | Tecnologia | Carregadores, Auscultadores, Bolsas Telemóvel |
| 0030 | Escritório | Réguas, Blocos, Pastas |
| 0031 | Escrita | Esferográficas em Metal/Plástico/Ecológicas, Roller |
| 0032 | Mochilas, Pastas & Sacolas | Bolsas, Pastas Congresso, Trolleys |
| 0033 | Sacolas & Bolsas Térmicas | Bolsas Térmicas, Non-woven, Algodão |
| 0034 | Esporte & Ar Livre | Coletes, Canivetes |
| 0035 | Squeezes & Copos | Canecas Viagem, Garrafas Alumínio/Plástico |
| 0036 | Casa, Restaurante & Bar | Tábuas, Utensílios, Barbecue, Marmitas |
| 0037 | Pessoal & Viagem | Bolsas Cosméticos, Anti-estress, Álcool Gel |
| 0038 | Chaveiros & Porta-cartões | Pulseiras, Lanyards, Porta-Chaves |
| 0039 | Criança & Escolar | Coletes, Papelaria, Lápis |
| 0040 | Sol & Chuva | Guarda-Chuvas Automáticos/Manuais, Capas de Chuva |
| 21 | Máscaras | Máscaras de proteção descartáveis |
| 0 | Exclusivo | Outros Produtos |

---

## 12. Exemplo Real — Caneta KISO `51102`

```json
{
  "ProdReference": "51102",
  "Name": "KISO. Esferográfica",
  "SEOName": "KISO",
  "Description": "Esferográfica em ABS com acabamento brilhante e clipe translúcido colorido. Até 1.5 km de escrita. ø11 x 136 mm",
  "ShortDescription": "Esferográfica em ABS com acabamento brilhante e clipe translúcido colorido. Até 1,5 km de escrita",
  "Brand": "hi!dea™",
  "Taric": "96081000",
  "Type": "Escrita",
  "TypeCode": "0031",
  "SubType": "Esferográficas em Plástico",
  "SubTypeCode": "0134",
  "HasColors": true,
  "HasSizes": false,
  "HasCapacitys": false,
  "CombinedSizes": "ø11 x 136 mm",
  "Weight": 1,
  "BoxWeightKG": 9.62,
  "BoxSizeM": "0.63x0.30x0.16",
  "BoxInnerQuantity": 50,
  "Packing": "",
  "Materials": "",
  "Properties": "Escrita a azul",
  "Certificates": "MSDS",
  "KeyWords": "81102, esferográfica, esferográficas, certificado, certificados, caneta, canetas",
  "Colors": "Azul, Azul claro, Preto, Transparente, Verde, Vermelho",
  "MainImage": "51102_set.jpg",
  "AllImageList": "51102_set.jpg, 51102_103.jpg, 51102_104.jpg, 51102_105.jpg, 51102_109.jpg, 51102_110-a.jpg, 51102_124.jpg",
  "IsStockOut": true,
  "NoReplenishment": false,
  "Catalogs": "Stockout,Stockout",
  "YourPrice": 0.50,
  "CustomizationTypes": "Tampografia, Silk Screen Circular",
  "CustomizationDefaultType": "Silk Screen Circular",
  "CustomizationDefault": "Esferográfica - Corpo (Silk Screen Circular - 40 x 25)",
  "ProductComponents": "Esferográfica",
  "ProductComponentLocations": "Corpo, Clipe",
  "UpdateDate": "12/17/2025 09:24:27",

  "Variantes": [
    {
      "Sku": "51102-103",
      "ColorCode": "103",
      "ColorDesc1": "Preto",
      "ColorHex1": "#000000",
      "Capacity": "",
      "Size": "",
      "YourPrice": 0.50,
      "Estoque": 0,
      "NoReplenishment": false,
      "IsStockOut": true,
      "OptionalImage1": "51102_103.jpg"
    },
    {
      "Sku": "51102-105",
      "ColorCode": "105",
      "ColorDesc1": "Vermelho",
      "ColorHex1": "#DD2A34",
      "Capacity": "",
      "Size": "",
      "YourPrice": 0.50,
      "Estoque": 311,
      "NoReplenishment": false,
      "IsStockOut": false,
      "OptionalImage1": "51102_105.jpg"
    }
  ],

  "Localizações de Impressão": [
    {
      "Componente": "Esferográfica",
      "Localização": "Corpo",
      "Área": "45 x 6 mm",
      "Técnicas": ["Tampografia (PDP1-01-01/02/03)"],
      "AreaImage": "51102_1_1_2.png"
    },
    {
      "Componente": "Esferográfica",
      "Localização": "Corpo",
      "Área": "40 x 25 mm",
      "Técnicas": ["Silk Screen Circular (SRC1-01-01)"],
      "AreaImage": "51102_1_1_1.png",
      "IsDefault": true
    },
    {
      "Componente": "Esferográfica",
      "Localização": "Clipe",
      "Área": "30 x 3 mm",
      "Técnicas": ["Tampografia (PDP1-01-01)"],
      "AreaImage": "51102_1_2_1.png"
    }
  ]
}
```

---

## 13. Exemplo Real — Garrafa SHOW `94550`

```json
{
  "ProdReference": "94550",
  "Name": "SHOW. Garrafa térmica em aço inox de parede dupla isolada a vácuo (510 mL)",
  "CombinedSizes": "ø67 x 255 mm | Caixa: 75 x 75 x 275 mm",
  "Weight": 334,
  "BoxSizeM": "0.400X0.400X0.300",
  "BoxWeightKG": 8.8,
  "Packing": "Polybag",
  "Materials": "Aço inox",
  "Capacitys": "510 mL",
  "HasCapacitys": false,
  "Type": "Squeezes & Copos",
  "SubType": "Garrafas",

  "Variantes (7 cores)": [
    { "Sku": "94550-105", "Cor": "Vermelho",         "Capacity": "510 mL", "Estoque": 2098  },
    { "Sku": "94550-106", "Cor": "Branco",            "Capacity": "510 mL", "Estoque": 5954  },
    { "Sku": "94550-114", "Cor": "Azul royal",        "Capacity": "510 mL", "Estoque": 3445  },
    { "Sku": "94550-119", "Cor": "Verde claro",       "Capacity": "510 mL", "Estoque": 318   },
    { "Sku": "94550-127", "Cor": "Cromado satinado",  "Capacity": "510 mL", "Estoque": 9832  },
    { "Sku": "94550-147", "Cor": "Chumbo",            "Capacity": "510 mL", "Estoque": 5416  },
    { "Sku": "94550-157", "Cor": "Cobre",             "Capacity": "510 mL", "Estoque": 1598  }
  ]
}
```

---

## 14. Exemplo Real — Preços de Personalização `51102`

### Tampografia 1 cor no Corpo (45 × 6 mm)

| Qtd mín | Custo/unid (€) | SLA (dias úteis) |
|---|---|---|
| 1 | €95,50 | 2 |
| 2 | €53,00 | 2 |
| 3 | €37,25 | 2 |
| 4 | €26,75 | 2 |
| 5 | €19,40 | 3 |
| 10 | €9,95 | 5 |
| 25 | €4,70 | 6 |
| 50 | €2,60 | 8 |
| 100 | €1,55 | 10 |
| 250 | €1,03 | 50 |
| 500 | €0,79 | — |
| 1.000 | €0,69 | — |
| 2.500 | €0,65 | — |
| 5.000 | €0,64 | — |
| 10.000 | €0,63 | — |

### Silk Screen Circular 1 cor no Corpo (40 × 25 mm) — Padrão

| Qtd mín | Custo/unid (€) | SLA (dias úteis) |
|---|---|---|
| 1 | €74,50 | 2 |
| 2 | €37,25 | 2 |
| 5 | €15,20 | 3 |
| 10 | €7,85 | 5 |
| 25 | €6,85 | 6 |
| 50 | €4,87 | 8 |
| 100 | €2,68 | 10 |
| 250 | €1,48 | 50 |
| 500 | €1,02 | — |
| 1.000 | €0,79 | — |
| 10.000 | €0,60 | — |

> **Preço final ao cliente** = Preço do produto + Custo de personalização (por unidade, na faixa correspondente).

---

## 15. Exemplo Real — Têxtil GOIABA WOMEN 30511

> Validado em 2026-06-06 via `spot_ws_optionals_complete?ref=30511` e `spot_ws_stocks?ref=30511`

### Dados do Produto

| Campo | Valor |
|---|---|
| `ProdReference` | `"30511"` |
| `Name` | `"GOIABA WOMEN WH. Camiseta feminina"` |
| `SEOName` | `"GOIABA WOMEN WH"` |
| `IsTextil` | `true` |
| `HasColors` | `true` |
| `HasSizes` | `true` |
| `HasCapacitys` | `false` |
| `Type` / `SubType` | `"SUCO"` / `"T-Shirts"` |
| `Brand` | `"hi!dea™"` |
| `CountryOfOrigin` | `"Brasil"` |
| `Materials` | `"100% algodão"` |
| `Certificates` | `"ABVTEX"` |
| `CertificateFiles` | `"cert_30511.zip"` |
| `Weight` | `1` (g — unitário) |
| `BoxWeightKG` | `8.4` (50 unid) |
| `BoxQuantity` | `50` |
| `BoxInnerQuantity` | `25` |
| `Repacking` | `"Polybag"` |
| `Gender` | `""` (vazio mesmo sendo feminina!) |
| `CustomizationTypes` | `"Transfer, Silk screen têxtil"` |
| `CustomizationDefaultType` | `"Silk screen têxtil"` |

### Variantes — SKU de 3 partes

| SKU | Cor | Tamanho | `SizeLengthCM` | `SizeWidthCM` | Estoque |
|---|---|---|---|---|---|
| `30511-106-P` | Branco (#FFFFFF) | P | 60 | 41 | 1.928 |
| `30511-106-M` | Branco (#FFFFFF) | M | 62 | 44 | 2.867 |
| `30511-106-G` | Branco (#FFFFFF) | G | 64 | 47 | 1 |
| `30511-106-GG` | Branco (#FFFFFF) | GG | 66 | 50 | 0 |

> ⚠️ **SKU têxtil = `{ProdReference}-{ColorCode}-{Size}`** — 3 segmentos, não 2!

### Preços (€) — 4 faixas

| Qtd mín | Preço/unid |
|---|---|
| 1 | €15,84 |
| 105 | €15,52 |
| 255 | €15,05 |
| 1.050 | €14,75 |

### Personalização

- **13 localizações de impressão** (Peito, Verso Superior, Verso Inferior, Costas, Mangas, Barras laterais, etc.)
- **Técnicas:** Transfer (TRS1) + Silk screen têxtil (TXP5)
- **Área padrão (Peito):** 240 × 200 mm
- **`DefaultCustomizationPrintingLines`:** `"30511_1_1_1.png"`

### Imagens

- `AllImageList`: `"30511_106.jpg, 30511_106-a.jpg, 30511_106-b.jpg, 30511_106-c.jpg"`
- Imagem por componente: `"30511_106_C1.png"` (mesma para todos os tamanhos de uma cor)
- Imagem por localização: `"30511_106_C1_L1.png"` (Peito), `"30511_106_C1_L10.png"` (Verso Superior), etc.
- Overlay da área: `"30511_1_1_1.png, 30511_1_1_2.png"` (duas variações de overlay para Peito)

---

## 16. Exemplo Real — Agenda SPECT A5 66190

> Validado em 2026-06-06 via `spot_ws_optionals_complete?ref=66190`

### Dados do Produto

| Campo | Valor |
|---|---|
| `ProdReference` | `"66190"` |
| `Name` | `"SPECT A5. Agenda A5"` |
| `SEOName` | `"SPECT A5"` |
| `Description` | `"Agenda A5 em tecido poliéster... (70 g/m²). 145 x 212 mm"` |
| `IsTextil` | `false` |
| `HasSizes` | `false` |
| `HasCapacitys` | `false` |
| `Type` / `SubType` | `"Últimas Chegadas"` / `"Agendas"` |
| `SubTypeCode` | `"162"` |
| `Brand` | `"hi!dea™"` |
| `CountryOfOrigin` | `"China"` |
| `Materials` | `"Tecido em poliéster"` |
| `Weight` | `446` (g) |
| `BoxQuantity` | `30` |
| `BoxInnerQuantity` | `1` |
| `AvailableGross` | `true` |
| `NewProduct` | `true` |
| `PaperSize` | `""` ⚠️ **vazio** — info na `Description` ("145 x 212 mm") |
| `PaperGramage` | `""` ⚠️ **vazio** — gramagem na `Description` ("70 g/m²") |
| `Properties` | `"Tamanho A5, Folhas pautadas, Miolo de agenda a 2 cores"` |
| `CombinedSizes` | `"145 x 212 mm"` |
| `Catalogs` | `"Últimas Chegadas,Agendas 2026,Novidades"` |
| `RelatedReferences` | `"66114, 66116"` |
| `CustomizationTypes` | `"Transfer"` |

### Variantes

| SKU | Cor | Hex |
|---|---|---|
| `66190-105` | Vermelho | `#DD2A34` |
| `66190-119` | Verde claro | `#C0E000` |
| `66190-124` | Azul claro | `#58B2FF` |

### Preços (€) — 4 faixas

| Qtd mín | Preço/unid |
|---|---|
| 1 | €21,92 |
| 50 | €21,26 |
| 255 | €21,04 |
| 1.050 | €20,80 |

### Personalização

- **1 localização:** Agenda - Frente (85 × 140 mm)
- **Técnica:** Transfer apenas (TRS1)
- Imagem do componente: `"66190_105_C1.png"`
- Imagem de localização: `"66190_105_C1_L1.png"`
- Overlay: `"66190_1_1_1.png"`

### Imagens

- `MainImage` (grupo): `"66190_set.jpg"`
- Imagens extras genéricas: `"66190_c.jpg, 66190_amb.jpg, 66190_a.jpg"`
- Por cor: `"66190_105.jpg, 66190_105-a.jpg, 66190_105-b.jpg"` | `"66190_119.jpg, ..."` | `"66190_124.jpg, ..."`

---

## 17. Limitações e Campos Ausentes

| Campo / Informação | Status | Alternativa |
|---|---|---|
| **Peso em gramas** | `WeightGr` sempre vazio | Usar `Weight` (número em gramas) |
| **País de origem** | `CountryOfOrigin` frequentemente vazio | Verificar `Description` |
| **Composição do material** | `Composition` frequentemente vazio | Verificar `Materials` + `Description` |
| **Certificados (arquivo)** | `CertificateFiles` = string filename ou null; `Certificates` = nome do cert | Validado: `"cert_30511.zip"` em têxtil; null em outros |
| **Estoque por armazém** | Requer sessão logada | Usar `spot_ws_stocks` (quantidade total) |
| **Personalização HTML (overlay visual)** | Requer sessão logada (`prod` ID interno) | Usar `customizationOptions` com `HotSpot*` |
| **2ª cor na variante** | `ColorDesc2`/`ColorHex2` raramente preenchidos | — |
| **Previsão de reposição** | `NextDate{1..6}` frequentemente vazio (sem reposição agendada) | `NoReplenishment=false` indica que haverá reposição no futuro |
| **Vídeos** | `Video360`, `VideoLink`, `VideoLinkVimeo` raramente preenchidos | — |
| **Tags estruturadas** | Apenas `KeyWords` (string CSV) sem taxonomia formal | Parsear via vírgula |
| **Preço de venda sugerido ao consumidor final** | Não disponível na API | Calcular via markup interno |
| **Descrição em PT-BR** | Descrições em português de Portugal | Adaptar localização |
| **Embalagem individual para canetas** | `Packing` vazio em muitos produtos | Verificar `ShortDescription` |
| **Limite de 22 chamadas/dia** | Feeds gerais | Usar download bulk via `spot_ws_download` |
| **Feed `optionalscomplete` = ~27 MB** | Muito grande para chamada MCP | Usar `spot_ws_download` com ext=json/csv/xml |
| **Feed `customizationOptions` = ~46 MB** | Muito grande para chamada MCP | Usar `spot_ws_download` com ext=json |
| **CORS imagens** | `spotgifts.com.br` bloqueia CORS direto | Usar proxy (ex: Supabase Edge Function) |
| **`Gender` (têxteis)** | ⚠️ Campo sempre vazio mesmo em produtos com corte feminino | Inferir via `Name`/`SubType` ("feminina", "masculina") |
| **`PaperSize` (agendas)** | ⚠️ Campo sempre vazio — validado em SPECT A5 (66190) | Extrair de `Description` ou `CombinedSizes` |
| **`PaperGramage` (agendas)** | ⚠️ Campo sempre vazio — gramagem aparece em `Description` ("70 g/m²") | Parsear `Description` com regex |
| **`CapacityMah` (baterias)** | Não confirmado — refs testadas (97162, 97941) retornaram erro ou vazio | Campo existe na estrutura mas sem validação positiva |
| **`CapacityGB` (USB)** | Ref 97529 retornou count=0; campo existe com valor `"0"` em não-USB | Campo existe mas validação positiva pendente |
| **Feed `canceledproducts`** | Erro código 2 (erro interno) na validação | Pode ser instabilidade transitória; testar novamente |
| **SKU têxtil = 3 partes** | ⚠️ `{ref}-{color}-{size}` — diferente de produtos regulares (`{ref}-{color}`) | JOIN entre feeds deve respeitar o formato correto por IsTextil |

---

## 18. Mapa Completo de Campos (Síntese)

```text
PRODUTO (chave: ProdReference)
│
├── IDENTIDADE
│   ├── ProdReference        → SKU pai / chave primária
│   ├── Name                 → Nome completo
│   ├── SEOName              → Nome de marca/linha
│   ├── Brand                → Marca
│   ├── Taric                → NCM / Código fiscal
│   ├── KeyWords             → Tags (CSV)
│   └── UpdateDate           → Data de atualização
│
├── DESCRIÇÃO
│   ├── Description          → Longa (inclui dimensões)
│   ├── ShortDescription     → Curta
│   ├── SEOShortDescription  → SEO curta
│   ├── SEOShortDescriptionCap → SEO em caps
│   └── Properties           → Ex: "Escrita a azul"
│
├── CATEGORIAS
│   ├── Type / TypeCode      → Categoria principal
│   ├── SubType / SubTypeCode → Subcategoria
│   ├── Catalogs             → Catálogos
│   ├── IsSeasonal + Season* → Sazonalidade
│   ├── OnlineExclusive      → Exclusivo online
│   ├── NewProduct           → Produto novo
│   └── IsStockOut           → Sem estoque
│
├── FÍSICA DO PRODUTO
│   ├── CombinedSizes        → Dimensões produto (mm)
│   ├── Weight               → Peso unitário (g)
│   ├── Packing              → Embalagem individual
│   ├── Materials            → Material principal
│   ├── Composition          → Composição
│   ├── PvcFree              → Livre de PVC
│   ├── IsTextil             → É têxtil
│   └── Certificates         → Certificações
│
├── CAMPOS ESPECÍFICOS POR TIPO
│   ├── Capacitys / Capacity → mL (garrafas/copos)
│   ├── Sizes / Size         → Tamanhos (têxteis)
│   ├── CapacityMah          → mAh (baterias)
│   ├── CapacityGB           → GB (USB/flash)
│   ├── RefillType           → Recarga (canetas)
│   ├── BatteryType          → Bateria (eletrônicos)
│   ├── InkColor             → Cor da tinta
│   ├── PaperSize            → Tamanho papel (agendas)
│   ├── PaperGramage         → Gramagem (agendas)
│   └── OtherDetails         → Outros
│
├── EMBALAGEM DE EMBARQUE
│   ├── BoxSizeM             → Dimensões caixa (metros)
│   ├── BoxWeightKG          → Peso bruto (KG)
│   ├── BoxVolume            → Volume (m³)
│   ├── BoxQuantity          → Qtd/caixa mestra
│   ├── BoxInnerQuantity     → Qtd/caixa interna
│   └── Multiplier           → Múltiplo de pedido
│
├── MÍDIA
│   ├── MainImage            → {ref}_set.jpg
│   ├── AllImageList         → Todas as imagens (CSV)
│   ├── BoxImage             → Imagem caixa
│   ├── BagImage             → Imagem saco
│   ├── PouchImage           → Imagem bolsa
│   ├── Video360             → Vídeo 360°
│   ├── VideoLink            → YouTube
│   └── VideoLinkVimeo       → Vimeo
│
├── PREÇOS (escala até 10 faixas no pai, 15 no customizationOptions)
│   ├── YourPrice            → Preço base revendedor
│   └── ScalePrices[{MinQt, Price, Sla}]
│
├── PERSONALIZAÇÃO (resumo)
│   ├── CustomizationTypes   → Técnicas disponíveis (CSV)
│   ├── CustomizationDefaultType
│   ├── CustomizationTables  → Tabelas disponíveis
│   ├── CustomizationDefault → Descrição padrão
│   ├── ProductComponents    → Componentes imprimíveis
│   ├── ProductComponentLocations → Localizações
│   └── DefaultCustomizationPrintingLines → Imagem guia
│
└── VARIANTES (optionals / optionalscomplete)
    │
    ├── IDENTIDADE
    │   ├── Sku / WebSku     → SKU da variante
    │   │                       Regular: {ref}-{color}
    │   │                       Têxtil:  {ref}-{color}-{size}  ⚠️
    │   └── ProdReference    → Link ao pai
    │
    ├── COR
    │   ├── ColorCode        → Código da cor
    │   ├── ColorDesc1       → Nome da cor 1
    │   ├── ColorHex1        → Hex da cor 1
    │   ├── ColorDesc2       → Nome cor 2 (bicolor)
    │   └── ColorHex2        → Hex cor 2
    │
    ├── TAMANHO/CAPACIDADE
    │   ├── Size             → Tamanho (têxteis): "P"/"M"/"G"/"GG"
    │   ├── SizeLengthCM     → Comprimento em cm (populado em têxteis)
    │   ├── SizeWidthCM      → Largura em cm (populado em têxteis)
    │   └── Capacity         → Capacidade (garrafas)
    │
    ├── IMAGENS DA VARIANTE
    │   ├── OptionalImage1   → {ref}_{color}.jpg
    │   └── OptionalImage2   → foto extra
    │
    ├── PREÇOS (até 10 faixas)
    │   ├── YourPrice
    │   └── MinQt{1..10} + Price{1..10}
    │
    ├── STATUS
    │   ├── IsStockOut
    │   ├── NoReplenishment
    │   └── LastSale
    │
    └── PERSONALIZAÇÃO POR LOCALIZAÇÃO (até 8)
        ├── Component{N}           → Componente
        ├── Component{N}Image      → {ref}_{color}_C{N}.png
        ├── Location{N}            → Localização
        ├── ComposedLocation{N}    → Composta
        ├── Location{N}Image       → {ref}_{color}_C{N}_L{M}.png
        ├── Area{N}                → WxH mm
        ├── Area{N}Image           → overlay imagem
        ├── CustomizationTypes{N}  → Técnica
        ├── TableCodes{N}          → Família de tabela
        ├── TableCodesOptions{N}   → Opções disponíveis
        ├── MaxColors{N}           → Max cores
        ├── HandlingCosts{N}       → Custo manuseio
        └── TableFullCode{N}       → Código completo

ESTOQUE (feed stocks — 96 chamadas/dia)
├── Sku / WebSku
├── Quantity                 → Estoque atual
└── NextQuantity{1..6} + NextDate{1..6}   → Previsões de reposição

PERSONALIZAÇÃO DETALHADA (customizationOptions)
├── ServiceCode              → Código único por combinação
├── Component + Location     → Onde imprimir
├── CustomizationTypeName    → Técnica
├── TableCode + TableCodeOption → Tabela + opção
├── MaxColors + AllowFullColor
├── LocationMaxPrintingAreaMM → Área max (mm)
├── HandlingCost             → Manuseio (€)
├── MinQt{1..15} + Price{1..15} → Escala preços de personaliz.
└── HotSpot{1/2}*            → Coordenadas overlay (px)

TABELAS GENÉRICAS (customizationTables)
├── TableCode + TableCodeOption
├── CustomizationTypeName
├── MaxColors
├── PriceByColor / PriceByArea / PriceByStitches
├── MinQt{1..15} + Price{1..15} → Preço base da técnica
└── Sla{1..15}               → SLA em dias úteis por faixa

CORES (feed colors — 52 cores)
├── ColorCode
└── Description

CATEGORIAS (feed productTypes — 31 tipos)
├── TypeCode + TypeDescription
└── SubTypes[{SubTypeCode, SubTypeDescription}]
```

---

## 19. Recomendações de Uso

### Qual feed usar para cada propósito?

| Propósito | Feed recomendado | Frequência sugerida |
|---|---|---|
| **Catálogo completo inicial** | `spot_ws_download` (optionalscomplete, json) | 1x/dia |
| **Atualização incremental** | `spot_ws_products` filtrado por `UpdateDate` | 1x/dia |
| **Estoque em tempo real** | `spot_ws_stocks` (96/dia disponíveis) | A cada hora |
| **Preços de personalização** | `spot_ws_download` (customizationOptions, json) | 1x/semana ou quando mudar |
| **Novos produtos removidos** | `spot_ws_canceled_products` | 1x/dia |
| **Tipos e categorias** | `spot_ws_product_types` | 1x/semana |
| **Paleta de cores** | `spot_ws_colors` | 1x/mês |
| **Detalhes de um produto específico** | `spot_ws_optionals_complete` com `ref=` | Sob demanda |
| **Verificar se produto existe** | `spot_search_products` | Sob demanda |

### Estratégia de Sincronização Recomendada

```text
DIÁRIO (madrugada):
  1. spot_ws_download(optionalscomplete, json)  → sincroniza tudo
  2. spot_ws_canceled_products                  → marca removidos

HORÁRIO:
  3. spot_ws_stocks (filtrado por ref com movimentação)
     → atualiza Quantity + NextDate/NextQuantity

SEMANAL:
  4. spot_ws_download(customizationOptions, json) → atualiza preços de personaliz.
  5. spot_ws_customization_tables                 → atualiza tabelas base

MENSAL:
  6. spot_ws_colors
  7. spot_ws_product_types
```

### Identificação dos Campos de Capacidade/Tamanho

| Tipo de produto | Campo no pai | Campo na variante |
|---|---|---|
| Garrafas / Copos | `Capacitys` (ex: "510 mL") | `Capacity` (ex: "510 mL") |
| Têxteis | `Sizes` (ex: "P, M, G, GG") | `Size` (ex: "G") + `SizeLengthCM`/`SizeWidthCM` por variante |
| Baterias | `CapacityMah` (campo existe, validação pendente) | — |
| USB / Flash | `CapacityGB` (campo existe, `"0"` em não-USB) | — |
| Dimensões físicas | `CombinedSizes` (ex: "ø11 x 136 mm" / "145 x 212 mm") | herdado do pai |
| Agenda — tamanho papel | `PaperSize` ⚠️ sempre vazio | Parsear `Description` ou `CombinedSizes` |
| Agenda — gramagem | `PaperGramage` ⚠️ sempre vazio | Parsear `Description` (ex: "70 g/m²") |
| Têxtil — gênero | `Gender` ⚠️ sempre vazio | Inferir de `Name`/`SubType` |

### Conversão de Preços (€ → R$)

Os preços da Spot estão em **euros (€)**. O sistema interno aplica:
- Taxa de câmbio configurável
- Markup padrão: 115% (`sale_price = cost_price × 2.15`)
- Custos de personalização são adicionados separadamente

---

*Documento gerado e validado com base em análise exaustiva de todos os feeds e ferramentas disponíveis no MCP da Spot (Stricker).*  
*Geração inicial: 2026-06-06 | Validação exaustiva (têxteis, agendas, estoque): 2026-06-06*  
*Total de chamadas API utilizadas na análise: 22/22 (other) + 4/96 (stocks)*
