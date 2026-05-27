import { Button } from "@/components/ui/button";
import { ShoppingCart, FileText } from "lucide-react";

export default function ActionButtonsGallery() {
  return (
    <div className="p-10 flex flex-col gap-10 bg-[#020817] min-h-screen text-white">
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-2">Design System: Botões de Ação</h1>
        <p className="text-muted-foreground mb-10">Validação de Gap (1.5) e Tracking (0.15em) conforme especificações.</p>
        
        <div className="space-y-12">
          <section>
            <h2 className="text-xl font-semibold mb-5 border-b border-white/10 pb-2">Desktop View</h2>
            <div className="flex gap-2.5 max-w-md">
              <Button
                size="lg"
                className="xl:h-13 h-12 flex-1 basis-0 gap-1.5 rounded-xl bg-primary text-[0.875rem] font-action-button text-primary-foreground shadow-md shadow-primary/20 transition-all duration-300 hover:scale-[1.02] hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                <ShoppingCart className="h-4 w-4" />
                Carrinho
              </Button>
              <Button
                size="lg"
                className="xl:h-13 h-12 flex-1 basis-0 gap-1.5 rounded-xl bg-success text-[0.875rem] font-action-button text-success-foreground shadow-md shadow-success/20 transition-all duration-300 hover:scale-[1.02] hover:bg-success/90 hover:shadow-lg hover:shadow-success/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                Orçamento
              </Button>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-5 border-b border-white/10 pb-2">Mobile Simulation (375px)</h2>
            <div className="w-[375px] border border-white/20 p-4 rounded-lg bg-[#0f172a]">
              <div className="flex gap-2.5">
                <Button
                  size="lg"
                  className="xl:h-13 h-12 flex-1 basis-0 gap-1.5 rounded-xl bg-primary text-[0.875rem] font-action-button text-primary-foreground shadow-md shadow-primary/20 transition-all duration-300 hover:scale-[1.02] hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Carrinho
                </Button>
                <Button
                  size="lg"
                  className="xl:h-13 h-12 flex-1 basis-0 gap-1.5 rounded-xl bg-success text-[0.875rem] font-action-button text-success-foreground shadow-md shadow-success/20 transition-all duration-300 hover:scale-[1.02] hover:bg-success/90 hover:shadow-lg hover:shadow-success/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  <FileText className="h-4 w-4" />
                  Orçamento
                </Button>
              </div>
            </div>
          </section>

          <section className="bg-white/5 p-6 rounded-xl border border-white/10">
            <h2 className="text-sm font-bold uppercase tracking-widest text-primary mb-3">Especificações Técnicas</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><strong className="text-white">Letter Spacing:</strong> 0.15em (Protegido por .font-action-button)</li>
              <li><strong className="text-white">Icon Gap:</strong> 1.5 (6px)</li>
              <li><strong className="text-white">Font Weight:</strong> 800</li>
              <li><strong className="text-white">Font Family:</strong> Outfit (font-display)</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
