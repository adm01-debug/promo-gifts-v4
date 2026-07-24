# 📋 Inventário Completo de Funcionalidades e Ferramentas

> Documento de referência para replicação de padrões em outros projetos  
> **Última atualização:** 03/03/2026

---

## 🔐 1. AUTENTICAÇÃO E SEGURANÇA

### 1.1 Autenticação de Usuários
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Login/Registro | `src/pages/Auth.tsx` | Supabase Auth |
| Contexto de Auth | `src/contexts/AuthContext.tsx` | React Context, Supabase |
| Rota Protegida | `src/components/auth/ProtectedRoute.tsx`, `src/components/layout/ProtectedRoute.tsx` | React Router DOM |
| Recuperação de Senha | `src/components/auth/ForgotPasswordForm.tsx` | Supabase Auth |
| Reset de Senha | `src/pages/ResetPassword.tsx` | Supabase Auth |
| Aprovação de Reset (Admin) | `src/components/admin/PasswordResetApproval.tsx` | Supabase, React Query |
| Hook de Reset Requests | `src/hooks/usePasswordResetRequests.ts` | Supabase |
| SSO Callback | `src/pages/SSOCallbackPage.tsx` | Supabase Auth |
| Reautenticação | `src/hooks/useReauthentication.ts` | Supabase Auth |

### 1.2 Controle de Acesso (RBAC)
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook RBAC | `src/hooks/useRBAC.tsx` | React, Supabase |
| Página de Roles | `src/pages/RolesPage.tsx` | React |
| Página de Permissões | `src/pages/PermissionsPage.tsx` | React |
| Página Role-Permissões | `src/pages/RolePermissionsPage.tsx` | React |
| Tabelas: `roles`, `permissions`, `user_roles` | Supabase Database | PostgreSQL, RLS Policies |

### 1.3 Autenticação de Dois Fatores (2FA)
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Setup 2FA | `src/components/security/TwoFactorSetup.tsx` | otpauth, qrcode.react |
| Hook 2FA | `src/hooks/use2FA.ts` | otpauth |

### 1.4 WebAuthn / Passkeys
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook WebAuthn | `src/hooks/useWebAuthn.ts` | Web Authentication API |
| Gerenciador de Passkeys | `src/components/security/PasskeyManager.tsx` | React |

### 1.5 Restrição por IP
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Gerenciador de IPs | `src/components/security/IPRestrictionManager.tsx` | React, Supabase |
| Hook de IPs Permitidos | `src/hooks/useAllowedIPs.ts` | Supabase |
| Validação de IP | `src/hooks/useIPValidation.ts` | Supabase, fetch API |
| Tabelas: `ip_whitelist`, `login_attempts` | Supabase Database | PostgreSQL, RLS |

### 1.6 Geo-Blocking
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Gerenciador GeoBlocking | `src/components/security/GeoBlockingManager.tsx` | React, Supabase |
| Hook GeoBlocking | `src/hooks/useGeoBlocking.ts` | Supabase |
| Edge Function Validação | `supabase/functions/validate-access/index.ts` | Deno |
| Tabelas: `geo_allowed_countries`, `city_whitelist`, `access_blocked_log` | Supabase Database | PostgreSQL |

### 1.7 Segurança de Acesso Avançada
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Dashboard de Segurança | `src/components/security/SecurityDashboard.tsx` | React |
| Gerenciador de Acesso | `src/components/admin/AccessSecurityManager.tsx` | React, Supabase |
| Hook Segurança de Acesso | `src/hooks/useAccessSecurity.ts` | Supabase |
| Detecção de Dispositivos | `src/hooks/useDeviceDetection.ts` | React |
| Edge Function Novo Dispositivo | `supabase/functions/detect-new-device/index.ts` | Deno |
| Tabelas: `access_security_settings`, `user_known_devices`, `device_login_notifications` | Supabase Database | PostgreSQL |

### 1.8 Configurações de Segurança
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página de Segurança | `src/pages/Security.tsx` | React |
| Página Admin Segurança | `src/pages/admin/AdminSegurancaPage.tsx` | React |
| Configurações Gerais | `src/components/security/SecuritySettings.tsx` | React, Supabase |
| Push Notification Settings | `src/components/security/PushNotificationSettings.tsx` | React |

### 1.9 CAPTCHA
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook Captcha | `src/hooks/useCaptcha.ts` | React |

### 1.10 Verificação de Senhas Comprometidas
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook Password Breach | `src/hooks/usePasswordBreachCheck.tsx` | Have I Been Pwned API |

---

## 🤖 2. INTELIGÊNCIA ARTIFICIAL

### 2.1 Chat com Especialista IA
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Botão do Chat | `src/components/expert/ExpertChatButton.tsx` | React, Lucide Icons |
| Dialog do Chat | `src/components/expert/ExpertChatDialog.tsx` | Shadcn Dialog |
| Edge Function | `supabase/functions/expert-chat/index.ts` | Deno, Lovable AI Gateway |
| Hook Conversações | `src/hooks/useExpertConversations.tsx` | Supabase, React Query |
| Tabelas: `expert_conversations`, `expert_messages` | Supabase Database | PostgreSQL |

### 2.2 Recomendações de IA
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Painel de Recomendações | `src/components/ai/AIRecommendationsPanel.tsx` | React |
| Chat IA | `src/components/ai/AIChat.tsx` | React |
| Hook Recomendações | `src/hooks/useAIRecommendations.ts` | Supabase Functions |
| Edge Function | `supabase/functions/ai-recommendations/index.ts` | Deno, Lovable AI Gateway |
| Smart Recommendations | `src/components/products/SmartRecommendations.tsx` | React |
| Product Intelligence | `src/components/products/ProductIntelligence.tsx` | React |
| Technique Recommendations | `src/hooks/useTechniqueRecommendations.ts` | React |

### 2.3 Busca Semântica
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Edge Function | `supabase/functions/semantic-search/index.ts` | Deno, Lovable AI Gateway, Cache TTL |
| RPC Function | `search_products_semantic` | PostgreSQL, pg_trgm |

### 2.4 Busca Visual (por Imagem)
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Botão Busca Visual | `src/components/search/VisualSearchButton.tsx` | React |
| Edge Function | `supabase/functions/visual-search/index.ts` | Deno, Lovable AI Gateway |
| Análise de imagem e busca por similaridade | Lovable AI | google/gemini-2.5-flash |

### 2.5 Geração de Mockups com IA
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página Gerador | `src/pages/MockupGenerator.tsx` | React |
| Edge Function | `supabase/functions/generate-mockup/index.ts` | Deno, Lovable AI Gateway |
| Edge Function NanoBanana | `supabase/functions/generate-mockup-nanobanana/index.ts` | Deno, NanoBanana API |
| Editor de Posição | `src/components/mockup/LogoPositionEditor.tsx` | Canvas API |
| Multi-Área | `src/components/mockup/MultiAreaManager.tsx` | React, @dnd-kit |
| Seletor de Produto | `src/components/mockup/MockupProductSelector.tsx` | React |
| Combobox de Busca | `src/components/mockup/ProductSearchCombobox.tsx` | React, cmdk |
| Seletor de Cliente | `src/components/mockup/MockupClientSelector.tsx` | React |
| Config Panel | `src/components/mockup/MockupConfigPanel.tsx` | React |
| Result Card | `src/components/mockup/MockupResultCard.tsx` | React, Framer Motion |
| Wizard de Etapas | `src/components/mockup/MockupWizard.tsx` | React |
| Anotações | `src/components/mockup/MockupAnnotations.tsx` | React |
| Comparação A/B | `src/components/mockup/MockupBeforeAfter.tsx` | React |
| Comparação Dialog | `src/components/mockup/MockupCompareDialog.tsx` | React |
| Histórico | `src/components/mockup/MockupHistoryPanel.tsx` | React, Supabase |
| Area Card | `src/components/mockup/AreaCard.tsx` | React |
| Cores da Logo | `src/components/mockup/LogoColorAnalyzer.tsx` | React |
| Config de Cores/Técnica | `src/components/mockup/TechniqueColorConfigDialog.tsx` | React |
| Art File Upload | `src/components/mockup/ArtFileUpload.tsx` | React, Supabase Storage |
| Template Selector | `src/components/mockup/TemplateSelector.tsx` | React |
| Template Preview | `src/components/mockup/TemplatePreview.tsx` | React |
| Save Template Dialog | `src/components/mockup/SaveTemplateDialog.tsx` | React |
| Share Menu | `src/components/mockup/ShareMenu.tsx` | React, Web Share API |
| Keyboard Shortcuts | `src/components/mockup/KeyboardShortcuts.tsx` | React |
| Success Toast | `src/components/mockup/MockupSuccessToast.tsx` | React |
| Skeleton Loading | `src/components/mockup/MockupSkeleton.tsx` | React |
| Generating Overlay | `src/components/mockup/GeneratingOverlay.tsx` | React, Framer Motion |
| Generate Button | `src/components/mockup/GenerateButton.tsx` | React |
| Technique Tooltip | `src/components/mockup/TechniqueTooltip.tsx` | React |
| Hook Gerador | `src/hooks/useMockupGenerator.ts` | Supabase |
| Hook Draft | `src/hooks/useMockupDraft.ts` | Supabase |
| Hook Técnicas | `src/hooks/useMockupTechniques.ts` | Supabase |
| Hook Cores da Logo | `src/hooks/useLogoColorAnalysis.ts` | React |
| Hook Posição | `src/hooks/usePositionHistory.ts` | React |
| Hook Print Areas | `src/hooks/usePrintAreas.ts` | Supabase |
| Hook Product Bounds | `src/hooks/useProductBounds.ts` | React |
| Lib Storage | `src/lib/mockup-storage.ts` | Supabase Storage |
| Lib Product Bounds | `src/lib/product-bounds-detector.ts` | Canvas API |
| Lib Print Area Grouping | `src/lib/print-area-grouping.ts` | TypeScript |
| Lib Fetch Print Areas | `src/lib/fetch-print-areas.ts` | Supabase |
| Tabelas: `generated_mockups`, `mockup_templates`, `mockup_drafts`, `art_file_attachments` | Supabase Database | PostgreSQL |

