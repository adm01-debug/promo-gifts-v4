import { PageSEO } from '@/components/seo/PageSEO';
import { ProductPriceSimulator } from '@/components/pricing/ProductPriceSimulator';
import { QuantityPriceCalculator } from '@/components/pricing/QuantityPriceCalculator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, BarChart3 } from 'lucide-react';

export default function PriceSimulatorPage() {
  return (
      <>
        <PageSEO
          title="Simulador de Preços"
          description="Simule preços de brindes com personalização, quantidades e custos."
          path="/simulador-precos"
        />
        <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
          {/* Hero Header — #1 */}
          <div className="flex flex-col gap-1">
            <h1
              data-testid="page-title-simulador-precos"
              className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            >
              Simulador de Preços
            </h1>
            <p className="max-w-lg text-sm text-muted-foreground">
              Calcule o preço exato de qualquer produto com personalização, compare técnicas e gere
              orçamentos em segundos.
            </p>
          </div>

          {/* Tabs com contexto — #2 */}
          <Tabs defaultValue="by-product" className="w-full">
            <TabsList className="grid h-auto w-full max-w-lg grid-cols-2 p-1">
              <TabsTrigger value="by-product" className="gap-2 py-2.5 data-[state=active]:shadow-md">
                <Package className="h-4 w-4" />
                <div className="flex flex-col items-start text-left">
                  <span className="text-xs font-medium sm:text-sm">Por Produto</span>
                  <span className="hidden text-[10px] font-normal text-muted-foreground sm:block">
                    Configure e veja o preço final
                  </span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="by-quantity" className="gap-2 py-2.5 data-[state=active]:shadow-md">
                <BarChart3 className="h-4 w-4" />
                <div className="flex flex-col items-start text-left">
                  <span className="text-xs font-medium sm:text-sm">Por Tiragem</span>
                  <span className="hidden text-[10px] font-normal text-muted-foreground sm:block">
                    Compare preços em diferentes quantidades
                  </span>
                </div>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="by-product" className="mt-6 animate-fade-in">
              <ProductPriceSimulator />
            </TabsContent>

            <TabsContent value="by-quantity" className="mt-6 animate-fade-in">
              <QuantityPriceCalculator productBasePrice={0} onSelectTechnique={() => {}} />
            </TabsContent>
          </Tabs>
        </div>
      </>
  );
}
