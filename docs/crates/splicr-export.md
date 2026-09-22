# splicr-export · 剪映原生草稿直出与多格式转码

`splicr-export` 负责将内存中的 `Timeline` 转化为剪映 PC 端原生工程草稿文件包 (`.draft`)，并支持 FFmpeg 快速转码与预设渲染。

---

## 1. 剪映草稿二进制构造规范

- **目录结构生成**：
  ```text
  <DraftName>/
  ├── draft_info.json         # 草稿元数据与版本签名
  ├── draft_content.json      # 轨道映射、关键帧动画与文本花字
  └── draft_meta_info.json    # 草稿预览与封面引用
  ```
- **绝对路径软映射**：精准映射各轨道素材文件位置，保证剪映打开即用、0 转码时间。

---

## 2. 导出参数与结果结构体

```rust
pub struct ExportParams {
    pub mode: ExportMode,
    pub output_path: String,
    pub resolution_width: u32,
    pub resolution_height: u32,
    pub fps: f64,
    pub video_bitrate_kbps: u32,
}

pub struct CapcutDraftResult {
    pub draft_folder_path: String,
    pub draft_id: String,
    pub created_at: String,
}
```
