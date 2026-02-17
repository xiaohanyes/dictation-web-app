<template>
  <!--
    听写页 - DictationPage (核心)
    这是应用的"主战场"：沉浸式听写体验

    UI 布局：
    ┌─────────────────────────────────────┐
    │  ← 返回              进度 5/20     │  ← 顶部工具栏
    ├─────────────────────────────────────┤
    │  ████████░░░░░░░░░░░░  进度条      │
    │                                     │
    │         ┌───────────┐              │
    │         │  🔊 播放   │              │  ← 巨大播放按钮
    │         └───────────┘              │
    │                                     │
    │  ◀ 上一个              下一个 ▶    │  ← 导航按钮
    │                                     │
    │      ┌─────────────────┐           │
    │      │   [ 答  案 ]    │           │  ← 答案区（初始隐藏）
    │      └─────────────────┘           │
    │                                     │
    │  不会拼音  不会书写  模糊  都会     │  ← 四个反馈按钮
    └─────────────────────────────────────┘
  -->
  <div id="dictationPage">
    <!-- ======= 加载状态 ======= -->
    <div
      v-if="loading"
      class="loading-state"
    >
      <n-spin size="large" />
      <p>加载词汇中...</p>
    </div>

    <!-- ======= 无数据状态 ======= -->
    <div
      v-else-if="!session"
      class="empty-state"
    >
      <div class="empty-icon">🤷</div>
      <h3>未找到该听写计划</h3>
      <n-button
        type="primary"
        round
        @click="$router.push('/')"
      > 回到首页 </n-button>
    </div>

    <!-- ======= 听写完成状态 ======= -->
    <div
      v-else-if="isFinished"
      class="finish-state animate-fade-in"
    >
      <div class="finish-icon">🎉</div>
      <h2 class="finish-title">听写完成！</h2>
      <div
        class="edit-trigger"
        @click.stop="openEditModal"
      >
        <span class="edit-trigger-name">{{ sessionName }}</span>
        <span
          class="edit-trigger-icon"
          title="编辑名称和备注"
        >✏️</span>
      </div>
      <div class="finish-stats">
        <div class="finish-stat">
          <span class="finish-stat-value finish-stat--correct">{{ computedStats.correct }}</span>
          <span class="finish-stat-label">都会</span>
        </div>
        <div class="finish-stat">
          <span class="finish-stat-value finish-stat--fuzzy">{{ computedStats.fuzzy }}</span>
          <span class="finish-stat-label">模糊</span>
        </div>
        <div class="finish-stat">
          <span class="finish-stat-value finish-stat--wrong-pinyin">{{
            computedStats.wrongPinyin
          }}</span>
          <span class="finish-stat-label">不会拼音</span>
        </div>
        <div class="finish-stat">
          <span class="finish-stat-value finish-stat--wrong-writing">{{
            computedStats.wrongWriting
          }}</span>
          <span class="finish-stat-label">不会书写</span>
        </div>
      </div>
      <div class="finish-actions">
        <n-button
          type="primary"
          size="large"
          round
          @click="restart"
        > 🔄 重新开始 </n-button>
        <n-button
          size="large"
          round
          @click="createPlanFromThis"
        > 📋 从此记录新建计划 </n-button>
        <n-button
          v-if="practiceWords.length > 0"
          type="info"
          size="large"
          round
          @click="openPracticeModal"
        > ✍️ 练习错题（{{ practiceWords.length }}） </n-button>
        <n-button
          size="large"
          round
          @click="$router.push('/')"
        > 🏠 回到首页 </n-button>
      </div>

      <!-- 词汇状态编辑列表 -->
      <WordStatusEditor
        :words="words"
        @update:status="handleWordStatusUpdate"
      />
    </div>

    <!-- ======= 开始前的设置面板（是否打乱） ======= -->
    <div
      v-else-if="!hasStarted"
      class="setup-state animate-fade-in"
    >
      <div class="setup-icon">📝</div>
      <h2 class="setup-title">准备开始听写</h2>
      <div
        class="edit-trigger"
        @click.stop="openEditModal"
      >
        <span class="edit-trigger-name">{{ sessionName }}</span>
        <span
          class="edit-trigger-icon"
          title="编辑名称和备注"
        >✏️</span>
      </div>
      <p class="setup-count">
        共 <strong>{{ words.length }}</strong> 个词语
      </p>

      <div class="setup-option">
        <label class="setup-label">是否打乱顺序？</label>
        <div class="shuffle-toggle">
          <button
            class="shuffle-btn"
            :class="{ 'shuffle-btn--active': !isShuffled }"
            @click="isShuffled = false"
          >
            📋 顺序
          </button>
          <button
            class="shuffle-btn"
            :class="{ 'shuffle-btn--active': isShuffled }"
            @click="isShuffled = true"
          >
            🔀 打乱
          </button>
        </div>
      </div>

      <n-button
        type="primary"
        size="large"
        round
        @click="startDictation"
      > ✨ 开始听写 </n-button>

      <!-- 词汇状态编辑（开始前也可查看/修改） -->
      <WordStatusEditor
        :words="words"
        @update:status="handleWordStatusUpdate"
      />
    </div>

    <!-- ======= 核心听写界面 ======= -->
    <div
      v-else
      class="dictation-active"
    >
      <!-- 顶部工具栏 -->
      <div class="toolbar animate-fade-in">
        <n-button
          text
          @click="$router.push('/')"
        > ← 返回 </n-button>
        <div class="toolbar-info">
          <span class="toolbar-path">{{ sessionName }}
            <n-button
              text
              size="small"
              @click="openEditModal"
              title="编辑名称和备注"
            >✏️</n-button>
          </span>
          <span class="toolbar-progress">{{ currentIndex + 1 }} / {{ words.length }}</span>
        </div>
        <div class="toolbar-options">
          <n-button
            text
            size="small"
            @click="toggleShuffle"
          >
            {{ isShuffled ? '🔀 已打乱' : '📋 顺序' }}
          </n-button>
        </div>
      </div>

      <!-- 进度条 -->
      <div class="progress-bar animate-fade-in-delay-1">
        <div
          class="progress-fill"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>

      <!-- 播放区域 -->
      <div class="play-area animate-fade-in-delay-2">
        <button
          class="play-btn"
          :class="{ 'play-btn--playing': isPlaying }"
          @click="playCurrent"
          title="播放当前词语"
        >
          <span class="play-btn-icon">{{ isPlaying ? '🔊' : '🔈' }}</span>
          <span class="play-btn-text">{{ isPlaying ? '播放中...' : '点击播放' }}</span>
        </button>
        <p class="play-hint">点击按钮听取词语发音，然后写在纸上</p>
      </div>

      <!-- 上一个 / 下一个 导航 -->
      <div class="nav-area">
        <button
          class="nav-btn"
          :disabled="currentIndex <= 0"
          @click="goPrev"
        >◀ 上一个</button>
        <button
          class="nav-btn"
          :disabled="currentIndex >= words.length - 1"
          @click="goNext"
        >
          下一个 ▶
        </button>
      </div>

      <!-- 答案区域（直接展示） -->
      <div class="answer-area animate-fade-in-delay-3">
        <div class="answer-card answer-card--revealed">
          <div class="answer-content">
            <span
              v-if="currentWord?.pinyin"
              class="answer-pinyin"
            >{{ currentWord.pinyin }}</span>
            <span class="answer-text">{{ currentWord?.content }}</span>
            <span
              v-if="currentWord?.prevStatus"
              class="answer-prev-status"
              :class="`answer-prev-status--${currentWord.prevStatus}`"
            >上次: {{ prevStatusText(currentWord.prevStatus) }}</span>
          </div>
        </div>
      </div>

      <!-- 反馈按钮区域（始终显示） -->
      <div class="feedback-area feedback-area--visible">
        <button
          class="feedback-btn feedback-btn--wrong-pinyin"
          @click="markAndNext('wrong_pinyin')"
        >
          <span class="feedback-icon">🗣️</span>
          <span class="feedback-label">不会拼音</span>
        </button>
        <button
          class="feedback-btn feedback-btn--wrong-writing"
          @click="markAndNext('wrong_writing')"
        >
          <span class="feedback-icon">✏️</span>
          <span class="feedback-label">不会书写</span>
        </button>
        <button
          class="feedback-btn feedback-btn--fuzzy"
          @click="markAndNext('fuzzy')"
        >
          <span class="feedback-icon">🤔</span>
          <span class="feedback-label">模糊</span>
        </button>
        <button
          class="feedback-btn feedback-btn--correct"
          @click="markAndNext('correct')"
        >
          <span class="feedback-icon">✅</span>
          <span class="feedback-label">都会</span>
        </button>
      </div>
    </div>

    <!-- ======= 编辑名称/备注弹窗 ======= -->
    <n-modal
      v-model:show="editModalVisible"
      preset="card"
      title="编辑听写记录"
      :style="{ maxWidth: '420px' }"
      :mask-closable="true"
      :close-on-esc="true"
    >
      <div class="edit-modal-body">
        <div class="edit-field">
          <label class="edit-field-label">名称</label>
          <n-input
            v-model:value="editName"
            placeholder="请输入听写记录名称"
            clearable
          />
        </div>
        <div class="edit-field">
          <label class="edit-field-label">备注</label>
          <n-input
            v-model:value="editNote"
            type="textarea"
            placeholder="可选，为这次听写添加备注"
            :autosize="{ minRows: 2, maxRows: 4 }"
            clearable
          />
        </div>
      </div>
      <template #footer>
        <div class="edit-modal-footer">
          <n-button @click="editModalVisible = false">取消</n-button>
          <n-button
            type="primary"
            @click="saveSessionInfo"
          >保存</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 练习错题弹窗 -->
    <HanziPracticeModal
      v-model:visible="practiceModalVisible"
      :words="practiceWords"
      style="margin-bottom: 25px;"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, toRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NSpin, NButton, NModal, NInput } from 'naive-ui'
