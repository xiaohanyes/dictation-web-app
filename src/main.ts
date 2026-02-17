/**
 * 应用入口文件
 *
 * 初始化顺序说明：
 * 1. 创建 Vue 应用实例
 * 2. 注册 Pinia 状态管理（全局 store）
 * 3. 注册 Vue Router（页面路由）
 * 4. 导入全局样式
 * 5. 挂载到 DOM
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// 全局样式（设计系统）
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
