<script setup lang="ts">
import { computed, ref } from "vue";
import { useData } from "vitepress";

interface ScopeItem {
  key: string;
  en: string;
  zh: string;
  defaultOn?: boolean;
}

const PLATFORM_SCOPES: ScopeItem[] = [
  {
    key: "openid",
    en: "OpenID Connect identity",
    zh: "OpenID Connect 身份",
    defaultOn: true,
  },
  {
    key: "profile",
    en: "Display name and avatar",
    zh: "显示名称与头像",
    defaultOn: true,
  },
  {
    key: "email",
    en: "Email address",
    zh: "邮箱地址",
    defaultOn: false,
  },
  {
    key: "teams:read",
    en: "Team memberships (recommended — fallback for users who never logged in to Glint)",
    zh: "团队成员关系（推荐——对从未登录过 Glint 的用户兜底）",
    defaultOn: true,
  },
  {
    key: "offline_access",
    en: "Refresh token (long-lived sessions)",
    zh: "刷新令牌（长期会话）",
    defaultOn: true,
  },
];

const APP_SCOPES: ScopeItem[] = [
  {
    key: "read_todos",
    en: "Read todos and comments",
    zh: "读取待办与评论",
    defaultOn: true,
  },
  { key: "create_todos", en: "Create todos", zh: "创建待办" },
  { key: "edit_todos", en: "Edit todo titles", zh: "编辑待办标题" },
  {
    key: "complete_todos",
    en: "Toggle todo completion",
    zh: "切换完成状态",
  },
  { key: "delete_todos", en: "Delete todos", zh: "删除待办" },
  {
    key: "reorder_todos",
    en: "Reorder todos (drag-and-drop)",
    zh: "调整待办顺序（拖拽排序）",
  },
  {
    key: "claim_todos",
    en: "Claim / unclaim todos",
    zh: "认领 / 取消认领待办",
  },
  {
    key: "manage_sets",
    en: "Manage sets (create/rename/delete/reorder/configure, bulk import-export)",
    zh: "管理分组（新建/重命名/删除/排序/配置，批量导入导出）",
  },
  { key: "comment", en: "Post comments", zh: "发布评论" },
  {
    key: "delete_comments",
    en: "Delete comments",
    zh: "删除评论",
  },
  { key: "read_settings", en: "Read team settings", zh: "读取团队设置" },
  {
    key: "manage_settings",
    en: "Manage team settings",
    zh: "管理团队设置",
  },
  {
    key: "write_todos",
    en: "Legacy create/edit/complete (skip if you use the specific scopes above)",
    zh: "旧版兼容（如已选用上方细分 scope，可不勾选）",
  },
];

const { lang } = useData();
const isZh = computed(() => lang.value?.startsWith("zh"));
const label = (item: ScopeItem) => (isZh.value ? item.zh : item.en);

const t = (en: string, zh: string) => (isZh.value ? zh : en);

const clientId = ref("prism_abc123");
const platform = ref<Record<string, boolean>>(
  Object.fromEntries(PLATFORM_SCOPES.map((s) => [s.key, !!s.defaultOn])),
);
const appPerms = ref<Record<string, boolean>>(
  Object.fromEntries(APP_SCOPES.map((s) => [s.key, !!s.defaultOn])),
);

const generated = computed(() => {
  const list: string[] = [];
  for (const s of PLATFORM_SCOPES) if (platform.value[s.key]) list.push(s.key);
  const cid = clientId.value.trim() || "prism_abc123";
  for (const s of APP_SCOPES)
    if (appPerms.value[s.key]) list.push(`app:${cid}:${s.key}`);
  return JSON.stringify(list, null, 2);
});

const totalSelected = computed(
  () =>
    Object.values(platform.value).filter(Boolean).length +
    Object.values(appPerms.value).filter(Boolean).length,
);

const selectAllApp = (on: boolean) => {
  for (const s of APP_SCOPES) appPerms.value[s.key] = on;
};

