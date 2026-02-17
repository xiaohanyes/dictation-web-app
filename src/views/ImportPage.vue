<template>
  <!--
    导入页 - ImportPage
    功能：支持 JSON 文件上传或直接粘贴 JSON 内容，批量导入文字数据
    设计：用户输入层级前缀 + JSON 内容/文件 → 预览 → 导入
  -->
  <div id="importPage">
    <section class="import-header animate-fade-in">
      <h1 class="page-title">📥 JSON 批量导入</h1>
      <p class="page-desc">上传 JSON 文件或直接粘贴 JSON 内容，批量导入文字数据</p>
    </section>

    <div class="import-body animate-fade-in-delay-1">
      <!-- 层级前缀输入 -->
      <div class="form-section">
        <label class="field-label">📂 层级前缀（必填）</label>
        <n-input v-model:value="levelPrefix" placeholder="例如：一年级下册" size="large" clearable>
          <template #prefix>
            <span class="input-prefix-icon">📁</span>
          </template>
        </n-input>
        <p class="field-hint">
          最终层级格式：<strong>{{ levelPrefix || '前缀' }} / unit / class</strong>
        </p>
      </div>

      <!-- JSON 输入方式切换 -->
      <div class="form-section">
        <label class="field-label">📝 JSON 数据</label>
        <n-tabs v-model:value="inputMode" type="segment" animated>
          <!-- Tab 1: 文件上传 -->
          <n-tab-pane name="file" tab="📁 文件上传">
            <n-upload
              accept=".json"
              :max="10"
              :default-upload="false"
              @change="handleFileChange"
              class="json-upload"
            >
              <n-upload-dragger>
                <div class="upload-icon">📄</div>
                <p class="upload-text">点击或拖拽 JSON 文件到此处</p>
                <p class="upload-hint">支持同时上传多个 .json 文件</p>
              </n-upload-dragger>
            </n-upload>
          </n-tab-pane>

          <!-- Tab 2: 直接输入 -->
          <n-tab-pane name="text" tab="✏️ 直接输入">
            <n-input
              v-model:value="rawJsonText"
              type="textarea"
              placeholder='粘贴 JSON 内容，格式如：&#10;{&#10;  "unit": "识字表 第一单元",&#10;  "content": [&#10;    { "class": "第一课", "chars": [{ "char": "霜", "pinyin": "shuāng" }] }&#10;  ]&#10;}'
              :rows="12"
              size="large"
              @blur="parseTextInput"
            />
          </n-tab-pane>
        </n-tabs>
      </div>

      <!-- 解析错误提示 -->
      <n-alert v-if="parseError" type="error" :title="parseError" class="animate-fade-in" />

      <!-- 预览区域 -->
      <div v-if="parsedEntries.length > 0" class="preview-section animate-fade-in">
        <label class="field-label">
          👀 预览（{{ parsedEntries.length }} 个文字，{{ uniquePaths.length }} 个层级）
        </label>

        <!-- 层级分组展示 -->
        <n-collapse>
          <n-collapse-item
            v-for="group in groupedPreview"
            :key="group.path"
            :title="`📂 ${group.path}（${group.entries.length} 字）`"
          >
            <div class="preview-tags">
              <n-tag
                v-for="(entry, idx) in group.entries"
                :key="idx"
                size="medium"
                round
                :bordered="false"
                :type="entry.isDuplicate ? 'warning' : 'success'"
              >
                {{ entry.content }}
                <template #avatar>
                  <span v-if="entry.isDuplicate" class="tag-badge">⚠️</span>
                </template>
              </n-tag>
            </div>
          </n-collapse-item>
        </n-collapse>

        <p v-if="duplicateCount > 0" class="duplicate-hint">
          ⚠️ {{ duplicateCount }} 个文字已存在于对应层级下，导入时将自动跳过
        </p>
      </div>

      <!-- 操作按钮 -->
      <div class="action-section">
        <n-button
          type="primary"
          size="large"
          round
          :disabled="newEntriesCount === 0 || !levelPrefix.trim()"
          :loading="importing"
          @click="handleImport"
        >
          ✨ 导入 {{ newEntriesCount }} 个文字
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  NInput,
  NButton,
  NTag,
  NTabs,
  NTabPane,
  NUpload,
  NUploadDragger,
  NAlert,
  NCollapse,
  NCollapseItem,
  useMessage,
} from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import { db, type Word } from '@/db'

const router = useRouter()
const message = useMessage()

// ============================================================
//  表单数据
// ============================================================

/** 用户输入的层级前缀，如"一年级下册" */
const levelPrefix = ref('')

