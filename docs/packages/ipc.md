# @splicr/ipc · 强类型契约与命令分发

`@splicr/ipc` 位于 `packages/ipc`，负责管理前端调用 Tauri 后端的所有类型契约与门面封装。

---

## 1. 核心导出与结构

```text
packages/ipc/
├── src/
│   ├── client.ts         # 底层 invoke 封装与全局统一错误处理
│   ├── commands.ts       # 领域命令门面 (projectIpc, updateIpc, agentIpc 等)
│   ├── events.ts         # Tauri Event 监听辅助封装
│   ├── types.gen.ts      # scripts/gen-ipc.mjs 自动生成的单源类型定义
│   └── index.ts          # 统一主入口导出
```

---

## 2. 使用示例

```typescript
import { updateIpc } from "@splicr/ipc";

// 强类型调用，入参与出参均享有完整的 TypeScript 自动补全
const info = await updateIpc.check();
console.log(`发现最新版本: v${info.version}, 是否强制升级: ${info.isForce}`);
```
