<template>
  <!--
    听写计划创建页 - DictationPlanPage
    功能：支持两种来源模式创建听写计划
    1. 从文字库中按层级筛选文字
    2. 从历史已完成的听写记录中，筛选指定状态的字

    新记录中会通过 sourceSessionId / sourceMode 字段追踪来源
  -->
  <div id="dictationPlanPage">
    <section class="plan-header animate-fade-in">
      <h1 class="page-title">📋 创建听写计划</h1>
      <p class="page-desc">从文字库或历史记录中选择文字，创建一次听写计划</p>
    </section>

    <div class="plan-body animate-fade-in-delay-1">
      <!-- 计划基本信息 -->
      <div class="form-section">
        <label class="field-label">✏️ 计划名称（必填）</label>
        <n-input
          v-model:value="planName"
          placeholder="例如：第一单元周末听写"
          size="large"
          clearable
        />
      </div>

      <div class="form-section">
        <label class="field-label">📝 备注（选填）</label>
        <n-input
          v-model:value="planNote"
          type="textarea"
          placeholder="添加一些备注信息..."
          :rows="3"
          size="large"
        />
      </div>

      <!-- ===================== 来源模式切换 ===================== -->
      <div class="form-section">
        <label class="field-label">📦 选择来源</label>
        <n-radio-group
          v-model:value="sourceMode"
          size="large"
        >
          <n-radio-button value="library">📚 从文字库选择</n-radio-button>
          <n-radio-button value="history">📋 从历史记录筛选</n-radio-button>
        </n-radio-group>
      </div>

      <!-- ===================== 文字库模式 ===================== -->
      <template v-if="sourceMode === 'library'">
        <!-- 层级筛选 -->
        <div class="form-section">
          <label class="field-label">📂 选择层级</label>
          <n-tree-select
            v-model:value="selectedPath"
            :options="pathTreeOptions"
            placeholder="请选择要听写的层级"
            size="large"
            clearable
            :default-expand-all="false"
            @update:value="onPathChange"
          />
          <p
            v-if="selectedPath"
            class="field-hint"
          >
            该层级下共有 <strong>{{ availableWords.length }}</strong> 个文字
            <span
              v-if="lastSessionOffset > 0"
              class="offset-hint"
            >
              ，上次听写到第 <strong>{{ lastSessionOffset }}</strong> 个
            </span>
          </p>
        </div>

        <!-- 起始位置 & 数量选择 -->
        <div
          v-if="availableWords.length > 0"
          class="form-section animate-fade-in"
        >
          <label class="field-label">📍 起始位置（从第几个字开始）</label>
          <div class="quantity-row">
            <n-slider
              v-model:value="startOffset"
              :min="0"
              :max="Math.max(availableWords.length - 1, 0)"
              :step="1"
              class="quantity-slider"
            />
            <n-input-number
              v-model:value="startOffset"
              :min="0"
              :max="Math.max(availableWords.length - 1, 0)"
              size="medium"
              class="quantity-input"
            />
            <n-button
              v-if="lastSessionOffset > 0"
              size="small"
              quaternary
              @click="startOffset = lastSessionOffset"
            >
              续接
            </n-button>
          </div>
          <p class="field-hint">
            将从第 <strong>{{ startOffset + 1 }}</strong> 个字开始， 剩余
            <strong>{{ remainingCount }}</strong> 个可选
          </p>

          <label
            class="field-label"
            style="margin-top: var(--space-md)"
          >🔢 听写数量</label>
          <div class="quantity-row">
            <n-slider
              v-model:value="wordCount"
              :min="1"
              :max="remainingCount"
              :step="1"
              class="quantity-slider"
            />
            <n-input-number
              v-model:value="wordCount"
              :min="1"
              :max="remainingCount"
              size="medium"
              class="quantity-input"
            />
            <n-button
              size="small"
              quaternary
              @click="wordCount = remainingCount"
            > 全部 </n-button>
          </div>
          <div class="shuffle-row">
            <n-checkbox v-model:checked="shuffleEnabled"> 🔀 随机打乱顺序 </n-checkbox>
          </div>
        </div>
      </template>

      <!-- ===================== 历史记录模式 ===================== -->
      <template v-if="sourceMode === 'history'">
        <!-- 选择历史记录 -->
        <div class="form-section">
          <label class="field-label">📊 选择历史听写记录</label>
          <n-select
            v-model:value="selectedSessionId"
            :options="completedSessionOptions"
            placeholder="请选择一条已完成的听写记录"
            size="large"
            clearable
            filterable
            @update:value="onHistorySessionChange"
          />
          <p
            v-if="selectedSessionId && selectedSessionDetail"
            class="field-hint"
          >
            该记录共 <strong>{{ selectedSessionDetail.words.length }}</strong> 个字， 来源层级：{{
              selectedSessionDetail.filterPath
            }}
          </p>
        </div>

        <!-- 筛选状态 -->
        <div
          v-if="selectedSessionId"
          class="form-section animate-fade-in"
        >
          <label class="field-label">🏷️ 筛选字的状态（选择要重新听写的）</label>
          <n-checkbox-group
            v-model:value="selectedStatuses"
            class="status-filter-group"
          >
            <n-checkbox value="wrong_pinyin">
              <span class="status-label status-label--wrong-pinyin">🗣️ 不会拼音</span>
            </n-checkbox>
            <n-checkbox value="wrong_writing">
              <span class="status-label status-label--wrong-writing">✏️ 不会书写</span>
            </n-checkbox>
            <n-checkbox value="fuzzy">
              <span class="status-label status-label--fuzzy">🤔 模糊</span>
            </n-checkbox>
            <n-checkbox value="correct">
              <span class="status-label status-label--correct">✅ 都会</span>
            </n-checkbox>
          </n-checkbox-group>
          <p class="field-hint">
            匹配到 <strong>{{ historyFilteredWords.length }}</strong> 个文字
          </p>

          <div
            v-if="historyFilteredWords.length > 0"
            class="shuffle-row"
          >
            <n-checkbox v-model:checked="shuffleEnabled"> 🔀 随机打乱顺序 </n-checkbox>
          </div>
        </div>
      </template>

      <!-- ===================== 文字预览（两种模式共用） ===================== -->
      <div
        v-if="selectedWords.length > 0"
        class="preview-section animate-fade-in"
      >
        <label class="field-label"> 👀 将要听写的文字（{{ selectedWords.length }} 个） </label>
        <div class="preview-tags">
          <n-tag
            v-for="word in selectedWords"
            :key="word.wordId ?? word.content"
            size="medium"
            round
            :bordered="false"
            type="info"
          >
            <n-tooltip trigger="hover">
              <template #trigger>{{ word.content }}</template>
              {{ word.pinyin }}
            </n-tooltip>
          </n-tag>
        </div>
      </div>

      <!-- 创建按钮 -->
      <div class="action-section">
        <n-button
          type="primary"
          size="large"
          round
          :disabled="!canCreate"
          :loading="creating"
          @click="handleCreate"
        >
          🚀 创建听写计划
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NInput,
  NInputNumber,
  NButton,
  NTag,
  NTreeSelect,
  NSlider,
  NCheckbox,
  NCheckboxGroup,
  NTooltip,
  NRadioGroup,
  NRadioButton,
  NSelect,
  useMessage,
} from 'naive-ui'
import type { TreeSelectOption, SelectOption } from 'naive-ui'
import { db, type Word, type SessionWord, type DictationSession, type WordStatus } from '@/db'