import { db, type DictationSession, type SessionWord, type WordStatus } from '@/db'
import WordStatusEditor from '@/components/WordStatusEditor.vue'
import HanziPracticeModal from '@/components/HanziPracticeModal.vue'

const route = useRoute()
const router = useRouter()
// ============================================================
//  状态
// ============================================================
const loading = ref(true)

/** 从 URL query 中读取的 sessionId */
const sessionId = computed(() => {
  const raw = route.query.sessionId
  return raw ? Number(raw) : null
})

/** 当前加载的 DictationSession 对象（null 表示未找到或加载失败） */
const session = ref<DictationSession | null>(null)

/**
 * 页面使用的词汇列表，从 session.words 中映射而来
 * 以 SessionWord 为主体，听写过程中直接操作它
 */
const words = ref<SessionWord[]>([])

const currentIndex = ref(0)
const answerRevealed = ref(false)
const isPlaying = ref(false)
const isShuffled = ref(true)
const isFinished = ref(false)

// 练习错题相关
const practiceModalVisible = ref(false)
const practiceWords = computed(() => {
  const incorrect = words.value.filter(w => w.status !== 'correct')
  const map = new Map<string, string>()

  incorrect.forEach(w => {
    // 简单的按字拆分，尝试匹配拼音
    const chars = w.content.split('')
    const pinyins = w.pinyin.trim().split(/\s+/) // 假设拼音用空格分隔

    chars.forEach((char, idx) => {
      if (!char.trim()) return
      // 只有当拼音数量与字数一致时才尝试匹配，否则留空
      const p = (pinyins.length === chars.length) ? (pinyins[idx] || '') : ''
      if (!map.has(char)) {
        map.set(char, p)
      }
    })
  })

  return Array.from(map.entries()).map(([char, pinyin]) => ({ char, pinyin }))
})

