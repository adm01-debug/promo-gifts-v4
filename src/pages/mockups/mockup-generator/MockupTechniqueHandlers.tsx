import { useState, useCallback } from "react";
import { toast } from "sonner";
import { techniqueNeedsColorConfig, classifyTechnique, type TechniqueColorConfig } from "@/components/mockup/techniqueColorUtils";
import type { MockupTechnique } from "@/types/external-db";

interface TechniqueHandlersOptions {
  hasLogo: boolean;
  selectedTechnique: MockupTechnique | null;
  setSelectedTechnique: (t: MockupTechnique | null) => void;
  setGeneratedMockup: (m: string | null) => void;
  setTechniqueColorConfig: (c: TechniqueColorConfig | null) => void;
}

export function useTechniqueHandlers({
  hasLogo,
  selectedTechnique,
  setSelectedTechnique,
  setGeneratedMockup,
  setTechniqueColorConfig,
}: TechniqueHandlersOptions) {
  const [pendingTechnique, setPendingTechnique] = useState<MockupTechnique | null>(null);
  const [techniqueChangeDialogOpen, setTechniqueChangeDialogOpen] = useState(false);
  const [colorConfigDialogOpen, setColorConfigDialogOpen] = useState(false);

  const handleTechniqueChange = useCallback((technique: MockupTechnique | null) => {
    if (hasLogo && selectedTechnique && technique && technique.id !== selectedTechnique.id) {
      setPendingTechnique(technique);
      setTechniqueChangeDialogOpen(true);
      return;
    }
    setSelectedTechnique(technique);
    setGeneratedMockup(null);
    if (technique && techniqueNeedsColorConfig(technique.name, technique.code)) {
      setTechniqueColorConfig(null);
      setColorConfigDialogOpen(true);
    } else if (technique) {
      setTechniqueColorConfig({ category: classifyTechnique(technique.name, technique.code), isFullColor: true });
    } else {
      setTechniqueColorConfig(null);
    }
  }, [hasLogo, selectedTechnique, setSelectedTechnique, setGeneratedMockup, setTechniqueColorConfig]);

  const confirmTechniqueChange = useCallback(() => {
    if (!pendingTechnique) {
      setTechniqueChangeDialogOpen(false);
      return;
    }
    setSelectedTechnique(pendingTechnique);
    setGeneratedMockup(null);
    setTechniqueChangeDialogOpen(false);
    toast.info(`Técnica alterada para ${pendingTechnique.name}. Dimensões ajustadas automaticamente.`, { duration: 3000 });
    if (techniqueNeedsColorConfig(pendingTechnique.name, pendingTechnique.code)) {
      setTechniqueColorConfig(null);
      setTimeout(() => setColorConfigDialogOpen(true), 300);
    } else {
      setTechniqueColorConfig({ category: classifyTechnique(pendingTechnique.name, pendingTechnique.code), isFullColor: true });
    }
    setPendingTechnique(null);
  }, [pendingTechnique, setSelectedTechnique, setGeneratedMockup, setTechniqueColorConfig]);

  return {
    pendingTechnique,
    techniqueChangeDialogOpen,
    setTechniqueChangeDialogOpen,
    colorConfigDialogOpen,
    setColorConfigDialogOpen,
    handleTechniqueChange,
    confirmTechniqueChange,
  };
}