### 2.6 Layout de Aprovação de Mockups
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Preview de Aprovação | `src/components/mockup/approval/MockupApprovalPreview.tsx` | React |
| Template de Aprovação | `src/components/mockup/approval/MockupApprovalTemplate.tsx` | React |
| Botões de Layout | `src/components/mockup/approval/MockupLayoutButtons.tsx` | React |
| Captura Offscreen | `src/components/mockup/approval/OffscreenLayoutCapture.tsx` | React, html2canvas |

### 2.7 Gerenciamento de Prompts IA
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Admin Prompts IA | `src/pages/admin/AdminPromptsIAPage.tsx` | React |
| Gerenciador de Prompts | `src/components/admin/MockupPromptManager.tsx` | React, Supabase |
| Tabelas: `mockup_prompt_configs`, `mockup_prompt_history` | Supabase Database | PostgreSQL |

### 2.8 Magic Up (Geração de Imagens Publicitárias)
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página Magic Up | `src/pages/MagicUp.tsx` | React |
| Resultado da Imagem | `src/components/magic-up/AdImageResult.tsx` | React |
| Banco de Prompts | `src/components/magic-up/PromptBank.tsx` | React |
| Gerador de Prompts | `src/components/magic-up/PromptGenerator.tsx` | React |
| Edge Function Geração | `supabase/functions/generate-ad-image/index.ts` | Deno, Lovable AI Gateway |
| Edge Function Prompt | `supabase/functions/generate-ad-prompt/index.ts` | Deno, Lovable AI Gateway |
| Tabela: `magic_up_generations` | Supabase Database | PostgreSQL |

### 2.9 Análise de Cores do Logo
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Edge Function | `supabase/functions/analyze-logo-colors/index.ts` | Deno, Lovable AI Gateway |

### 2.10 Sugestões Contextuais
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook | `src/hooks/useContextualSuggestions.ts` | React |

---

## 📦 3. GESTÃO DE PRODUTOS

### 3.1 Catálogo de Produtos
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Grid de Produtos | `src/components/products/ProductGrid.tsx` | React, TanStack Virtual |
| Lista de Produtos | `src/components/products/ProductList.tsx` | React |
| Card de Produto | `src/components/products/ProductCard.tsx` | React, Framer Motion |
| Card Aprimorado | `src/components/products/EnhancedProductCard.tsx` | React, Framer Motion |
| Detalhes do Produto | `src/pages/ProductDetail.tsx` | React, React Query |
| Galeria de Imagens | `src/components/products/ProductGallery.tsx` | React |
| Galeria com Zoom | `src/components/products/ZoomableGallery.tsx` | React |
| Variações | `src/components/products/ProductVariations.tsx` | React |
| Seletor de Cores | `src/components/products/ProductColorSelector.tsx` | React |
| Produtos Relacionados | `src/components/products/RelatedProducts.tsx` | React |
| Composição de Kit | `src/components/products/KitComposition.tsx` | React |
| Kit Visual | `src/components/products/KitVisualComposition.tsx` | React |
| Quick View | `src/components/products/ProductQuickView.tsx` | React |
| Hover Preview | `src/components/products/ProductHoverPreview.tsx` | React |
| Dimensões | `src/components/products/ProductDimensions.tsx` | React |
| Info Bar | `src/components/products/ProductInfoBar.tsx` | React |
| Category Badges | `src/components/products/ProductCategoryBadges.tsx` | React |
| Novelty Badge | `src/components/products/NoveltyBadge.tsx` | React |
| Packaging Badge | `src/components/products/PackagingBadge.tsx` | React |
| Packaging Modal | `src/components/products/PackagingModal.tsx` | React |
| Stats Popover | `src/components/products/StatsPopover.tsx` | React |
| Layout Popover | `src/components/products/LayoutPopover.tsx` | React |
| Column Selector | `src/components/products/ColumnSelector.tsx` | React |
| Quick Add to Quote | `src/components/products/QuickAddToQuote.tsx` | React |
| Inline Price Calculator | `src/components/products/InlinePriceCalculator.tsx` | React |
| Share Actions | `src/components/products/ShareActions.tsx` | Web Share API |
| Contexto de Produtos | `src/contexts/ProductsContext.tsx` | React Context |
| Hook Produtos | `src/hooks/useProducts.ts` | Supabase, React Query |
| Hook Imagens | `src/hooks/useProductImages.ts` | Supabase |
| Hook Busca Fuzzy | `src/hooks/useProductFuzzySearch.ts` | Fuse.js |
| Hook Recomendações | `src/hooks/useProductRecommendations.ts` | React |
| Hook Recent Products | `src/hooks/useRecentProducts.ts` | React |
| Hook Analytics | `src/hooks/useProductAnalytics.ts` | Supabase |
| Tabela: `products` | Supabase Database | PostgreSQL, Full-Text Search |

### 3.2 Virtualização
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Grid Virtualizado | `src/components/products/VirtualizedProductGrid.tsx` | @tanstack/react-virtual |
| Hook Infinite Scroll | `src/hooks/useInfiniteScroll.ts` | React |

### 3.3 Personalização de Produtos
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Regras de Personalização | `src/components/products/ProductPersonalizationRules.tsx` | React |
| Opções de Customização | `src/components/products/ProductCustomizationOptions.tsx` | React |
| Customization (subpasta) | `src/components/products/customization/` | React |
| Admin Personalização | `src/components/admin/ProductPersonalizationManager.tsx` | React |
| Grupo Personalização | `src/components/admin/GroupPersonalizationManager.tsx` | React |
| Gerenciador de Técnicas | `src/components/admin/TechniquesManager.tsx` | React, DnD Kit |
| Gerenciador de Grupos | `src/components/admin/ProductGroupsManager.tsx` | React |
| Seletor de Técnica | `src/components/personalization/TechniqueSelector.tsx` | React |
| SLA de Técnica | `src/components/personalization/TechniqueSLACard.tsx` | React |
| Customização de Tema | `src/components/personalization/ThemeCustomization.tsx` | React |
| Hook Opções Customização | `src/hooks/useProductCustomizationOptions.ts` | Supabase |
| Hook Produto Personalização | `src/hooks/useProdutoPersonalizacao.ts` | Supabase |
| Lib Personalização (Engine) | `src/lib/personalization/` (calculators, selectors, transformers, validators, repositories, services, types) | TypeScript |
| Tabelas: `personalization_techniques`, `personalization_sizes`, `personalization_locations`, `product_components`, `product_component_locations` | Supabase Database | PostgreSQL |