function openPracticeModal () {
  practiceModalVisible.value = true
}

/**
 * 是否已经开始听写
 * 用于控制"设置面板"（选择是否打乱）和"听写界面"之间的切换
 * 用户必须先在设置面板点击"开始听写"才会进入听写状态
 */
const hasStarted = ref(false)

/** 本轮听写的统计数据 */
const stats = ref({
  correct: 0,
  fuzzy: 0,
  wrongPinyin: 0,
  wrongWriting: 0,
})

// ============================================================
//  计算属性
// ============================================================

/** 展示的计划名称，取 session 名称 */
const sessionName = computed(() => session.value?.name || '未知计划')

/** 当前词语 */
const currentWord = computed(() => words.value[currentIndex.value] || null)

/**
 * 实时计算统计数据（基于 words 数组当前状态）
 * 用计算属性替代手动维护的 stats，确保直接修改词汇状态后统计数字自动正确
 */
const computedStats = computed(() => {
  const result = { correct: 0, fuzzy: 0, wrongPinyin: 0, wrongWriting: 0 }
  for (const w of words.value) {
    switch (w.status) {
      case 'correct':
        result.correct++
        break
      case 'fuzzy':
        result.fuzzy++
        break
      case 'wrong_pinyin':
        result.wrongPinyin++
        break
      case 'wrong_writing':
        result.wrongWriting++
        break
    }
  }
  return result
})

