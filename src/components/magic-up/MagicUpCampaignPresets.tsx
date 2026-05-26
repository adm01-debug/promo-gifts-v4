import { Button } from '@/components/ui/button';
import { BRIEF_PRESETS, type MagicUpBrief } from '@/pages/magic-up/magicUpStrategy';

interface MagicUpCampaignPresetsProps {
  onSelect: (preset: MagicUpBrief) => void;
}

export function MagicUpCampaignPresets({ onSelect }: MagicUpCampaignPresetsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {BRIEF_PRESETS.map((preset) => (
        <Button
          key={preset.label}
          type="button"
          variant="outline"
          size="sm"
          className="justify-start text-xs"
          onClick={() => onSelect(preset)}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}