### 3.4 Histórico de Preços
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Gráfico de Preços | `src/components/products/PriceHistoryChart.tsx` | Recharts |

### 3.5 Novidades (Novelties)
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página Novidades | `src/pages/NoveltiesPage.tsx` | React |
| Seção de Novidades | `src/components/novelties/NoveltiesSection.tsx` | React |
| Grid de Novidades | `src/components/novelties/NoveltyProductGrid.tsx` | React |
| Stats Cards | `src/components/novelties/NoveltyStatsCards.tsx` | React |
| Widget Expirando | `src/components/novelties/ExpiringNoveltiesWidget.tsx` | React |
| Hook | `src/hooks/useNovelties.ts` | Supabase |
| Edge Function Cleanup | `supabase/functions/cleanup-novelties/index.ts` | Deno |

### 3.6 Sincronização de Produtos
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Webhook de Produtos | `supabase/functions/product-webhook/index.ts` | Deno, Supabase |
| Import CSV | `src/components/admin/ProductImportCSV.tsx` → movido para `BulkImportPanel.tsx` | xlsx |
| Gerenciador de Produtos | `src/components/admin/ProductsManager.tsx` | React, Supabase |
| Qualidade de Catálogo | `src/components/admin/CatalogQualityDashboard.tsx` | React |
| Image Upload | `src/components/admin/ImageUploadButton.tsx` | React, Supabase Storage |
| Inline Edit | `src/components/admin/InlineEditField.tsx` | React |
| Tabela: `product_sync_logs` | Supabase Database | PostgreSQL |

### 3.7 Categorias
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Sidebar de Categorias | `src/components/categories/CategorySidebarPanel.tsx` | React |
| Navegação em Árvore | `src/components/categories/CategoryTreeNavigation.tsx` | React |
| Navegador em Árvore | `src/components/categories/CategoryTreeNavigator.tsx` | React |
| Hook Categories | `src/hooks/useCategories.ts` | Supabase |
| Hook Categories Tree | `src/hooks/useCategoriesTree.ts` | Supabase |
| Hook Category Icons | `src/hooks/useCategoryIcons.ts` | Supabase |
| Hook External Categories | `src/hooks/useExternalCategoriesQuery.ts` | External DB |
| Tabela: `category_icons` | Supabase Database | PostgreSQL |

### 3.8 Materiais
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Badge de Material | `src/components/materials/MaterialBadge.tsx` | React |
| Hook Material Filter | `src/hooks/useMaterialFilter.ts` | React |
| Hook Material Groups | `src/hooks/useMaterialGroups.ts` | React |
| Hook Material Types | `src/hooks/useMaterialTypes.ts` | React |
| Hook Produtos por Material | `src/hooks/useProductsByMaterial.ts` | Supabase |
| Edge Function | `supabase/functions/materials-api/index.ts` | Deno |

### 3.9 Cores e Variações
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook Color System | `src/hooks/useColorSystem.ts` | Supabase |
| Hook Colors | `src/hooks/useColors.ts` | Supabase |
| Hook Variant Stock | `src/hooks/useVariantStock.ts` | Supabase |
| Hook External Variant Stock | `src/hooks/useExternalVariantStock.ts` | External DB |
| Hook Variant Supplier Sources | `src/hooks/useVariantSupplierSources.ts` | Supabase |
| Lib Supplier Colors | `src/lib/supplier-colors.ts` | TypeScript |
| Tabelas: `color_groups`, `color_variations`, `color_nuances` | Supabase Database | PostgreSQL |

### 3.10 Ramo de Atividade
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Badge | `src/components/ramo-atividade/RamoAtividadeBadge.tsx` | React |
| Accordion de Grupos | `src/components/ramo-atividade/RamoAtividadeGroupAccordion.tsx` | React |
| Checkbox de Segmento | `src/components/ramo-atividade/SegmentoCheckbox.tsx` | React |
| Hook Ramo Atividade | `src/hooks/useRamoAtividade.ts` | Supabase |
| Hook Ramo Filho | `src/hooks/useRamoAtividadeFilho.ts` | Supabase |
| Hook Filter | `src/hooks/useRamoAtividadeFilter.ts` | React |
| Hook Produto-Ramo | `src/hooks/useProdutoRamoAtividade.ts` | Supabase |

### 3.11 Fornecedores
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook Suppliers | `src/hooks/useSuppliers.ts` | Supabase |
| Hook Supplier Comparison | `src/hooks/useSupplierComparison.ts` | React |

---

## 📝 4. GESTÃO DE ORÇAMENTOS (QUOTES)

### 4.1 CRUD de Orçamentos
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Builder de Orçamento | `src/pages/QuoteBuilderPage.tsx` | React |
| Lista de Orçamentos | `src/pages/QuotesListPage.tsx` | React |
| Lista Configurável | `src/components/quotes/QuotesConfigurableList.tsx` | React |
| Visualização | `src/pages/QuoteViewPage.tsx` | React |
| Dashboard | `src/pages/QuotesDashboardPage.tsx` | Recharts |
| Hook Principal | `src/hooks/useQuotes.ts` | Supabase, React Query |
| Auto Save | `src/components/quotes/QuoteAutoSave.tsx` | React |
| Hook Auto Save | `src/hooks/useAutoSave.tsx` | React |
| Seletor de Produto | `src/components/quotes/QuoteProductSelector.tsx` | React |
| Seletor de Cliente | `src/components/quotes/QuoteClientSelector.tsx` | React |
| Seletor Empresa-Contato | `src/components/quotes/CompanyContactSelector.tsx` | React |
| Seletor de Cor | `src/components/quotes/QuoteProductColorSelector.tsx` | React |
| Personalização de Produto | `src/components/quotes/QuoteProductCustomization.tsx` | React |
| Seletor de Personalização | `src/components/quotes/QuotePersonalizationSelector.tsx` | React |
| Itens Arrastáveis | `src/components/quotes/DraggableQuoteItems.tsx` | React, @dnd-kit |
| Lista de Itens | `src/components/quotes/QuoteItemsList.tsx` | React |
| Detalhe de Item (Sheet) | `src/components/quotes/QuoteItemDetailSheet.tsx` | React |
| Resumo | `src/components/quotes/QuoteSummary.tsx` | React |
| Status Timeline | `src/components/quotes/QuoteStatusTimeline.tsx` | React |
| Validity Banner | `src/components/quotes/QuoteValidityBanner.tsx` | React |
| Next Action Banner | `src/components/quotes/QuoteNextActionBanner.tsx` | React |
| Mobile Action Bar | `src/components/quotes/QuoteMobileActionBar.tsx` | React |
| Convert to Order | `src/components/quotes/QuoteConvertToOrder.tsx` | React |
| Quick Quote FAB | `src/components/quote/QuickQuoteFAB.tsx` | React |
| Tags/Etiquetas | `src/components/quotes/TagManager.tsx` | React |
| WhatsApp Share | `src/components/quotes/QuoteWhatsAppShare.tsx` | React |
| Tabelas: `quotes`, `quote_items`, `quote_item_personalizations` | Supabase Database | PostgreSQL |

### 4.2 Kanban de Orçamentos
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página Kanban | `src/pages/QuotesKanbanPage.tsx` | React |
| Board Kanban | `src/components/quotes/QuoteKanbanBoard.tsx` | @dnd-kit/core, @dnd-kit/sortable |

### 4.3 Templates de Orçamento
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página Templates | `src/pages/QuoteTemplatesPage.tsx` | React |
| Lista de Templates | `src/components/quotes/QuoteTemplatesList.tsx` | React |
| Admin Templates | `src/components/quotes/AdminTemplatesManager.tsx` | React |
| Formulário | `src/components/quotes/QuoteTemplateForm.tsx` | React Hook Form, Zod |
| Seletor | `src/components/quotes/QuoteTemplateSelector.tsx` | React |
| Salvar como Template | `src/components/quotes/SaveAsTemplateButton.tsx` | React |
| Hook | `src/hooks/useQuoteTemplates.ts` | Supabase |
| Tabela: `quote_templates` | Supabase Database | PostgreSQL |