/** 进度百分比 */
const progressPercent = computed(() =>
  words.value.length > 0 ? (currentIndex.value / words.value.length) * 100 : 0,
)

/**
 * 将响应式的 words 数组转为纯 JS 对象
 * Vue3 的 ref/reactive 会将数组包装成 Proxy，
 * 而 Dexie（IndexedDB）无法正确序列化 Proxy 对象，
 * 必须先用 toRaw() 解除代理，再深拷贝确保嵌套对象也是纯对象
 */
function getPlainWords (): SessionWord[] {
  return JSON.parse(JSON.stringify(toRaw(words.value)))
}

// ============================================================
//  核心逻辑
// ============================================================

/**
 * 加载听写计划数据
 * 通过 URL 中的 sessionId 从 dictation_sessions 表读取
 * 若 session 有已完成的词，自动跳到第一个 status === 'new' 的词（恢复进度）
 */
async function loadSession () {
  loading.value = true
  try {
    if (!sessionId.value) {
      session.value = null
      return
    }

    const result = await db.dictation_sessions.get(sessionId.value)
    if (!result) {
      session.value = null
      return
    }

    session.value = result
    words.value = [...result.words]

    // 恢复进度：统计已完成的词，并定位到第一个未完成的词
    const firstNewIndex = words.value.findIndex((w) => w.status === 'new')
    if (firstNewIndex >= 0) {
      currentIndex.value = firstNewIndex
    } else {
      // 所有词都已完成
      currentIndex.value = words.value.length - 1
    }

    // 统计已有的标记结果（恢复进度时显示正确的统计）
    for (const w of words.value) {
      switch (w.status) {
        case 'correct':
          stats.value.correct++
          break
        case 'fuzzy':
          stats.value.fuzzy++
          break
        case 'wrong_pinyin':
          stats.value.wrongPinyin++
          break
        case 'wrong_writing':
          stats.value.wrongWriting++
          break
      }
    }

    // 如果 session 状态已经是 in_progress，自动跳过设置面板直接进入听写
    if (result.status === 'in_progress') {
      hasStarted.value = true
    }

    // 如果 session 已经完成，直接展示完成状态（含统计和"新建计划"按钮）
    if (result.status === 'completed') {
      hasStarted.value = true
      isFinished.value = true
    }
  } finally {
    loading.value = false
  }
}

/**
 * 点击"开始听写"按钮
 * 根据用户的选择决定是否打乱顺序，更新 session 状态为 in_progress，然后进入听写状态
 */
async function startDictation () {
  if (isShuffled.value) {
    shuffleArray(words.value)
  }

  // 将 session 状态更新为 in_progress
  if (session.value?.id) {
    await db.dictation_sessions.update(session.value.id, {
      status: 'in_progress',
    })
    session.value.status = 'in_progress'
  }

  hasStarted.value = true
  // 进入后自动播放第一个词
  setTimeout(() => playCurrent(), 500)
}

/**
 * Fisher-Yates 洗牌算法
 * 保证完美的均匀分布，每种排列等概率出现
 */
function shuffleArray<T> (arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = temp
  }
}

/**
 * 播放当前词语的语音
 * 使用浏览器原生 SpeechSynthesis API（MVP 阶段的兜底方案）
 */
function playCurrent () {
  if (!currentWord.value || isPlaying.value) return

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(currentWord.value.content)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.8
  utterance.pitch = 1

  utterance.onstart = () => {
    isPlaying.value = true
  }
  utterance.onend = () => {
    isPlaying.value = false
  }
  utterance.onerror = () => {
    isPlaying.value = false
  }

  window.speechSynthesis.speak(utterance)
}

/** 揭示答案 */
function revealAnswer () {
  answerRevealed.value = true
}

/** 上一个词 */
function goPrev () {
  if (currentIndex.value > 0) {
    currentIndex.value--
    answerRevealed.value = false
    setTimeout(() => playCurrent(), 200)
  }
}

/** 下一个词（不标记状态，仅切换） */
function goNext () {
  if (currentIndex.value < words.value.length - 1) {
    currentIndex.value++
    answerRevealed.value = false
    setTimeout(() => playCurrent(), 200)
  }
}

