import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTauriCommand } from "./useTauriCommand";
import * as ipcModule from "@splicr/ipc";

vi.mock("@splicr/ipc", () => ({
  callIpc: vi.fn(),
}));

describe("useTauriCommand", () => {
  it("初始化状态具有默认值并在 reset 时重置", async () => {
    const { result } = renderHook(() => useTauriCommand("project_create_blank" as any));

    expect(result.current.state).toEqual({
      data: null,
      loading: false,
      error: null,
    });

    // 触发调用
    (ipcModule.callIpc as any).mockResolvedValueOnce({ id: "proj_123" });

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.state.data).toEqual({ id: "proj_123" });
    expect(result.current.state.loading).toBe(false);

    // 手动 reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.state.data).toBeNull();
  });

  it("当 callIpc 抛出异常时捕获 error", async () => {
    const { result } = renderHook(() => useTauriCommand("project_create_blank" as any));

    (ipcModule.callIpc as any).mockRejectedValueOnce(new Error("IPC failed"));

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.data).toBeNull();
    expect((result.current.state.error as Error).message).toBe("IPC failed");
  });
});