### 4.4 Aprovação de Orçamentos
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página Pública | `src/pages/PublicQuoteApproval.tsx` | React |
| QR Code | `src/components/quotes/QuoteQRCode.tsx` | qrcode.react |
| Edge Function | `supabase/functions/quote-approval/index.ts` | Deno, Rate Limiter |
| Hook | `src/hooks/useQuoteApproval.ts` | React |
| Tabela: `quote_approval_tokens` | Supabase Database | PostgreSQL |

### 4.5 Histórico e Versões
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Painel de Histórico | `src/components/quotes/QuoteHistoryPanel.tsx` | React |
| Hook Histórico | `src/hooks/useQuoteHistory.ts` | Supabase |
| Tabela: `quote_history` | Supabase Database | PostgreSQL |

### 4.6 Geração de Propostas PDF
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Dialog de Geração | `src/components/quotes/PdfGenerationDialog.tsx` | React |
| Preview da Proposta | `src/components/quotes/QuoteProposalPreview.tsx` | React |
| Template HTML | `src/components/pdf/ProposalHtmlTemplate.tsx` | React |
| Proposta Tailwind | `src/components/pdf/PropostaComercialTailwind.tsx` | React, Tailwind |
| Header | `src/components/pdf/proposal/ProposalHeader.tsx` | React |
| Client Bar | `src/components/pdf/proposal/ProposalClientBar.tsx` | React |
| Product Table | `src/components/pdf/proposal/ProposalProductTable.tsx` | React |
| Totals | `src/components/pdf/proposal/ProposalTotals.tsx` | React |
| Notes | `src/components/pdf/proposal/ProposalNotes.tsx` | React |
| Footer | `src/components/pdf/proposal/ProposalFooter.tsx` | React |
| Seller Signature | `src/components/pdf/proposal/ProposalSellerSignature.tsx` | React |
| Logo Transparent BG | `src/components/pdf/proposal/LogoWithTransparentBg.tsx` | React |

### 4.7 Sincronização com Bitrix
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Edge Function Sync | `supabase/functions/quote-sync/index.ts` | Deno, N8N Webhooks |
| Edge Function Sync Bitrix | `supabase/functions/sync-quote-bitrix/index.ts` | Deno, Bitrix24 API |

---

## 📋 5. GESTÃO DE PEDIDOS (ORDERS)

### 5.1 CRUD de Pedidos
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página de Pedidos | `src/pages/OrdersPage.tsx` | React, TanStack Table |
| Hook | `src/hooks/useOrders.ts` | Supabase, React Query |
| Tabelas: `orders`, `order_items`, `order_history` | Supabase Database | PostgreSQL |

---

## 👥 6. GESTÃO DE CLIENTES E CRM

### 6.1 CRM de Empresas
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook CRM Companies | `src/hooks/useCrmCompanies.ts` | Supabase |
| Seletor no Carrinho | `src/components/cart/CartCompanyPicker.tsx` | React |
| Tabelas: `companies`, `company_contacts`, `company_addresses`, `contact_emails`, `contact_phones` | Supabase Database | PostgreSQL |

### 6.2 Integração Bitrix24
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página Sync V2 | `src/pages/BitrixSyncPageV2.tsx` | React |
| Edge Function | `supabase/functions/bitrix-sync/index.ts` | Deno, Bitrix24 API |
| Hook | `src/hooks/useBitrixSync.ts` | Supabase Functions |
| Hook Async | `src/hooks/useBitrixSyncAsync.ts` | Supabase Functions |
| Tabelas: `bitrix_clients`, `bitrix_deals`, `bitrix_sync_logs` | Supabase Database | PostgreSQL |

### 6.3 Datas Comemorativas
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Widget Próximas Datas | `src/components/dashboard/UpcomingDatesWidget.tsx` | React |
| Filtro de Datas | `src/components/filters/CommemorativeDateFilter.tsx` | React |
| Hook | `src/hooks/useCommemorativeDates.ts` | Supabase |
| Edge Function | `supabase/functions/commemorative-dates/index.ts` | Deno |

---

## 🏆 7. GAMIFICAÇÃO

### 7.1 Sistema de Recompensas
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página da Loja | `src/pages/RewardsStorePage.tsx` | React |
| Hook Gamification | `src/hooks/useGamification.ts` | Supabase |
| Hook Rewards Store | `src/hooks/useRewardsStore.ts` | Supabase |
| Tabela: `achievements` | Supabase Database | PostgreSQL |

### 7.2 Metas de Vendas
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Card de Metas | `src/components/goals/SalesGoalsCard.tsx` | React |
| Hook | `src/hooks/useSalesGoals.ts` | Supabase |

---

## 📊 8. ANALYTICS E BI

### 8.1 Dashboard Customizável
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página | `src/pages/CustomizableDashboard.tsx` | React, DnD Kit |
| Dashboard Arrastável | `src/components/dashboard/DraggableDashboard.tsx` | React, @dnd-kit |

### 8.3 Tendências
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página | `src/pages/TrendsPage.tsx` | React, Recharts |

### 8.4 Analytics de Produtos
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook | `src/hooks/useProductAnalytics.ts` | Supabase |
| User Behavior Tracking | `src/components/analytics/UserBehaviorTracking.tsx` | React |
| Tabela: `product_views` | Supabase Database | PostgreSQL |

---

## 🔔 9. NOTIFICAÇÕES

### 9.1 Sistema de Notificações
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Serviço Principal | `src/services/notificationService.ts` | Supabase |
| Edge Function Send | `supabase/functions/send-notification/index.ts` | Deno |
| Edge Function Cleanup | `supabase/functions/cleanup-notifications/index.ts` | Deno |
| Edge Function Digest | `supabase/functions/send-digest/index.ts` | Deno |
| Tabela: `workspace_notifications` | Supabase Database | PostgreSQL |

### 9.2 Notificações Push
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook | `src/hooks/usePushNotifications.tsx` | Web Push API |
| Settings | `src/components/security/PushNotificationSettings.tsx` | React |
| Service Worker | `src/lib/sw-register.ts` | Service Worker API |

---

## 📁 10. COLEÇÕES E FAVORITOS

### 10.1 Sistema de Favoritos
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Contexto | `src/contexts/FavoritesContext.tsx` | React Context |
| Página | `src/pages/FavoritesPage.tsx` | React |
| Hook | `src/hooks/useFavorites.ts` | React, LocalStorage |

### 10.2 Coleções de Produtos
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Contexto | `src/contexts/CollectionsContext.tsx` | React Context |
| Página Lista | `src/pages/CollectionsPage.tsx` | React |
| Página Detalhe | `src/pages/CollectionDetailPage.tsx` | React |
| Hook | `src/hooks/useCollections.ts` | Supabase |
| Hook External Collections | `src/hooks/useExternalCollections.ts` | External DB |

### 10.3 Comparação de Produtos
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Contexto | `src/contexts/ComparisonContext.tsx` | React Context |
| Página | `src/pages/ComparePage.tsx` | React |
| Hook | `src/hooks/useComparison.ts` | React |
| Comparação Fornecedores | `src/hooks/useSupplierComparison.ts` | React |

### 10.4 Visualizados Recentemente
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Contexto | `src/contexts/RecentlyViewedContext.tsx` | React Context |
| Hook | `src/hooks/useRecentlyViewed.ts` | React |
| Barra | `src/components/products/RecentlyViewedBar.tsx` | React |
| Popover | `src/components/products/RecentlyViewedPopover.tsx` | React |

---

## 🎙️ 11. COMANDOS DE VOZ

### 11.1 Reconhecimento de Fala
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook Principal | `src/hooks/useVoiceCommands.ts` | Web Speech API |
| Hook Reconhecimento | `src/hooks/useSpeechRecognition.ts` | Web Speech API |
| Hook Feedback | `src/hooks/useVoiceFeedback.ts` | Web Speech Synthesis API |
| Hook Histórico | `src/hooks/useVoiceCommandHistory.ts` | React |
| Overlay de Busca por Voz | `src/components/search/VoiceSearchOverlay.tsx` | React |

---

## 📤 13. EXPORTAÇÃO

### 13.1 Export Excel
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Lib | `src/lib/export/` | xlsx |

### 13.2 Export PDF
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Gerador | Múltiplos componentes (ver seção 4.6) | jspdf, jspdf-autotable, html2canvas |

---

## 🌐 14. LOCALIZAÇÃO (pt-BR)

