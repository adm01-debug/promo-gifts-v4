import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Sparkles,
  MessageCircle,
  X,
  Send,
  Loader2,
  Lightbulb,
  Palette,
  Ruler,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestions?: QuickAction[];
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
}

interface AIMockupAssistantProps {
  productName?: string;
  techniqueName?: string;
  /** Legacy callback (type/value pair). */
  onSuggestionApply?: (type: string, value: unknown) => void;
  /** Modern callback receiving structured suggestion (techniqueId, position, etc). */
  onApplySuggestion?: (suggestion: {
    techniqueId?: string;
    position?: { x: number; y: number };
    [key: string]: unknown;
  }) => void;
  className?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "position", label: "Melhor posição", icon: Target, action: () => {} },
  { id: "size", label: "Tamanho ideal", icon: Ruler, action: () => {} },
  { id: "color", label: "Cores sugeridas", icon: Palette, action: () => {} },
  { id: "tips", label: "Dicas gerais", icon: Lightbulb, action: () => {} },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "Olá! Eu sou o Matheus, seu expert em layouts. Posso ajudar com posicionamento, técnicas e sugestões para criar o mockup perfeito. Como posso ajudar?",
    timestamp: new Date(),
    suggestions: QUICK_ACTIONS,
  },
];

export function AIMockupAssistant({
  productName,
  techniqueName,
  onSuggestionApply,
  className,
}: AIMockupAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        `Para ${productName || "este produto"}, recomendo posicionar a logo no centro superior, deixando margem de 2cm das bordas.`,
        `A técnica ${techniqueName || "escolhida"} funciona melhor com logos simplificados. Considere reduzir o número de cores para melhores resultados.`,
        "Para máxima visibilidade, mantenha o tamanho do logo entre 8-12cm de largura. Logos muito pequenos perdem impacto.",
        "Dica: Posicione a logo levemente acima do centro geométrico - isso cria melhor equilíbrio visual em produtos vestíveis.",
      ];

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleQuickAction = (action: QuickAction) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: action.label,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const actionResponses: Record<string, string> = {
      position: `Para ${productName || "este produto"}, a posição ideal é centralizada no terço superior, a cerca de 8cm da gola/borda superior.`,
      size: "O tamanho ideal para máxima visibilidade e legibilidade é entre 10-15cm de largura. Para logos detalhados, prefira tamanhos maiores.",
      color: `Com a técnica ${techniqueName || "selecionada"}, sugiro usar no máximo 3-4 cores sólidas para melhor definição e custo otimizado.`,
      tips: "3 dicas rápidas: 1) Sempre peça aprovação visual antes de produzir, 2) Considere como a peça será usada, 3) Teste o contraste logo/produto.",
    };

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: actionResponses[action.id] || "Posso ajudar com mais alguma coisa?",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  if (!isOpen) {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn("fixed bottom-24 right-4 z-50 md:bottom-6", className)}
      >
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg gap-0 p-0 relative overflow-hidden group bg-primary hover:bg-primary/90 text-primary-foreground border-0"
          onClick={() => setIsOpen(true)}
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <Bot className="h-6 w-6" />
          </motion.div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground/50" />
            <Sparkles className="relative h-4 w-4 text-primary-foreground" />
          </span>
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={cn(
        "fixed z-50 shadow-2xl rounded-2xl border bg-background overflow-hidden",
        "bottom-24 right-4 md:bottom-6",
        isMinimized ? "w-72 h-14" : "w-80 sm:w-96 h-[500px] max-h-[70vh]",
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 border-b bg-primary/15 cursor-pointer"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="p-2 rounded-lg bg-primary/25">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-sm">Matheus — Expert em Layouts</h3>
          {!isMinimized && (
            <p className="text-xs text-muted-foreground truncate">
              Powered by AI
            </p>
          )}
        </div>
        <Badge variant="secondary" className="text-[10px]">
          Beta
        </Badge>
        <Button
          variant="ghost"
          size="icon" aria-label="Fechar"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 h-[calc(100%-130px)]">
            <div className="p-3 space-y-4">
              <AnimatePresence>
                {messages.map((message, idx) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={cn(
                      "flex gap-2",
                      message.role === "user" ? "flex-row-reverse" : ""
                    )}
                  >
                    <div
                      className={cn(
                        "p-2 rounded-lg shrink-0",
                        message.role === "user"
                          ? "bg-primary text-white"
                          : "bg-muted"
                      )}
                    >
                      {message.role === "user" ? (
                        <MessageCircle className="h-4 w-4" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "rounded-xl p-3 max-w-[80%]",
                        message.role === "user"
                          ? "bg-primary text-white"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-sm">{message.content}</p>

                      {/* Quick actions */}
                      {message.suggestions && message.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {message.suggestions.map((action) => (
                            <Button
                              key={action.id}
                              variant="secondary"
                              size="sm"
                              className="h-7 text-xs gap-1 px-2"
                              onClick={() => handleQuickAction(action)}
                            >
                              <action.icon className="h-3 w-3" />
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2"
                >
                  <div className="p-2 rounded-lg bg-muted">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="bg-muted rounded-xl p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </motion.div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t bg-muted/30">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre o mockup..."
                className="flex-1 h-10 !ring-[hsl(145,80%,30%)] !border-[hsl(145,80%,30%)] focus-visible:!ring-[hsl(145,80%,30%)]/20 focus-visible:!border-[hsl(145,80%,30%)] hover:!border-[hsl(145,80%,30%)]/50"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon" aria-label="Carregando"
                className="h-10 w-10 shrink-0 bg-primary hover:bg-primary/90 text-white"
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </>
      )}
    </motion.div>
  );
}
