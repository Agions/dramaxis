# @dramaxis/ui · 电影调色台设计系统与原子组件库

`@dramaxis/ui` 位于 `packages/ui`，承载 Dramaxis 专业电影级非编调色台视觉规范下的高保真、无状态原子组件与基础交互图元。

---

## 1. 设计规范与色彩代币 (Design Tokens)

为了给创作者营造沉浸式暗室调光与剪辑环境，组件库采用深灰哑光背景与琥珀金调光高光：

```css
:root {
  /* 品牌核心：琥珀金与电影调光金色 */
  --color-gold: #F5C842;
  --color-gold-muted: rgba(245, 200, 66, 0.12);
  --color-gold-glow: rgba(245, 200, 66, 0.25);

  /* 哑光暗黑非编背景梯度 */
  --color-bg: #0d0f12;
  --color-surface: #16191f;
  --color-surface-elevated: #1e222a;
  --color-border: #262b35;

  /* 文本灰阶 */
  --color-text-primary: #f0f2f5;
  --color-text-secondary: #9ba3af;
  --color-text-muted: #626a7a;
}
```

---

## 2. 核心原子组件清单

- **`Button`**：
  - `primary`：琥珀金渐变高光流光变体，用于主生产流触发；
  - `secondary`：哑光深色微线框按钮，用于常规操作；
  - `danger`：暗红渐变，用于破坏性工程删除或丢弃操作；
  - `ghost`：完全无背景按钮，用于时间轴紧凑工具条。
- **`Card`**：
  - 带有微弱 1px 哑光内发光与悬停微投影，提供物理机架般的质感。
- **`Badge`**：
  - 用于智能体角色铭牌（如 `Director`、`Screenwriter`）、模型系列与命中置信度标注。
- **`Modal / Dialog`**：
  - 支持快捷键 ESC 监听、焦点捕获锁 (Focus Trap) 与高斯毛玻璃 Backdrop 虚化，无缝衔接人机协同断点 (HITL) 决策流。
- **`ProgressBar`**：
  - 平滑贝塞尔曲线进度指示条，用于渲染与多智能体推演状态呈现。