### 14.1 Configuração pt-BR
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Locale Config | `src/lib/date-utils.ts` | date-fns |
| Formatação | `src/lib/format.ts` | TypeScript |
| Text Utils | `src/lib/textUtils.ts` | TypeScript |

> **Nota:** O sistema é **exclusivamente pt-BR**. Não há suporte a multi-idioma (i18n).

---

## ⚡ 15. PERFORMANCE E CACHE

### 15.1 Caching
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Rate Limiter | `supabase/functions/_shared/rate-limiter.ts` | Deno, In-memory cache |
| Query Config | `src/lib/query-config.ts` | React Query |

### 15.2 Rate Limit Dashboard
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página | `src/pages/RateLimitDashboardPage.tsx` | React |
| Edge Function Check | `supabase/functions/rate-limit-check/index.ts` | Deno |

---

## 📱 16. PWA (Progressive Web App)

### 16.1 Service Worker
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Registro SW | `src/lib/sw-register.ts` | Service Worker API |

---

## 🎨 17. UI/UX

### 17.1 Componentes Base
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Componentes UI | `src/components/ui/` | Shadcn/UI, Radix UI |
| Tema | `src/contexts/ThemeContext.tsx` | React Context |
| Design System | `src/index.css`, `tailwind.config.ts` | Tailwind CSS |

### 17.2 Layout e Navegação
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Main Layout | `src/components/layout/MainLayout.tsx` | React |
| Header | `src/components/layout/Header.tsx` | React |
| Header Actions Menu | `src/components/layout/HeaderActionsMenu.tsx` | React |
| Sidebar Reorganizada | `src/components/layout/SidebarReorganized.tsx` | React |
| Page Header | `src/components/layout/PageHeader.tsx` | React |
| Panel Components | `src/components/layout/PanelComponents.tsx` | React |
| Breadcrumbs | `src/components/navigation/Breadcrumbs.tsx` | React |
| Breadcrumbs Dinâmicos | `src/components/navigation/DynamicBreadcrumbs.tsx` | React |
| Breadcrumbs Persistentes | `src/components/common/PersistentBreadcrumbs.tsx` | React |

### 17.3 Animações e Efeitos
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Page Transition | `src/components/effects/PageTransition.tsx` | Framer Motion |
| Mini Confetti | `src/components/effects/MiniConfetti.tsx` | canvas-confetti |
| Success Celebration | `src/components/effects/SuccessCelebration.tsx` | Framer Motion |
| Glass Elements | `src/components/common/GlassElements.tsx` | React, CSS |
| Micro Interactions | `src/components/common/MicroInteractions.tsx` | Framer Motion |
| Scroll Progress | `src/components/common/ScrollProgress.tsx` | React |

### 17.4 Drag and Drop
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Sortable Item | `src/components/admin/SortableItem.tsx` | @dnd-kit/sortable |
| Kanban | `src/components/quotes/QuoteKanbanBoard.tsx` | @dnd-kit/core |

### 17.5 Componentes Comuns
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Back Button | `src/components/common/BackButton.tsx` | React |
| Confirm Dialog | `src/components/common/ConfirmDialog.tsx` | React |
| Dark Mode Toggle | `src/components/common/DarkModeToggle.tsx` | React |
| Empty State | `src/components/common/EmptyState.tsx` | React |
| Enhanced Stats Card | `src/components/common/EnhancedStatsCard.tsx` | React |
| Image With Fallback | `src/components/common/ImageWithFallback.tsx` | React |
| Loading Overlay | `src/components/common/LoadingOverlay.tsx` | React |
| Status Timeline | `src/components/common/StatusTimeline.tsx` | React |
| Sticky Filter Bar | `src/components/common/StickyFilterBar.tsx` | React |
| Swipe Actions | `src/components/common/SwipeActions.tsx` | React |
| Urgency Badge | `src/components/common/UrgencyBadge.tsx` | React |
| Social Proof | `src/components/common/SocialProof.tsx` | React |
| Spotlight Aprimorado | `src/components/common/EnhancedSpotlight.tsx` | React |
| Contextual Tooltips | `src/components/common/ContextualTooltips.tsx` | React |
| Contextual Skeleton | `src/components/common/ContextualSkeleton.tsx` | React |
| Contextual Onboarding | `src/components/common/ContextualOnboarding.tsx` | React |

### 17.6 Loading States
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Loading Screen | `src/components/LoadingScreen.tsx` | React |
| Loading Overlay | `src/components/loading/LoadingOverlay.tsx` | React |
| Skeleton Loading | `src/components/loading/SkeletonLoading.tsx` | React |
| Skeleton Shimmer | `src/components/loading/SkeletonShimmer.tsx` | React |

### 17.7 Responsive e Mobile
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Mobile Hook | `src/hooks/use-mobile.tsx` | React |
| Smart Mobile Nav | `src/components/mobile/SmartMobileNav.tsx` | React |
| Mobile Product Actions | `src/components/mobile/MobileProductActions.tsx` | React |

### 17.8 Toast e Dialogs
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Toast Hook | `src/hooks/use-toast.ts` | Sonner |
| Confirm Dialog | `src/hooks/useConfirmDialog.tsx` | React |

---

## 🔧 18. UTILITÁRIOS

### 18.1 Debounce e Throttle
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook Debounce | `src/hooks/useDebounce.ts` | React |
| Hook Debounced Search | `src/hooks/useDebouncedSearch.ts` | React |

### 18.2 Seleção em Massa
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook | `src/hooks/useBulkSelection.ts` | React |

### 18.3 Teclado
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook Key Press | `src/hooks/useKeyPress.ts` | React |
| Hook Keyboard Navigation | `src/hooks/useKeyboardNavigation.ts` | React |

### 18.4 Validações
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Libs | `src/lib/validations/` | Zod |

### 18.5 Data/Hora
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Utils | `src/lib/date-utils.ts` | date-fns |

### 18.6 Clipboard
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook Copy to Clipboard | `src/hooks/useCopyToClipboard.ts` | Clipboard API |

### 18.7 Persistência Local
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook Local Storage | `src/hooks/useLocalStorage.ts` | localStorage |

### 18.8 Scroll e Click
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook Scroll | `src/hooks/useScroll.ts` | React |
| Hook Scroll Lock Fix | `src/hooks/useScrollLockFix.ts` | React |
| Hook Click Outside | `src/hooks/useClickOutside.ts` | React |
| Hook Pagination | `src/hooks/usePagination.ts` | React |

### 18.9 Toggle e Media Query
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook Toggle | `src/hooks/useToggle.ts` | React |
| Hook Media Query | `src/hooks/useMediaQuery.ts` | React |

### 18.10 Image Converter
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Lib | `src/lib/image-converter.ts` | Canvas API |

### 18.11 Lazy Loading com Retry
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Lib | `src/lib/lazyWithRetry.ts` | React.lazy |

---

## 🛡️ 19. TRATAMENTO DE ERROS

### 19.1 Error Boundaries
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Error Boundary | `src/components/errors/ErrorBoundary.tsx` | React |
| Enhanced Boundary | `src/components/errors/EnhancedErrorBoundary.tsx` | React |
| Page Error Boundary | `src/components/errors/PageErrorBoundary.tsx` | React |
| Route Error Boundary | `src/components/errors/RouteErrorBoundary.tsx` | React |

### 19.2 Error Handlers
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Hook | `src/hooks/useErrorHandler.ts` | React |

---

## 🔗 20. INTEGRAÇÕES

### 20.1 Supabase (Lovable Cloud)
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Cliente | `src/integrations/supabase/client.ts` | @supabase/supabase-js |
| Types | `src/integrations/supabase/types.ts` | TypeScript |

### 20.2 Banco de Dados Externo (Promobrind)
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Lib External DB | `src/lib/external-db.ts` | Supabase Edge Functions |
| Lib External RPC | `src/lib/external-rpc.ts` | Supabase Edge Functions |
| Lib CRM DB | `src/lib/crm-db.ts` | Supabase Edge Functions |
| Edge Function Bridge | `supabase/functions/external-db-bridge/index.ts` | Deno, PostgreSQL |
| Edge Function Inspect | `supabase/functions/external-db-inspect/index.ts` | Deno |
| Edge Function CRM Bridge | `supabase/functions/crm-db-bridge/index.ts` | Deno, PostgreSQL |
| Hook External DB | `src/hooks/useExternalDatabase.ts` | React |
| Hook External Simulator | `src/hooks/useExternalSimulator.ts` | React |
| Página de Teste | `src/pages/ExternalDatabaseTest.tsx` | React |

