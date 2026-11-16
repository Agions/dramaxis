# Changelog

All notable changes to the Dramaxis project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-11-13

### 🚀 Production Model Matrix & Comprehensive Documentation Overhaul

- **Official LLM Engine Matrix Alignment (11 Providers)**:
  - Upgraded and strictly verified active production-level models from official developer portals across all 11 providers:
    - **Qwen**: `qwen3.8-max` (flagship reasoning), `qwen3.7-plus`, `qwen3.8-omni-flash` (realtime native multimodal).
    - **DeepSeek**: `deepseek-v4-pro` (V4 Pro flagship), `deepseek-flash` (V4.1 MoE multimodal).
    - **OpenAI**: `gpt-6-astra` (flagship reasoning & agentic tasks), `gpt-6.1-sol`, `gpt-6.1-terra`, `gpt-6-luna`.
    - **Claude**: `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-haiku-5-5`, `claude-fable-5-2`.
    - **Gemini**: `gemini-4-argon` (frontier reasoning), `gemini-3.8-flash` (multimodal throughput), `gemini-3.8-live`.
    - **Kimi**: `kimi-k3.1-pro` (3-trillion parameter native vision), `kimi-k3.1-pro-highspeed`, `kimi-k3`.
    - **GLM**: `glm-5.3` (1M context + deep thinking), `glm-5.3-flash`, `glm-5.2`.
    - **Doubao**: `doubao-seed-2-1-pro-260915`, `doubao-seed-2-1-lite-260915`, `doubao-seed-2-1-turbo-260628`.
    - **Hunyuan**: `hy4` (TokenHub 1M native vision flagship), `hy3`.
    - **Local**: `deepseek-r1:14b`, `qwq:32b`, `qwen3:14b`, `llama3.3:70b`.
    - **Qwen37**: `qwen3.8-omni-flash` (multimodal experimental endpoint).
  - Deprecated and removed legacy/unsupported model IDs (`moonshot-v1-*`, `doubao-pro-*`, `hunyuan-standard`) to prevent 404 runtime errors.
- **Comprehensive Documentation Suite Update**:
  - Synchronized VitePress technical docs (`docs/index.md`, `docs/guide/getting-started.md`, `docs/guide/multi-agent-studio.md`, `docs/crates/dramaxis-script.md`).
  - Synchronized offline user manuals and printable guides (`resources/docs/manual_template.html`, `resources/docs/Dramaxis_快速上手指南.md`).
  - Synchronized UI controls: `LlmConfigForm.tsx`, `llmOptions.ts`, `ScriptStudioPanel.tsx`, and `AgentModelMatrixCard.tsx`.

## [1.2.0] - 2026-10-21

### 🚀 Major Architectural Upgrades & Highlights

- **Decoupled Playback Engine (`usePlaybackStore`)**:
  - Independent 60fps high-frequency playback clock separated from heavy project state updates.
  - Zero-overhead audio/video synchronized scrub and canvas waveform rendering.
- **Unified 4-Workshop State Machine (`useWorkshopStore`)**:
  - Dedicated domain state management for Asset Hub, Script Studio, Production Workspace, and Export Hub.
  - Granular undo/redo and atomic inspector property mutations.
- **Production Monolith Decomposition**:
  - Refactored `production.tsx` into modular components: `ProductionHeader`, `ProductionLeftSidebar`, `ProductionWorkspace`, and `ProductionInspector`.
  - Maintainable component hierarchy and optimized rendering pipelines.
- **Multi-Modal Vision RAG & Script Retention Flywheel**:
  - Deep integration of video scene visual embeddings and multimodal scene-by-scene matching.
  - Golden 3-second hook heuristics and retention tension arc generation.
- **Comprehensive Legacy Cleanup & Naming Standardization**:
  - Sanitized obsolete legacy references across Rust and TypeScript ecosystems.
  - Safe LocalStorage key migration with backwards compatibility.

## [1.0.0] - 2026-08-06

### 🚀 Major Features & Highlights

- **Architectural Rewrite**: Complete modernization from legacy Python codebase to a high-performance **Tauri 2 + Rust + React 19 + TypeScript** desktop architecture.
- **7-Step AI Video Narrative Pipeline**:
  - **Step 1 (Intake)**: Raw video file drag-and-drop intake with resolution and frame rate probe.
  - **Step 2 (Detection)**: High-speed FFmpeg scene transition detection and highlight clip split.
  - **Step 3 (Script Engine)**: First-person monologue narration generator with 11 LLM provider choices (DeepSeek, OpenAI, Claude, Gemini, Ollama, etc.).
  - **Step 4 (Voice Synth)**: Multi-engine TTS voice synthesis with Edge-TTS and zero-shot GPT-SoVITS voice cloning.
  - **Step 5 (Subtitle)**: VAD endpoint detection for precise subtitle alignment and dynamic karaoke style rendering.
  - **Step 6 (Timeline Compose)**: Multi-track DAG alignment for background music, vocal track, and video keyframes.
  - **Step 7 (CapCut Draft Export)**: One-click export to native CapCut project draft format (`.draft`) and short-video resolution presets.

### 🎨 UI & Design System

- **Cinematic Darkroom Theme**: Sleek deep obsidian background (`#0D0D0F`) paired with warm gold accents (`#F5C842`).
- **Streamlined Navigation**: Simplified 5-module left navigation sidebar (首页, AI 7步流, 资产库, 设置, 帮助) with zero route duplication.
- **Chinese First**: Default interface language initialized to Chinese (`zh-CN`).

### 🛠️ Infrastructure & Quality Assurance

- **Project Structure Flattening**: Simplified monorepo structure by placing frontend and desktop app core cleanly at project root.
- **100% Test Coverage Compliance**: Passed 157 Vitest unit tests and Rust workspace check.