/** JSON 输入方式：file-文件上传, text-直接输入 */
const inputMode = ref<'file' | 'text'>('file')

/** 直接输入的 JSON 文本 */
const rawJsonText = ref('')

/** 解析错误信息 */
const parseError = ref('')

/** 导入中状态 */
const importing = ref(false)

// ============================================================
//  JSON 格式定义
// ============================================================

/**
 * JSON 数据格式 —— 与架构计划书中的格式对应
 *
 * 一个 JSON 对象包含一个 unit（如"识字表 第一单元"），
 * unit 下有多个 class（如"第一课"），每个 class 下有多个 chars。
 */
interface JsonCharEntry {
  char: string
  pinyin: string
}

interface JsonClassEntry {
  class: string
  chars: JsonCharEntry[]
}

interface JsonUnitData {
  unit: string
  content: JsonClassEntry[]
}

// ============================================================
//  解析结果
// ============================================================

/** 解析后的单条文字信息 */
interface ParsedEntry {
  content: string
  pinyin: string
  path: string
  isDuplicate: boolean
}

/** 解析后的文字列表 */
const parsedEntries = ref<ParsedEntry[]>([])

/** 已存在的文字集合（key = path + '|' + content） */
const existingSet = ref<Set<string>>(new Set())

/** 去重后能唯一识别的层级路径 */
const uniquePaths = computed(() => {
  const paths = new Set(parsedEntries.value.map((e) => e.path))
  return Array.from(paths)
})

/** 重复数量 */
const duplicateCount = computed(() => {
  return parsedEntries.value.filter((e) => e.isDuplicate).length
})

/** 实际可导入的文字数量 */
const newEntriesCount = computed(() => {
  return parsedEntries.value.filter((e) => !e.isDuplicate).length
})

/** 按层级分组的预览数据 */
const groupedPreview = computed(() => {
  const map = new Map<string, ParsedEntry[]>()
  for (const entry of parsedEntries.value) {
    if (!map.has(entry.path)) {
      map.set(entry.path, [])
    }
    map.get(entry.path)!.push(entry)
  }
  return Array.from(map.entries())
    .map(([path, entries]) => ({ path, entries }))
    .sort((a, b) => a.path.localeCompare(b.path))
})

// ============================================================
//  解析逻辑
// ============================================================

/**
 * 解析单个 JSON 数据对象
 *
 * 将 JSON 中的 unit/class/chars 结构转换为扁平的 ParsedEntry 数组
 * 层级拼接规则：用户前缀 / unit / class
 */
function parseJsonData(data: JsonUnitData): ParsedEntry[] {
  const prefix = levelPrefix.value.trim()
  if (!prefix) return []

  const entries: ParsedEntry[] = []
  const unit = data.unit

  for (const classItem of data.content) {
    // 拼接层级：前缀/unit/class
    const path = `${prefix}/${unit}/${classItem.class}`

    for (const charItem of classItem.chars) {
      const key = `${path}|${charItem.char}`
      entries.push({
        content: charItem.char,
        pinyin: charItem.pinyin,
        path,
        isDuplicate: existingSet.value.has(key),
      })
    }
  }

  return entries
}

/**
 * 处理文件上传变化
 *
 * 读取所有上传的 JSON 文件并解析。
 * 使用 FileReader API 读取文件内容，然后 JSON.parse 解析。
 */
async function handleFileChange(options: { fileList: UploadFileInfo[] }) {
  parseError.value = ''
  parsedEntries.value = []

  if (!levelPrefix.value.trim()) {
    parseError.value = '请先输入层级前缀'
    return
  }

  const allEntries: ParsedEntry[] = []

  for (const fileInfo of options.fileList) {
    if (!fileInfo.file) continue

    try {
      const text = await readFileAsText(fileInfo.file)
      const data = JSON.parse(text)

      // 支持单个对象或数组格式
      const items: JsonUnitData[] = Array.isArray(data) ? data : [data]
      for (const item of items) {
        validateJsonStructure(item)
        allEntries.push(...parseJsonData(item))
      }
    } catch (err: any) {
      parseError.value = `文件 "${fileInfo.name}" 解析失败：${err.message}`
      return
    }
  }

  // 查询已存在的数据，用于标记重复
  await markDuplicates(allEntries)
  parsedEntries.value = allEntries
}

/**
 * 解析直接输入的 JSON 文本
 */
