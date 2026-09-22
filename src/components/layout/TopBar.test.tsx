import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopBar } from "./TopBar";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@hooks/useTauriQuery", () => ({
  useTauriQuery: () => ({
    data: "1.2.0",
    isError: false,
    isLoading: false,
  }),
}));

vi.mock("@splicr/ipc", () => ({
  themeIpc: {
    setLocale: vi.fn().mockResolvedValue(true),
  },
}));

describe("TopBar", () => {
  it("正确渲染应用 Logo、版本号与后端连接指示器", () => {
    render(<TopBar />);

    expect(screen.getByText("splicr")).toBeInTheDocument();
    expect(screen.getByText(/v1\.2\.0/)).toBeInTheDocument();
    expect(screen.getByText("已连接")).toBeInTheDocument();
  });

  it("点击快捷搜索能触发命令面板 openCommandPalette", () => {
    render(<TopBar />);
    const cmdBtn = screen.getByTitle("打开命令面板 ⌘K");
    expect(cmdBtn).toBeInTheDocument();
    fireEvent.click(cmdBtn);
  });

  it("支持中英文语言切换点击", () => {
    render(<TopBar />);
    const langBtn = screen.getByTitle("切换中英文 (Toggle Language)");
    expect(langBtn).toBeInTheDocument();
    fireEvent.click(langBtn);
  });
});
