#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Splicr v1.0.1 · 工业级多智能体影视解说创作桌面引擎
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

# 注册系统高清中文字体
REGULAR_FONT_PATH = "/System/Library/Fonts/STHeiti Light.ttc"
BOLD_FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"

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
        self.drawString(18 * mm, 282 * mm, "Splicr 影视解说创作引擎 · 用户使用手册 (v1.0.1)")
        self.setStrokeColor(COLOR_BORDER)
        self.setLineWidth(0.5)
        self.line(18 * mm, 280 * mm, 192 * mm, 280 * mm)
        
        # 绘制底部页脚与页码
        self.line(18 * mm, 16 * mm, 192 * mm, 16 * mm)
        self.drawRightString(192 * mm, 11 * mm, f"第 {self._pageNumber} 页 / 共 {page_count} 页")
        self.drawString(18 * mm, 11 * mm, "© 2026 Splicr Architecture Team · 保密与知识产权保护")
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
    
    # 自定义段落排版样式
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
        fontSize=30,
        leading=38,
        textColor=colors.HexColor("#0D0D0F"),
    )
    style_cover_subtitle = ParagraphStyle(
        "CoverSubtitle",
        fontName="ChineseRegular",
        fontSize=13,
        leading=20,
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
        fontSize=16,
        leading=22,
        textColor=COLOR_PRIMARY_DARK,
        spaceBefore=14,
        spaceAfter=10,
        keepWithNext=True,
    )
    style_h2 = ParagraphStyle(
        "SectionH2",
        fontName="ChineseBold",
        fontSize=12,
        leading=18,
        textColor=COLOR_GOLD,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True,
    )
    style_h3 = ParagraphStyle(
        "SectionH3",
        fontName="ChineseBold",
        fontSize=10.5,
        leading=16,
        textColor=COLOR_TEXT_MAIN,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    )
    style_body = ParagraphStyle(
        "Body",
        fontName="ChineseRegular",
        fontSize=9.5,
        leading=15,
        textColor=COLOR_TEXT_MAIN,
        spaceAfter=6,
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
    
    # 顶部品牌标识
    brand_table = Table(
        [[
            Paragraph("<b>SPLICR</b>", style_cover_brand),
            Paragraph("<b>多智能体影视解说工业级桌面引擎</b>", style_cover_meta)
        ]],
        colWidths=[50 * mm, 120 * mm]
    )
    brand_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(brand_table)
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=2, color=COLOR_GOLD, spaceAfter=25 * mm))

    # 封面主标题区
    story.append(Paragraph("OFFICIAL MANUAL · v1.0.1", style_cover_badge))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph("用户使用手册与<br/>多智能体创作实操指南", style_cover_title))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        "针对长视频切片、AI 多角色编剧、48kHz 高清语音合成、多轨时间轴吸附及剪映草稿一键互通的完整工作流指南。",
        style_cover_subtitle
    ))
    
    story.append(Spacer(1, 50 * mm))

    # 封面底部信息
    meta_data = [
        [Paragraph("<b>适用平台：</b>", style_cover_meta), Paragraph("macOS (Apple Silicon & Intel) / Windows 10/11 / Linux", style_cover_meta)],
        [Paragraph("<b>底层技术：</b>", style_cover_meta), Paragraph("Tauri 2.0 · Rust Native 核心 · React 19 · FFmpeg 硬件加速", style_cover_meta)],
        [Paragraph("<b>官方发行：</b>", style_cover_meta), Paragraph("Splicr Architecture Engineering Team", style_cover_meta)],
        [Paragraph("<b>更新日期：</b>", style_cover_meta), Paragraph("2026 年 9 月 (v1.0.1 正式发布版)", style_cover_meta)],
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
    # 第二页：系统概述与前置依赖环境
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("1. 系统概述与运行环境配置", style_h1))
    story.append(Paragraph(
        "<b>Splicr</b> 是一套专为影视解说、短视频二创与纪录片解说量身打造的<b>桌面级工业化创作引擎</b>。"
        "不同于传统繁重的非线性编辑软件，Splicr 引入了<b>多智能体自主流水线范式</b>：编剧分析师（Screenwriter）、"
        "声音导演（Voice Director）、调色质检员（Colorist）全链路协同，自动化完成影视原片探测、场景切点识别、剧情文案撰写、"
        "超拟真配音生成及剪映（CapCut）草稿工程一键打通。",
        style_body
    ))

    # 呼出框卡片
    callout_data = [[
        Paragraph("<b>设计原则：本地第一 (Local-First) 与创作者协同 (HITL)</b><br/>"
                  "Splicr 坚持纯本地数据安全性，所有视频切片与音频缓存均保留在用户本地机器；在智能体执行流程中，"
                  "提供断点暂停机制（Human-in-the-Loop），创作者可随时介入调整文案词句与切片节点，告别失控的黑盒全自动。",
                  style_callout_text)
    ]]
    callout_table = Table(callout_data, colWidths=[174 * mm])
    callout_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_GOLD_LIGHT),
        ("BOX", (0, 0), (-1, -1), 1, COLOR_GOLD),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(callout_table)
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("1.1 操作系统与硬件配置要求", style_h2))
    os_table_data = [
        [Paragraph("操作系统", style_table_header), Paragraph("最低配置要求", style_table_header), Paragraph("推荐硬件环境", style_table_header)],
        [Paragraph("<b>macOS</b>", style_table_cell), Paragraph("macOS 12.0 (Monterey)+", style_table_cell), Paragraph("Apple Silicon M1/M2/M3/M4 (原生 VideoToolbox 加速)", style_table_cell)],
        [Paragraph("<b>Windows</b>", style_table_cell), Paragraph("Windows 10/11 64位操作系统", style_table_cell), Paragraph("Intel 8代+ / AMD Ryzen (支持 NVENC / QSV 编解码)", style_table_cell)],
        [Paragraph("<b>Linux</b>", style_table_cell), Paragraph("Ubuntu 22.04 LTS / Debian 12+", style_table_cell), Paragraph("具备 VA-API 硬件加速支持的图形显示环境", style_table_cell)],
    ]
    t_os = Table(os_table_data, colWidths=[30 * mm, 50 * mm, 94 * mm])
    t_os.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_os)
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("1.2 必备核心前置依赖：FFmpeg 5.0+", style_h2))
    story.append(Paragraph(
        "Splicr 的音视频流探测（FfmpegProbe）、智能场景镜头切片识别与多轨合流高度依赖系统中预装的 <code>ffmpeg</code>。"
        "初次使用前请确保在系统中安装：",
        style_body
    ))
    
    cmd_data = [[
        Paragraph("<b>macOS (Homebrew 安装):</b><br/>"
                  "<code>brew install ffmpeg</code><br/><br/>"
                  "<b>Windows (WinGet 一键安装):</b><br/>"
                  "<code>winget install Gyan.FFmpeg</code><br/><br/>"
                  "<b>验证安装:</b> 打开终端或 PowerShell 执行 <code>ffmpeg -version</code>，输出版本信息即为就绪。",
                  style_code)
    ]]
    t_cmd = Table(cmd_data, colWidths=[174 * mm])
    t_cmd.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F9FAFB")),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(t_cmd)
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────
    # 第三页：核心五步上手流程
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("2. 五分钟快速创作全流程实操", style_h1))
    story.append(Paragraph("跟随以下标准化步骤，即可迅速将一部影视原片转变为对齐完成的精美短视频解说草稿：", style_body))

    workflow_data = [
        [
            Paragraph("<b>步骤</b>", style_table_header),
            Paragraph("<b>操作环节</b>", style_table_header),
            Paragraph("<b>关键动作与系统底层逻辑</b>", style_table_header)
        ],
        [
            Paragraph("<b>01</b>", style_table_header),
            Paragraph("<b>新建项目 & 批量导入素材</b>", style_table_cell),
            Paragraph("点击「批量导入素材」或按 <code>Cmd+N</code>，拖入 <code>.mp4 / .mov / .mkv</code> 影视原片。系统自动调用 FfmpegProbe 探测分辨率、时长与帧率。", style_table_cell)
        ],
        [
            Paragraph("<b>02</b>", style_table_header),
            Paragraph("<b>触发 AI 智能场景切片</b>", style_table_cell),
            Paragraph("在素材库选择原片，点击「智能切片」。Rust 原生引擎执行帧差分析算法，自动标定高能画面切点，并按时间戳排序展示镜头总览。", style_table_cell)
        ],
        [
            Paragraph("<b>03</b>", style_table_header),
            Paragraph("<b>智能编剧撰写解说词</b>", style_table_cell),
            Paragraph("进入「生产工作台」，在右侧面板设定解说基调（如反转悬疑、搞笑吐槽）。LLM 根据镜头节奏自动生成按秒对齐的解说文案分段（seg_00, seg_01）。", style_table_cell)
        ],
        [
            Paragraph("<b>04</b>", style_table_header),
            Paragraph("<b>配音工作室试听与合成</b>", style_table_cell),
            Paragraph("选择 Edge-TTS 免费声线或 MiniMax 48kHz 影院级超拟真人声，点击「生成整轨配音」。音频流在本地自动切段并精准吸附至对应分镜画面。", style_table_cell)
        ],
        [
            Paragraph("<b>05</b>", style_table_header),
            Paragraph("<b>一键导出剪映专业草稿</b>", style_table_cell),
            Paragraph("点击工作台右上角「导出剪映草稿」。引擎在剪映草稿箱直接生成 draft_content.json，打开电脑上的剪映即可无缝微调花字与特效！", style_table_cell)
        ],
    ]
    t_flow = Table(workflow_data, colWidths=[14 * mm, 45 * mm, 115 * mm])
    t_flow.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
    ]))
    story.append(t_flow)
    story.append(Spacer(1, 5 * mm))

    story.append(Paragraph("2.1 多轨道时间轴交互指南 (MultiTrack Timeline)", style_h2))
    story.append(Paragraph(
        "Splicr 的生产工作台配备了自研的虚拟多轨道时间轴：<br/>"
        "• <b>视频画面轨 (Video Track)</b>：直观展示镜头切片缩略图、分镜切点标签与各镜头时长；<br/>"
        "• <b>音频解说轨 (Narration Track)</b>：展现 48 频段 FFT 真实音频频谱微波，支持逐句对齐试听；<br/>"
        "• <b>智能字幕轨 (Subtitle Track)</b>：内置 <code>splicr-subtitle</code> 单一真相源核心，支持精确到厘秒的卡拉OK逐字高亮渲染。",
        style_body
    ))
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────
    # 第四页：模型配置与高级技巧
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("3. AI 模型配置与高级功能指引", style_h1))
    story.append(Paragraph("进入应用左侧导航栏的「设置中心」➔「模型与密钥」完成参数配置：", style_body))

    story.append(Paragraph("3.1 主流大语言模型 (LLM Providers) 推荐配置", style_h2))
    llm_data = [
        [Paragraph("服务提供商", style_table_header), Paragraph("推荐模型标识 (Model)", style_table_header), Paragraph("特点与适用解说场景", style_table_header)],
        [Paragraph("<b>DeepSeek</b>", style_table_cell), Paragraph("<code>deepseek-chat</code>", style_table_cell), Paragraph("国内免代理直连，逻辑严密，极其擅长悬疑、剧情反转与网感热梗", style_table_cell)],
        [Paragraph("<b>OpenAI</b>", style_table_cell), Paragraph("<code>gpt-4o / gpt-4o-mini</code>", style_table_cell), Paragraph("文学修辞造诣高，外语译配与复杂好莱坞电影脉络整理极强", style_table_cell)],
        [Paragraph("<b>通义千问</b>", style_table_cell), Paragraph("<code>qwen-plus / qwen-max</code>", style_table_cell), Paragraph("中文成语俗语地道，古装、武侠、历史题材解说首选", style_table_cell)],
        [Paragraph("<b>私有化部署</b>", style_table_cell), Paragraph("<code>Ollama / vLLM 自定义</code>", style_table_cell), Paragraph("完全离线运行，配置自定义 Base URL 即可实现内网零泄密出片", style_table_cell)],
    ]
    t_llm = Table(llm_data, colWidths=[30 * mm, 45 * mm, 99 * mm])
    t_llm.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_llm)
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("3.2 语音合成引擎 (TTS Engines)", style_h2))
    story.append(Paragraph(
        "• <b>Edge-TTS</b>：微软官方原生语音库，开箱即用，无需填写任何 API Key，全免费商用（推荐声线：<code>zh-CN-YunxiNeural</code>）。<br/>"
        "• <b>MiniMax (Mimo)</b>：国内头部超拟真音频大模型，支持 48kHz 院线级高清音质与情感换气声（模型：<code>speech-02-hd</code>，声线：<code>male-qn-qingse</code>）。<br/>"
        "• <b>GPT-SoVITS</b>：支持导入创作者本人的 5 秒音频样本进行声音克隆，实现独一无二的个人 IP 专属音色。",
        style_body
    ))
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("3.3 剪映草稿互通规范 (CapCut Draft Interop)", style_h2))
    info_data = [[
        Paragraph("<b>剪映专业版草稿原生落盘路径：</b><br/>"
                  "• <b>macOS:</b> <code>~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft/</code><br/>"
                  "• <b>Windows:</b> <code>C:\\Users\\&lt;用户名&gt;\\AppData\\Local\\JianyingPro\\User Data\\Projects\\com.lveditor.draft\\</code><br/>"
                  "Splicr 导出的草稿严格遵守剪映 <code>draft_content.json</code> 协议，原视频切片软链接入轨，解说音频独立成轨，字幕轨道智能断句完成。创作者可直接在剪映内套用各类爆款花字模板！",
                  style_callout_text)
    ]]
    t_info = Table(info_data, colWidths=[174 * mm])
    t_info.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_BLUE_BG),
        ("BOX", (0, 0), (-1, -1), 1, COLOR_BLUE_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(t_info)
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────
    # 第五页：全局快捷键字典与常见问题排查 (FAQ)
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("4. 全局生产力快捷键与故障排查 (FAQ)", style_h1))

    story.append(Paragraph("4.1 高频键盘快捷键字典", style_h2))
    shortcut_data = [
        [Paragraph("快捷键 (macOS / Win)", style_table_header), Paragraph("功能定义", style_table_header), Paragraph("说明与使用技巧", style_table_header)],
        [Paragraph("<code>Space</code> (空格键)", style_table_cell), Paragraph("播放 / 暂停监视器", style_table_cell), Paragraph("即时启停音视频回放", style_table_cell)],
        [Paragraph("<code>Cmd+K / Ctrl+K</code>", style_table_cell), Paragraph("呼出全局命令面板", style_table_cell), Paragraph("支持模糊搜索工程、切换页面与触发动作", style_table_cell)],
        [Paragraph("<code>Cmd+N / Ctrl+N</code>", style_table_cell), Paragraph("新建创作项目", style_table_cell), Paragraph("弹出项目创建向导", style_table_cell)],
        [Paragraph("<code>Cmd+R / Ctrl+R</code>", style_table_cell), Paragraph("直达生产工作台", style_table_cell), Paragraph("快速跳转进入流水线排练与制作界面", style_table_cell)],
        [Paragraph("<code>Cmd+E / Ctrl+E</code>", style_table_cell), Paragraph("导出工程面板", style_table_cell), Paragraph("呼出 CapCut 草稿导出与自定义封装窗口", style_table_cell)],
        [Paragraph("<code>Cmd+, / Ctrl+,</code>", style_table_cell), Paragraph("打开系统设置中心", style_table_cell), Paragraph("修改外观主题、语言、API Key 与声线", style_table_cell)],
        [Paragraph("<code>Cmd+/ / Ctrl+/</code>", style_table_cell), Paragraph("打开帮助文档中心", style_table_cell), Paragraph("查阅本地知识库话题与故障诊断指导", style_table_cell)],
    ]
    t_sc = Table(shortcut_data, colWidths=[36 * mm, 44 * mm, 94 * mm])
    t_sc.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_sc)
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("4.2 常见问题速查解答 (FAQ)", style_h2))
    
    faq_items = [
        ("Q1: 导入素材后点击「智能切片」无反应或报错？",
         "请确认系统终端输入 ffmpeg -version 能正确显示版本号。安装或配置环境变量后，必须完全退出 Splicr 客户端并重新启动，以确保系统环境变量被正确继承。"),
        ("Q2: 编剧智能体生成文案时提示网络错误或 Key 无效？",
         "请进入「设置中心」检查 API Key 前后是否有无意复制的空格；若使用海外模型且位于国内网络环境，请在 Base URL 中填写对应的反代地址，或换用国内直连的 DeepSeek / 通义千问。"),
        ("Q3: 剪映专业版打开导出的草稿提示「部分素材已丢失」？",
         "Splicr 为保障毫秒级导出速度并防止占用双倍硬盘空间，采用文件绝对路径软链接。导出剪映工程后，请勿移动、重命名或删除原视频文件。"),
        ("Q4: 调色台外观暗色与亮色模式如何切换？",
         "点击顶部导航栏右上角的太阳/月亮图标，或按 Cmd+K 输入「切换主题」，可在电影调光室黑金模式与珍珠暖白模式间无缝切换，同时支持跟随操作系统外观联动。"),
    ]

    for q, a in faq_items:
        story.append(Paragraph(f"<b>{q}</b>", style_h3))
        story.append(Paragraph(a, style_body))

    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=COLOR_BORDER, spaceAfter=4 * mm))
    story.append(Paragraph(
        "Splicr v1.0.1 工业级多智能体影视解说引擎 · 版权所有 © 2026 Agions · 祝您创作顺利！",
        ParagraphStyle("FooterNote", fontName="ChineseRegular", fontSize=8, leading=12, textColor=COLOR_TEXT_MUTED, alignment=1)
    ))

    # 生成 PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[PDF-GENERATOR] OK: 已成功构建专业手册 -> {output_path}")

if __name__ == "__main__":
    out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "resources/docs/Splicr_用户使用手册.pdf")
    build_manual_pdf(out)
