import { motion } from "framer-motion";
import { toast } from "sonner";
import { Send, Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type RefObject } from "react";

interface ChatInputBarProps {
  input: string;
  setInput: (v: string) => void;
  isLoading: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isFromVoiceRef: React.MutableRefObject<boolean>;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onStopGenerating: () => void;
  setIsFromVoice: (v: boolean) => void;
}

export function ChatInputBar({
  input, setInput, isLoading, inputRef, isFromVoiceRef,
  onKeyDown, onSend, onStopGenerating, setIsFromVoice,
}: ChatInputBarProps) {
  const handleVoiceInput = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) { toast.error("Seu navegador não suporta reconhecimento de voz"); return; }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    toast.info("🎙️ Ouvindo… fale agora", { duration: 3000 });
    recognition.onresult = (event: Event) => {
      const speechEvent = event as unknown as { results: ArrayLike<ArrayLike<{ transcript: string }>> };
      const transcript = speechEvent.results[0][0].transcript;
      if (transcript) {
        setInput(transcript);
        isFromVoiceRef.current = true;
        setIsFromVoice(true);
        setTimeout(() => {
          const sendBtn = document.querySelector('[data-oracle-send]') as HTMLButtonElement;
          sendBtn?.click();
        }, 100);
      }
    };
    recognition.onerror = () => toast.error("Não foi possível captar o áudio");
    recognition.start();
  };

  return (
    <div className="px-4 py-3 border-t border-border/20 flex-shrink-0">
      {isLoading && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center mb-2">
          <button onClick={onStopGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium border border-border/50 bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all">
            <Square className="h-3 w-3 fill-current" />
            Parar de gerar
          </button>
        </motion.div>
      )}
      <div className="flex gap-2 items-end">
        <textarea ref={inputRef} value={input}
          onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
          onKeyDown={onKeyDown} placeholder="Pergunte ao Flow…" disabled={isLoading} rows={1}
          className="flex-1 min-h-[40px] max-h-[120px] rounded-xl border border-border/30 bg-muted/20 text-sm px-3 py-2.5 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary/25 transition-all placeholder:text-muted-foreground/40 disabled:opacity-50" />
        {!input.trim() && !isLoading && (
          <Button variant="ghost" size="icon" onClick={handleVoiceInput} aria-label="Entrada por voz"
            className="h-10 w-10 rounded-xl shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10">
            <Mic className="h-5 w-5" />
          </Button>
        )}
        <Button data-oracle-send onClick={onSend} disabled={!input.trim() || isLoading} size="icon" aria-label="Enviar mensagem"
          className="h-10 w-10 rounded-xl shrink-0">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground/30 text-center mt-1.5 select-none">
        Shift+Enter para nova linha · Flow - Assistente Pessoal
      </p>
    </div>
  );
}
