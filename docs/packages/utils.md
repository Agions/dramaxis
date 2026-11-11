# @dramaxis/utils · 纯函数工具库与时间轴数学算子

`@dramaxis/utils` 位于 `packages/utils`，提供零外部运行时依赖的通用高频工具函数、字节单位转换与针对音视频非编时间轴的高精度时间基数学算子。

---

## 1. 核心导出算子

### 1. 时间轴与时间基高精度转换
- **`formatSeconds(seconds: number): string`**：
  将浮点数秒精准格式化为 `MM:SS.ms` 或 `HH:MM:SS` 格式，保障刻度尺展示美观一致；
- **`secondsToFrames(seconds: number, fps: number): number`**：
  视频帧数与浮点秒数双向四舍五入换算，适配 23.976、24、25、29.97、30、60 等标准时间基；
- **`framesToSeconds(frames: number, fps: number): number`**：
  依据真实帧率将离散帧编号反算回绝对秒数。

### 2. 存储与网络单位格式化
- **`formatBytes(bytes: number | null): string`**：
  将原始字节整型智能阶梯转换为可读的 `B`、`KB`、`MB`、`GB`，用于素材体积展示与下载平滑测速。

### 3. 数学与边界守卫
- **`clamp(val: number, min: number, max: number): number`**：
  严格将数值限制在闭区间内，用于时间轴缩放手柄与 BGM 音量分贝滑块防御；
- **`parseCutPoint(timeStr: string): number`**：
  解析形如 `01:23.45` 或浮点秒字符串为标准浮点秒数。

---

## 2. 单元测试与无副作用保证

本包所有工具函数均为无状态、无副作用的纯函数（Pure Functions），100% 覆盖单元测试，确保在时间轴高频微秒计算中拥有极高执行效率与零内存泄漏。