const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;
const copy = async () => {
  await navigator.clipboard.writeText(generated.value);
  copied.value = true;
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => (copied.value = false), 1500);
};
</script>

<template>
  <div class="scope-builder">
    <div class="row">
      <label class="field">
        <span class="field-label">
          {{ t("Glint client ID", "Glint Client ID") }}
        </span>
        <input
          v-model="clientId"
          type="text"
          spellcheck="false"
          placeholder="prism_abc123"
          class="cid-input"
        />
        <span class="hint">
          {{
            t(
              "Found in Glint → Settings → App Config → Client ID.",
              "可在 Glint → 设置 → 应用配置 → 客户端 ID 找到。",
            )
          }}
        </span>
      </label>
    </div>

    <div class="row two-col">
      <fieldset>
        <legend>{{ t("Platform scopes", "平台 scope") }}</legend>
        <label v-for="s in PLATFORM_SCOPES" :key="s.key" class="check">
          <input type="checkbox" v-model="platform[s.key]" />
          <code>{{ s.key }}</code>
          <span class="desc">{{ label(s) }}</span>
        </label>
      </fieldset>

      <fieldset>
        <legend class="legend-row">
          {{ t("Glint cross-app scopes", "Glint 跨应用 scope") }}
          <span class="bulk">
            <button type="button" @click="selectAllApp(true)">
              {{ t("All", "全选") }}
            </button>
            <button type="button" @click="selectAllApp(false)">
              {{ t("None", "全不选") }}
            </button>
          </span>
        </legend>
        <label v-for="s in APP_SCOPES" :key="s.key" class="check">
          <input type="checkbox" v-model="appPerms[s.key]" />
          <code>{{ s.key }}</code>
          <span class="desc">{{ label(s) }}</span>
        </label>
      </fieldset>
    </div>

    <div class="output-head">
      <strong>
        {{ t("Generated allowed_scopes", "生成的 allowed_scopes") }}
      </strong>
      <span class="count">
        {{ t(`${totalSelected} scope(s)`, `共 ${totalSelected} 个`) }}
      </span>
      <button type="button" class="copy-btn" @click="copy">
        {{ copied ? t("Copied!", "已复制！") : t("Copy", "复制") }}
      </button>
    </div>
    <pre class="output"><code>{{ generated }}</code></pre>
  </div>
</template>

<style scoped>
.scope-builder {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  background: var(--vp-c-bg-soft);
  font-size: 14px;
}
.row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.row.two-col {
  flex-wrap: wrap;
}
.row.two-col fieldset {
  flex: 1 1 280px;
  min-width: 0;
}
fieldset {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 10px 12px 12px;
  margin: 0;
}
legend {
  padding: 0 6px;
  font-weight: 600;
  font-size: 13px;
  color: var(--vp-c-text-1);
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bulk button {
  background: transparent;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 1px 8px;
  font-size: 11px;
  color: var(--vp-c-text-2);
  cursor: pointer;
}
.bulk button:hover {
  background: var(--vp-c-default-soft);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}
.field-label {
  font-weight: 600;
  font-size: 13px;
}
.cid-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}
.cid-input:focus {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -1px;
}
.hint {
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.check {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: baseline;
  gap: 6px;
  padding: 3px 0;
  cursor: pointer;
}
.check input {
  margin: 0;
  cursor: pointer;
}
.check code {
  font-size: 12px;
  background: var(--vp-c-default-soft);
  border-radius: 3px;
  padding: 1px 6px;
  white-space: nowrap;
}
.check .desc {
  color: var(--vp-c-text-2);
  font-size: 12px;
}
.output-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}
.output-head .count {
  flex: 1;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.copy-btn {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
  border: none;
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}
.copy-btn:hover {
  background: var(--vp-c-brand-2);
}
.output {
  background: var(--vp-code-block-bg);
  border-radius: 6px;
  padding: 10px 12px;
  margin: 0;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
}
.output code {
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-1);
  background: transparent;
  padding: 0;
}
</style>
