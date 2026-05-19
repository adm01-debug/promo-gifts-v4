import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { type QuoteTemplate } from "@/hooks/quotes";
import { QuoteTemplatesList } from "./QuoteTemplatesList";

interface QuoteTemplateSelectorProps {
  onSelectTemplate: (template: QuoteTemplate) => void;
  trigger?: React.ReactNode;
}

export function QuoteTemplateSelector({ 
  onSelectTemplate,
  trigger,
}: QuoteTemplateSelectorProps) {
  const [open, setOpen] = useState(false);

  const handleSelectTemplate = (template: QuoteTemplate) => {
    onSelectTemplate(template);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Usar Template
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Selecionar Template</DialogTitle>
          <DialogDescription>
            Escolha um template para preencher automaticamente o orçamento
          </DialogDescription>
        </DialogHeader>
        <QuoteTemplatesList
          onApplyTemplate={handleSelectTemplate}
          selectionMode
        />
      </DialogContent>
    </Dialog>
  );
}
