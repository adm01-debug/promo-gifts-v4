/**
 * BIAiCopilot — chat lateral grounded nos dados do BI.
 * "Pergunte ao BI" — chama edge function `bi-copilot` (Lovable AI · gemini-flash).
 */
import { useState, useRef, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Send, Bot, User as UserIcon, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useClientHealthScore } from "@/hooks/bi/useClientHealthScore";
import { useClientBI } from "@/hooks/bi/useClientBI";
import { useClientAffinity } from "@/hooks/bi/useClientAffinity";
import { useIndustryTrends } from "@/hooks/bi/useIndustryTrends";
import { useClientSeasonality } from "@/hooks/bi/useClientSeasonality";
import { useClientVsIndustry } from "@/hooks/bi/useClientVsIndustry";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  ramoAtividade: string | null;
}

const SUGGESTED_QUESTIONS = [
  "Por que a frequência caiu?",
  "Qual produto tem maior chance de fechar?",
  "Quando devo abordar esse cliente?",
  "Qual o melhor pitch para hoje?",
];

export function BIAiCopilot({ open, onOpenChange, clientId, clientName, ramoAtividade }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const health = useClientHealthScore(clientId, ramoAtividade);
  const bi = useClientBI(clientId);
  const affinity = useClientAffinity(clientId);
  const trends = useIndustryTrends(ramoAtividade);
  const seas = useClientSeasonality(clientId, ramoAtividade);
  const vs = useClientVsIndustry(clientId, ramoAtividade);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const context = {
        clientName,
        ramoAtividade,
        score: health.score,
        tier: health.tier,
        crossZoneInsight: health.crossZoneInsight,
        nextAction: health.nextActionLabel,
        windowLabel: health.windowLabel,
        shareOfWalletPct: health.shareOfWalletPct,
        potentialUntappedBRL: health.potentialUntappedBRL,
        ltv: bi.ltv,
        avgTicket: bi.avgTicket,
        ordersCount: bi.ordersCount,
        daysSinceLastOrder: bi.daysSinceLastOrder,
        topCategories: affinity.data?.categories?.slice(0, 3).map((c) => ({
          category: c.category,
          count: c.count,
          revenue: c.revenue,
        })),
        industryTrends: trends.data?.trends?.slice(0, 5).map((t) => ({
          name: t.productName,
          category: t.category,
          unitsSold: t.unitsSold,
        })),
        seasonality: {
          topClientMonths: seas.topClientMonths.map((m) => `${m.monthLabel} (${Math.round(m.sharePercent)}%)`),
          nextPeakMonth: seas.nextPeakMonth,
          daysToNextPeak: seas.daysToNextPeak,
        },
        clientVsIndustry: vs.metrics.map((m) => ({
          label: m.label,
          delta: Math.round(m.deltaPercent),
        })),
      };

      const { data, error } = await supabase.functions.invoke("bi-copilot", {
        body: {
          question,
          context,
          history: messages.slice(-6),
        },
      });

      if (error) throw error;
      const answer = (data as { answer?: string })?.answer ?? "Não consegui processar agora.";
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch (_e) {
      toast.error("Erro ao consultar o copiloto. Tente novamente.");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Desculpe, tive um problema para responder. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-5 pb-3 border-b bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10">
          <SheetTitle className="flex items-center gap-2 font-display">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            Pergunte ao BI
          </SheetTitle>
          <SheetDescription className="text-xs">
            IA grounded nos dados de <strong>{clientName}</strong>. Pergunte qualquer coisa.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1" ref={scrollRef as React.RefObject<HTMLDivElement>}>
          <div className="p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-lg border border-dashed p-4 text-center space-y-2">
                  <Bot className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    Faça uma pergunta sobre este cliente. Eu uso todos os dados do BI para responder.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" /> Sugestões
                  </p>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="w-full text-left text-xs p-2.5 rounded-lg border bg-card hover:bg-muted/60 hover:border-primary/30 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
              >
                {m.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm",
                  )}
                >
                  {m.content}
                </div>
                {m.role === "user" && (
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 space-y-1.5 max-w-[80%]">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 border-t bg-card flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte algo sobre este cliente..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
