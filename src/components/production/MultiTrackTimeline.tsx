/**
 * dramaxis v1.2.0 · 全景多轨生产时间轴组件 (Facade Re-export)
 *
 * 拆解子模块详见 ./timeline/ (各模块文件名均严格受控于 <= 8 字母规范):
 * - ruler.tsx: 时间轴标尺刻度
 * - header.tsx: 轨道控制头 (M/S/L)
 * - cursor.tsx: 播放头与选区遮罩
 * - tools.tsx: 顶部时间码、对齐与缩放控制栏
 * - clip.tsx: 音频波形与切片模型
 * - index.tsx: 容器集成
 *
 * @author Agions
 * @copyright (c) 2026 Dramaxis. All rights reserved.
 */

export * from "./timeline";
export { MultiTrackTimeline as default } from "./timeline";
