# 全栈架构拓扑与洋葱模型 (Architecture Overview)

splicr 采用现代桌面工程的高内聚、低耦合架构设计，严格遵循 **Clean Architecture (洋葱架构)** 与 **单向依赖原则**。

---

## 1. 系统分层拓扑图

```mermaid
graph TD
    subgraph UI ["1. 前端表现与交互层 (React 19 + TailwindCSS)"]
        Routes["路由视图 (/routes)"] --> Components["UI 组件 (/components)"]
        Components --> Stores["全局状态 (/stores)"]
        Components --> Hooks["业务 Hooks (/hooks)"]
    end

    subgraph Contract ["2. IPC 强类型契约层 (packages/ipc)"]
        Client["IPC Client (client.ts)"]
        Commands["指令契约 (commands.ts)"]
        Types["自动生成类型 (types.gen.ts)"]
    end

    subgraph Host ["3. Tauri 宿主分发层 (src-tauri)"]
        TauriMain["Tauri Runtime (main.rs / lib.rs)"]
        CommandHandlers["命令处理中枢 (commands/*.rs)"]
        AppState["全局上下文 (AppContext)"]
    end

    subgraph Engine ["4. Rust 原生领域引擎 (src-tauri/crates/ - 12 Micro-Crates)"]
        Agent["src-tauri/crates/agent (6-Agent 协同引擎)"]
        Pipeline["src-tauri/crates/detect + script + voice + subtitle + compose + export"]
        Core["src-tauri/crates/core (统一领域实体 domain.rs 与 DI 容器)"]
        Infra["src-tauri/crates/storage + crates/plugin + crates/update"]
    end

    Routes --> Contract
    Contract --> Host
    Host --> Engine
```

---

## 2. 四大核心分层职责

### 1. 前端交互与视觉渲染层 (`src/` & `packages/ui`)
- **技术栈**：React 19、TypeScript 5.8、TanStack Router/Query、TailwindCSS 4。
- **职责**：
  - 承载专业电影级调色台 UI 交互与深色/金色视觉系统。
  - 驱动 5 轨毫秒级多媒体时间轴虚拟化渲染。
  - 通过 Zustand 分片管理项目、设置、素材与更新状态。

### 2. 强类型契约层 (`packages/ipc`)
- **职责**：
  - 充当前后端之间的坚固防火墙，通过 `scripts/gen-ipc.mjs` 静态反射 Rust 结构体与枚举，自动生成 100% 对应的 TypeScript 类型定义 (`types.gen.ts`)。
  - 严禁前端使用任意 `any` 或弱类型调用后端。

### 3. Tauri 2.0 宿主中枢层 (`src-tauri`)
- **职责**：
  - 承载桌面应用生命周期管理、系统原生托盘、窗口震动 (Vibrancy) 特效与原生菜单。
  - 解析来自前端的 44 个 Tauri Command 并注入 `AppContext` 依赖容器，分发至底层的 Rust 领域服务。

### 4. Rust 原生领域微模块集群 (`crates/`)
- **职责**：
  - 12 个完全独立的 Cargo Workspace Crate，各自拥有清晰的边界与单一职责。
  - 涵盖音视频硬件探针、VAD 断句、场景突变检测、LLM 多模态调度与剪映草稿二进制封装。
  - 核心领域模型统一收敛至 `crates/core/src/domain.rs`，消除循环依赖与重复定义。
