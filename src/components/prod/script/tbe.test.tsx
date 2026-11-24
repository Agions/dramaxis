import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TextBasedEditor, type TbeSegment } from "./tbe";

describe("TextBasedEditor (P1-2 以文剪片双向联动)", () => {
  const initial: TbeSegment[] = [
    {
      id: "seg-1",
      kind: "narration",
      text: "注意看，这个男人刚刚被扫地出门。",
      startSeconds: 0,
      endSeconds: 3.5,
    },
    {
      id: "seg-2",
      kind: "original_clip",
      text: "三十年河东，三十年河西！",
      sourceInSec: 12.0,
      sourceOutSec: 15.0,
    },
  ];

  it("渲染旁白与原声金句卡片，并支持插入原声金句与波纹删除", () => {
    const onChange = vi.fn();
    const onRippleDelete = vi.fn();

    render(
      <TextBasedEditor
        segments={initial}
        onChange={onChange}
        onRippleDelete={onRippleDelete}
      />,
    );

    expect(screen.getByText("解说旁白")).toBeTruthy();
    expect(screen.getByText("原声金句")).toBeTruthy();

    // 插入原声金句
    fireEvent.click(screen.getByText("+ 原声金句"));
    expect(onChange).toHaveBeenCalledTimes(1);
    const afterInsert = onChange.mock.calls[0]?.[0] as TbeSegment[];
    expect(afterInsert).toHaveLength(3);
    expect(afterInsert[2]?.kind).toBe("original_clip");

    // 波纹删除第一段
    const deleteButtons = screen.getAllByLabelText("波纹删除段落");
    if (deleteButtons[0]) {
      fireEvent.click(deleteButtons[0]);
    }
    expect(onRippleDelete).toHaveBeenCalledWith("seg-1");
  });

  it("支持上下重排段落以联动时间轴顺序", () => {
    const onChange = vi.fn();
    render(<TextBasedEditor segments={initial} onChange={onChange} />);

    const moveDownButtons = screen.getAllByLabelText("下移段落");
    if (moveDownButtons[0]) {
      fireEvent.click(moveDownButtons[0]);
    }

    const reordered = onChange.mock.calls[0]?.[0] as TbeSegment[];
    expect(reordered[0]?.id).toBe("seg-2");
    expect(reordered[1]?.id).toBe("seg-1");
  });
});
