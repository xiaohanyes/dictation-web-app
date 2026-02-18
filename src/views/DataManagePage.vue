<template>
  <!--
    数据管理页 - DataManagePage
    功能：
    1. 批量导入文字数据 (JSON Import)
    2. 数据库备份与恢复 (Database Backup/Restore)
  -->
  <div id="dataManagePage">
    <section class="page-header animate-fade-in">
      <h1 class="page-title">数据管理</h1>
      <p class="page-desc">管理您的词库和听写记录数据</p>
    </section>

    <div class="page-body animate-fade-in-delay-1">
      <n-tabs
        type="line"
        animated
        size="large"
      >
        <!-- Tab 1: 文字导入 (原功能) -->
        <n-tab-pane
          name="import-words"
          tab="📥 文字导入"
        >
          <div class="tab-content">
            <div class="form-section">
              <label class="field-label">📂 层级前缀（可选）</label>
              <n-input
                v-model:value="levelPrefix"
                placeholder="例如：一年级下册"
                size="large"
                clearable
              >
                <template #prefix>
                  <span class="input-prefix-icon">📁</span>
                </template>
              </n-input>
              <p class="field-hint">
                最终层级格式：<strong>{{ levelPrefix ? `${levelPrefix} / ` : '' }}unit / class</strong>
              </p>
            </div>

            <div class="form-section">
              <label class="field-label">📝 JSON 数据</label>
              <n-tabs
                v-model:value="inputMode"
                type="segment"
                animated
              >
                <n-tab-pane
                  name="file"
                  tab="📁 文件上传"
                >
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

                <n-tab-pane
                  name="text"
                  tab="✏️ 直接输入"
                >
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
            <n-alert
              v-if="parseError"
              type="error"
              :title="parseError"
              class="animate-fade-in"
            />

            <!-- 预览区域 -->
            <div
              v-if="parsedEntries.length > 0"
              class="preview-section animate-fade-in"
            >
              <label class="field-label">
                👀 预览（{{ parsedEntries.length }} 个文字，{{ uniquePaths.length }} 个层级）
              </label>

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
                        <span
                          v-if="entry.isDuplicate"
                          class="tag-badge"
                        >⚠️</span>
                      </template>
                    </n-tag>
                  </div>
                </n-collapse-item>
              </n-collapse>

              <p
                v-if="duplicateCount > 0"
                class="duplicate-hint"
              >
                ⚠️ {{ duplicateCount }} 个文字已存在于对应层级下，导入时将自动跳过
              </p>
            </div>

            <div class="action-section">
              <n-button
                type="primary"
                size="large"
                round
                :disabled="newEntriesCount === 0"
                :loading="importing"
                @click="handleImport"
              >
                ✨ 导入 {{ newEntriesCount }} 个文字
              </n-button>
            </div>
          </div>
        </n-tab-pane>

        <!-- Tab 2: 数据库备份 (新功能) -->
        <n-tab-pane
          name="backup-restore"
          tab="📦 数据库备份"
        >
          <div class="tab-content backup-content">
            <!-- 导出部分 -->
            <div class="backup-card">
              <div class="card-header">
                <span class="card-icon">📤</span>
                <h3 class="card-title">数据备份</h3>
              </div>
              <p class="card-desc">
                将当前所有词库和听写记录导出为 JSON 文件。建议定期备份以防数据丢失。
              </p>
              <n-button
                type="info"
                ghost
                size="large"
                @click="exportDatabase"
              >
                下载备份文件 (.json)
              </n-button>
            </div>

            <n-divider />

            <!-- 导入部分 -->
            <div class="backup-card">
              <div class="card-header">
                <span class="card-icon">📥</span>
                <h3 class="card-title">数据恢复</h3>
              </div>
              <p class="card-desc">
                从备份文件恢复数据。<br />
                <span class="text-danger">注意：恢复操作将清空当前所有数据！</span>
              </p>

              <n-upload
                accept=".json"
                :show-file-list="false"
                :custom-request="importDatabase"
              >
                <n-button
                  type="warning"
                  size="large"
                >
                  选择备份文件并恢复
                </n-button>
              </n-upload>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
  useDialog,
  NDivider,
} from 'naive-ui'
import type { UploadCustomRequestOptions, UploadFileInfo } from 'naive-ui'
import { db, type Word, type DictationSession } from '@/db'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()

