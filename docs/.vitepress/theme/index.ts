import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import ScopeBuilder from "./ScopeBuilder.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("ScopeBuilder", ScopeBuilder);
  },
} satisfies Theme;
