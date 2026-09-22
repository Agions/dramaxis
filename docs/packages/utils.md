# @splicr/utils · 时间轴刻度与通用工具库

`@splicr/utils` 位于 `packages/utils`，提供零依赖的前端通用纯函数与音视频换算工具。

---

## 1. 核心导出工具

- **`formatBytes(bytes: number | null): string`**：将字节数智能转换为 `KB`、`MB`、`GB` 格式。
- **`formatSeconds(seconds: number): string`**：将秒数转换为 `MM:SS` 或 `HH:MM:SS` 格式。
- **`secondsToFrames(seconds: number, fps: number): number`**：毫秒级时间戳与视频帧号的高精度换算。
- **`clamp(val: number, min: number, max: number): number`**：数值边界限制工具。
