import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Dramaxis (剧枢) 官方架构与开发文档',
  description: '工业级 Rust Native + Multi-Agent 短剧 AI 叙事与视频工程自动化生产桌面引擎',
  lang: 'zh-CN',
  base: '/',
  lastUpdated: true,
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#F5C842' }],
    ['meta', { name: 'keywords', content: 'Dramaxis, 剧枢, AI视频解说, Multi-Agent, Tauri 2, Rust, FFmpeg, 剪映草稿, 多平台母带定制' }]
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Dramaxis Docs',

    nav: [
      { text: '📖 指南与实战', link: '/guide/start', activeMatch: '/guide/' },
      { text: '🏛️ 架构设计', link: '/arch/overview', activeMatch: '/arch/' },
      { text: '🦀 Rust Crates', link: '/crates/core', activeMatch: '/crates/' },
      { text: '📦 前端 Packages', link: '/packages/ipc', activeMatch: '/packages/' },
      { text: '🔌 IPC 契约字典', link: '/api/cmd', activeMatch: '/api/' },
      { text: '🛠️ DevOps 与交付', link: '/devops/dev', activeMatch: '/devops/' },
      {
        text: 'v1.2.0',
        items: [
          { text: 'Changelog 更新日志', link: 'https://github.com/Agions/dramaxis/releases' },
          { text: 'GitHub 源码仓库', link: 'https://github.com/Agions/dramaxis' },
          { text: '问题反馈 (Issues)', link: 'https://github.com/Agions/dramaxis/issues' }
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '🚀 指南与实战',
          items: [
            { text: '快速上手 (Getting Started)', link: '/guide/start' },
            { text: '6-Agent 智能体编排实战', link: '/guide/studio' },
            { text: '剪映草稿 (.draft) 导出流程', link: '/guide/capcut' },
            { text: '常见问题与避坑指南 (FAQ)', link: '/guide/faq' }
          ]
        }
      ],
      '/arch/': [
        {
          text: '🏛️ 核心架构与原理',
          items: [
            { text: '全栈洋葱模型拓扑与分层', link: '/arch/overview' },
            { text: '6-Agent 协同中枢与状态机', link: '/arch/agent' },
            { text: '核心流水线契约 (Pipeline Contract)', link: '/arch/flow' },
            { text: 'Monorepo 架构与双向隔离', link: '/arch/repo' },
            { text: '安全体系与 Keychain 凭证隔离', link: '/arch/secure' }
          ]
        }
      ],
      '/crates/': [
        {
          text: '🦀 Rust Crates 核心领域参考',
          items: [
            { text: 'dramaxis-core (统一模型/DI/错误)', link: '/crates/core' },
            { text: 'dramaxis-agent (6-Agent 智能体集群)', link: '/crates/agent' },
            { text: 'dramaxis-script (11 大 LLM 矩阵适配)', link: '/crates/script' },
            { text: 'dramaxis-voice (48kHz TTS/音色克隆)', link: '/crates/voice' },
            { text: 'dramaxis-subtitle (VAD/动态字幕)', link: '/crates/sub' },
            { text: 'dramaxis-detect (FFmpeg 突变打点)', link: '/crates/detect' },
            { text: 'dramaxis-intake (4 大生成策略分流)', link: '/crates/intake' },
            { text: 'dramaxis-compose (5 轨毫秒级磁吸)', link: '/crates/compose' },
            { text: 'dramaxis-export (剪映二进制/母带压制)', link: '/crates/export' },
            { text: 'dramaxis-storage (资产扫描与持久化)', link: '/crates/storage' },
            { text: 'dramaxis-update (断点续传/自更新)', link: '/crates/update' }
          ]
        }
      ],
      '/packages/': [
        {
          text: '📦 前端 Monorepo Packages',
          items: [
            { text: '@dramaxis/ipc (类型契约与命令分发)', link: '/packages/ipc' },
            { text: '@dramaxis/core (Zustand 状态机与派生)', link: '/packages/core' },
            { text: '@dramaxis/ui (调色台设计系统与原子组件)', link: '/packages/ui' },
            { text: '@dramaxis/utils (时间轴/格式化通用工具)', link: '/packages/utils' }
          ]
        }
      ],
      '/api/': [
        {
          text: '🔌 Tauri IPC 契约字典',
          items: [
            { text: '全量 46 个 IPC 指令字典', link: '/api/cmd' },
            { text: '实时事件监听矩阵 (Event Matrix)', link: '/api/event' }
          ]
        }
      ],
      '/devops/': [
        {
          text: '🛠️ 工程化与持续交付',
          items: [
            { text: '本地开发调试与环境准备', link: '/devops/dev' },
            { text: 'IPC 代码自动化生成机制 (gen-ipc)', link: '/devops/ipc' },
            { text: '跨平台打包构建与 Release 发布', link: '/devops/build' }
          ]
        }
      ]
    },

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档'
              },
              modal: {
                noResultsText: '无法找到相关结果',
                resetButtonTitle: '清除查询条件',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭'
                }
              }
            }
          }
        }
      }
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Agions/dramaxis' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Dramaxis Studio. Built with Rust & Tauri 2.0.'
    },

    outline: {
      level: [2, 3],
      label: '本页目录'
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },

    darkModeSwitchLabel: '主题外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '目录菜单',
    returnToTopLabel: '返回顶部'
  }
})
