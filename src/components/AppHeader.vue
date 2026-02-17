<template>
  <!--
    顶部导航栏
    设计思路：
    - 左侧是 Logo + 应用名（使用书法字体 LXGW WenKai）
    - 右侧是导航链接
    - 底部有一条细微的渐变线，给人"笔触"的感觉
  -->
  <header class="app-header">
    <div class="header-inner">
      <!-- Logo 区域 -->
      <router-link to="/" class="header-brand">
        <span class="brand-icon">✍️</span>
        <span class="brand-text">听写助手</span>
      </router-link>

      <!-- 导航链接 -->
      <nav class="header-nav">
        <router-link
          to="/"
          class="nav-link"
          active-class="nav-link--active"
          :class="{ 'nav-link--active': $route.path === '/' }"
        >
          <span class="nav-icon">🏠</span>
          <span>首页</span>
        </router-link>
        <router-link to="/import" class="nav-link" active-class="nav-link--active">
          <span class="nav-icon">📥</span>
          <span>JSON 导入</span>
        </router-link>
        <router-link to="/dictation-plan" class="nav-link" active-class="nav-link--active">
          <span class="nav-icon">📋</span>
          <span>听写计划</span>
        </router-link>
        <router-link to="/word-library" class="nav-link" active-class="nav-link--active">
          <span class="nav-icon">📚</span>
          <span>词库管理</span>
        </router-link>
      </nav>
    </div>
    <!-- 底部渐变装饰线 -->
    <div class="header-accent" />
  </header>
</template>

<script setup lang="ts">
/**
 * AppHeader - 全局顶部导航栏组件
 *
 * 为什么单独抽成组件？
 * - 导航栏在所有页面都存在，抽组件避免重复代码
 * - 方便后续添加更多导航项（如"管理页"）
 * - 便于独立维护样式和交互逻辑
 */
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  /**
   * backdrop-filter: blur() 实现毛玻璃效果
   * 当页面滚动时，导航栏下方的内容会产生模糊透视感
   * 这是一个非常现代的 UI 处理手法（macOS/iOS 风格）
   */
  background: rgba(255, 248, 240, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.header-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-md) var(--space-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* ---- Logo ---- */
.header-brand {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  text-decoration: none;
  color: var(--color-secondary);
  transition: transform var(--transition-bounce);
}

.header-brand:hover {
  transform: scale(1.03);
  color: var(--color-secondary);
}

.brand-icon {
  font-size: 1.5rem;
}

.brand-text {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* ---- 导航链接 ---- */
.header-nav {
  display: flex;
  gap: var(--space-xs);
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.nav-link:hover {
  background: rgba(242, 153, 74, 0.08);
  color: var(--color-primary);
}

.nav-link--active {
  background: rgba(242, 153, 74, 0.12);
  color: var(--color-primary);
  font-weight: 600;
}

.nav-icon {
  font-size: 1rem;
}

/* ---- 底部装饰渐变线 ---- */
.header-accent {
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-primary-light) 20%,
    var(--color-primary) 50%,
    var(--color-accent-green) 80%,
    transparent 100%
  );
  opacity: 0.6;
}
</style>