### 20.3 Bitrix24
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Edge Function | `supabase/functions/bitrix-sync/index.ts` | Deno, REST API |
| Webhooks | N8N Integration | N8N Webhooks |

### 20.4 Lovable AI Gateway
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Todas Edge Functions IA | `supabase/functions/*/index.ts` | LOVABLE_API_KEY |
| Modelos Suportados | - | google/gemini-*, openai/gpt-* |

### 20.5 Dropbox
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Edge Function List | `supabase/functions/dropbox-list/index.ts` | Deno, Dropbox API |

### 20.6 GitHub
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Edge Function Fix Config | `supabase/functions/github-fix-config/index.ts` | Deno, GitHub API |

### 20.7 Email
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Edge Function Verify | `supabase/functions/verify-email/index.ts` | Deno |

### 20.8 Webhooks
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Webhook Dispatcher | `supabase/functions/webhook-dispatcher/index.ts` | Deno |

---

## 🔍 21. BUSCA E FILTROS

### 21.1 Busca Global
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Global Search | `src/components/search/GlobalSearch.tsx` | React |
| Search Palette | `src/components/search/GlobalSearchPalette.tsx` | React, cmdk |
| Smart Search Input | `src/components/search/SmartSearchInput.tsx` | React |
| Search with Suggestions | `src/components/search/SearchWithSuggestions.tsx` | React |
| Smart Suggestions | `src/components/search/SmartSuggestions.tsx` | React |
| Advanced Search | `src/components/search/AdvancedSearch.tsx` | React |
| Hook Search | `src/hooks/useSearch.ts` | React |
| Hook Generic Fuzzy Search | `src/hooks/useGenericFuzzySearch.ts` | Fuse.js |

### 21.2 Filtros Avançados
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página de Filtros | `src/pages/FiltersPage.tsx` | React |
| Painel de Filtros | `src/components/filters/FilterPanel.tsx` | React |
| Painel Avançado | `src/components/filters/AdvancedFilterPanel.tsx` | React |
| Quick Filters Bar | `src/components/filters/QuickFiltersBar.tsx` | React |
| Sticky Filter Bar | `src/components/filters/StickyFilterBar.tsx` | React |
| Color Family Filter | `src/components/filters/ColorFamilyFilter.tsx` | React |
| Color Group Filter | `src/components/filters/ColorGroupFilter.tsx` | React |
| Inline Color Group Filter | `src/components/filters/InlineColorGroupFilter.tsx` | React |
| External Category Filter | `src/components/filters/ExternalCategoryFilter.tsx` | React |
| Commemorative Date Filter | `src/components/filters/CommemorativeDateFilter.tsx` | React |
| Debounced Price Input | `src/components/filters/DebouncedPriceInput.tsx` | React |
| Presets Estáticos | `src/components/filters/FilterPresets.ts` | TypeScript |
| Preset Manager | `src/components/filters/PresetManager.tsx` | React |
| Presets Bar | `src/components/filters/PresetsBar.tsx` | React |
| Saved Filters | `src/components/filters/SavedFilters.tsx` | React |
| Hook Advanced Filters | `src/hooks/useAdvancedFilters.ts` | React |
| Busca Avançada de Preço | `src/pages/AdvancedPriceSearchPage.tsx` | React |

---

## 💰 22. SIMULADOR DE PREÇOS

### 22.1 Simulador Wizard (Principal)
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página Wizard | `src/pages/SimuladorWizard.tsx` | React |
| Step Product | `src/components/simulator/wizard/StepProduct.tsx` | React |
| Step Location | `src/components/simulator/wizard/StepLocation.tsx` | React |
| Step Specs | `src/components/simulator/wizard/StepSpecs.tsx` | React |
| Step Comparison | `src/components/simulator/wizard/StepComparison.tsx` | React |
| Product Color Grid | `src/components/simulator/wizard/ProductColorGrid.tsx` | React |
| Quantity Range Comparison | `src/components/simulator/wizard/QuantityRangeComparison.tsx` | React |
| Personalization Summary | `src/components/simulator/wizard/PersonalizationSummary.tsx` | React |
| Mobile Summary | `src/components/simulator/wizard/MobilePersonalizationSummary.tsx` | React |
| Personalization Tabs | `src/components/simulator/wizard/PersonalizationTabs.tsx` | React |
| Remove Personalization | `src/components/simulator/wizard/RemovePersonalizationDialog.tsx` | React |
| Error Boundary | `src/components/simulator/wizard/SimulatorErrorBoundary.tsx` | React |
| Context Bar | `src/components/simulator/wizard/WizardContextBar.tsx` | React |
| Mockup Preview | `src/components/simulator/wizard/WizardMockupPreview.tsx` | React |
| Step Indicator | `src/components/simulator/wizard/WizardStepIndicator.tsx` | React |
| Hook Wizard | `src/hooks/simulator/useSimulatorWizard.ts` | React |
| Hook Pricing | `src/hooks/simulator/useWizardPricing.ts` | React |
| Hook Drafts | `src/hooks/simulator/useWizardDrafts.ts` | Supabase |
| Hook Persistence | `src/hooks/simulator/useWizardPersistence.ts` | React |
| Hook Undo/Redo | `src/hooks/simulator/useUndoRedo.ts` | React |
| Hook Live Preview | `src/hooks/simulator/useLivePricePreview.ts` | React |

### 22.2 Simulador de Preços (Compacto)
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página | `src/pages/PriceSimulatorPage.tsx` | React |
| Product Price Simulator | `src/components/pricing/ProductPriceSimulator.tsx` | React |
| Quantity Price Calculator | `src/components/pricing/QuantityPriceCalculator.tsx` | React |
| Simulator Product Search | `src/components/pricing/simulator/ProductSearch.tsx` | React |
| Technique Selector | `src/components/pricing/simulator/TechniqueSelector.tsx` | React |
| Customization Options | `src/components/pricing/simulator/CustomizationOptions.tsx` | React |
| Quantity and Result | `src/components/pricing/simulator/QuantityAndResult.tsx` | React |
| Price Result V51 | `src/components/pricing/simulator/PriceResultV51.tsx` | React |
| Engraving List | `src/components/pricing/simulator/EngravingList.tsx` | React |
| Multi Engraving Result | `src/components/pricing/simulator/MultiEngravingResult.tsx` | React |
| Product Variant Selector | `src/components/pricing/simulator/ProductVariantSelector.tsx` | React |
| Step Indicator | `src/components/pricing/simulator/StepIndicator.tsx` | React |

### 22.3 Simulador de Personalização (Legacy)
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Componentes | `src/components/simulator/` | React |
| Decision Matrix Chart | `src/components/simulator/DecisionMatrixChart.tsx` | Recharts |
| Margin Calculator | `src/components/simulator/MarginCalculatorCard.tsx` | React |
| Margin Thermometer | `src/components/simulator/MarginThermometer.tsx` | React |
| Multi Product Comparison | `src/components/simulator/MultiProductComparison.tsx` | React |
| Multi Technique Selector | `src/components/simulator/MultiTechniqueSelector.tsx` | React |
| Niche Recommendation | `src/components/simulator/NicheRecommendationBadge.tsx` | React |
| Optimal Quantity | `src/components/simulator/OptimalQuantityHighlight.tsx` | React |
| Product Location Selector | `src/components/simulator/ProductLocationSelector.tsx` | React |
| Product Quantity Card | `src/components/simulator/ProductQuantityCard.tsx` | React |
| Recent Simulations | `src/components/simulator/RecentSimulationsQuickAccess.tsx` | React |
| Results Cards | `src/components/simulator/ResultsComparisonCards.tsx` | React |
| Scenario Comparison | `src/components/simulator/ScenarioComparison.tsx` | React |
| Smart Product Search | `src/components/simulator/SmartProductSearch.tsx` | React |
| Stock Alert | `src/components/simulator/StockAlert.tsx` | React |
| Technique Card | `src/components/simulator/TechniqueCard.tsx` | React |
| Technique Selection Card | `src/components/simulator/TechniqueSelectionCard.tsx` | React |
| Upsell++ | `src/components/simulator/UpsellPlusPlus.tsx` | React |
| Export Actions | `src/components/simulator/ExportActions.tsx` | React |
| Mockup Preview | `src/components/simulator/MockupPreview.tsx` | React |
| Hook Simulation | `src/hooks/useSimulation.ts` | Supabase |
| Hook Preferences | `src/hooks/useSimulatorPreferences.ts` | React |
| Tabela: `personalization_simulations` | Supabase Database | PostgreSQL |

