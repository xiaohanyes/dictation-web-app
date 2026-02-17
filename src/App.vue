<template>
  <!--
    App Shell - 应用外壳
    使用 Naive UI 的全局配置组件包裹整个应用：
    - NConfigProvider: 统一主题配置（可定制 Naive UI 组件的主题色）
    - NMessageProvider: 全局消息提示（success/error/warning toast）
    - NDialogProvider: 全局对话框
  -->
  <div id="dictationApp">
    <n-config-provider :theme-overrides="themeOverrides" :locale="zhCN">
      <n-message-provider>
        <n-dialog-provider>
          <!-- 顶部导航栏 -->
          <AppHeader />
          <!-- 页面内容区 -->
          <main class="app-main">
            <router-view v-slot="{ Component }">
              <component :is="Component" />
            </router-view>
          </main>
        </n-dialog-provider>
      </n-message-provider>
    </n-config-provider>
  </div>
</template>

<script setup lang="ts">
import { NConfigProvider, NMessageProvider, NDialogProvider, zhCN } from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'
import AppHeader from '@/components/AppHeader.vue'

/**
 * Naive UI 主题覆盖
 *
 * 为什么不直接用 Naive UI 的默认主题？
 * 因为我们有自己的设计语言（暖橙色系），需要让 Naive UI 的组件
 * 和我们的全局样式保持视觉一致性。这里只覆盖关键色值。
 */
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#F2994A',
    primaryColorHover: '#F9BC80',
    primaryColorPressed: '#D97B2E',
    primaryColorSuppl: '#F2994A',
    borderRadius: '12px',
    fontFamily: "'Noto Sans SC', -apple-system, sans-serif",
  },
  Button: {
    borderRadiusMedium: '12px',
    borderRadiusLarge: '16px',
  },
}
</script>

<style scoped>
#dictationApp {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  padding: var(--space-lg);
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
}

/* 页面切换过渡动画 */
.page-fade-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.page-fade-leave-active {
  transition: opacity 0.2s ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.page-fade-leave-to {
  opacity: 0;
}
</style>
