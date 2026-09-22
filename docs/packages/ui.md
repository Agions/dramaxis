# @splicr/ui · 调色台设计系统与原子组件

`@splicr/ui` 位于 `packages/ui`，承载 splicr 电影调色台设计规范下的无状态原子组件与基础控件。

---

## 1. 设计规范与色彩代币 (Design Tokens)

- **主色调**：电影调光金 (`--color-gold`: `#F5C842`) 与琥珀渐变 (`#E8933A`)。
- **暗黑背景**：高保真哑光灰阶 (`--color-bg`: `#0d0f12`, `--color-surface`: `#16191f`)。
- **高光晕染**：`--color-gold-glow: rgba(245, 200, 66, 0.25)`。

---

## 2. 核心组件列表

- **`Button`**：支持 `primary` (金色渐变流光)、`secondary` (哑光线框)、`danger` 与 `ghost` 4 种变体。
- **`Badge`**：用于模型标签、Agent 角色身份卡片与版本状态提示。
- **`Card`**：带有 3D 浮雕投影与悬停微交互的卡片容器。
- **`Dialog` / `Modal`**：支持 ESC 监听、毛玻璃 Backdrop 虚化与锁定模式的无障碍弹窗。