/**
 * 标记当前词的掌握状态，然后自动切换到下一个
 *
 * 步骤：
 * 1. 更新本地 words 数组中对应词的 status
 * 2. 同步更新 dictation_sessions 表中整个 words 数组
 * 3. 更新本轮统计数据
 * 4. 重置答案显示状态
 * 5. 移动到下一个词，或标记全部完成
 */
async function markAndNext (status: WordStatus) {
  if (!currentWord.value || !session.value?.id) return

  // 更新本地 words 数组中当前词的状态
  words.value[currentIndex.value]!.status = status

  // 更新统计
  switch (status) {
    case 'correct':
      stats.value.correct++
      break
    case 'fuzzy':
      stats.value.fuzzy++
      break
    case 'wrong_pinyin':
      stats.value.wrongPinyin++
      break
    case 'wrong_writing':
      stats.value.wrongWriting++
      break
  }

  // 移动到下一个
  answerRevealed.value = false
  if (currentIndex.value < words.value.length - 1) {
    currentIndex.value++
    // 同步更新 session 到数据库（进行中状态）
    await db.dictation_sessions.update(session.value.id, {
      words: getPlainWords(),
    })
    setTimeout(() => playCurrent(), 300)
  } else {
    // 全部完成：标记 session 为 completed
    isFinished.value = true
    await db.dictation_sessions.update(session.value.id, {
      words: getPlainWords(),
      status: 'completed',
      completedAt: Date.now(),
    })
    session.value.status = 'completed'
  }
}

/** 重新开始本组听写 */
async function restart () {
  // 重置所有词的状态为 new
  words.value.forEach((w) => (w.status = 'new'))
  currentIndex.value = 0
  answerRevealed.value = false
  isFinished.value = false
  stats.value = { correct: 0, fuzzy: 0, wrongPinyin: 0, wrongWriting: 0 }

  if (isShuffled.value) {
    shuffleArray(words.value)
  }

  // 同步到数据库，状态恢复为 in_progress
  if (session.value?.id) {
    await db.dictation_sessions.update(session.value.id, {
      words: getPlainWords(),
      status: 'in_progress',
      completedAt: undefined,
    })
    session.value.status = 'in_progress'
  }

  setTimeout(() => playCurrent(), 500)
}

/** 切换打乱/顺序模式（听写中途也可切换） */
function toggleShuffle () {
  isShuffled.value = !isShuffled.value
  if (isShuffled.value) {
    shuffleArray(words.value)
  } else {
    // 恢复原始顺序：按 wordId 排序
    words.value.sort((a, b) => a.wordId - b.wordId)
  }
  currentIndex.value = 0
  answerRevealed.value = false
}

/**
 * 处理 WordStatusEditor 组件的状态变更事件
 * 如果点击的状态与当前状态相同，则重置为 new（取消标记）
 * 否则设为新状态，然后同步到数据库
 */
async function handleWordStatusUpdate (index: number, status: WordStatus) {
  if (!session.value?.id) return

  // 如果点击的状态和当前状态相同，则切换回 new（取消标记）
  const currentStatus = words.value[index]!.status
  words.value[index]!.status = currentStatus === status ? 'new' : status

  // 同步到数据库
  await db.dictation_sessions.update(session.value.id, {
    words: getPlainWords(),
  })
}

// ============================================================
//  编辑名称/备注弹窗
// ============================================================

const editModalVisible = ref(false)
const editName = ref('')
const editNote = ref('')

/** 打开编辑弹窗，用当前 session 的值初始化表单 */
function openEditModal () {
  if (!session.value) return
  editName.value = session.value.name
  editNote.value = session.value.note || ''
  editModalVisible.value = true
}

/** 保存修改到数据库并更新本地状态 */
async function saveSessionInfo () {
  if (!session.value?.id || !editName.value.trim()) return

  const newName = editName.value.trim()
  const newNote = editNote.value.trim() || undefined

  await db.dictation_sessions.update(session.value.id, {
    name: newName,
    note: newNote,
  })

  // 更新本地状态
  session.value.name = newName
  session.value.note = newNote

  editModalVisible.value = false
}

/**
 * 从当前已完成的听写记录跳转到新建计划页
 * 通过 URL query 传递 sourceSessionId，DictationPlanPage 会自动切到历史模式并预选该记录
 */
