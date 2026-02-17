<template>
  <!--
    词库管理页 - WordLibraryPage
    两层 UI：
    - 第一层：卡片列表展示每个词库（按层级分组）
    - 第二层：点击卡片后进入该词库的详细文字表格
  -->
  <div id="wordLibraryPage">
    <section class="page-header animate-fade-in">
      <h1 class="page-title">📚 词库管理</h1>
      <p class="page-desc">浏览和管理文字表基础数据</p>
    </section>

    <!-- ==================== 第一层：词库卡片列表 ==================== -->
    <div
      v-if="!activePath"
      class="animate-fade-in-delay-1"
    >
      <div class="toolbar">
        <div class="toolbar-left">
          <n-input
            v-model:value="groupSearch"
            placeholder="搜索词库..."
            clearable
            size="medium"
            style="width: 240px"
          >
            <template #prefix>🔍</template>
          </n-input>
        </div>
        <div class="toolbar-right">
          <n-button
            type="primary"
            size="medium"
            @click="$router.push('/import')"
          >
            📥 导入词库
          </n-button>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-if="filteredGroups.length === 0"
        class="empty-state"
      >
        <div class="empty-icon">📚</div>
        <h3 class="empty-title">还没有词库</h3>
        <p class="empty-desc">点击上方按钮导入你的第一个词库吧！</p>
      </div>

      <!-- 词库卡片网格 -->
      <div v-else>
        <div class="card-grid">
          <div
            v-for="group in paginatedGroups"
            :key="group.path"
            class="library-card"
            @click="enterDetail(group.path)"
          >
            <div class="library-card-top">
              <span class="library-card-icon">📖</span>
              <div
                class="card-actions"
                @click.stop
              >
                <n-dropdown
                  trigger="hover"
                  :options="cardOptions"
                  @select="(key) => handleSelectGroupAction(key, group)"
                >
                  <n-button
                    text
                    style="font-size: 1.2rem"
                  >⋮</n-button>
                </n-dropdown>
              </div>
            </div>
            <div class="library-card-info">
              <n-tag
                size="small"
                round
                :bordered="false"
                type="info"
              > {{ group.count }} 字 </n-tag>
            </div>
            <h3 class="library-card-title">{{ group.displayName }}</h3>
            <p class="library-card-path">{{ group.path }}</p>
          </div>
        </div>

        <!-- 分页 -->
        <div class="pagination-row">
          <n-pagination
            v-model:page="groupPage"
            v-model:page-size="groupPageSize"
            :page-sizes="[12, 24, 36, 48]"
            show-size-picker
            :item-count="filteredGroups.length"
          />
        </div>
      </div>
    </div>

    <!-- ==================== 第二层：文字详情表格 ==================== -->
    <div
      v-else
      class="detail-view animate-fade-in"
    >
      <!-- 面包屑导航 -->
      <div class="breadcrumb">
        <n-button
          text
          type="primary"
          @click="exitDetail"
        > ← 返回词库列表 </n-button>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">{{ activePath }}</span>
      </div>

      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <n-input
            v-model:value="detailSearch"
            placeholder="搜索文字或拼音"
            clearable
            size="medium"
            style="width: 200px"
            @update:value="loadDetailWords"
          >
            <template #prefix>🔍</template>
          </n-input>
        </div>
        <div class="toolbar-right">
          <n-button
            v-if="checkedKeys.length > 0"
            type="error"
            size="medium"
            ghost
            @click="handleBatchDelete"
          >
            🗑️ 删除选中（{{ checkedKeys.length }}）
          </n-button>
          <n-button
            secondary
            type="info"
            size="medium"
            @click="handleExport"
            :disabled="detailWords.length === 0"
          >
            📤 导出 JSON
          </n-button>
          <n-button
            type="primary"
            size="medium"
            @click="openAddModal"
          > ➕ 新增文字 </n-button>
        </div>
      </div>

      <!-- 数据表格 -->
      <n-data-table
        :columns="columns"
        :data="detailWords"
        :pagination="pagination"
        :row-key="(row: Word) => row.id!"
        :loading="detailLoading"
        v-model:checked-row-keys="checkedKeys"
        striped
        class="word-table"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <n-modal
      v-model:show="showModal"
      :title="editingWord ? '编辑文字' : '新增文字'"
      preset="dialog"
      positive-text="保存"
      negative-text="取消"
      :positive-button-props="{ disabled: !canSave }"
      @positive-click="handleSave"
      @negative-click="showModal = false"
      style="width: 480px"
    >
      <div class="modal-form">
        <div class="form-item">
          <label class="form-label">文字</label>
          <n-input
            v-model:value="formData.content"
            placeholder="输入文字"
          />
        </div>
        <div class="form-item">
          <label class="form-label">拼音</label>
          <n-input
            v-model:value="formData.pinyin"
            placeholder="输入拼音"
          />
        </div>
        <div class="form-item">
          <label class="form-label">层级路径</label>
          <n-input
            v-model:value="formData.path"
            placeholder="输入层级路径"
          />
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h, watch } from 'vue'
import {
  NDataTable,
  NButton,
  NInput,
  NModal,
  NTag,
  NSpace,
  NPopconfirm,
  NPagination,
  NDropdown,
  useMessage,
  useDialog,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { db, type Word } from '@/db'

const message = useMessage()
const dialog = useDialog()

// ============================================================
//  第一层：词库分组卡片
// ============================================================

interface WordGroup {
  path: string
  displayName: string
  count: number
}

const allGroups = ref<WordGroup[]>([])
const groupSearch = ref('')

// 分页状态
const groupPage = ref(1)
const groupPageSize = ref(12)

/** 按搜索关键字过滤的词库列表 */
const filteredGroups = computed(() => {
  const s = groupSearch.value.trim().toLowerCase()
  if (!s) return allGroups.value
  return allGroups.value.filter(
    (g) => g.path.toLowerCase().includes(s) || g.displayName.toLowerCase().includes(s),
  )
})

/** 分页后的词库列表 */
const paginatedGroups = computed(() => {
  const start = (groupPage.value - 1) * groupPageSize.value
  return filteredGroups.value.slice(start, start + groupPageSize.value)
})

// 搜索变动时重置分页
watch(groupSearch, () => {
  groupPage.value = 1
})

/** 加载词库分组 */
async function loadGroups () {
  const allWords = await db.words.toArray()
  const map = new Map<string, WordGroup>()

  for (const word of allWords) {
    let group = map.get(word.path)
    if (!group) {
      const parts = word.path.split('/')
      group = {
        path: word.path,
        displayName: parts[parts.length - 1] || word.path,
        count: 0,
      }
      map.set(word.path, group)
    }
    group.count++
  }

  allGroups.value = Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path))
}

