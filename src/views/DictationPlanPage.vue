<template>
  <!--
    听写计划创建页 - DictationPlanPage
    功能：从文字表中按层级筛选文字，指定数量，填写计划信息，创建听写记录
  -->
  <div id="dictationPlanPage">
    <section class="plan-header animate-fade-in">
      <h1 class="page-title">📋 创建听写计划</h1>
      <p class="page-desc">从文字库中选择文字，创建一次听写计划</p>
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
        <p v-if="selectedPath" class="field-hint">
          该层级下共有 <strong>{{ availableWords.length }}</strong> 个文字
          <span v-if="lastSessionOffset > 0" class="offset-hint">
            ，上次听写到第 <strong>{{ lastSessionOffset }}</strong> 个
          </span>
        </p>
      </div>

      <!-- 起始位置 & 数量选择 -->
      <div v-if="availableWords.length > 0" class="form-section animate-fade-in">
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

        <label class="field-label" style="margin-top: var(--space-md)">🔢 听写数量</label>
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
          <n-button size="small" quaternary @click="wordCount = remainingCount"> 全部 </n-button>
        </div>
        <div class="shuffle-row">
          <n-checkbox v-model:checked="shuffleEnabled"> 🔀 随机打乱顺序 </n-checkbox>
        </div>
      </div>

      <!-- 文字预览 -->
      <div v-if="selectedWords.length > 0" class="preview-section animate-fade-in">
        <label class="field-label"> 👀 将要听写的文字（{{ selectedWords.length }} 个） </label>
        <div class="preview-tags">
          <n-tag
            v-for="word in selectedWords"
            :key="word.id"
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
import { useRouter } from 'vue-router'
import {
  NInput,
  NInputNumber,
  NButton,
  NTag,
  NTreeSelect,
  NSlider,
  NCheckbox,
  NTooltip,
  useMessage,
} from 'naive-ui'
import type { TreeSelectOption } from 'naive-ui'
import { db, type Word, type SessionWord } from '@/db'

const router = useRouter()
const message = useMessage()

// ============================================================
//  表单数据
// ============================================================

const planName = ref('')
const planNote = ref('')
const selectedPath = ref<string | null>(null)
const wordCount = ref(10)
const startOffset = ref(0)
const shuffleEnabled = ref(false)
const creating = ref(false)

/** 选中层级下的所有可用文字 */
const availableWords = ref<Word[]>([])

/** 上次听写结束的偏移位置（自动计算，用于“续接”按钮） */
const lastSessionOffset = ref(0)

/** 所有层级路径（用于构建树形选择器） */
const allPaths = ref<string[]>([])

// ============================================================
//  计算属性
// ============================================================

/** 从偏移位置开始，剩余可选的文字数量 */
const remainingCount = computed(() => {
  return Math.max(availableWords.value.length - startOffset.value, 0)
})

/**
 * 根据设置选取的文字列表
 *
 * 先根据 startOffset 截取起始位置之后的文字，
 * 再根据 wordCount 截取指定数量。
 * 如开启随机则在截取范围内打乱顺序。
 */
const selectedWords = computed(() => {
  // 先从偏移位置开始截取
  const sliced = availableWords.value.slice(startOffset.value, startOffset.value + wordCount.value)
  const words = [...sliced]

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

/** 是否满足创建条件 */
const canCreate = computed(() => {
  return planName.value.trim() && selectedPath.value && selectedWords.value.length > 0
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
  function cleanEmptyChildren(nodes: TreeSelectOption[]) {
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
async function loadPaths() {
  const allWords = await db.words.toArray()
  const pathSet = new Set<string>()
  for (const word of allWords) {
    pathSet.add(word.path)
  }
  allPaths.value = Array.from(pathSet).sort()
}

/**
 * 层级选择变化时，加载该层级下的所有文字
 *
 * 使用 startsWith 匹配，这样选择父层级时会包含所有子层级的文字
 * 例如选择 "一年级下册" 会匹配到 "一年级下册/识字表 第一单元/第一课" 等所有子路径
 */
async function onPathChange(path: string | null) {
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
  const sessions = await db.dictation_sessions.filter((s) => s.filterPath === path).toArray()

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

// ============================================================
//  创建逻辑
// ============================================================

/**
 * 创建听写计划
 *
 * 将选中的文字信息写入 dictation_sessions 表，
 * 每个字初始状态为 'new'（待听写）
 */
async function handleCreate() {
  if (!canCreate.value) return

  creating.value = true
  try {
    const sessionWords: SessionWord[] = selectedWords.value.map((word) => ({
      wordId: word.id!,
      content: word.content,
      pinyin: word.pinyin,
      status: 'new',
    }))

    await db.dictation_sessions.add({
      name: planName.value.trim(),
      note: planNote.value.trim() || undefined,
      filterPath: selectedPath.value!,
      words: sessionWords,
      status: 'pending',
      createdAt: Date.now(),
    })

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

onMounted(() => {
  loadPaths()
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
