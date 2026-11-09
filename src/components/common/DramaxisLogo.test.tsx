import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DramaxisLogo } from "./DramaxisLogo";

describe("DramaxisLogo", () => {
  it("默认渲染 Dramaxis 纯徽标形态 (mark)", () => {
    render(<DramaxisLogo size={40} />);
    const emblem = screen.getByLabelText("Dramaxis Emblem");
    expect(emblem).toBeInTheDocument();
    expect(emblem).toHaveAttribute("width", "40");
    expect(emblem).toHaveAttribute("height", "40");
  });

  it("渲染横版 Dramaxis 剧枢中英双标形态 (horizontal)", () => {
    render(<DramaxisLogo variant="horizontal" size={36} />);
    const logo = screen.getByLabelText("Dramaxis 剧枢 Logo");
    expect(logo).toBeInTheDocument();
    expect(screen.getByText("Dramaxis")).toBeInTheDocument();
    expect(screen.getByText("剧枢")).toBeInTheDocument();
  });
});
