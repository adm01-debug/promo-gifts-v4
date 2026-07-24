import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const MESSAGES = [
  'Carregando...',
  'Preparando tudo para você...',
  'Quase lá...',
  'Finalizando detalhes...',
];
const MESSAGE_ROTATION_MS = 2500;

export default function LoadingScreen() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, MESSAGE_ROTATION_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-[spin_0.7s_linear_infinite] text-brand-primary" />
        <p className="animate-fade-in text-muted-foreground" key={messageIndex}>
          {MESSAGES[messageIndex]}
        </p>
      </div>
    </div>
  );
}
