/**
 * 示例 Store - 暂未使用
 * 后续可用于全局状态管理（如当前听写设置、用户偏好等）
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', () => {
  /** 听写时是否自动打乱顺序 */
  const autoShuffle = ref(true)

  /** TTS 语速 (0.5 - 2.0) */
  const speechRate = ref(0.8)

  /** TTS 语言 */
  const speechLang = ref('zh-CN')

  return { autoShuffle, speechRate, speechLang }
})
