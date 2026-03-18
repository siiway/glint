import { defineConfig } from "vitepress";

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
    ],
  },
];

export default defineConfig({
  title: "Glint",
  description: "A team-based todo list powered by Cloudflare Workers and Prism",
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
          "/zh/guide/": [
            {
              text: "\u4ECB\u7ECD",
              items: [
                { text: "\u5FEB\u901F\u5F00\u59CB", link: "/zh/guide/getting-started" },
                { text: "\u914D\u7F6E", link: "/zh/guide/configuration" },
              ],
            },
            {
              text: "\u529F\u80FD",
              items: [
                { text: "\u56E2\u961F\u4E0E\u89D2\u8272", link: "/zh/guide/teams" },
                { text: "\u5F85\u529E\u5206\u7EC4", link: "/zh/guide/sets" },
                { text: "\u5F85\u529E\u4E8B\u9879", link: "/zh/guide/todos" },
                { text: "\u6743\u9650", link: "/zh/guide/permissions" },
              ],
            },
          ],
          "/zh/api/": [
            {
              text: "API \u53C2\u8003",
              items: [
                { text: "\u6982\u8FF0", link: "/zh/api/" },
                { text: "\u8BA4\u8BC1", link: "/zh/api/auth" },
                { text: "\u5E94\u7528\u914D\u7F6E", link: "/zh/api/config" },
                { text: "\u8BBE\u7F6E", link: "/zh/api/settings" },
                { text: "\u6743\u9650", link: "/zh/api/permissions" },
                { text: "\u5F85\u529E\u5206\u7EC4", link: "/zh/api/sets" },
                { text: "\u5F85\u529E\u4E8B\u9879", link: "/zh/api/todos" },
                { text: "\u8BC4\u8BBA", link: "/zh/api/comments" },
              ],
            },
          ],
        },
      },
    },
  },
  themeConfig: {
    socialLinks: [{ icon: "github", link: "https://github.com/siiway/glint" }],
  },
});
