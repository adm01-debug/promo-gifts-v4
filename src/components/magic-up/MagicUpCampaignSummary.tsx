import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CAMPAIGN_STATUSES, toHuman, type MagicUpCampaign } from '@/pages/magic-up/magicUpStrategy';

interface MagicUpCampaignSummaryProps {
  campaign: MagicUpCampaign | null;
  channel: string;
  objective: string;
  tone: string;
  onSave: () => void;
}

export function MagicUpCampaignSummary({
  campaign,
  channel,
  objective,
  tone,
  onSave,
}: MagicUpCampaignSummaryProps) {
  const status =
    CAMPAIGN_STATUSES.find((item) => item.value === campaign?.status)?.label || 'Rascunho';

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{campaign?.title || 'Campanha sem nome'}</p>
          <p className="text-xs text-muted-foreground">
            {toHuman(channel)} · {toHuman(objective)} · {toHuman(tone)}
          </p>
        </div>
        <Badge variant={campaign?.id ? 'secondary' : 'outline'}>{status}</Badge>
      </div>
      <Button type="button" size="sm" className="w-full" onClick={onSave}>
        {campaign?.id ? 'Atualizar campanha' : 'Salvar campanha'}
      </Button>
    </div>
  );
}