const route = useRoute()
const router = useRouter()
const message = useMessage()

// ============================================================
//  表单数据（通用）
// ============================================================

const planName = ref('')
const planNote = ref('')
const shuffleEnabled = ref(false)
const creating = ref(false)

/**
 * 来源模式：
 * - library: 从文字库中按层级选择（默认，即原有逻辑）
 * - history: 从已完成的历史听写记录中筛选特定状态的字
 */
const sourceMode = ref<'library' | 'history'>('library')

// ============================================================
//  文字库模式相关状态
// ============================================================

const selectedPath = ref<string | null>(null)
const wordCount = ref(10)
const startOffset = ref(0)

/** 选中层级下的所有可用文字 */
const availableWords = ref<Word[]>([])

/** 上次听写结束的偏移位置（自动计算，用于"续接"按钮） */
const lastSessionOffset = ref(0)

/** 所有层级路径（用于构建树形选择器） */
const allPaths = ref<string[]>([])

// ============================================================
//  历史记录模式相关状态
// ============================================================

/** 选中的历史听写记录 ID */
const selectedSessionId = ref<number | null>(null)

/** 选中的历史听写记录的完整数据 */
const selectedSessionDetail = ref<DictationSession | null>(null)

/** 用户勾选的要筛选的状态列表 */
const selectedStatuses = ref<WordStatus[]>(['wrong_pinyin', 'wrong_writing', 'fuzzy'])

