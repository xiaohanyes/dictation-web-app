/**
 * Vue Router 路由配置
 *
 * 路由结构说明：
 * - /               → 首页，展示词库和听写记录
 * - /import         → JSON 批量导入页面
 * - /dictation      → 核心听写页面
 * - /dictation-plan → 创建听写计划页面
 *
 * 使用 lazy loading（动态 import）延迟加载页面组件，
 * 这样首次加载时只下载首页代码，其他页面按需加载，提升性能
 */

import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomePage.vue'),
    },
    {
      path: '/import',
      name: 'data-manage',
      component: () => import('@/views/DataManagePage.vue'),
    },
    {
      path: '/dictation',
      name: 'dictation',
      component: () => import('@/views/DictationPage.vue'),
    },
    {
      path: '/dictation-plan',
      name: 'dictation-plan',
      component: () => import('@/views/DictationPlanPage.vue'),
    },
    {
      path: '/word-library',
      name: 'word-library',
      component: () => import('@/views/WordLibraryPage.vue'),
    },
  ],
})

export default router