function createPlanFromThis () {
  if (!session.value?.id) return
  router.push({
    name: 'dictation-plan',
    query: { sourceSessionId: session.value.id },
  })
}

/** 将上次状态码转为中文文本 */
function prevStatusText (s: string): string {
  const map: Record<string, string> = {
    wrong_pinyin: '不会拼音',
    wrong_writing: '不会书写',
    fuzzy: '模糊',
    correct: '都会',
  }
  return map[s] || s
}

// ---- 生命周期 ----
onMounted(() => {
  loadSession()
})
</script>

<style scoped>
#dictationPage {
  padding-top: var(--space-md);
  min-height: 70vh;
  display: flex;
  flex-direction: column;
}

/* =======================================
   设置面板（开始前）
   ======================================= */
.setup-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: var(--space-lg);
  text-align: center;
}

.setup-icon {
  font-size: 3.5rem;
}

.setup-title {
  font-family: var(--font-display);
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.setup-path {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.setup-count {
  font-size: 0.95rem;
  color: var(--color-text-muted);
}

.setup-count strong {
  color: var(--color-primary);
  font-family: var(--font-display);
  font-size: 1.2rem;
}

.setup-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.setup-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.shuffle-toggle {
  display: flex;
  gap: var(--space-sm);
}

.shuffle-btn {
  padding: var(--space-sm) var(--space-lg);
  border: 2px solid rgba(242, 153, 74, 0.15);
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-bounce);
}

.shuffle-btn:hover {
  border-color: rgba(242, 153, 74, 0.4);
  transform: scale(1.03);
}

.shuffle-btn--active {
  border-color: var(--color-primary);
  background: rgba(242, 153, 74, 0.08);
  color: var(--color-primary);
  font-weight: 600;
}

/* =======================================
   工具栏
   ======================================= */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.toolbar-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.toolbar-path {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.toolbar-progress {
  font-weight: 700;
  font-size: 1rem;
  color: var(--color-text-primary);
  font-family: var(--font-display);
}

/* =======================================
   进度条
   ======================================= */
.progress-bar {
  height: 6px;
  background: rgba(242, 153, 74, 0.1);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: var(--space-2xl);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary-light), var(--color-primary));
  border-radius: 999px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* =======================================
   播放按钮区域
   ======================================= */
.play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.play-btn {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: white;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  box-shadow:
    0 8px 32px rgba(242, 153, 74, 0.3),
    0 0 0 0 rgba(242, 153, 74, 0.4);
  transition:
    transform var(--transition-bounce),
    box-shadow var(--transition-normal);
  animation: softPulse 2.5s ease-in-out infinite;
}

.play-btn:hover {
  transform: scale(1.06);
  box-shadow: 0 12px 40px rgba(242, 153, 74, 0.4);
}

.play-btn:active {
  transform: scale(0.95);
  animation: gentleBounce 0.3s ease;
}

.play-btn--playing {
  animation: none;
  box-shadow:
    0 8px 32px rgba(242, 153, 74, 0.4),
    0 0 0 8px rgba(242, 153, 74, 0.15);
}

.play-btn-icon {
  font-size: 2.5rem;
}

.play-btn-text {
  font-size: 0.75rem;
  font-weight: 500;
  opacity: 0.9;
}

.play-hint {
  margin-top: var(--space-md);
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

/* =======================================
   上一个 / 下一个 导航
   ======================================= */
.nav-area {
  display: flex;
  justify-content: center;
  gap: var(--space-xl);
  margin-bottom: var(--space-xl);
}

.nav-btn {
  padding: var(--space-sm) var(--space-xl);
  border: 1.5px solid rgba(45, 58, 74, 0.12);
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-bounce);
}

.nav-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.nav-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* =======================================
   答案区域
   ======================================= */
.answer-area {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-2xl);
}

.answer-card {
  width: 100%;
  max-width: 400px;
  min-height: 120px;
  border-radius: var(--radius-xl);
  cursor: pointer;
  transition:
    transform var(--transition-normal),
    box-shadow var(--transition-normal);
  overflow: hidden;
}

.answer-card:hover {
  transform: scale(1.02);
}