### 22.4 Gravação e Técnicas de Preço
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página Gravação | `src/pages/EngravingRegistrationPage.tsx` | React |
| Pricing Panel | `src/components/engraving/PricingPanel.tsx` | React |
| Techniques Panel | `src/components/engraving/TechniquesPanel.tsx` | React |
| Hook Gravação | `src/hooks/useGravacao.ts` | Supabase |
| Hook Gravação V2 | `src/hooks/useGravacaoV2.ts` | Supabase |
| Hook Gravação Price V2 | `src/hooks/useGravacaoPriceV2.ts` | Supabase |
| Hook Customization Price | `src/hooks/useCustomizationPrice.ts` | Supabase |
| Hook Technique Pricing | `src/hooks/useTechniquePricing.ts` | Supabase |
| Hook Technique Options | `src/hooks/useTechniquePricingOptions.ts` | Supabase |
| Hook Técnicas External | `src/hooks/useTechniquesExternal.ts` | External DB |
| Hook Técnicas Unificadas | `src/hooks/useTecnicasUnificadas.ts` | React |
| Hooks Gravação (pasta) | `src/hooks/gravacao/` (useFornecedoresGravacao, useTecnicasGravacao, useVariantesGravacao) | Supabase |
| Hooks Técnicas (pasta) | `src/hooks/tecnicas/` (usePrecoCalculation, useTabelasPreco, useTecnicaMutations, useTecnicasList) | Supabase |

---

## 🧰 23. MONTADOR DE KITS

### 23.1 Kit Builder
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página | `src/pages/KitBuilderPage.tsx` | React |
| Seletor de Caixa | `src/components/kit-builder/BoxSelector.tsx` | React |
| Seletor de Itens | `src/components/kit-builder/ItemSelector.tsx` | React |
| Config Personalização | `src/components/kit-builder/PersonalizationConfig.tsx` | React |
| Resumo do Kit | `src/components/kit-builder/KitSummary.tsx` | React |
| Indicador de Volume | `src/components/kit-builder/VolumeIndicator.tsx` | React |
| Wizard Steps | `src/components/kit-builder/WizardSteps.tsx` | React |
| Hook | `src/hooks/useKitBuilder.ts` | React |
| Lib Volume Calculator | `src/lib/kit-builder/volume-calculator.ts` | TypeScript |
| Lib Price Calculator | `src/lib/kit-builder/price-calculator.ts` | TypeScript |
| Lib Types | `src/lib/kit-builder/types.ts` | TypeScript |

---

## 📦 24. ESTOQUE

### 24.1 Estoque
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página | `src/pages/StockDashboardPage.tsx` | React |
| Dashboard | `src/components/inventory/StockDashboard.tsx` | React |
| Stock Badge | `src/components/inventory/StockBadge.tsx` | React |
| Stock Alerts | `src/components/inventory/StockAlertsIndicator.tsx` | React |
| Stock Filter Chips | `src/components/inventory/StockFilterChips.tsx` | React |
| Variant Stock Table | `src/components/inventory/VariantStockTable.tsx` | React |
| Hook Stock Dashboard | `src/hooks/useStockDashboard.ts` | Supabase |
| Hook Variant Stock | `src/hooks/useVariantStock.ts` | Supabase |

### 24.2 Estoque Futuro
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Dialog Adicionar | `src/components/products/AddFutureStockDialog.tsx` | React |
| Modal Estoque Futuro | `src/components/products/FutureStockModal.tsx` | React |
| Hook | `src/hooks/useFutureStock.ts` | Supabase |
| Tabela: `future_stock_entries` | Supabase Database | PostgreSQL |

---

## 🛒 25. CARRINHO DO VENDEDOR

### 25.1 Sistema de Carrinho
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página | `src/pages/SellerCartsPage.tsx` | React |
| Contexto | `src/contexts/SellerCartContext.tsx` | React Context |
| Header Button | `src/components/cart/CartHeaderButton.tsx` | React |
| Company Picker | `src/components/cart/CartCompanyPicker.tsx` | React |
| Hook Seller Carts | `src/hooks/useSellerCarts.ts` | Supabase |
| Hook Cart Templates | `src/hooks/useCartTemplates.ts` | Supabase |
| Tabela: `cart_templates` | Supabase Database | PostgreSQL |

---

## 📋 26. AUDITORIA

### 26.1 Audit Log
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Componente Histórico | `src/components/audit/AuditHistory.tsx` | React |
| Hook | `src/hooks/useAuditLog.ts` | Supabase |
| Tabela: `audit_log` | Supabase Database | PostgreSQL |

---

## ♿ 27. ACESSIBILIDADE

### 27.1 Componentes de Acessibilidade
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Accessibility Provider | `src/components/a11y/AccessibilityProvider.tsx` | React |
| Aria Live | `src/components/a11y/AriaLive.tsx` | React |
| Visually Hidden | `src/components/a11y/VisuallyHidden.tsx` | React |
| Skip to Content | `src/components/common/SkipToContent.tsx` | React |

---

## 🎓 28. ONBOARDING

### 28.1 Tour Interativo
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Onboarding Tour | `src/components/onboarding/OnboardingTour.tsx` | React |
| Restart Tour Button | `src/components/onboarding/RestartTourButton.tsx` | React |
| Contexto | `src/contexts/OnboardingContext.tsx` | React Context |
| Hook | `src/hooks/useOnboarding.ts` | React |

---

## 👤 29. ADMINISTRAÇÃO

### 29.1 Painel Admin
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página Admin | `src/pages/AdminPanel.tsx` | React |
| Admin Cadastros | `src/pages/admin/AdminCadastrosPage.tsx` | React |
| Admin Usuários | `src/pages/admin/AdminUsuariosPage.tsx` | React |
| Admin Segurança | `src/pages/admin/AdminSegurancaPage.tsx` | React |
| Admin Prompts IA | `src/pages/admin/AdminPromptsIAPage.tsx` | React |
| Edge Function Manage Users | `supabase/functions/manage-users/index.ts` | Deno |

### 29.2 Perfil do Usuário
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página Perfil | `src/pages/ProfilePage.tsx` | React |

### 29.3 Status do Sistema
| Funcionalidade | Arquivo Principal | Ferramentas/Bibliotecas |
|----------------|-------------------|-------------------------|
| Página Status | `src/pages/SystemStatusPage.tsx` | React |

---

## 🗄️ 30. EDGE FUNCTIONS (COMPLETO)

| Edge Function | Descrição | Dependências |
|---------------|-----------|--------------|
| `ai-recommendations` | Recomendações IA de produtos | Lovable AI Gateway |
| `analyze-logo-colors` | Análise de cores de logos | Lovable AI Gateway |
| `bitrix-sync` | Sincronização com Bitrix24 | Bitrix24 REST API |
| `categories-api` | API de categorias | External PostgreSQL |
| `cleanup-notifications` | Limpeza de notificações antigas | Supabase |
| `cleanup-novelties` | Limpeza de novidades expiradas | Supabase |
| `commemorative-dates` | Datas comemorativas | Supabase |
| `crm-db-bridge` | Bridge para banco CRM externo | External PostgreSQL |
| `detect-new-device` | Detecção de novos dispositivos | Supabase |
| `dropbox-list` | Listagem de arquivos do Dropbox | Dropbox API |
| `expert-chat` | Chat com especialista IA | Lovable AI Gateway |
| `external-db-bridge` | Bridge para banco externo Promobrind | External PostgreSQL |
| `external-db-inspect` | Inspeção de schema do banco externo | External PostgreSQL |
| `generate-ad-image` | Geração de imagens publicitárias | Lovable AI Gateway |
| `generate-ad-prompt` | Geração de prompts publicitários | Lovable AI Gateway |
| `generate-mockup` | Geração de mockups com IA | Lovable AI Gateway |
| `generate-mockup-nanobanana` | Geração via NanoBanana API | NanoBanana API |
| `github-fix-config` | Fix de configuração GitHub | GitHub API |
| `manage-users` | Gestão de usuários admin | Supabase Admin |
| `materials-api` | API de materiais | External PostgreSQL |
| `process-queue` | Processamento de filas | Supabase |
| `product-webhook` | Webhook de sincronização de produtos | Supabase |
| `quote-approval` | Aprovação pública de orçamentos | Rate Limiter |
| `quote-sync` | Sync de orçamentos N8N | N8N Webhooks |
| `rate-limit-check` | Verificação de rate limit | In-memory cache |
| `semantic-search` | Busca semântica por IA | Lovable AI Gateway, Cache TTL |
| `send-digest` | Envio de digest/resumo | Supabase |
| `send-notification` | Envio de notificações | Supabase |
| `sync-quote-bitrix` | Sync de orçamento com Bitrix | Bitrix24 API |
| `validate-access` | Validação de acesso por IP/Geo | Supabase |
| `verify-email` | Verificação de email | Supabase |
| `visual-search` | Busca visual por imagem | Lovable AI Gateway |
| `webhook-dispatcher` | Dispatcher de webhooks | Supabase |

