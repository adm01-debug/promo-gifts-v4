import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CAMPAIGN_STATUSES,
  toHuman,
  type MagicUpBrief,
  type MagicUpCampaign,
  type MagicUpCampaignStatus,
} from '@/pages/magic-up/magicUpStrategy';
import { MagicUpCampaignPresets } from './MagicUpCampaignPresets';
import { MagicUpCampaignSummary } from './MagicUpCampaignSummary';

interface MagicUpCampaignPanelProps {
  brief: MagicUpBrief;
  campaign: MagicUpCampaign | null;
  campaigns: MagicUpCampaign[];
  onBriefChange: (brief: MagicUpBrief) => void;
  onCampaignChange: (campaign: MagicUpCampaign | null) => void;
  onSave: () => void;
  onSelectCampaign: (campaign: MagicUpCampaign) => void;
  onDuplicateCampaign: (campaign: MagicUpCampaign) => void;
  fields: Array<{
    field: keyof Pick<MagicUpBrief, 'objective' | 'channel' | 'audience' | 'tone'>;
    options: string[];
  }>;
}

export function MagicUpCampaignPanel({
  brief,
  campaign,
  campaigns,
  onBriefChange,
  onCampaignChange,
  onSave,
  onSelectCampaign,
  onDuplicateCampaign,
  fields,
}: MagicUpCampaignPanelProps) {
  const updateCampaign = (patch: Partial<MagicUpCampaign>) =>
    onCampaignChange({
      ...(campaign || {
        ...brief,
        id: null,
        title: 'Campanha Magic Up',
        status: 'draft',
        clientId: null,
        clientName: null,
      }),
      ...patch,
    });

  return (
    <div className="space-y-3">
      <MagicUpCampaignPresets onSelect={onBriefChange} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Título</Label>
          <Input
            value={campaign?.title ?? ''}
            placeholder="Ex: WhatsApp premium · caneca"
            onChange={(e) => updateCampaign({ title: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={campaign?.status || 'draft'}
            onValueChange={(value) => updateCampaign({ status: value as MagicUpCampaignStatus })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map(({ field, options }) => (
          <div key={field} className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{toHuman(field)}</Label>
            <Select
              value={brief[field]}
              onValueChange={(value) => onBriefChange({ ...brief, [field]: value })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {toHuman(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">CTA</Label>
          <Input
            value={brief.cta}
            onChange={(e) => onBriefChange({ ...brief, cta: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ocasião</Label>
          <Input
            value={brief.occasion}
            onChange={(e) => onBriefChange({ ...brief, occasion: e.target.value })}
            className="h-9"
          />
        </div>
      </div>
      <MagicUpCampaignSummary
        campaign={campaign}
        channel={brief.channel}
        objective={brief.objective}
        tone={brief.tone}
        onSave={onSave}
      />
      {campaigns.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Campanhas recentes">
          {campaigns.slice(0, 8).map((item) => (
            <Button
              key={item.id || item.title}
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1 text-xs"
              onClick={() => onSelectCampaign(item)}
              onDoubleClick={() => onDuplicateCampaign(item)}
            >
              {item.title}
              <Badge variant="secondary" className="text-[9px]">
                {toHuman(item.channel)}
              </Badge>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
