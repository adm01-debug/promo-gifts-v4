import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Settings, DollarSign, FolderOpen, Layers, Package } from "lucide-react";
import { TechniquesPanel } from "@/components/engraving/TechniquesPanel";
import { PricingPanel } from "@/components/engraving/PricingPanel";
import { ProductGroupsManager } from "@/components/admin/ProductGroupsManager";
import { GroupPersonalizationManager } from "@/components/admin/GroupPersonalizationManager";
import { ProductPersonalizationManager } from "@/components/admin/personalization-manager";
import { TechniquesManager } from "@/components/admin/TechniquesManager";
import { PageSEO } from "@/components/seo/PageSEO";

export function EngravingRegistrationContent() {
  const [activeTab, setActiveTab] = useState("techniques");

  return (
    <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
      <PageSEO title="Cadastro de Gravações" description="Cadastre técnicas de gravação e personalização." path="/gravacoes" noIndex />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-4xl grid-cols-6">
          <TabsTrigger value="techniques" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Técnicas</span>
          </TabsTrigger>
          <TabsTrigger value="pricing" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Preços</span>
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Grupos</span>
          </TabsTrigger>
          <TabsTrigger value="group-rules" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Regras</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Por Produto</span>
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Cadastro</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="techniques">
          <TechniquesPanel />
        </TabsContent>

        <TabsContent value="pricing">
          <PricingPanel />
        </TabsContent>

        <TabsContent value="groups">
          <ProductGroupsManager />
        </TabsContent>

        <TabsContent value="group-rules">
          <GroupPersonalizationManager />
        </TabsContent>

        <TabsContent value="products">
          <ProductPersonalizationManager />
        </TabsContent>

        <TabsContent value="manage">
          <TechniquesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Default export removed — only EngravingRegistrationContent is used (via AdminCadastrosPage)