### Compartilhado (_shared)
| Módulo | Arquivo | Descrição |
|--------|---------|-----------|
| Rate Limiter | `supabase/functions/_shared/rate-limiter.ts` | Rate limiting in-memory |

---

## 📚 31. BIBLIOTECAS PRINCIPAIS

| Biblioteca | Versão | Uso Principal |
|------------|--------|---------------|
| React | ^18.3.1 | Framework UI |
| React Router DOM | 6.30.2 | Roteamento |
| @supabase/supabase-js | ^2.39.0 | Backend/Auth/DB |
| @tanstack/react-query | ^5.17.0 | Estado servidor |
| @tanstack/react-virtual | ^3.0.0 | Virtualização |
| Tailwind CSS | - | Estilização |
| Shadcn/UI + Radix UI | Múltiplas | Componentes UI |
| Framer Motion | ^11.0.0 | Animações |
| React Hook Form | ^7.51.0 | Formulários |
| Zod | ^3.22.4 | Validação |
| date-fns | ^2.30.0 | Manipulação de datas |
| Recharts | ^2.10.3 | Gráficos |
| jspdf + jspdf-autotable | ^2.5.1, 5.0.7 | Geração PDF |
| html2canvas | ^1.4.1 | Captura de tela para PDF/Layout |
| xlsx | ^0.18.5 | Export Excel |
| papaparse | ^5.4.1 | Parse CSV |
| @dnd-kit/* | Múltiplas | Drag and Drop |
| qrcode.react | ^3.1.0 | QR Codes |
| otpauth | ^9.2.2 | 2FA |
| lucide-react | ^0.309.0 | Ícones |
| Sonner | ^1.3.1 | Toasts |
| react-hot-toast | ^2.4.1 | Toasts (alternativo) |
| canvas-confetti | ^1.9.4 | Confetti visual |
| cmdk | ^0.2.0 | Command palette |
| embla-carousel-react | ^8.0.0 | Carousel |
| fuse.js | ^7.1.0 | Busca fuzzy |
| input-otp | ^1.2.4 | Input OTP |
| react-resizable-panels | ^2.0.11 | Painéis redimensionáveis |
| react-helmet-async | ^2.0.5 | SEO/Meta tags |
| vaul | ^0.9.0 | Drawer mobile |
| zustand | ^4.5.0 | State management |
| vitest | ^3.2.4 | Testes |
| @testing-library/react | ^16.3.2 | Testes de componentes |
| @testing-library/jest-dom | ^6.9.1 | Matchers DOM |
| jsdom | ^20.0.3 | DOM virtual para testes |

---

## 🗄️ 32. TABELAS DO BANCO DE DADOS (COMPLETO)

### Core
- `products` - Catálogo de produtos
- `quotes`, `quote_items`, `quote_item_personalizations` - Orçamentos
- `orders`, `order_items`, `order_history` - Pedidos
- `profiles`, `user_roles`, `roles`, `permissions`, `role_permissions` - Usuários e RBAC

### Personalização
- `personalization_techniques`, `personalization_sizes`, `personalization_locations`
- `product_components`, `product_component_locations`, `product_component_location_techniques`
- `product_groups`, `product_group_members`, `product_group_components`, `product_group_locations`
- `personalization_simulations`, `generated_mockups`
- `mockup_templates`, `mockup_drafts`, `art_file_attachments`
- `mockup_prompt_configs`, `mockup_prompt_history`
- `magic_up_generations`

### Clientes e CRM
- `bitrix_clients`, `bitrix_deals`, `bitrix_sync_logs`
- `companies`, `company_contacts`, `company_addresses`
- `contact_emails`, `contact_phones`
- `expert_conversations`, `expert_messages`

### Segurança
- `ip_whitelist`, `login_attempts`
- `geo_allowed_countries`, `city_whitelist`
- `access_security_settings`, `access_blocked_log`
- `user_known_devices`, `device_login_notifications`
- `password_reset_requests`
- `quote_approval_tokens`

### Cores e Categorias
- `color_groups`, `color_variations`, `color_nuances`
- `category_icons`

### Estoque
- `future_stock_entries`

### Carrinho
- `cart_templates`

### Notificações
- `notifications`

### Outros
- `quote_templates`, `quote_history`
- `product_views`, `product_sync_logs`
- `achievements`
- `audit_log`

---

## 🧠 34. INTELIGÊNCIA DE MERCADO (`/inteligencia-comercial`)

Painel estratégico com KPIs, rankings e narrativa de IA acionável a partir das vendas internas + sinais de mercado.

### Componentes
- **IntelligenceFilterBar** — período (7d–360d), categoria, fornecedor, produto. Sticky no topo, debounce 300ms para evitar refetch em cascata.
- **IntelligenceKPICards** — KPIs com tooltip explicativo (faturamento, ticket médio, qty, conversão), animação fade-in escalonada.
- **MarketIntelligenceInsightsCard** — narrativa de IA via edge `market-intelligence-insights`. Cache server-side de 6h (`ai_insights_cache`), botões Copiar/Exportar/Regenerar (com tooltip avisando consumo de créditos).
- **MarketIntelligenceChart**, **SalesOverviewChart**, **TrendingProducts**, **CategoryRanking**, **SupplierSales**, **ProductRankingSearch** — cada um com empty state ilustrado (`IntelligenceEmptyState`).
- **Refresh global** — invalida todas as queries da rota e atualiza o indicador "Atualizado há …".

### Backend
- **Edge `market-intelligence-insights`** — Zod-validated, quota-aware (`check_ai_quota`), structured logging (latência, tokens, fallback), cache de 6h por hash de filtros, fallback determinístico em 429/402.
- **Tabela `ai_insights_cache`** — 1 linha por usuário+filtros+dia; expira em 24h. Limpeza diária via `pg_cron` (`cleanup-ai-insights-cache`, 03:00).
- **Tabela `ai_usage_events`** — telemetria de regenerações manuais (`event_type = 'manual_regenerate'`) com metadata = filtros ativos.

### Painel Admin
- **`/admin/consumo-ia`** inclui `MarketIntelInsightsUsagePanel`: total de regenerações, top usuários, % cache hit, série diária 14 dias.

### Performance
- Prefetch da rota via `routePrefetch`.
- Listas longas usam `@tanstack/react-virtual` (padrão >50 itens).
- Filtros sticky com `backdrop-blur-md` + `bg-background/85`.

---

## 🔐 35. SECRETS/ENV VARS

| Secret | Uso |
|--------|-----|
| `LOVABLE_API_KEY` | AI Gateway (auto-configurado) |
| `SUPABASE_URL` | Conexão backend |
| `SUPABASE_ANON_KEY` | Auth pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Operações admin |
| `BITRIX_WEBHOOK_URL` | Integração Bitrix24 |
| `N8N_WEBHOOK_URL` | Automações N8N |
| `PRODUCT_WEBHOOK_SECRET` | Sync de produtos |
| `EXTERNAL_DB_URL` | Banco externo Promobrind |
| `CRM_DB_URL` | Banco CRM externo |
| `DROPBOX_ACCESS_TOKEN` | Integração Dropbox |
| `NANOBANANA_API_KEY` | Geração de mockups NanoBanana |

---

*Documento gerado para referência em novos projetos. Atualizado em: 03/03/2026*
