#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dramaxis (剧枢) v1.1.0 · 电影级多智能体影视叙事与智能解说创作平台
官方用户使用手册 (PDF Generator using ReportLab)
"""

import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# 注册系统高清中文字体 (macOS 或通用降级)
REGULAR_FONT_PATH = "/System/Library/Fonts/STHeiti Light.ttc"
BOLD_FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"

if not os.path.exists(REGULAR_FONT_PATH):
    REGULAR_FONT_PATH = "/System/Library/Fonts/PingFang.ttc"
if not os.path.exists(BOLD_FONT_PATH):
    BOLD_FONT_PATH = "/System/Library/Fonts/PingFang.ttc"

pdfmetrics.registerFont(TTFont("ChineseRegular", REGULAR_FONT_PATH, subfontIndex=0))
pdfmetrics.registerFont(TTFont("ChineseBold", BOLD_FONT_PATH, subfontIndex=0))

# 品牌设计色彩令牌 (Cinematic Darkroom & Amber Gold)
COLOR_PRIMARY_DARK = colors.HexColor("#0D0D0F")
COLOR_SURFACE = colors.HexColor("#161619")
COLOR_GOLD = colors.HexColor("#D97706")        # 琥珀金 (高对比印刷度)
COLOR_GOLD_LIGHT = colors.HexColor("#FDF8E7")  # 浅金背景
COLOR_BORDER = colors.HexColor("#E5E7EB")
COLOR_TEXT_MAIN = colors.HexColor("#1F2937")
COLOR_TEXT_MUTED = colors.HexColor("#6B7280")
COLOR_BLUE_BG = colors.HexColor("#EFF6FF")
COLOR_BLUE_BORDER = colors.HexColor("#3B82F6")

class NumberedCanvas(canvas.Canvas):
    """自定义带页眉页脚与页码的 Canvas"""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            # 封面页不绘制页眉页脚
            return
        
        self.saveState()
        self.setFont("ChineseRegular", 8)
        self.setFillColor(COLOR_TEXT_MUTED)
        
        # 绘制顶部页眉
        self.drawString(18 * mm, 282 * mm, "Dramaxis (剧枢) 多智能体影视解说平台 · 官方使用手册 (v1.1.0)")
        self.setStrokeColor(COLOR_BORDER)
        self.setLineWidth(0.5)
        self.line(18 * mm, 280 * mm, 192 * mm, 280 * mm)
        
        # 绘制底部页脚与页码
        self.line(18 * mm, 16 * mm, 192 * mm, 16 * mm)
        self.drawRightString(192 * mm, 11 * mm, f"第 {self._pageNumber} 页 / 共 {page_count} 页")
        self.drawString(18 * mm, 11 * mm, "© 2026 Agions Dramaxis Architecture Team · 保密与知识产权保护")
        self.restoreState()


def build_manual_pdf(output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=22 * mm,
        bottomMargin=22 * mm,
    )
    
    styles = getSampleStyleSheet()
    
    style_cover_brand = ParagraphStyle(
        "CoverBrand",
        fontName="ChineseBold",
        fontSize=18,
        leading=24,
        textColor=colors.HexColor("#F5C842"),
    )
    style_cover_badge = ParagraphStyle(
        "CoverBadge",
        fontName="ChineseBold",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#D97706"),
    )
    style_cover_title = ParagraphStyle(
        "CoverTitle",
        fontName="ChineseBold",
        fontSize=28,
        leading=36,
        textColor=colors.HexColor("#0D0D0F"),
    )
    style_cover_subtitle = ParagraphStyle(
        "CoverSubtitle",
        fontName="ChineseRegular",
        fontSize=12,
        leading=18,
        textColor=colors.HexColor("#4B5563"),
    )
    style_cover_meta = ParagraphStyle(
        "CoverMeta",
        fontName="ChineseRegular",
        fontSize=9,
        leading=15,
        textColor=colors.HexColor("#6B7280"),
    )
    
    style_h1 = ParagraphStyle(
        "SectionH1",
        fontName="ChineseBold",
        fontSize=15,
        leading=21,
        textColor=COLOR_PRIMARY_DARK,
        spaceBefore=14,
        spaceAfter=10,
        keepWithNext=True,
    )
    style_h2 = ParagraphStyle(
        "SectionH2",
        fontName="ChineseBold",
        fontSize=11.5,
        leading=17,
        textColor=COLOR_GOLD,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True,
    )
    style_h3 = ParagraphStyle(
        "SectionH3",
        fontName="ChineseBold",
        fontSize=10,
        leading=15,
        textColor=COLOR_TEXT_MAIN,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    )
    style_body = ParagraphStyle(
        "Body",
        fontName="ChineseRegular",
        fontSize=9,
        leading=14.5,
        textColor=COLOR_TEXT_MAIN,
        spaceAfter=5,
    )
    style_callout_title = ParagraphStyle(
        "CalloutTitle",
        fontName="ChineseBold",
        fontSize=9.5,
        leading=14,
        textColor=COLOR_GOLD,
    )
    style_callout_text = ParagraphStyle(
        "CalloutText",
        fontName="ChineseRegular",
        fontSize=8.5,
        leading=13.5,
        textColor=COLOR_TEXT_MAIN,
    )
    style_code = ParagraphStyle(
        "CodeText",
        fontName="ChineseRegular",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1F2937"),
    )
    style_table_header = ParagraphStyle(
        "TableHeader",
        fontName="ChineseBold",
        fontSize=9,
        leading=12,
        textColor=COLOR_PRIMARY_DARK,
    )
    style_table_cell = ParagraphStyle(
        "TableCell",
        fontName="ChineseRegular",
        fontSize=8.5,
        leading=12,
        textColor=COLOR_TEXT_MAIN,
    )

    story = []

    # ─────────────────────────────────────────────────────────────
    # 封面页 (Page 1)
    # ─────────────────────────────────────────────────────────────
    story.append(Spacer(1, 20 * mm))
    
    brand_table = Table(
        [[
            Paragraph("<b>DRAMAXIS 剧枢</b>", style_cover_brand),
            Paragraph("<b>电影级多智能体影视叙事与智能解说平台</b>", style_cover_meta)
        ]],
        colWidths=[55 * mm, 115 * mm]
    )
    brand_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(brand_table)
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=2, color=COLOR_GOLD, spaceAfter=22 * mm))

    story.append(Paragraph("OFFICIAL MANUAL · v1.1.0", style_cover_badge))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph("用户使用手册与<br/>6-Agent 协同导演实操指南", style_cover_title))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        "涵盖 6-Agent 智能体导演流水线、5 轨毫秒级对齐时间轴、四道质量闸门质检、本地优先沙箱架构与剪映草稿一键互通的完整指南。",
        style_cover_subtitle
    ))
    
    story.append(Spacer(1, 45 * mm))

    meta_data = [
        [Paragraph("<b>适用平台：</b>", style_cover_meta), Paragraph("macOS (Apple Silicon & Intel) / Windows 10/11 / Linux", style_cover_meta)],
        [Paragraph("<b>底层技术：</b>", style_cover_meta), Paragraph("Tauri 2.0 · Rust Native 微服务群 · React 19 · FFmpeg 硬件加速", style_cover_meta)],
        [Paragraph("<b>架构团队：</b>", style_cover_meta), Paragraph("Dramaxis 剧枢架构工程研发团队 (Agions)", style_cover_meta)],
        [Paragraph("<b>版本信息：</b>", style_cover_meta), Paragraph("2026 年 10 月 (v1.1.0 深度融合正式版)", style_cover_meta)],
    ]
    meta_table = Table(meta_data, colWidths=[25 * mm, 145 * mm])
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(meta_table)
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────
    # 第二页：系统概述与 6-Agent 架构
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("1. 系统概述与 6-Agent 智能协同架构", style_h1))
    story.append(Paragraph(
        "<b>Dramaxis（剧枢）</b> 融合了全自动编剧叙事引擎与工业级音视频工程切片技术，打造出专为第一人称解说、深度二创与短剧剪辑量身定制的<b>桌面级工业化智能导演系统</b>。"
        "系统引入了 <b>6-Agent 自治协作导演管线</b>，实现从原始长视频到高完播率剪映工程的全链路交付。",
        style_body
    ))

    # 6-Agent 协同表格
    agent_data = [
        [Paragraph("智能体代号", style_table_header), Paragraph("角色职责", style_table_header), Paragraph("核心算法与能力", style_table_header)],
        [Paragraph("<b>DirectorAgent</b>", style_table_cell), Paragraph("🎬 总控导演", style_table_cell), Paragraph("任务拓扑拆解、全流程状态机驱动与异常熔断处理", style_table_cell)],
        [Paragraph("<b>VisualCriticAgent</b>", style_table_cell), Paragraph("👁️ 画面视觉分析师", style_table_cell), Paragraph("FFmpeg 硬件抽帧、转场切点提取与高能镜头评分", style_table_cell)],
        [Paragraph("<b>ScreenwriterAgent</b>", style_table_cell), Paragraph("✍️ 金牌编剧", style_table_cell), Paragraph("自反思完播率机制，生成 0~3s 黄金 Hook 与第一人称剧本分镜", style_table_cell)],
        [Paragraph("<b>VoiceArtistAgent</b>", style_table_cell), Paragraph("🎙️ 声乐调音师", style_table_cell), Paragraph("调度 Edge-TTS / 48kHz MiniMax / GPT-SoVITS 合成独白音频", style_table_cell)],
        [Paragraph("<b>SoundEngineerAgent</b>", style_table_cell), Paragraph("🎛️ 混音剪辑师", style_table_cell), Paragraph("装配 5 轨毫秒级时间轴，挂载 V1/A1/A2/A3/S1 并实现 -18% 自动闪避", style_table_cell)],
        [Paragraph("<b>QualityReviewerAgent</b>", style_table_cell), Paragraph("🔍 质量验收员", style_table_cell), Paragraph("执行四道质量闸门硬核验收，生成全维度质检报告", style_table_cell)],
    ]
    t_agent = Table(agent_data, colWidths=[38 * mm, 34 * mm, 102 * mm])
    t_agent.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_agent)
    story.append(Spacer(1, 4 * mm))

    callout_data = [[
        Paragraph("<b>本地优先沙箱架构 (Local-First Sandbox)</b><br/>"
                  "每个创作项目均完全隔离在 <code>~/.dramaxis/projects/&lt;工程ID&gt;/</code> 目录，下设 <code>media/</code> (素材软链)、"
                  "<code>drafts/</code> (剪映工程)、<code>cache/</code> (中间缓存) 与 <code>project.dramaxis.json</code> (工程总描述符)。"
                  "素材零拷贝不重复占用硬盘，工程数据完全离线自治，确保创作者资产极致安全。",
                  style_callout_text)
    ]]
    callout_table = Table(callout_data, colWidths=[174 * mm])
    callout_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_GOLD_LIGHT),
        ("BOX", (0, 0), (-1, -1), 1, COLOR_GOLD),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(callout_table)
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────
    # 第三页：5 轨时间轴与创作全流程
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("2. 5 轨毫秒级时间轴与五分钟创作实操", style_h1))
    story.append(Paragraph("Dramaxis 采用 5 轨毫秒级对齐模型，彻底消除视听滞后感：", style_body))

    tracks_data = [
        [Paragraph("轨道代号", style_table_header), Paragraph("轨道类型 (TrackKind)", style_table_header), Paragraph("功能定义与处理特性", style_table_header)],
        [Paragraph("<b>V1</b>", style_table_cell), Paragraph("画面切片轨 (Video)", style_table_cell), Paragraph("镜头切片缩略图、分镜切点标记与画面原片精准映射", style_table_cell)],
        [Paragraph("<b>A1</b>", style_table_cell), Paragraph("第一人称独白轨 (Voice)", style_table_cell), Paragraph("48 频段真实音频波形展示，支持逐句对齐试听与微调", style_table_cell)],
        [Paragraph("<b>A2</b>", style_table_cell), Paragraph("环境音效轨 (Ambient)", style_table_cell), Paragraph("环境拟音、氛围铺底，增强第一人称临场沉浸感", style_table_cell)],
        [Paragraph("<b>A3</b>", style_table_cell), Paragraph("智能配乐轨 (Bgm)", style_table_cell), Paragraph("根据情绪节奏自动挂载，人声独白发声时自动启用 -18% 智能闪避", style_table_cell)],
        [Paragraph("<b>S1</b>", style_table_cell), Paragraph("逐字字幕轨 (Subtitle)", style_table_cell), Paragraph("内置统一字幕引擎，支持 SRT/VTT/ASS 毫秒级卡拉OK动态高亮", style_table_cell)],
    ]
    t_tracks = Table(tracks_data, colWidths=[20 * mm, 45 * mm, 109 * mm])
    t_tracks.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_tracks)
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("2.1 标准创作五步法", style_h2))
    steps_data = [
        [Paragraph("步序", style_table_header), Paragraph("操作环节", style_table_header), Paragraph("关键动作与底层逻辑", style_table_header)],
        [Paragraph("<b>01</b>", style_table_header), Paragraph("新建项目 & 导入素材", style_table_cell), Paragraph("按 <code>Cmd+N</code> 创建工程，拖入原片。系统自动建立软链并启动 FfmpegProbe 探测元数据。", style_table_cell)],
        [Paragraph("<b>02</b>", style_table_header), Paragraph("启动 6-Agent 流水线", style_table_cell), Paragraph("按 <code>Cmd+R</code> 一键触发 6 大智能体协同，视觉分析师抽帧，编剧撰写黄金 Hook 文案。", style_table_cell)],
        [Paragraph("<b>03</b>", style_table_header), Paragraph("声乐调音与配乐挂载", style_table_cell), Paragraph("调度 Edge-TTS 或 MiniMax 合成 48kHz 独白音频，混音剪辑师完成 5 轨毫秒级对齐。", style_table_cell)],
        [Paragraph("<b>04</b>", style_table_header), Paragraph("人机断点确认 (HITL)", style_table_cell), Paragraph("在编剧与对齐断点处，创作者可在 5 轨时间轴直接拖拽微调或编辑文案台词。", style_table_cell)],
        [Paragraph("<b>05</b>", style_table_header), Paragraph("一键导出剪映草稿", style_table_cell), Paragraph("按 <code>Cmd+E</code> 导出草稿。打开剪映电脑版，在草稿箱中直接双击继续添加爆款花字与特效！", style_table_cell)],
    ]
    t_steps = Table(steps_data, colWidths=[14 * mm, 45 * mm, 115 * mm])
    t_steps.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
    ]))
    story.append(t_steps)
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────
    # 第四页：四道质量闸门与剪映互通
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("3. 四道质量闸门与剪映草稿深度互通", style_h1))
    story.append(Paragraph(
        "为确保生成成果的高完播率与专业级工业水准，Dramaxis 在交付剪辑草稿前由 <b>QualityReviewerAgent</b> 执行硬核质检：",
        style_body
    ))

    gates_data = [
        [Paragraph("质量闸门", style_table_header), Paragraph("质检指标与标准", style_table_header), Paragraph("业务价值与交付保障", style_table_header)],
        [Paragraph("<b>Gate 1: 黄金 Hook</b>", style_table_cell), Paragraph("开场 0~3 秒高能诱导评分 ≥ 80.0，首句时长 ≤ 3.8s", style_table_cell), Paragraph("锁定短视频前 3 秒黄金留存率，击穿平台完播算法", style_table_cell)],
        [Paragraph("<b>Gate 2: 音画字幕同步</b>", style_table_cell), Paragraph("VAD 语音对齐公差 ≤ 100ms (实测 42.5ms)", style_table_cell), Paragraph("杜绝声画错位与字幕延迟，达到院线级视听体验", style_table_cell)],
        [Paragraph("<b>Gate 3: 叙事呼吸节奏</b>", style_table_cell), Paragraph("切镜频率与台词语速比评分 ≥ 85.0", style_table_cell), Paragraph("张弛有度，消除单一画面停留过久的审美疲劳", style_table_cell)],
        [Paragraph("<b>Gate 4: 内容合规风控</b>", style_table_cell), Paragraph("平台违禁词、敏感内容 100% 自动过滤拦截", style_table_cell), Paragraph("规避限流与下架风险，确保全平台顺利发布分发", style_table_cell)],
    ]
    t_gates = Table(gates_data, colWidths=[36 * mm, 58 * mm, 80 * mm])
    t_gates.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_gates)
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("3.1 剪映专业版草稿原生互通 (CapCut Interop)", style_h2))
    info_data = [[
        Paragraph("<b>剪映本地草稿原生存储路径：</b><br/>"
                  "• <b>macOS:</b> <code>~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft/</code><br/>"
                  "• <b>Windows:</b> <code>%LOCALAPPDATA%\\JianyingPro\\User Data\\Projects\\com.lveditor.draft\\</code><br/>"
                  "Dramaxis 导出的草稿严格遵守剪映 <code>draft_content.json</code> 协议，原视频无损切片映射至主视频轨，"
                  "独白音频独立成轨，字幕智能断句入轨，创作者在剪映中可直接套用爆款花字模板！",
                  style_callout_text)
    ]]
    t_info = Table(info_data, colWidths=[174 * mm])
    t_info.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_BLUE_BG),
        ("BOX", (0, 0), (-1, -1), 1, COLOR_BLUE_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(t_info)
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────
    # 第五页：快捷键与 FAQ
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("4. 全局生产力快捷键与常见故障排除 (FAQ)", style_h1))

    shortcut_data = [
        [Paragraph("快捷键 (macOS / Win)", style_table_header), Paragraph("功能定义", style_table_header), Paragraph("说明与使用技巧", style_table_header)],
        [Paragraph("<code>Space</code> (空格键)", style_table_cell), Paragraph("播放 / 暂停监视器", style_table_cell), Paragraph("即时启停音视频回放与时间轴指针", style_table_cell)],
        [Paragraph("<code>Cmd+K / Ctrl+K</code>", style_table_cell), Paragraph("呼出全局命令面板", style_table_cell), Paragraph("支持模糊搜索工程、切换页面与触发管线动作", style_table_cell)],
        [Paragraph("<code>Cmd+N / Ctrl+N</code>", style_table_cell), Paragraph("新建创作项目", style_table_cell), Paragraph("在本地沙箱快速创建独立隔离工程", style_table_cell)],
        [Paragraph("<code>Cmd+R / Ctrl+R</code>", style_table_cell), Paragraph("启动 6-Agent 智能管线", style_table_cell), Paragraph("一键触发全流程多智能体协同导演流水线", style_table_cell)],
        [Paragraph("<code>Cmd+. / Ctrl+.</code>", style_table_cell), Paragraph("中断 / 暂停当前管线", style_table_cell), Paragraph("支持创作者随时介入微调 (HITL)", style_table_cell)],
        [Paragraph("<code>Cmd+S / Ctrl+S</code>", style_table_cell), Paragraph("立即保存当前工程", style_table_cell), Paragraph("更新 project.dramaxis.json 工程总表", style_table_cell)],
        [Paragraph("<code>Cmd+E / Ctrl+E</code>", style_table_cell), Paragraph("呼出导出面板", style_table_cell), Paragraph("一键生成剪映 CapCut 草稿或自定义媒体封装", style_table_cell)],
        [Paragraph("<code>Cmd+, / Ctrl+,</code>", style_table_cell), Paragraph("打开系统设置中心", style_table_cell), Paragraph("配置 LLM 密钥、TTS 引擎、音色克隆与外观", style_table_cell)],
        [Paragraph("<code>Cmd+/ / Ctrl+/</code>", style_table_cell), Paragraph("打开帮助与知识库", style_table_cell), Paragraph("查阅内置教程、参考文档与诊断排查指引", style_table_cell)],
    ]
    t_sc = Table(shortcut_data, colWidths=[36 * mm, 44 * mm, 94 * mm])
    t_sc.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_sc)
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("4.1 常见问题解答 (FAQ)", style_h2))
    faq_items = [
        ("Q1: 导入素材后点击「智能切片」无反应或提示找不到探针？",
         "请确认系统终端执行 ffmpeg -version 能正确显示版本。安装或更新环境变量后，请完全退出 Dramaxis 客户端并重新启动，使客户端继承最新系统环境变量。"),
        ("Q2: 编剧智能体生成解说文案时报错或提示 Key 无效？",
         "请进入「设置中心」核对 API Key 是否包含多余空格；国内推荐使用免代理直连的 DeepSeek (deepseek-chat) 或通义千问，海外模型请在 Base URL 中配置合规中转反代。"),
        ("Q3: 剪映打开草稿后提示「媒体素材已丢失」？",
         "Dramaxis 采用文件绝对路径软链接以节约存储并加速导出。导出工程后，请勿在操作系统中移动、重命名或删除原视频源文件。"),
    ]
    for q, a in faq_items:
        story.append(Paragraph(f"<b>{q}</b>", style_h3))
        story.append(Paragraph(a, style_body))

    story.append(Spacer(1, 5 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=COLOR_BORDER, spaceAfter=4 * mm))
    story.append(Paragraph(
        "Dramaxis (剧枢) v1.1.0 · 版权所有 © 2026 Agions · 祝您创作顺利！",
        ParagraphStyle("FooterNote", fontName="ChineseRegular", fontSize=8, leading=12, textColor=COLOR_TEXT_MUTED, alignment=1)
    ))

    # 生成 PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[PDF-GENERATOR] OK: 已成功构建专业手册 -> {output_path}")

if __name__ == "__main__":
    out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "resources/docs/Dramaxis_用户使用手册.pdf")
    build_manual_pdf(out)