// ============================================================
//  Tab 1: 文字导入逻辑 (复用原有逻辑)
// ============================================================

const levelPrefix = ref('')
const inputMode = ref<'file' | 'text'>('file')
const rawJsonText = ref('')
const parseError = ref('')
const importing = ref(false)
const importedData = ref<JsonUnitData[]>([])

// JSON 接口定义
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

// 解析结果接口
interface ParsedEntry {
  content: string
  pinyin: string
  path: string
  isDuplicate: boolean
}

const parsedEntries = ref<ParsedEntry[]>([])
const existingSet = ref<Set<string>>(new Set())

const uniquePaths = computed(() => {
  const paths = new Set(parsedEntries.value.map((e) => e.path))
  return Array.from(paths)
})

const duplicateCount = computed(() => {
  return parsedEntries.value.filter((e) => e.isDuplicate).length
})

const newEntriesCount = computed(() => {
  return parsedEntries.value.filter((e) => !e.isDuplicate).length
})

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
})

watch([importedData, levelPrefix], () => {
  updateParsedEntries()
})

async function updateParsedEntries () {
  if (importedData.value.length === 0) {
    parsedEntries.value = []
    return
  }

  const prefix = levelPrefix.value.trim()
  const entries: ParsedEntry[] = []

  for (const data of importedData.value) {
    const unit = data.unit
    for (const classItem of data.content) {
      const path = prefix
        ? `${prefix}/${unit}/${classItem.class}`
        : `${unit}/${classItem.class}`

      for (const charItem of classItem.chars) {
        entries.push({
          content: charItem.char,
          pinyin: charItem.pinyin,
          path,
          isDuplicate: false,
        })
      }
    }
  }
  await markDuplicates(entries)
  parsedEntries.value = entries
}

async function handleFileChange (options: { fileList: UploadFileInfo[] }) {
  parseError.value = ''
  parsedEntries.value = []

  const allData: JsonUnitData[] = []
  for (const fileInfo of options.fileList) {
    if (!fileInfo.file) continue
    try {
      const text = await readFileAsText(fileInfo.file)
      const data = JSON.parse(text)
      const items: JsonUnitData[] = Array.isArray(data) ? data : [data]
      for (const item of items) {
        validateJsonStructure(item)
        allData.push(item)
      }
    } catch (err: any) {
      parseError.value = `文件 "${fileInfo.name}" 解析失败：${err.message}`
      return
    }
  }
  importedData.value = allData
}

async function parseTextInput () {
  parseError.value = ''
  parsedEntries.value = []
  const text = rawJsonText.value.trim()
  if (!text) return

  try {
    const data = JSON.parse(text)
    const items: JsonUnitData[] = Array.isArray(data) ? data : [data]
    const allData: JsonUnitData[] = []
    for (const item of items) {
      validateJsonStructure(item)
      allData.push(item)
    }
    importedData.value = allData
  } catch (err: any) {
    parseError.value = `JSON 解析失败：${err.message}`
  }
}

function validateJsonStructure (data: any): asserts data is JsonUnitData {
  if (!data || typeof data !== 'object') throw new Error('JSON 应该是一个对象')
  if (typeof data.unit !== 'string') throw new Error('缺少 "unit" 字段')
  if (!Array.isArray(data.content)) throw new Error('缺少 "content" 字段')
  // ... (简化校验逻辑，保持健壮性即可)
}