/** 所有已完成的听写记录（用于构建下拉选项） */
const completedSessions = ref<DictationSession[]>([])

// ============================================================
//  计算属性 —— 文字库模式
// ============================================================

/** 从偏移位置开始，剩余可选的文字数量 */
const remainingCount = computed(() => {
  return Math.max(availableWords.value.length - startOffset.value, 0)
})

/**
 * 【文字库模式】根据设置选取的文字列表
 *
 * 先根据 startOffset 截取起始位置之后的文字，
 * 再根据 wordCount 截取指定数量。
 * 如开启随机则在截取范围内打乱顺序。
 */
const librarySelectedWords = computed<SessionWord[]>(() => {
  const sliced = availableWords.value.slice(startOffset.value, startOffset.value + wordCount.value)
  const words = sliced.map((w) => ({
    wordId: w.id!,
    content: w.content,
    pinyin: w.pinyin,
    status: 'new' as const,
  }))

  if (shuffleEnabled.value) {
    // Fisher-Yates 洗牌算法 —— 保证每个排列出现的概率相等
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = words[i]!
      words[i] = words[j]!
      words[j] = temp
    }
  }
  return words
})

// ============================================================
//  计算属性 —— 历史记录模式
// ============================================================

/**
 * 已完成的听写记录下拉选项
 *
 * 格式化为 NSelect 需要的 { label, value } 结构
 * label 中包含记录名称、完成时间和各状态统计，便于用户快速识别
 */
const completedSessionOptions = computed<SelectOption[]>(() => {
  return completedSessions.value.map((s) => {
    const time = new Date(s.completedAt || s.createdAt).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    // 统计各状态数量，帮助用户判断该记录是否值得筛选
    const wrongPinyin = s.words.filter((w) => w.status === 'wrong_pinyin').length
    const wrongWriting = s.words.filter((w) => w.status === 'wrong_writing').length
    const fuzzy = s.words.filter((w) => w.status === 'fuzzy').length
    const correct = s.words.filter((w) => w.status === 'correct').length

    return {
      label: `${s.name}（${time}）🗣️${wrongPinyin} ✏️${wrongWriting} 🤔${fuzzy} ✅${correct}`,
      value: s.id!,
    }
  })
})

/**
 * 【历史记录模式】根据勾选的状态筛选出的文字
 *
 * 从选中的历史记录的 words 数组中，
 * 筛选出 status 在 selectedStatuses 中的字
 */
const historyFilteredWords = computed<SessionWord[]>(() => {
  if (!selectedSessionDetail.value || selectedStatuses.value.length === 0) return []

  const filtered = selectedSessionDetail.value.words
    .filter((w) => selectedStatuses.value.includes(w.status))
    .map((w) => ({
      wordId: w.wordId,
      content: w.content,
      pinyin: w.pinyin,
      status: 'new' as const, // 新计划中重置为 new
      prevStatus: w.status,   // 保留上次的状态，听写时可参考
    }))

  if (shuffleEnabled.value) {
    for (let i = filtered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = filtered[i]!
      filtered[i] = filtered[j]!
      filtered[j] = temp
    }
  }

  return filtered
})

// ============================================================
//  统一计算属性
// ============================================================

/**
 * 最终选中的文字列表（根据当前模式自动选择）
 *
 * 文字库模式 → librarySelectedWords
 * 历史记录模式 → historyFilteredWords
 */
const selectedWords = computed<SessionWord[]>(() => {
  return sourceMode.value === 'library' ? librarySelectedWords.value : historyFilteredWords.value
})

/** 是否满足创建条件（两种模式各有不同的前置条件） */
const canCreate = computed(() => {
  const hasName = planName.value.trim().length > 0
  const hasWords = selectedWords.value.length > 0

  if (sourceMode.value === 'library') {
    return hasName && selectedPath.value && hasWords
  } else {
    return hasName && selectedSessionId.value && hasWords
  }
})

/**
 * 将扁平的路径列表构建为 NTreeSelect 需要的树形结构
 *
 * 思路：
 * 1. 将每个路径按 "/" 拆分为层级数组
 * 2. 遍历每一层，逐层构建节点
 * 3. 叶子节点和中间节点都可以被选中
 *
 * 例如输入 ["一年级下册/识字表 第一单元/第一课", "一年级下册/识字表 第一单元/第二课"]
 * 输出树：
 *   一年级下册
 *     └── 识字表 第一单元
 *           ├── 第一课
 *           └── 第二课
 */