async function parseTextInput() {
  parseError.value = ''
  parsedEntries.value = []

  const text = rawJsonText.value.trim()
  if (!text) return

  if (!levelPrefix.value.trim()) {
    parseError.value = '请先输入层级前缀'
    return
  }

  try {
    const data = JSON.parse(text)
    const items: JsonUnitData[] = Array.isArray(data) ? data : [data]
    const allEntries: ParsedEntry[] = []

    for (const item of items) {
      validateJsonStructure(item)
      allEntries.push(...parseJsonData(item))
    }

    await markDuplicates(allEntries)
    parsedEntries.value = allEntries
  } catch (err: any) {
    parseError.value = `JSON 解析失败：${err.message}`
  }
}

/**
 * 校验 JSON 结构是否符合预期格式
 *
 * 确保包含 unit（字符串）和 content（数组），
 * 每个 content 项包含 class（字符串）和 chars（数组），
 * 每个 chars 项包含 char 和 pinyin。
 */
function validateJsonStructure(data: any): asserts data is JsonUnitData {
  if (!data || typeof data !== 'object') {
    throw new Error('JSON 应该是一个对象')
  }
  if (typeof data.unit !== 'string') {
    throw new Error('缺少 "unit" 字段（字符串类型）')
  }
  if (!Array.isArray(data.content)) {
    throw new Error('缺少 "content" 字段（数组类型）')
  }
  for (const item of data.content) {
    if (typeof item.class !== 'string') {
      throw new Error('content 项缺少 "class" 字段（字符串类型）')
    }
    if (!Array.isArray(item.chars)) {
      throw new Error(`"${item.class}" 中缺少 "chars" 字段（数组类型）`)
    }
    for (const c of item.chars) {
      if (typeof c.char !== 'string') {
        throw new Error(`"${item.class}" 中 chars 项缺少 "char" 字段`)
      }
      if (typeof c.pinyin !== 'string') {
        throw new Error(`"${item.class}" 中 chars 项 "${c.char}" 缺少 "pinyin" 字段`)
      }
    }
  }
}

/**
 * 读取文件内容为文本
 * 使用 FileReader API 的 Promise 封装
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

/**
 * 查询数据库中已存在的文字，标记重复项
 *
 * 从待导入数据中提取所有涉及的路径，查询这些路径下已有的文字，
 * 然后对每条数据标记是否重复（同一路径下同一文字）
 */
async function markDuplicates(entries: ParsedEntry[]) {
  const paths = new Set(entries.map((e) => e.path))
  const set = new Set<string>()

  for (const path of paths) {
    const existing = await db.words.where('path').equals(path).toArray()
    for (const w of existing) {
      set.add(`${w.path}|${w.content}`)
    }
  }

  existingSet.value = set

  // 更新每条记录的重复标记
  for (const entry of entries) {
    entry.isDuplicate = set.has(`${entry.path}|${entry.content}`)
  }
}

// ============================================================
//  导入逻辑
// ============================================================

/**
 * 执行批量导入
 *
 * 将解析后的非重复文字数据批量写入 words 表。
 * 使用 Dexie 的 bulkAdd 实现高效批量写入。
 */
async function handleImport() {
  if (!levelPrefix.value.trim() || newEntriesCount.value === 0) return

  importing.value = true
  try {
    const now = Date.now()

    const newWords: Word[] = parsedEntries.value
      .filter((e) => !e.isDuplicate)
      .map((entry) => ({
        content: entry.content,
        pinyin: entry.pinyin,
        path: entry.path,
        createdAt: now,
      }))

    await db.words.bulkAdd(newWords)
    message.success(`成功导入 ${newWords.length} 个文字！`)

    // 导入成功后跳转首页
    router.push('/')
  } catch (err) {
    console.error('导入失败:', err)
    message.error('导入失败，请重试')
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
#importPage {
  padding-top: var(--space-lg);
}

.import-header {
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
.import-body {
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

.input-prefix-icon {
  margin-right: 4px;
}

/* ---- 文件上传区域 ---- */
.json-upload {
  margin-top: var(--space-sm);
}

.upload-icon {
  font-size: 2.5rem;
  margin-bottom: var(--space-sm);
}

.upload-text {
  font-size: 0.95rem;
  color: var(--color-text-primary);
  font-weight: 500;
}

.upload-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: var(--space-xs);
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
  padding: var(--space-sm) 0;
}

.tag-badge {
  margin-right: 2px;
}

.duplicate-hint {
  margin-top: var(--space-md);
  font-size: 0.8rem;
  color: var(--color-accent-yellow);
}

/* ---- 操作按钮 ---- */
.action-section {
  display: flex;
  justify-content: center;
  padding-top: var(--space-md);
}
</style>