function readFileAsText (file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

async function markDuplicates (entries: ParsedEntry[]) {
  const paths = new Set(entries.map((e) => e.path))
  const set = new Set<string>()
  for (const path of paths) {
    const existing = await db.words.where('path').equals(path).toArray()
    for (const w of existing) {
      set.add(`${w.path}|${w.content}|${w.pinyin}`)
    }
  }
  existingSet.value = set
  for (const entry of entries) {
    entry.isDuplicate = set.has(`${entry.path}|${entry.content}|${entry.pinyin}`)
  }
}

async function handleImport () {
  if (newEntriesCount.value === 0) return
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
    router.push('/')
  } catch (err) {
    console.error('导入失败:', err)
    message.error('导入失败，请重试')
  } finally {
    importing.value = false
  }
}

// ============================================================
//  Tab 2: 数据库备份/恢复逻辑
// ============================================================

interface BackupData {
  version: number
  timestamp: number
  type: 'full_backup'
  appVersion: string
  words: Word[]
  sessions: DictationSession[]
}

/** 导出数据库 */
async function exportDatabase () {
  try {
    const words = await db.words.toArray()
    const sessions = await db.dictation_sessions.toArray()

    const backupData: BackupData = {
      version: 1,
      timestamp: Date.now(),
      type: 'full_backup',
      appVersion: '1.0.0', // 可选：从 package.json 读取
      words,
      sessions,
    }

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // 文件名格式：dictation-backup-YYYYMMDD-HHMM.json
    const dateStr = new Date().toISOString().replace(/[:T-]/g, '').slice(0, 12)
    a.download = `dictation-backup-${dateStr}.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success('备份文件导出成功！')
  } catch (err) {
    console.error('导出失败:', err)
    message.error('导出失败')
  }
}

/** 导入数据库 */
async function importDatabase (options: UploadCustomRequestOptions) {
  const { file } = options

  // 确认对话框
  dialog.warning({
    title: '⚠️ 警告：覆盖数据',
    content: '此操作将清空当前应用内的所有数据（词库和听写记录），并使用备份文件的数据进行覆盖。\n\n该操作不可撤销！确定要继续吗？',
    positiveText: '确定覆盖并恢复',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const text = await readFileAsText(file.file as File)
        const data = JSON.parse(text) as BackupData

        // 简单校验
        if (data.type !== 'full_backup' || !Array.isArray(data.words) || !Array.isArray(data.sessions)) {
          message.error('无效的备份文件格式')
          return
        }

        // 执行恢复
        await db.transaction('rw', db.words, db.dictation_sessions, async () => {
          await db.words.clear()
          await db.dictation_sessions.clear()

          if (data.words.length > 0) await db.words.bulkAdd(data.words)
          if (data.sessions.length > 0) await db.dictation_sessions.bulkAdd(data.sessions)
        })

        message.success(`恢复成功！已还原 ${data.words.length} 个文字和 ${data.sessions.length} 条记录。`)

        // 刷新页面以确保所有状态重置
        setTimeout(() => {
          location.reload()
        }, 1500)

      } catch (err: any) {
        console.error('恢复失败:', err)
        message.error(`恢复失败: ${err.message}`)
      }
    }
  })
}

</script>

<style scoped>
#dataManagePage {
  padding-top: var(--space-lg);
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: var(--space-xl);
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

/* ---- 通用样式 ---- */
.tab-content {
  padding-top: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
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

/* ---- 备份/恢复卡片样式 ---- */
.backup-content {
  max-width: 600px;
  margin: 0 auto;
}

.backup-card {
  padding: var(--space-md);
  text-align: center;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.card-icon {
  font-size: 1.5rem;
}

.card-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
}

.card-desc {
  color: var(--color-text-secondary);
  font-size: 0.95rem;
  margin-bottom: var(--space-lg);
  line-height: 1.5;
}

.text-danger {
  color: var(--color-error);
  font-weight: 600;
}

/* ---- 预览与操作 ---- */
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

.action-section {
  display: flex;
  justify-content: center;
  padding-top: var(--space-md);
}

.json-upload {
  margin-top: var(--space-sm);
}

.upload-icon {
  font-size: 2.5rem;
  margin-bottom: var(--space-sm);
}
</style>
