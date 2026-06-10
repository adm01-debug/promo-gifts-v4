# SPOT / spotgifts.com.br — Análise Cirúrgica Exaustiva v2.0

> **Classificação:** CONFIDENCIAL — USO INTERNO  
> **Data da Análise:** 2026-03-08  
> **Versão da Aplicação:** v49.10.7  
> **Conta de Acesso:** brasilmarcas  
> **Método:** Engenharia reversa completa da interface web (pública + autenticada)  
> **Canal mapeado:** Canal B (portal público) + Canal C (portal autenticado) — ver [`README.md`](./README.md)

---

## ÍNDICE GERAL

1. [Identidade e Contexto de Negócio](#1-identidade-e-contexto-de-negócio)
2. [Infraestrutura e Stack Técnica](#2-infraestrutura-e-stack-técnica)
3. [Sistema de Autenticação](#3-sistema-de-autenticação)
4. [Gestão de Sessão, Cookies e Storage](#4-gestão-de-sessão-cookies-e-storage)
5. [Variáveis Globais JavaScript](#5-variáveis-globais-javascript)
6. [Mapeamento Completo de Endpoints — 28 Endpoints](#6-mapeamento-completo-de-endpoints--28-endpoints)
7. [Schemas de Resposta JSON](#7-schemas-de-resposta-json)
8. [Catálogo — Motor de Busca e Filtros](#8-catálogo--motor-de-busca-e-filtros)
9. [Produto — Personalização e Técnicas de Impressão](#9-produto--personalização-e-técnicas-de-impressão)
10. [Carrinho — Fluxo Completo](#10-carrinho--fluxo-completo)
11. [Checkout — Formulário de Destino e Pagamento](#11-checkout--formulário-de-destino-e-pagamento)
12. [Simulador de Personalização](#12-simulador-de-personalização)
13. [Fluxo da Loja (AJAX)](#13-fluxo-da-loja-ajax)
14. [Área do Cliente](#14-área-do-cliente)
15. [Maquetas Guardadas](#15-maquetas-guardadas)
16. [Orçamentos Comparativos](#16-orçamentos-comparativos)
17. [Pedidos Reais — Dados de Produção](#17-pedidos-reais--dados-de-produção)
18. [Documentos Financeiros](#18-documentos-financeiros)
19. [Analytics e Tracking](#19-analytics-e-tracking)
20. [Módulos JavaScript (pt.js)](#20-módulos-javascript-ptjs)
21. [URL Patterns da Aplicação](#21-url-patterns-da-aplicação)
22. [Segurança — Vulnerabilidades e Observações](#22-segurança--vulnerabilidades-e-observações)
23. [Deduções Arquiteturais](#23-deduções-arquiteturais)
24. [Glossário de Termos Internos](#24-glossário-de-termos-internos)

---

## 1. Identidade e Contexto de Negócio

### 1.1 Quem é a SPOT / Stricker

A **SPOT** é a marca brasileira (pt-BR) da **Stricker**, uma empresa global de brindes promocionais e presentes corporativos. O domínio `spotgifts.com.br` serve como plataforma B2B onde distribuidores e revendedores autorizados (como a conta `brasilmarcas`) fazem login para consultar catálogos, configurar personalizações, solicitar orçamentos e realizar pedidos.

| Atributo | Valor |
|----------|-------|
| URL Base | `https://www.spotgifts.com.br/pt/` |
| Marca Brasil | SPOT |
| Marca Global | STRICKER |
| Sub-marca Têxtil | SUCO Brazil (TypeCode=23) |
| Modelo de Negócio | B2B — distribuição de brindes promocionais |
| Moeda | BRL (Real Brasileiro) |
| País Fixo | BR |
| Idioma Padrão | pt (português) |
| Suporte Multi-idioma | Sim, via prefixo `/{lang}/` na URL |

### 1.2 Subcatálogos Identificados

| ID | Nome | Descrição Deduzida |
|----|------|---------------------|
| 1 | SPOT | Catálogo principal — linha completa |
| 4 | (sub) | Sub-catálogo não nomeado — possivelmente promocional ou sazonal |
| 5 | Novidades | Produtos novos recém-adicionados |
| 7 | Stockout | Produtos em liquidação / sem reposição |
| 11 | Our Nature | Linha sustentável / ecológica |

---

## 2. Infraestrutura e Stack Técnica

### 2.1 Stack Completa

| Camada | Tecnologia | Versão/Detalhe | Observações |
|--------|-----------|----------------|-------------|
| **Backend** | PHP | Arquitetura MVC própria | Não usa framework popular — código proprietário |
| **CDN** | Cloudflare | Proxy + TLS 1.3 | Ray ID exemplo: `9d9468a6ab8df161-ORD` (PoP em Chicago) |
| **Reverse Proxy** | Envoy | Header `x-envoy-upstream-service-time` | Sugere container orchestration (Kubernetes/Istio) |
| **Frontend JS** | jQuery | 1.9.1 | Versão muito antiga (2013) — risco de vulnerabilidades |
| **Frontend UI** | jQuery UI | 1.9.2 | Componentes: datepicker, sortable |
| **Seletor** | Select2 | latest | `select2.min.js` — para dropdowns avançados |
| **Carrossel** | Owl Carousel | — | `owl.carousel.min.js` |
| **Tabelas** | DataTables | — | `jquery.dataTables` + `fixedColumns` |
| **Alertas** | AlertifyJS | — | `alertify.min.js` |
| **Números** | Numeral.js | — | `numeral.min.js` — formatação monetária |
| **Analytics** | Google Analytics 4 | G-P6EHZG9H8E | E-commerce tracking |
| **Tag Manager** | GTM | GTM-M8RVG96, GTM-NP6B2NG7 | 2 containers |
| **Marketing** | Salesforce MC | OrgId 510006116 | Marketing Cloud |
| **Fonte** | Google Fonts | Montserrat (400, 500, 600, 700) | Fonte principal da UI |

### 2.2 Bundle JavaScript (v49.10.7)

| Arquivo | Tamanho | Função |
|---------|---------|--------|
| `/public/js/main.prod.js` | ~110 KB | Lógica principal — catálogo, produto, carrinho, favoritos |
| `/public/js/global.prod.js` | ~4.9 KB | Init global, loja, calendário de eventos |
| `/public/js/form-validation.prod.js` | ~10.5 KB | Validações de formulários |
| `/fotos/traducoes/pt.js` | ~32 KB | Strings de tradução — mapa completo de 19 módulos |

---

## 3. Sistema de Autenticação

### 3.1 Fluxo de Login

```
GET /pt/area-reservada/login/
    → Renderiza formulário HTML
    → POST com credenciais (login, pwd, subm=true)
        → SUCESSO: HTTP 302 → /pt/ + Set-Cookie: PHPSESSID
        → FALHA: HTTP 200 → re-renderiza página (sem JSON de erro)
```

### 3.2 Parâmetros de Login

| Parâmetro | Tipo | Valor | Obrigatório |
|-----------|------|-------|-------------|
| `login` | string | Username ou e-mail | **Sim** |
| `pwd` | string (max 20) | Senha | **Sim** |
| `subm` | hidden | `true` | **Sim** |
| `urlreturn` | string | URL de retorno após login | Não |

### 3.3 Proteção Anti-Fraude — Bloqueio Geolocalizado

> *"A sua conta foi bloqueada devido a acessos em diferentes Países em simultâneo."*

O backend compara o IP/geolocalização da sessão atual com sessões anteriores e bloqueia se detectar acesso de múltiplos países simultaneamente. **Qualquer automação com IP fora do Brasil pode bloquear a conta.**

### 3.4 Comportamento de Redirecionamento de Auth

| Cenário | Comportamento |
|---------|---------------|
| Endpoint protegido sem sessão | JSON: `{"success":false,"type":"redirect","data":"/pt/area-reservada/login/?urlreturn=..."}` |
| Página protegida sem sessão | HTTP 200 mas renderiza a homepage (sem 401/403) |
| Conta bloqueada (multi-país) | Mensagem de erro específica |
| Faturas vencidas | Mensagem: *"Existem faturas vencidas que ainda não foram liquidadas."* |

---

## 4. Gestão de Sessão, Cookies e Storage

### 4.1 Cookies

| Cookie | Função | Expiração |
|--------|--------|-----------|
| `PHPSESSID` | Autenticação principal | Sessão (browser close) |
| `cookiePolicy` | Aceite LGPD/cookies | 365 dias |
| `help_cookie_{id}` | Controla tooltips/ajuda já vistos | 365 dias |
| `list` | Estado de listas/favoritos | Sessão |

### 4.2 LocalStorage

| Chave | Função |
|-------|--------|
| `personalizador-designer-{id}` | Estado completo do editor de personalização para um produto específico |
| `personalizador-designer-base64-{id}` | Imagem base64 do designer salva localmente |

---

## 5. Variáveis Globais JavaScript

```
window.appComponent
  └── app_configs
       └── apiUrl
            └── createDraft → /pt/simulador/actions/criarDraft.php

window.carrinho_devolve_validar
window.carrinho_devolve_validar_amostra_fisica
window.save_physical_sample_info_url
```

---

## 6. Mapeamento Completo de Endpoints — 28 Endpoints

### Endpoints Públicos (sem auth)

| # | Método | Endpoint | Função |
|---|--------|----------|--------|
| 1 | GET | `/pt/catalogo/ajax/pesquisar.php` | Pesquisa rápida de produtos |
| 2 | POST | `/pt/catalogo/catalogo.ajax.php` (method=getStockWarehouses) | Stock por armazém |
| 3 | GET | `/pt/produto/ajax/carregaPersonalizacoes.php` | Dados de personalização do produto |
| 4 | GET | `/pt/produto/ajax/carregaRelacionados.php` | Produtos relacionados |

### Endpoints com Auth Obrigatória

| # | Método | Endpoint | Função |
|---|--------|----------|--------|
| 5 | POST | `/pt/area-reservada/login/` | Login |
| 6 | POST | `/pt/catalogo/catalogo.ajax.php` (method=getSemaforo) | Semáforo de stock |
| 7 | POST | `/pt/catalogo/catalogo.ajax.php` (method=getCidadeByCEP) | Lookup de CEP |
| 8 | POST | `/pt/catalogo/catalogo.ajax.php` (method=toggleFavorite) | Favoritar produto |
| 9 | POST | `/pt/catalogo/catalogo.ajax.php` (method=setComercialMarkets) | Definir mercados |
| 10 | GET | `/pt/calculos/ajax/actualizarGrupoProduto.php` | Atualizar/remover item do carrinho |
| 11 | GET | `/pt/carrinho/ajax/esvaziarCarrinho.php` | Esvaziar carrinho |
| 12 | POST | `/pt/carrinho/ajax/importFicheiro.php` | Importar carrinho via Excel |
| 13 | POST | `/pt/carrinho/ajax/pesquisaRapida.php` | Pesquisa rápida no carrinho |
| 14 | GET | `/pt/simulador/actions/devolvePersonalizacoesParaValidar.php` | Validar personalizações |
| 15 | GET | `/pt/carrinho/ajax/devolveGruposParaValidarAmostraFisica.php` | Validar amostra física |
| 16 | POST | `/pt/carrinho/ajax/guardarInfoAmostraFisica.php` | Salvar info amostra |
| 17 | POST | `/pt/loja/loja.ajax.php` (method=devolveOpcoesEntrega) | Opções de entrega |
| 18 | POST | `/pt/loja/loja.ajax.php` (method=devolveOpcoesEntregaExpedicao) | Opções de expedição |
| 19 | POST | `/pt/loja/loja.ajax.php` (method=devolvePortes) | Calcular frete |
| 20 | POST | `/pt/loja/actions/verificaCompras.php` | Validar compras antes de confirmar |
| 21 | POST | `/pt/simulador/actions/criarDraft.php` | Criar rascunho de personalização |
| 22 | POST | `/pt/simulador/actions/guardarMaqueta.php` | Salvar layout |
| 23 | POST | `/pt/simulador/actions/adicionarAoCarrinho.php` | Adicionar personalizado ao carrinho |
| 24 | POST | `/pt/clientes/clientes.ajax.php` (method=getCidadeByCEP) | CEP via área do cliente |
| 25 | GET | `/pt/clientes/documentos/download.php` | Download de fatura/NF |
| 26 | GET | `/clientes/encomendas.php` | Detalhe do pedido |
| 27 | POST | `/maquetas_guardadas/actions/remover.php` | Remover maqueta |
| 28 | GET | `/pt/maquetas_guardadas/paginas/listagem.php` | Listar maquetas |

### Dispatchers Multipropósito

| Dispatcher | Métodos |
|-----------|---------|
| `catalogo.ajax.php` | getSemaforo, getStockWarehouses, getCidadeByCEP, toggleFavorite, setComercialMarkets |
| `loja.ajax.php` | devolveOpcoesEntrega, devolveOpcoesEntregaExpedicao, devolvePortes |
| `clientes.ajax.php` | getCidadeByCEP |

---

## 7. Schemas de Resposta JSON

O sistema utiliza **3 schemas de resposta JSON distintos**:

#### Padrão 1 — `_status` wrapper (catalogo.ajax.php)
```json
{ "data": { /* payload */ }, "_status": { "success": true } }
```

#### Padrão 2 — `success` + `data.type` (simulador, carrinho, maquetas)
```json
{ "success": true, "data": { "message": "mensagem", "type": "redirect|success|error|none" } }
```

#### Padrão 3 — `result` wrapper (loja.ajax.php)
```json
{ "result": { /* array ou objeto */ } }
```

### Enum de Tipos (`data.type`)

| Valor | Comportamento Frontend |
|-------|----------------------|
| `"redirect"` | `window.location = data.message` |
| `"success"` | Exibir notificação de sucesso |
| `"error"` | Exibir erro ao usuário |
| `"none"` | Nenhuma ação (lista vazia, validação ok) |

> ⚠️ **ALERTA:** O sistema usa HTTP 500 para erros de validação mas ainda retorna JSON válido. O status HTTP **não é confiável** — sempre verificar `success` no body.

---

## 8. Catálogo — Motor de Busca e Filtros

### 8.1 Pesquisa Rápida

**Endpoint:** `GET /pt/catalogo/ajax/pesquisar.php`

| Parâmetro | Tipo | Obrigatório |
|-----------|------|-------------|
| `ajax` | int `1` | Sim |
| `q` | string (max 100) | Sim |

**Response:** até 5 resultados no formato `{line, value (URL), text (REF - NOME)}`.

### 8.2 Filtros do Catálogo

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `q` | string | Texto livre |
| `f1[]` | array int | Categoria/separador |
| `f2[]` | array int | Família de produto (152 famílias) |
| `f3[]` | array int | Cor |
| `f4[]` | array int | Técnica de impressão (14 técnicas) |
| `f6[]` | array int | Temáticos (26 categorias) |
| `f9[]` | array int | Tamanho (têxtil) — P, M, G, GG, XGG |
| `n_cores[]` | array | Nº de cores: 1, 2, 3, 4, 5, 12, Full color |
| `excl_on` | bool | Excluir sem estoque |
| `catalogo` | int | Sub-catálogo: 1, 4, 5, 7, 11 |

> Não existem `f5[]`, `f7[]` ou `f8[]` — foram removidos ou deprecados.

### 8.3 Técnicas de Impressão (14 completas)

| # | Técnica | Notas |
|---|---------|-------|
| 1 | Autocolantes brancos | Adesivos |
| 2 | Bordado | Custo por pontos |
| 3 | Cunho | Gravação por pressão |
| 4 | Doming | Resina 3D |
| 5 | Laser | Gravação laser padrão |
| 6 | Laser circular | 360° |
| 7 | Serigrafia | Silk screen padrão |
| 8 | Serigrafia Circular | 360° silk screen |
| 9 | Serigrafia têxtil | Para tecidos |
| 10 | Sublimação - Sob Consulta | Preço manual |
| 11 | Tampografia | Pad printing |
| 12 | Transferência | Transfer |
| 13 | UV Digital | Full color |
| 14 | Termogravação | Gravação térmica |

---

## 9. Produto — Personalização e Técnicas de Impressão

### 9.1 Sistema Dual de IDs

| ID | Nome | Visibilidade | Exemplo |
|----|------|-------------|---------|
| `prod` | ID interno | Somente backend/dev | `1824` |
| `iderp` | Referência ERP | Visível ao cliente | `81198` |

### 9.2 Padrão de URLs de Imagens

```
Produto:      /fotos/produtos/{iderp}_{cor}-{view}.jpg
              Ex: /fotos/produtos/81198_103-box.jpg

Picotado:     /fotos/produtos/picotado/{prod_id}/{iderp}_{comp}_{loc}_{view}.png
              Ex: /fotos/produtos/picotado/1824/81198_1_1_1.png
```

### 9.3 Data-Attributes do Produto (HTML)

| Atributo | Exemplo | Uso |
|----------|---------|-----|
| `data-prod` | `1824` | ID interno |
| `data-iderp` | `81198` | Referência ERP |
| `data-rel` | `660;1742` | Produtos relacionados (`;` separados) |
| `data-fav` | `0` ou `1` | Estado de favorito |
| `data-img-zoom` | `/fotos/produtos/81198_103-box.jpg` | URL da imagem zoom |

---

## 10. Carrinho — Fluxo Completo

### 10.1 Conceito de "Grupo de Produto"

O carrinho organiza itens em **grupos** (`grupo_id`). Cada grupo pode conter o produto base + personalizações + opcionais vinculados. O grupo é a unidade atômica de operação — é o que se remove, atualiza ou valida.

### 10.2 Endpoints do Carrinho

| Endpoint | Método | Parâmetros | Função |
|----------|--------|-----------|--------|
| `/pt/calculos/ajax/actualizarGrupoProduto.php` | GET | `id` (grupo), `action=del` | Remover item |
| `/pt/carrinho/ajax/esvaziarCarrinho.php` | GET | — | Esvaziar carrinho |
| `/pt/carrinho/ajax/importFicheiro.php` | POST | arquivo `.xlsx` (max 200KB) | Importar via Excel |
| `/pt/carrinho/ajax/pesquisaRapida.php` | POST | `q` (ref), `ajax=1` | Busca rápida |

---

## 11. Checkout — Formulário de Destino e Pagamento

### 11.1 Fluxo de Checkout

```
/pt/loja/ (carrinho) → /pt/loja/destino/ (endereço + pagamento)
  → /pt/loja/confirmacao/ (revisão) → Pedido Confirmado
```

### 11.2 Campos do Formulário `/pt/loja/destino/`

| Campo `name` | Tipo | Função |
|-------------|------|--------|
| `carrinho_hash` | hidden | Hash SHA de integridade do carrinho (anti-tampering) |
| `nome` | text | Nome do destinatário |
| `codigopostal` | text | CEP (dispara `getCidadeByCEP` via `blur`) |
| `bairro`, `localidade`, `tipo_logradouro`, `morada` | text | Auto-preenchidos pelo CEP |
| `pais` | hidden | País fixo: `BR` |
| `local` | text | Complemento / número |
| `telefone` | tel | Telefone |
| `email` | hidden | E-mail (pré-preenchido da conta) |
| `id_morada` | select (Select2) | Endereço salvo |
| `estado` | select | Estado BR (AC–TO) |
| `id_payment` | select (Select2) | Método de pagamento |
| `decimals` | hidden | Casas decimais: `2` |

### 11.3 Loja AJAX — Cálculo de Entrega (encadeado)

```
1. devolveOpcoesEntrega (id_entrega)
   → 2. devolveOpcoesEntregaExpedicao (id_expedicao + id_entrega)
      → 3. devolvePortes (id_pagamento + id_entrega + id_expedicao)
         → Retorna {html: {portes, totalgeral}}
```

---

## 12. Simulador de Personalização

| Endpoint | Função |
|----------|--------|
| `POST /pt/simulador/actions/criarDraft.php` | Criar rascunho |
| `POST /pt/simulador/actions/guardarMaqueta.php` | Salvar layout |
| `POST /pt/simulador/actions/adicionarAoCarrinho.php` | Adicionar ao carrinho |
| `GET /pt/simulador/actions/devolvePersonalizacoesParaValidar.php` | Validar pendentes |

---

## 13. Fluxo da Loja (AJAX)

Cadeia sequencial de dependências:
```
1. Selecionar Entrega → 2. Selecionar Expedição → 3. Calcular Portes
   → 4. Verificar Compras (POST /pt/loja/actions/verificaCompras.php)
      → 5. Confirmar Pedido
```

---

## 14. Área do Cliente

| Endpoint | Função |
|----------|--------|
| `GET /pt/clientes/documentos/download.php?id={doc_id}` | Download de fatura/NF |
| `GET /clientes/encomendas.php?use={pedido_id}` | Detalhe do pedido |

> **Nota:** O endpoint de encomendas NÃO tem o prefixo `/pt/` — possivelmente legado.

---

## 15. Maquetas Guardadas

`POST /maquetas_guardadas/actions/remover.php` — parâmetro `id_maqueta`.

> **BUG IDENTIFICADO:** A resposta de sucesso retorna `"success": false` quando o `type` é `"redirect"`. O frontend provavelmente ignora `success` e age baseado em `type`.

---

## 16. Orçamentos Comparativos

**URL:** `/pt/orcamentos/?n=1`

Sistema de comparação de orçamentos com quantidades variáveis, margens de produto e de personalização, e extras. Recurso B2B sofisticado — distribuidores podem comparar diferentes configurações de pedido lado a lado.

---

## 17. Pedidos Reais — Dados de Produção

10 pedidos encontrados na conta brasilmarcas (fev-mar/2026), range ID: 380616 → 382090. Todos com status "Liquidada".

**IDs são sequenciais globais** (não por cliente) — a diferença entre IDs indica o volume de pedidos de todos os clientes no período.

---

## 18. Documentos Financeiros

| Nº Doc | Nº Pedido | Data | Montante | Status |
|--------|-----------|------|----------|--------|
| 457757 | 382064 | 2026-03-07 | R$ 11.536,20 | Liquidada |
| 455876 | 381961 | 2026-02-26 | R$ 3.965,76 | Liquidada |
| 455806 | 381974 | 2026-02-26 | R$ 481,95 | Liquidada |
| 455704 | 382032 | 2026-02-25 | R$ 285,60 | Liquidada |
| 455040 | 380684 | 2026-02-21 | R$ 191,70 | Liquidada |

**Total faturado (visível):** R$ 23.623,95 · **Ticket médio:** R$ 2.624,88

---

## 19. Analytics e Tracking

| Sistema | ID/Config |
|---------|-----------|
| Google Analytics 4 | `G-P6EHZG9H8E` — Enhanced Ecommerce |
| GTM Container 1 | `GTM-M8RVG96` — tracking principal |
| GTM Container 2 | `GTM-NP6B2NG7` — marketing/remarketing |
| Salesforce MC | OrgId `510006116` — trackPageView em todas as páginas |

### Schema GA4 de Produto (Dados Reais)

```json
{
  "item_id": "92365",
  "item_name": "ARUBA. Bolsa de cosméticos em 300D",
  "affiliation": "SPOT",
  "currency": "BRL",
  "item_category": "SPOT",
  "item_category2": "Bolsas de Cosméticos",
  "item_variant": "92365-131",
  "price": 606.9,
  "quantity": 102
}
```

---

## 20. Módulos JavaScript (pt.js)

O arquivo `/fotos/traducoes/pt.js` expõe **19 módulos** com **340+ strings de interface**:

| Módulo | Strings | Descrição |
|--------|---------|-----------|
| `txt_simulador` | 87 | Motor completo do simulador — módulo mais complexo |
| `txt_formulario` | 75 | Formulário de personalização (upload, cores, bordado) |
| `txt_loja` | 48 | Fluxo de compra: stock, transportadora, amostra física |
| `txt_geral` | 22 | UI global: cancelar, confirmar, fechar, avançar |
| `txt_catalogo` | 16 | Validações de carrinho, expiração, múltiplos de quantidade |
| `txt_clientes` | 14 | Bloqueio de conta, CEP, faturas vencidas |
| `txt_customizador` | 15 | Editor visual: apagar, copiar, erros de área, HotSpots |
| `txt_orcamentos_comparativos` | 12 | Orçamento comparativo: quantidades, margens |
| `txt_newsletter` (DataTables) | 12 | Paginação, ordenação, filtros de tabelas |
| `txt_servicos` | 10 | Confirmar encomenda, cores Pantone, upload |
| + 9 módulos adicionais | — | — |

### Strings Críticas de Negócio

| Chave | Implicação |
|-------|-----------|
| `calculadora_bloqueada_js` | Alguns produtos têm precificação manual (sob consulta) |
| `personalizar_erro_numero_cores_js` | Validação client-side de cores no upload |
| `personalizar_pantone_disclaimer_js` | Disclaimer legal obrigatório para cores Pantone |
| `erro_quantidade_multiplo` | Validação de MOQ (Minimum Order Quantity) |

---

## 21. URL Patterns da Aplicação

| Pattern | Exemplo | Descrição |
|---------|---------|-----------|
| `/pt/catalogo/{slug}/{iderp}/` | `/pt/catalogo/roller-em-metal/81198/` | Página de produto |
| `/fotos/produtos/{iderp}_{cor}-{view}.jpg` | `/fotos/produtos/81198_103-box.jpg` | Imagem de produto |
| `/fotos/produtos/picotado/{prod}/{iderp}_{c}_{l}_{v}.png` | `/fotos/produtos/picotado/1824/81198_1_1_1.png` | Zona de impressão |
| `/clientes/encomendas.php?use={id}` | `?use=382064` | Detalhe do pedido |
| `/pt/clientes/documentos/download.php?id={id}` | `?id=457757` | Download de fatura |
| `/pt/loja/carrinho/` | — | Carrinho |
| `/pt/loja/destino/` | — | Endereço de entrega |
| `/pt/loja/confirmacao/` | — | Confirmação do pedido |
| `/pt/orcamentos/?n=1` | — | Orçamento comparativo |

---

## 22. Segurança — Vulnerabilidades e Observações

### Vulnerabilidades

| Criticidade | Item |
|------------|------|
| 🔴 CRÍTICO | **Sem CSRF Token** — chamadas AJAX POST sem proteção |
| 🔴 CRÍTICO | **Bloqueio geolocalizado** — IP fora do Brasil bloqueia a conta |
| 🟡 ALTO | Endpoints públicos sensíveis retornam dados reais sem auth |
| 🟡 ALTO | Faturas/NFs protegidas apenas por PHPSESSID sem 2FA |
| 🟡 MÉDIO | HTTP Status Codes incorretos (500 para validação) |
| 🟡 MÉDIO | jQuery 1.9.1 (2013) com vulnerabilidades conhecidas |

### Controles Positivos

| Status | Item |
|--------|------|
| ✅ | HTTPS obrigatório com Cloudflare + TLS 1.3 |
| ✅ | `X-Frame-Options: SAMEORIGIN` |
| ✅ | `Cache-Control: no-store, no-cache` |
| ✅ | `carrinho_hash` SHA previne manipulação entre páginas |
| ✅ | Bloqueio geolocalizado como defesa principal |

---

## 23. Deduções Arquiteturais

1. **jQuery 1.9.1 (2013) + PHP MVC próprio** = sistema com 10+ anos de idade
2. **3 schemas de resposta JSON diferentes** = evolução por múltiplos desenvolvedores/fases
3. **Endpoint duplicado `getCidadeByCEP`** (catalogo + clientes) = refatoração incompleta
4. **Versionamento v49.10.7** = 49 major releases, sistema maduro e em desenvolvimento ativo
5. **Dual ID system** (`prod` + `iderp`) = tight-coupling com ERP externo
6. **URL prefix `/{lang}/`** = suporte multi-idioma; instância BR tem país fixo
7. **O sistema nunca retorna HTTP 401 ou 403** — usa HTTP 200 para tudo, com controle via JSON ou redirect no body

---

## 24. Glossário de Termos Internos

| Termo | Significado |
|-------|-------------|
| **iderp** | ID de referência do ERP (visível ao cliente) |
| **prod** | ID interno do banco de dados web |
| **maqueta** | Layout/design de personalização salvo |
| **picotado** | Imagem da zona de impressão recortada |
| **semáforo** | Sistema visual de disponibilidade (verde/amarelo/vermelho) |
| **portes** | Custo de frete/transporte |
| **grupo** | Unidade de item no carrinho (produto + personalizações) |
| **draft** | Rascunho de personalização no simulador |
| **amostra física** | Sample físico antes do pedido final |
| **morada** | Endereço (termo português de Portugal) |
| **encomenda** | Pedido (termo PT) |
| **opcionais** | Acessórios/extras do produto |
| **TypeCode** | Código de tipo de produto (ex: 23 = têxtil SUCO) |

---

> **Análise realizada em 2026-03-08 · Aplicação: SPOT / spotgifts.com.br v49.10.7**  
> **Cobre:** Canal B (portal público) + Canal C (portal autenticado) — ver [`README.md`](./README.md) para o Canal A (webservice API)  
> **⚠️ CONFIDENCIAL — USO INTERNO**