const pathTreeOptions = computed<TreeSelectOption[]>(() => {
  const root: TreeSelectOption[] = []

  for (const path of allPaths.value) {
    const parts = path.split('/')
    let currentLevel = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      // 从根到当前层级的完整路径，作为节点的 key/value
      const fullPath = parts.slice(0, i + 1).join('/')

      let existing = currentLevel.find((node) => node.key === fullPath)
      if (!existing) {
        existing = {
          key: fullPath,
          label: part,
          children: [],
        }
        currentLevel.push(existing)
      }
      currentLevel = existing.children as TreeSelectOption[]
    }
  }

  // 清理空的 children 数组（叶子节点不需要 children）
  function cleanEmptyChildren (nodes: TreeSelectOption[]) {
    for (const node of nodes) {
      if (node.children && (node.children as TreeSelectOption[]).length === 0) {
        delete node.children
      } else if (node.children) {
        cleanEmptyChildren(node.children as TreeSelectOption[])
      }
    }
  }
  cleanEmptyChildren(root)

  return root
})

// ============================================================
//  数据加载
// ============================================================

/**
 * 加载所有可用的层级路径
 * 从 words 表中获取所有去重后的 path 列表
 */
async function loadPaths () {
  const allWords = await db.words.toArray()
  const pathSet = new Set<string>()
  for (const word of allWords) {
    pathSet.add(word.path)
  }
  allPaths.value = Array.from(pathSet).sort()
}

/**
 * 加载所有已完成的听写记录
 * 用于历史记录模式的下拉选择
 */
async function loadCompletedSessions () {
  const sessions = await db.dictation_sessions.filter((s) => s.status === 'completed').toArray()
  // 按完成时间倒序，最近完成的排在前面
  sessions.sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt))
  completedSessions.value = sessions
}

/**
 * 层级选择变化时，加载该层级下的所有文字
 *
 * 使用 startsWith 匹配，这样选择父层级时会包含所有子层级的文字
 * 例如选择 "一年级下册" 会匹配到 "一年级下册/识字表 第一单元/第一课" 等所有子路径
 */
async function onPathChange (path: string | null) {
  if (!path) {
    availableWords.value = []
    lastSessionOffset.value = 0
    startOffset.value = 0
    return
  }

  // 精确匹配当前路径 + 前缀匹配子路径
  const allWords = await db.words
    .filter((w) => w.path === path || w.path.startsWith(path + '/'))
    .toArray()

  availableWords.value = allWords

  // 自动计算续接位置：查询同层级下已有的听写记录，
  // 统计已听写过的总字数作为偏移起点
  // 注意：需要排除掉从历史记录创建的（sourceMode === 'history' 或 sourceSessionId 存在），以免重复计算进度
  const sessions = await db.dictation_sessions
    .filter((s) => s.filterPath === path && s.sourceMode !== 'history' && !s.sourceSessionId)
    .toArray()

  let totalDictated = 0
  for (const session of sessions) {
    totalDictated += session.words.length
  }

  // 如果已听写字数超过总数，说明已经听完一轮，重置为 0
  const offset = totalDictated < allWords.length ? totalDictated : 0
  lastSessionOffset.value = offset
  startOffset.value = offset

  // 默认选 25 个或剩余全部
  const remaining = allWords.length - offset
  wordCount.value = Math.min(remaining, 25)
}

/**
 * 历史记录选择变化时，加载该记录的详细数据
 */
async function onHistorySessionChange (id: number | null) {
  if (!id) {
    selectedSessionDetail.value = null
    return
  }

  const session = await db.dictation_sessions.get(id)
  selectedSessionDetail.value = session || null
}

// ============================================================
//  创建逻辑
// ============================================================

/**
 * 创建听写计划
 *
 * 根据当前模式，组装不同的数据写入 dictation_sessions 表
 * - 文字库模式：filterPath 取选中的层级路径，sourceMode 为 'library'
 * - 历史记录模式：filterPath 复用原记录的路径，sourceMode 为 'history'，
 *   并记录 sourceSessionId 用于追踪来源
 */
