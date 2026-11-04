/**
 * dramaxis v1.2.0 · LlmProviderGrid
 *
 * 模型厂商卡片矩阵选择器
 */

import { memo } from "react";
import { Badge, Card } from "@dramaxis/ui";
import { LLM_OPTIONS, type LlmMeta } from "./llmOptions";

interface LlmProviderGridProps {
  selectedProvider: string;
  onSelect: (provider: LlmMeta) => void;
}

export const LlmProviderGrid = memo(function LlmProviderGrid({
  selectedProvider,
  onSelect,
}: LlmProviderGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {LLM_OPTIONS.map((item) => {
        const isSelected = selectedProvider === item.id;
        return (
          <Card
            key={item.id}
            interactive
            glow={isSelected}
            onClick={() => onSelect(item)}
            className={`p-3 text-left transition-all ${
              isSelected ? "border-gold bg-gold-muted ring-1 ring-gold/50" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xl">{item.icon}</span>
              <Badge variant={isSelected ? "gold" : "zinc"}>{item.badge}</Badge>
            </div>
            <div className="mt-2 text-xs font-bold text-text-primary truncate">
              {item.name}
            </div>
            <div className="text-[10px] text-text-secondary truncate mt-0.5">
              {item.desc}
            </div>
          </Card>
        );
      })}
    </div>
  );
});
