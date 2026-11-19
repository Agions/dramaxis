/**
 * dramaxis v1.1.0 · Tauri Invoke 统一封装
 *
 * 设计:
 * - 唯一对 @tauri-apps/api 的强依赖点 (其它文件 import '@/ipc/client' 即可)
 * - 编译期类型保障: callIpc<C>('cmd', args) 时 args / result 自动强类型
 * - 错误统一: 异常 JSON 反序列化为 DramaxisError
 */

import { invoke } from "@tauri-apps/api/core";
import { asDramaxisError, DramaxisClientError } from "./errors";
import type {
  CommandArgs,
  CommandResultOf,
  IpcCommand,
} from "./types.gen";

/** 强类型 callIpc,穿透到 Rust 端 command */
export async function callIpc<C extends IpcCommand>(
  command: C,
  ...args: CommandArgs<C> extends void ? [] : [args: CommandArgs<C>]
): Promise<CommandResultOf<C>> {
  const payload = args[0] ?? (undefined as unknown);
  try {
    return await invoke<CommandResultOf<C>>(
      command,
      payload as Record<string, unknown>,
    );
  } catch (err) {
    const dramaxisErr = asDramaxisError(err);
    throw new DramaxisClientError(dramaxisErr);
  }
}