async function handleCreate () {
  if (!canCreate.value) return

  creating.value = true
  try {
    const sessionWords: SessionWord[] = selectedWords.value

    if (sourceMode.value === 'library') {
      // 文字库模式
      await db.dictation_sessions.add({
        name: planName.value.trim(),
        note: planNote.value.trim() || undefined,
        filterPath: selectedPath.value!,
        words: sessionWords,
        status: 'pending',
        createdAt: Date.now(),
        sourceMode: 'library',
      })
    } else {
      // 历史记录模式：记录来源 session ID
      await db.dictation_sessions.add({
        name: planName.value.trim(),
        note: planNote.value.trim() || undefined,
        filterPath: selectedSessionDetail.value!.filterPath,
        words: sessionWords,
        status: 'pending',
        createdAt: Date.now(),
        sourceMode: 'history',
        sourceSessionId: selectedSessionId.value!,
      })
    }

    message.success('听写计划创建成功！')
    router.push('/')
  } catch (err) {
    console.error('创建失败:', err)
    message.error('创建失败，请重试')
  } finally {
    creating.value = false
  }
}

// ============================================================
//  生命周期
// ============================================================

onMounted(async () => {
  await Promise.all([loadPaths(), loadCompletedSessions()])

  // 如果 URL 中携带了 sourceSessionId，自动切到历史记录模式并预选该记录
  const rawSourceId = route.query.sourceSessionId
  if (rawSourceId) {
    const sourceId = Number(rawSourceId)
    // 确认该记录确实在已完成列表中
    const exists = completedSessions.value.find((s) => s.id === sourceId)
    if (exists) {
      skipSourceModeReset = true  // 跳过 watch 中的重置逻辑
      sourceMode.value = 'history'
      selectedSessionId.value = sourceId
      await onHistorySessionChange(sourceId)
    }
  }
})

/**
 * 切换来源模式时重置相关状态，避免残留数据干扰
 */
/**
 * 用于跳过 sourceMode 的 watch 重置逻辑
 * 当通过 URL 参数自动切到历史模式时，不希望 watch 清空已预选的记录
 */
let skipSourceModeReset = false

watch(sourceMode, () => {
  if (skipSourceModeReset) {
    skipSourceModeReset = false
    return
  }

  // 重置文字库模式状态
  selectedPath.value = null
  availableWords.value = []
  startOffset.value = 0
  wordCount.value = 10
  lastSessionOffset.value = 0

  // 重置历史记录模式状态
  selectedSessionId.value = null
  selectedSessionDetail.value = null
  selectedStatuses.value = ['wrong_pinyin', 'wrong_writing', 'fuzzy']

  shuffleEnabled.value = false
})

/**
 * 监听 shuffleEnabled 变化时重新触发 selectedWords 计算
 * 实际上 computed 会自动重新计算，但因为 shuffle 的随机性，
 * 每次切换 checked 时用户期望看到不同的顺序
 */
watch(shuffleEnabled, () => {
  // computed 依赖 shuffleEnabled 会自动重新计算
})
</script>

<style scoped>
#dictationPlanPage {
  padding-top: var(--space-lg);
}

.plan-header {
  text-align: center;
  margin-bottom: var(--space-2xl);
}

.page-title {
  font-family: var(--font-display);
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--space-xs);
}

.page-desc {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

/* ---- 表单区域 ---- */
.plan-body {
  max-width: 700px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.form-section {
  display: flex;
  flex-direction: column;
}

.field-label {
  display: block;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: var(--space-sm);
  color: var(--color-text-primary);
}

.field-hint {
  margin-top: var(--space-xs);
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

/* ---- 数量选择 ---- */
.quantity-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.quantity-slider {
  flex: 1;
}

.quantity-input {
  width: 100px;
}

.shuffle-row {
  margin-top: var(--space-md);
}

/* ---- 状态筛选组 ---- */
.status-filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.status-label {
  font-weight: 500;
  font-size: 0.88rem;
}

.status-label--wrong-pinyin {
  color: #e74c3c;
}

.status-label--wrong-writing {
  color: #e67e22;
}

.status-label--fuzzy {
  color: #f39c12;
}

.status-label--correct {
  color: #27ae60;
}

/* ---- 预览区域 ---- */
.preview-section {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
}

.preview-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

/* ---- 操作按钮 ---- */
.action-section {
  display: flex;
  justify-content: center;
  padding-top: var(--space-md);
}
</style>