.answer-mask {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  background: linear-gradient(135deg, rgba(45, 58, 74, 0.06), rgba(242, 153, 74, 0.06));
  backdrop-filter: blur(4px);
  border: 2px dashed rgba(242, 153, 74, 0.25);
  border-radius: var(--radius-xl);
  gap: var(--space-sm);
}

.answer-mask-icon {
  font-size: 1.5rem;
  opacity: 0.6;
}

.answer-mask-text {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.answer-card--revealed {
  cursor: default;
}

.answer-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  background: var(--color-bg-card);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  padding: var(--space-xl);
  gap: var(--space-xs);
  animation: fadeInUp 0.4s ease;
}

.answer-pinyin {
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text-muted);
  letter-spacing: 0.1em;
  font-family: Arial, Helvetica, sans-serif;
}

.answer-text {
  font-family: var(--font-display);
  font-size: 2.8rem;
  font-weight: 400;
  color: var(--color-text-primary);
  letter-spacing: 0.15em;
}

.answer-prev-status {
  font-size: 0.78rem;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 999px;
  margin-top: var(--space-xs);
}

.answer-prev-status--wrong_pinyin {
  color: #e74c3c;
  background: rgba(235, 87, 87, 0.1);
}

.answer-prev-status--wrong_writing {
  color: #e07c39;
  background: rgba(224, 124, 57, 0.1);
}

.answer-prev-status--fuzzy {
  color: #c89b2a;
  background: rgba(242, 201, 76, 0.15);
}

.answer-prev-status--correct {
  color: #27ae60;
  background: rgba(39, 174, 96, 0.1);
}

/* =======================================
   反馈按钮（4 个）
   ======================================= */
.feedback-area {
  display: flex;
  justify-content: center;
  gap: var(--space-md);
  flex-wrap: wrap;
  opacity: 0;
  transform: translateY(20px);
  pointer-events: none;
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}

.feedback-area--visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.feedback-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: var(--space-sm) var(--space-lg);
  border: 2px solid transparent;
  border-radius: var(--radius-lg);
  background: var(--color-bg-card);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition:
    transform var(--transition-bounce),
    box-shadow var(--transition-normal),
    border-color var(--transition-fast);
  min-width: 80px;
}

.feedback-btn:hover {
  transform: translateY(-4px) scale(1.04);
  box-shadow: var(--shadow-md);
}

.feedback-btn:active {
  transform: scale(0.95);
}

.feedback-btn--wrong-pinyin:hover {
  border-color: var(--color-accent-red);
}

.feedback-btn--wrong-writing:hover {
  border-color: #e07c39;
}

.feedback-btn--fuzzy:hover {
  border-color: var(--color-accent-yellow);
}

.feedback-btn--correct:hover {
  border-color: var(--color-accent-green);
}

.feedback-icon {
  font-size: 1.6rem;
}

.feedback-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

/* =======================================
   完成状态
   ======================================= */
.finish-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  gap: var(--space-xl);
}

.finish-icon {
  font-size: 4rem;
  animation: gentleBounce 0.6s ease;
}

.finish-title {
  font-family: var(--font-display);
  font-size: 2rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent-green));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.finish-stats {
  display: flex;
  gap: var(--space-xl);
  flex-wrap: wrap;
  justify-content: center;
}

.finish-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}

.finish-stat-value {
  font-size: 2.2rem;
  font-weight: 700;
  font-family: var(--font-display);
}

.finish-stat--correct {
  color: var(--color-accent-green);
}

.finish-stat--fuzzy {
  color: var(--color-accent-yellow);
}

.finish-stat--wrong-pinyin {
  color: var(--color-accent-red);
}

.finish-stat--wrong-writing {
  color: #e07c39;
}

.finish-stat-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.finish-actions {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-md);
}

/* =======================================
   空状态 & 加载
   ======================================= */
.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: var(--space-md);
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
}

/* =======================================
   编辑触发器（名称旁的编辑按钮）
   ======================================= */
.edit-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  transition:
    background var(--transition-fast),
    transform var(--transition-bounce);
}

.edit-trigger:hover {
  background: rgba(242, 153, 74, 0.08);
  transform: scale(1.02);
}

.edit-trigger-name {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.edit-trigger-icon {
  font-size: 0.85rem;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
}

.edit-trigger:hover .edit-trigger-icon {
  opacity: 1;
}

/* =======================================
   编辑弹窗
   ======================================= */
.edit-modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.edit-field-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.edit-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}

.dictation-active {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
