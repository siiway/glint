import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Glint",
  description: "A team-based todo list powered by Cloudflare Workers and Prism",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Configuration", link: "/guide/configuration" },
          ],
        },
        {
          text: "Features",
          items: [
            { text: "Teams & Roles", link: "/guide/teams" },
            { text: "Todo Sets", link: "/guide/sets" },
            { text: "Todos", link: "/guide/todos" },
            { text: "Permissions", link: "/guide/permissions" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          items: [
            { text: "Overview", link: "/api/" },
            { text: "Authentication", link: "/api/auth" },
            { text: "App Config", link: "/api/config" },
            { text: "Settings", link: "/api/settings" },
            { text: "Permissions", link: "/api/permissions" },
            { text: "Todo Sets", link: "/api/sets" },
            { text: "Todos", link: "/api/todos" },
            { text: "Comments", link: "/api/comments" },
          ],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: "https://github.com/siiway/glint" }],
  },
});
