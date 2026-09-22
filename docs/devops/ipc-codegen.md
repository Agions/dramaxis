# IPC 代码自动化生成机制 (gen-ipc)

`splicr` 采用自动化代码生成机制，确保 Rust 后端与 TypeScript 前端的类型定义 100% 同步，杜绝人工维护类型带来的遗漏与漂移。

---

## 1. 工作原理

```mermaid
graph LR
    RustCommands["src-tauri/src/commands/*.rs\ncrates/*/src/*.rs"] --> Script["scripts/gen-ipc.mjs"]
    Script --> AST["AST 正则与语法静态扫描"]
    AST --> GenTS["src/ipc/types.gen.ts\npackages/ipc/src/types.gen.ts"]
    GenTS --> CompileCheck["TypeScript tsc --noEmit 编译校验"]
```

1. **扫描 Rust 源码**：分析 `#[tauri::command]` 宏修饰的函数签名，以及带有 `#[derive(Serialize, Deserialize)]` 的 Struct 与 Enum。
2. **提取映射关系**：自动将 Rust 原生类型（`String`, `u64`, `f64`, `Option<T>`, `Vec<T>`, `Result<T, E>`）映射为 TypeScript 原生类型（`string`, `number`, `T | null`, `T[]`）。
3. **双向产物写入**：同时更新 `src/ipc/types.gen.ts` 与 `packages/ipc/src/types.gen.ts`。

---

## 2. 常用命令

```bash
# 重新生成 IPC 类型
pnpm gen:ipc

# CI/CD 中校验类型是否处于最新状态 (若有未提交的生成代码则报错)
pnpm gen:ipc:check
```
