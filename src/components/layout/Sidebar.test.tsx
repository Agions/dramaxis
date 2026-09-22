import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "./Sidebar";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useRouterState: () => ({
    location: { pathname: "/production" },
  }),
}));

describe("Sidebar", () => {
  it("正确渲染主功能导航与底部导航项", () => {
    render(<Sidebar currentPath="/production" />);

    expect(screen.getByText("工作台")).toBeInTheDocument();
    expect(screen.getByText("Agent 创作")).toBeInTheDocument();
    expect(screen.getByText("资产库")).toBeInTheDocument();
    expect(screen.getByText("设置")).toBeInTheDocument();
    expect(screen.getByText("帮助")).toBeInTheDocument();
  });

  it("点击导航项触发路由跳转", () => {
    render(<Sidebar currentPath="/production" />);

    const homeBtn = screen.getByText("工作台");
    fireEvent.click(homeBtn);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });

    const settingsBtn = screen.getByText("设置");
    fireEvent.click(settingsBtn);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });
});
