import { Button } from "@/components/ui/button";
import { ShoppingCart, FileText } from "lucide-react";

export default function DebugButtons() {
  return (
    <div className="p-10 flex flex-col gap-10 bg-[#020817] min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-5">Botões de Ação - Validação Visual</h1>
      
      <div className="flex gap-2.5 max-w-md">
        <Button
          size="lg"
          className="xl:h-13 h-12 flex-1 basis-0 gap-1.5 rounded-xl bg-primary font-display text-[0.875rem] font-bold tracking-[0.15em] text-primary-foreground shadow-md shadow-primary/20 transition-all duration-300 hover:scale-[1.02] hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          <ShoppingCart className="h-4 w-4" />
          Carrinho
        </Button>
        <Button
          size="lg"
          className="xl:h-13 h-12 flex-1 basis-0 gap-1.5 rounded-xl bg-success font-display text-[0.875rem] font-bold tracking-[0.15em] text-success-foreground shadow-md shadow-success/20 transition-all duration-300 hover:scale-[1.02] hover:bg-success/90 hover:shadow-lg hover:shadow-success/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          Orçamento
        </Button>
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-3 text-white">Versão Mobile (Simulação 375px)</h2>
        <div className="w-[375px] border border-white/20 p-4 rounded-lg bg-[#0f172a]">
          <div className="flex gap-2.5">
            <Button
              size="lg"
              className="xl:h-13 h-12 flex-1 basis-0 gap-1.5 rounded-xl bg-primary font-display text-[0.875rem] font-bold tracking-[0.15em] text-primary-foreground shadow-md shadow-primary/20 transition-all duration-300 hover:scale-[1.02] hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              <ShoppingCart className="h-4 w-4" />
              Carrinho
            </Button>
            <Button
              size="lg"
              className="xl:h-13 h-12 flex-1 basis-0 gap-1.5 rounded-xl bg-success font-display text-[0.875rem] font-bold tracking-[0.15em] text-success-foreground shadow-md shadow-success/20 transition-all duration-300 hover:scale-[1.02] hover:bg-success/90 hover:shadow-lg hover:shadow-success/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              Orçamento
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
