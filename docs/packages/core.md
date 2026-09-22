# @splicr/core · 全局状态机与派生计算

`@splicr/core` 位于 `packages/core`，管理前端所有的 Zustand 全局响应式状态切片、多语言派生与业务通用 Hooks。

---

## 1. 核心状态切片

- **`useUpdateStore`**：更新状态机快照、跳过版本列表 (`skippedVersions`) 与通知角标状态 (`hasNotification`)。
- **`useProjectStore`**：当前激活项目、5 轨多媒体工程与历史撤销/重做栈。
- **`useSettingsStore`**：系统语言、API Key 凭据缓存标记与快捷键绑定。
- **`useThemeStore`**：电影级调色台主题（深色/浅色/跟随系统）切换管理。

---

## 2. 使用示例

```typescript
import { useUpdateStore } from "@splicr/core";

export function StatusBar() {
  const hasNotification = useUpdateStore((s) => s.hasNotification);
  return hasNotification ? <span>● NEW</span> : null;
}
```
