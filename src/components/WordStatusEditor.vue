<template>
  <!--
    词汇状态编辑器组件
    展示听写计划中所有词汇，每个词旁边有四个状态按钮，点击可切换状态。
    再次点击已激活的状态按钮会取消标记（重置为 new）。

    Props:
    - words: SessionWord[] — 词汇列表（响应式，直接修改 status）
    事件:
    - update:status — 某个词的状态发生变化时触发，父组件负责持久化
  -->
  <div class="word-editor">
    <div class="word-editor-header">
      <h3 class="word-editor-title">📝 词汇详情</h3>
      <button
        class="lock-btn"
        :class="{ 'lock-btn--unlocked': !isLocked }"
        @click="isLocked = !isLocked"
        :title="isLocked ? '点击解锁，允许修改状态' : '点击锁定，防止误操作'"
      >
        {{ isLocked ? '🔒' : '🔓' }}
      </button>
    </div>
    <div class="word-editor-list">
      <div
        v-for="(word, idx) in words"
        :key="idx"
        class="word-editor-item"
      >
        <div class="word-editor-info">
          <span class="word-editor-content">{{ word.content }}</span>
          <span class="word-editor-pinyin">{{ word.pinyin }}</span>
          <span
            v-if="word.prevStatus"
            class="prev-status-tag"
            :class="`prev-status-tag--${word.prevStatus}`"
            :title="`上次: ${prevStatusLabel(word.prevStatus)}`"
          >{{ prevStatusLabel(word.prevStatus) }}</span>
        </div>
        <div class="word-editor-actions">
          <button
            class="status-btn status-btn--wrong-pinyin"
            :class="{ 'status-btn--active': word.status === 'wrong_pinyin' }"
            :disabled="isLocked"
            @click="toggleStatus(idx, 'wrong_pinyin')"
            title="不会拼音"
          >
            🗣️
          </button>
          <button
            class="status-btn status-btn--wrong-writing"
            :class="{ 'status-btn--active': word.status === 'wrong_writing' }"
            :disabled="isLocked"
            @click="toggleStatus(idx, 'wrong_writing')"
            title="不会书写"
          >
            ✏️
          </button>
          <button
            class="status-btn status-btn--fuzzy"
            :class="{ 'status-btn--active': word.status === 'fuzzy' }"
            :disabled="isLocked"
            @click="toggleStatus(idx, 'fuzzy')"
            title="模糊"
          >
            🤔
          </button>
          <button
            class="status-btn status-btn--correct"
            :class="{ 'status-btn--active': word.status === 'correct' }"
            :disabled="isLocked"
            @click="toggleStatus(idx, 'correct')"
            title="都会"
          >
            ✅
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { SessionWord, WordStatus } from '@/db'

/** 锁定状态：默认锁定，防止误操作 */
const isLocked = ref(true)

/** Props：接收词汇列表 */
defineProps<{
  words: SessionWord[]
}>()

/** 事件：状态变更时通知父组件（传递 index 和新状态） */
const emit = defineEmits<{
  'update:status': [index: number, status: WordStatus]
}>()

/**
 * 切换指定词汇的状态
 * 如果点击的状态与当前状态相同 → 重置为 new（取消标记）
 * 否则 → 设为新状态
 */
function toggleStatus (index: number, status: WordStatus) {
  emit('update:status', index, status)
}

/** 将上次状态码转为中文标签 */
function prevStatusLabel (s: WordStatus): string {
  const map: Record<WordStatus, string> = {
    new: '新词',
    wrong_pinyin: '不会拼音',
    wrong_writing: '不会书写',
    fuzzy: '模糊',
    correct: '都会',
  }
  return map[s] || s
}
</script>

<style scoped>
/* =======================================
   词汇状态编辑列表
   ======================================= */
.word-editor {
  width: 100%;
  max-width: 600px;
  margin-top: var(--space-2xl);
}

.word-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.word-editor-title {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.lock-btn {
  width: 36px;
  height: 36px;
  border: 2px solid rgba(45, 58, 74, 0.12);
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  cursor: pointer;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform var(--transition-bounce),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.lock-btn:hover {
  transform: scale(1.1);
  border-color: rgba(242, 153, 74, 0.4);
}

.lock-btn--unlocked {
  border-color: var(--color-accent-green);
  background: rgba(39, 174, 96, 0.08);
}

.word-editor-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.word-editor-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  border: 1px solid rgba(242, 153, 74, 0.08);
  transition: box-shadow var(--transition-fast);
}

.word-editor-item:hover {
  box-shadow: var(--shadow-sm);
}

.word-editor-info {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  min-width: 0;
}

.word-editor-content {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.word-editor-pinyin {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-family: Arial, Helvetica, sans-serif;
}

.word-editor-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.status-btn {
  width: 34px;
  height: 34px;
  border: 2px solid rgba(45, 58, 74, 0.1);
  border-radius: var(--radius-md);
  background: var(--color-bg-main);
  cursor: pointer;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform var(--transition-bounce),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
  opacity: 0.5;
}

.status-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.status-btn:hover {
  opacity: 1;
  transform: scale(1.12);
  box-shadow: var(--shadow-sm);
}

/* 激活状态：各按钮对应颜色高亮 */
.status-btn--active {
  opacity: 1;
  transform: scale(1.05);
}

.status-btn--wrong-pinyin.status-btn--active {
  border-color: var(--color-accent-red);
  background: rgba(235, 87, 87, 0.1);
}

.status-btn--wrong-writing.status-btn--active {
  border-color: #e07c39;
  background: rgba(224, 124, 57, 0.1);
}

.status-btn--fuzzy.status-btn--active {
  border-color: var(--color-accent-yellow);
  background: rgba(242, 201, 76, 0.1);
}

.status-btn--correct.status-btn--active {
  border-color: var(--color-accent-green);
  background: rgba(39, 174, 96, 0.1);
}

/* ---- 上次状态标签 ---- */
.prev-status-tag {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  white-space: nowrap;
  opacity: 0.85;
}

.prev-status-tag--wrong_pinyin {
  color: #e74c3c;
  background: rgba(235, 87, 87, 0.1);
}

.prev-status-tag--wrong_writing {
  color: #e07c39;
  background: rgba(224, 124, 57, 0.1);
}

.prev-status-tag--fuzzy {
  color: #c89b2a;
  background: rgba(242, 201, 76, 0.15);
}

.prev-status-tag--correct {
  color: #27ae60;
  background: rgba(39, 174, 96, 0.1);
}
</style>