const cardOptions = [
  { label: '删除词库', key: 'delete' },
]

function handleSelectGroupAction (key: string, group: WordGroup) {
  if (key === 'delete') {
    handleDeleteGroup(group)
  }
}

function handleDeleteGroup (group: WordGroup) {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除词库「${group.displayName}」吗？这将删除该词库下的所有文字。`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        // 删除该路径下的所有文字
        await db.words.where('path').equals(group.path).delete()
        message.success(`已删除词库「${group.displayName}」`)
        // 重新加载分组
        await loadGroups()
      } catch (err) {
        console.error('删除词库失败:', err)
        message.error('删除词库失败')
      }
    },
  })
}

// ============================================================
//  第二层：文字详情表格
// ============================================================

/** 当前选中的词库路径，null 表示在第一层 */
const activePath = ref<string | null>(null)
const detailLoading = ref(false)
const detailWords = ref<Word[]>([])
const detailSearch = ref('')
const checkedKeys = ref<number[]>([])

/** 弹窗相关 */
const showModal = ref(false)
const editingWord = ref<Word | null>(null)
const formData = ref({ content: '', pinyin: '', path: '' })

const pagination = ref({
  page: 1,
  pageSize: 20,
  pageSizes: [10, 20, 50, 100],
  showSizePicker: true,
  prefix: ({ itemCount }: { itemCount?: number }) => `共 ${itemCount ?? 0} 条`,
  onChange: (page: number) => {
    pagination.value.page = page
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.value.pageSize = pageSize
    pagination.value.page = 1
  },
})

/** 表格列定义 */
const columns = computed<DataTableColumns<Word>>(() => [
  { type: 'selection' },
  {
    title: '文字',
    key: 'content',
    width: 100,
    render: (row) => h(NTag, { type: 'info', bordered: false, round: true }, () => row.content),
  },
  { title: '拼音', key: 'pinyin', width: 120 },
  { title: '层级路径', key: 'path', ellipsis: { tooltip: true } },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 170,
    render: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
    sorter: (a, b) => a.createdAt - b.createdAt,
  },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    render: (row) =>
      h(NSpace, { size: 'small' }, () => [
        h(
          NButton,
          { size: 'small', quaternary: true, type: 'primary', onClick: () => openEditModal(row) },
          () => '✏️ 编辑',
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row.id!) },
          {
            trigger: () =>
              h(NButton, { size: 'small', quaternary: true, type: 'error' }, () => '🗑️ 删除'),
            default: () => `确定删除「${row.content}」吗？`,
          },
        ),
      ]),
  },
])

const canSave = computed(() => {
  return formData.value.content.trim() && formData.value.pinyin.trim() && formData.value.path.trim()
})

// ============================================================
//  导航操作
// ============================================================

function enterDetail (path: string) {
  activePath.value = path
  detailSearch.value = ''
  checkedKeys.value = []
  // 重置分页
  pagination.value.page = 1
  loadDetailWords()
}

function exitDetail () {
  activePath.value = null
  loadGroups()
}

// ============================================================
//  数据加载
// ============================================================

async function loadDetailWords () {
  if (!activePath.value) return
  detailLoading.value = true
  try {
    const path = activePath.value
    let words = await db.words.where('path').equals(path).toArray()

    const search = detailSearch.value.trim().toLowerCase()
    if (search) {
      words = words.filter(
        (w) => w.content.toLowerCase().includes(search) || w.pinyin.toLowerCase().includes(search),
      )
    }

    detailWords.value = words
    checkedKeys.value = []
  } finally {
    detailLoading.value = false
  }
}

// ============================================================
//  CRUD 操作
// ============================================================

function openAddModal () {
  editingWord.value = null
  formData.value = { content: '', pinyin: '', path: activePath.value || '' }
  showModal.value = true
}

function openEditModal (word: Word) {
  editingWord.value = word
  formData.value = { content: word.content, pinyin: word.pinyin, path: word.path }
  showModal.value = true
}

async function handleSave () {
  if (!canSave.value) return false
  try {
    const data = {
      content: formData.value.content.trim(),
      pinyin: formData.value.pinyin.trim(),
      path: formData.value.path.trim(),
    }

    if (editingWord.value) {
      await db.words.update(editingWord.value.id!, data)
      message.success('修改成功')
    } else {
      await db.words.add({ ...data, createdAt: Date.now() })
      message.success('新增成功')
    }

    showModal.value = false
    await loadDetailWords()
  } catch (err) {
    console.error('保存失败:', err)
    message.error('保存失败')
    return false
  }
}

async function handleDelete (id: number) {
  try {
    await db.words.delete(id)
    message.success('删除成功')
    await loadDetailWords()
  } catch (err) {
    console.error('删除失败:', err)
    message.error('删除失败')
  }
}

async function handleBatchDelete () {
  if (checkedKeys.value.length === 0) return
  try {
    await db.words.bulkDelete(checkedKeys.value)
    message.success(`成功删除 ${checkedKeys.value.length} 条数据`)
    checkedKeys.value = []
    await loadDetailWords()
  } catch (err) {
    console.error('批量删除失败:', err)
    message.error('批量删除失败')
  }
}

async function handleExport () {
  if (!activePath.value || detailWords.value.length === 0) return

  try {
    const parts = activePath.value.split('/')
    let className = parts.pop() || 'DefaultClass'
    let unitName = parts.length > 0 ? parts.join('/') : 'DefaultUnit'

    // 如果 activePath 只有一级 (e.g. "一年级"), split 后 parts=[], className="一年级", unitName="DefaultUnit"
    // 为了更友好，这种情况下可以保留 unitName 为空或者设为 "Root"
    if (unitName === 'DefaultUnit' && className !== 'DefaultClass') {
      // do nothing or adjust strategy
    }

    // 构造符合 ImportPage 导入格式的 JSON
    const jsonData = {
      unit: unitName,
      content: [
        {
          class: className,
          chars: detailWords.value.map((w) => ({
            char: w.content,
            pinyin: w.pinyin,
          })),
        },
      ],
    }

    // 触发下载
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${className}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    message.success('导出成功')
  } catch (err) {
    console.error('导出失败:', err)
    message.error('导出失败')
  }
}

// ============================================================
//  生命周期
// ============================================================

onMounted(() => {
  loadGroups()
})
</script>

<style scoped>
#wordLibraryPage {
  padding-top: var(--space-lg);
}

.page-header {
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

/* ---- 工具栏 ---- */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  flex-wrap: wrap;
  gap: var(--space-md);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

/* ---- 词库卡片网格 ---- */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-lg);
}

.library-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition:
    box-shadow var(--transition-normal),
    transform var(--transition-normal);
  border: 1px solid rgba(242, 153, 74, 0.08);
}

.library-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-4px);
  border-color: rgba(242, 153, 74, 0.2);
}

.library-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-xs);
}

.card-actions {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.library-card:hover .card-actions {
  opacity: 1;
}

.library-card-info {
  margin-bottom: var(--space-md);
}

.library-card-icon {
  font-size: 1.5rem;
}

.library-card-title {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--space-xs);
}

.library-card-path {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

/* ---- 详情视图 ---- */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
  font-size: 0.9rem;
}

.breadcrumb-sep {
  color: var(--color-text-muted);
}

.breadcrumb-current {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.word-table {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

/* ---- 弹窗表单 ---- */
.modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding-top: var(--space-md);
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.form-label {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-text-primary);
}

/* ---- 空状态 ---- */
.empty-state {
  text-align: center;
  padding: var(--space-3xl) var(--space-lg);
}

.empty-icon {
  font-size: 3.5rem;
  margin-bottom: var(--space-md);
  animation: float 3s ease-in-out infinite;
}

@keyframes float {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-8px);
  }
}

.empty-title {
  font-family: var(--font-display);
  font-size: 1.3rem;
  margin-bottom: var(--space-sm);
  color: var(--color-text-primary);
}

.empty-desc {
  color: var(--color-text-muted);
  margin-bottom: var(--space-xl);
}

/* ---- 分页 ---- */
.pagination-row {
  display: flex;
  justify-content: center;
  margin-top: var(--space-lg);
}
</style>
