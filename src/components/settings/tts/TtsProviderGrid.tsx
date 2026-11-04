import { Card, Badge } from "@dramaxis/ui";
import { TTS_OPTIONS, type TtsMeta } from "./ttsOptions";

interface TtsProviderGridProps {
  currentProvider?: string | null;
  onSelect: (item: TtsMeta) => void;
}

export function TtsProviderGrid({ currentProvider, onSelect }: TtsProviderGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {TTS_OPTIONS.map((item) => {
        const selected = currentProvider === item.id;
        return (
          <Card
            key={item.id}
            interactive
            glow={selected}
            onClick={() => onSelect(item)}
            className={`p-4 text-left ${selected ? "border-gold bg-gold-muted" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{item.icon}</span>
              <Badge variant={selected ? "gold" : "zinc"}>{item.tag}</Badge>
            </div>
            <div className="mt-3 text-sm font-bold text-text-primary">
              {item.label}
            </div>
            <div className="text-[11px] text-text-secondary mt-1 leading-snug">
              {item.hint}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
