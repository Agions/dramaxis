# splicr-storage · 资产库索引扫描与轻量持久化

`splicr-storage` 负责素材库目录快速递归扫描、MIME 类型自动推断、SHA-256 内容寻址哈希与缩略图缓存管理。

---

## 1. 核心特性

- **高效扫描白名单**：支持 `.mp4`, `.mov`, `.mkv`, `.avi`, `.webm`, `.mp3`, `.wav`, `.aac`, `.flac` 等音视频格式。
- **确定性 SHA-256 指纹**：用于检测素材重复导入与缓存命中。
- **轻量持久化**：管理本地项目列表、最近打开历史与工程草稿的序列化。

---

## 2. 关键结构体

```rust
pub struct AssetEntry {
    pub id: String,
    pub path: String,
    pub filename: String,
    pub kind: AssetKind,
    pub size_bytes: u64,
    pub sha256: String,
    pub thumbnail_path: Option<String>,
}

pub enum AssetKind {
    Video,
    Audio,
    Image,
    Subtitle,
}
```
