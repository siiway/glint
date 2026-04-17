import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

const guideSidebar = (prefix = "") => [
  {
    text: "Introduction",
    items: [
      { text: "Getting Started", link: `${prefix}/guide/getting-started` },
      { text: "Configuration", link: `${prefix}/guide/configuration` },
    ],
  },
  {
    text: "Features",
    items: [
      { text: "Teams & Roles", link: `${prefix}/guide/teams` },
      { text: "Todo Sets", link: `${prefix}/guide/sets` },
      { text: "Todos", link: `${prefix}/guide/todos` },
      { text: "Permissions", link: `${prefix}/guide/permissions` },
      { text: "Realtime Sync", link: `${prefix}/guide/realtime` },
    ],
  },
  {
    text: "Integration",
    items: [
      { text: "Cross-App Integration", link: `${prefix}/guide/cross-app` },
    ],
  },
];

const apiSidebar = (prefix = "") => [
  {
    text: "API Reference",
    items: [
      { text: "Overview", link: `${prefix}/api/` },
      { text: "Authentication", link: `${prefix}/api/auth` },
      { text: "App Config", link: `${prefix}/api/config` },
      { text: "Settings", link: `${prefix}/api/settings` },
      { text: "Permissions", link: `${prefix}/api/permissions` },
      { text: "Todo Sets", link: `${prefix}/api/sets` },
      { text: "Todos", link: `${prefix}/api/todos` },
      { text: "Comments", link: `${prefix}/api/comments` },
      { text: "Cross-App", link: `${prefix}/api/cross-app` },
    ],
  },
];

const zhGuideSidebar = [
  {
    text: "介绍",
    items: [
      { text: "快速开始", link: "/zh/guide/getting-started" },
      { text: "配置", link: "/zh/guide/configuration" },
    ],
  },
  {
    text: "功能",
    items: [
      { text: "团队与角色", link: "/zh/guide/teams" },
      { text: "待办分组", link: "/zh/guide/sets" },
      { text: "待办事项", link: "/zh/guide/todos" },
      { text: "权限", link: "/zh/guide/permissions" },
      { text: "实时同步", link: "/zh/guide/realtime" },
    ],
  },
  {
    text: "集成",
    items: [
      { text: "跨应用集成", link: "/zh/guide/cross-app" },
    ],
  },
];

const zhApiSidebar = [
  {
    text: "API 参考",
    items: [
      { text: "概述", link: "/zh/api/" },
      { text: "认证", link: "/zh/api/auth" },
      { text: "应用配置", link: "/zh/api/config" },
      { text: "设置", link: "/zh/api/settings" },
      { text: "权限", link: "/zh/api/permissions" },
      { text: "待办分组", link: "/zh/api/sets" },
      { text: "待办事项", link: "/zh/api/todos" },
      { text: "评论", link: "/zh/api/comments" },
      { text: "跨应用", link: "/zh/api/cross-app" },
    ],
  },
];

export default withMermaid(defineConfig({
  title: "Glint",
  description: "A team-based todo list powered by Cloudflare Workers and Prism",
  head: [
    ["link", { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }],
  ],
  locales: {
    root: {
      label: "English",
      lang: "en",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/guide/getting-started" },
          { text: "API", link: "/api/" },
        ],
        sidebar: {
          "/guide/": guideSidebar(),
          "/api/": apiSidebar(),
        },
      },
    },
    zh: {
      label: "\u4E2D\u6587",
      lang: "zh-CN",
      title: "Glint",
      description: "\u57FA\u4E8E Cloudflare Workers \u548C Prism \u7684\u56E2\u961F\u5F85\u529E\u4E8B\u9879\u7BA1\u7406\u5DE5\u5177",
      themeConfig: {
        nav: [
          { text: "\u6307\u5357", link: "/zh/guide/getting-started" },
          { text: "API", link: "/zh/api/" },
        ],
        sidebar: {
          "/zh/guide/": zhGuideSidebar,
          "/zh/api/": zhApiSidebar,
        },
      },
    },
  },
  themeConfig: {
    logo: "/favicon.svg",
    socialLinks: [{ icon: "github", link: "https://github.com/siiway/glint" }],
  },
  mermaid: {},
}));
