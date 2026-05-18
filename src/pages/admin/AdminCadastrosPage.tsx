import React, { Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { PageSEO } from "@/components/seo/PageSEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Palette, FolderOpen, Truck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const ProductsManager = lazyWithRetry(() =>
  import("@/components/admin/ProductsManager").then(m => ({ default: m.ProductsManager }))
);
const SuppliersManager = lazyWithRetry(() =>
  import("@/components/admin/suppliers-manager").then(m => ({ default: m.SuppliersManager }))
);
const EngravingRegistrationContent = lazyWithRetry(() =>
  import("@/pages/EngravingRegistrationPage").then(m => ({ default: m.EngravingRegistrationContent }))
);

function TabFallback() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

const VALID_TABS = ["products", "suppliers", "personalizacao"] as const;

export default function AdminCadastrosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = (VALID_TABS as readonly string[]).includes(tabParam ?? '') ? tabParam! : "products";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
      <PageSEO title="Cadastros" description="Gerencie produtos, fornecedores e técnicas de personalização." path="/admin/cadastros" noIndex />
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <FolderOpen className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Cadastros</h1>
            <p className="text-muted-foreground">Gerencie produtos, fornecedores e técnicas de personalização</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList>
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-2">
              <Truck className="h-4 w-4" />
              Fornecedores
            </TabsTrigger>
            <TabsTrigger value="personalizacao" className="gap-2">
              <Palette className="h-4 w-4" />
              Personalização
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Suspense fallback={<TabFallback />}>
              <ProductsManager />
            </Suspense>
          </TabsContent>

          <TabsContent value="suppliers">
            <Suspense fallback={<TabFallback />}>
              <SuppliersManager />
            </Suspense>
          </TabsContent>

          <TabsContent value="personalizacao">
            <Suspense fallback={<TabFallback />}>
              <EngravingRegistrationContent />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
  );
}
