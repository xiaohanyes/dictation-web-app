<template>
  <!--
    首页 - HomePage
    功能：上栏展示待完成的听写计划，下栏展示所有听写记录，均分页
  -->
  <div id="homePage">
    <!-- 欢迎区域 -->
    <section class="hero animate-fade-in">
      <h1 class="hero-title">
        <span class="hero-greeting">开始今天的</span>
        <span class="hero-highlight">听写练习</span>
      </h1>
    </section>

    <!-- 上栏：待完成的听写计划 -->
    <section class="section animate-fade-in-delay-1">
      <div class="section-header">
        <h2 class="section-title">📝 待完成的听写计划</h2>
        <n-button size="small" quaternary type="primary" @click="$router.push('/dictation-plan')">
          ➕ 创建计划
        </n-button>
      </div>

      <div v-if="pendingLoading" class="loading-state">
        <n-spin size="small" />
      </div>

      <div v-else-if="pendingSessions.length === 0" class="empty-hint">
        <span>暂无待完成的计划</span>
      </div>

      <template v-else>
        <div class="card-grid">
          <div
            v-for="session in pendingSessions"
            :key="session.id"
            class="session-card session-card--pending"
            @click="startDictation(session.id!)"
          >
            <div class="session-card-top">
              <n-tag
                :type="session.status === 'in_progress' ? 'warning' : 'info'"
                size="small"
                round
              >
                {{ session.status === 'in_progress' ? '⏳ 进行中' : '📋 待听写' }}
              </n-tag>
              <span class="session-card-time">{{ formatTime(session.createdAt) }}</span>
            </div>
            <h3 class="session-card-name">{{ session.name }}</h3>
            <p v-if="session.note" class="session-card-note">{{ session.note }}</p>
            <div class="session-card-progress">
              <n-progress
                type="line"
                :percentage="getProgress(session).percentage"
                :status="getProgress(session).percentage === 100 ? 'success' : 'default'"
                :height="6"
                :show-indicator="false"
              />
              <span class="progress-text">
                {{ getProgress(session).done }} / {{ session.words.length }}
              </span>
            </div>
            <div class="session-card-stats">
              <span class="stat" title="都会">✅ {{ countStatus(session, 'correct') }}</span>
              <span class="stat" title="模糊">🤔 {{ countStatus(session, 'fuzzy') }}</span>
              <span class="stat" title="不会拼音"
                >🗣️ {{ countStatus(session, 'wrong_pinyin') }}</span
              >
              <span class="stat" title="不会书写"
                >✏️ {{ countStatus(session, 'wrong_writing') }}</span
              >
            </div>
          </div>
        </div>
        <div class="pagination-row">
          <n-pagination
            v-model:page="pendingPage"
            :page-size="pendingPageSize"
            :item-count="pendingTotal"
          />
        </div>
      </template>
    </section>

    <!-- 下栏：所有听写记录 -->
    <section class="section animate-fade-in-delay-1">
      <h2 class="section-title">📊 听写记录</h2>

      <div v-if="allLoading" class="loading-state">
        <n-spin size="small" />
      </div>

      <div v-else-if="allSessions.length === 0" class="empty-hint">
        <span>暂无听写记录</span>
      </div>

      <template v-else>
        <div class="card-grid">
          <div
            v-for="session in allSessions"
            :key="session.id"
            class="session-card"
            @click="startDictation(session.id!)"
          >
            <div class="session-card-top">
              <n-tag :type="statusTagType(session.status)" size="small" round>
                {{ statusLabel(session.status) }}
              </n-tag>
              <span class="session-card-time">{{ formatTime(session.createdAt) }}</span>
            </div>
            <h3 class="session-card-name">{{ session.name }}</h3>
            <p v-if="session.note" class="session-card-note">{{ session.note }}</p>
            <div class="session-card-progress">
              <n-progress
                type="line"
                :percentage="getProgress(session).percentage"
                :status="getProgress(session).percentage === 100 ? 'success' : 'default'"
                :height="6"
                :show-indicator="false"
              />
              <span class="progress-text">
                {{ getProgress(session).done }} / {{ session.words.length }}
              </span>
            </div>
            <div class="session-card-stats">
              <span class="stat" title="都会">✅ {{ countStatus(session, 'correct') }}</span>
              <span class="stat" title="模糊">🤔 {{ countStatus(session, 'fuzzy') }}</span>
              <span class="stat" title="不会拼音"
                >🗣️ {{ countStatus(session, 'wrong_pinyin') }}</span
              >
              <span class="stat" title="不会书写"
                >✏️ {{ countStatus(session, 'wrong_writing') }}</span
              >
            </div>
          </div>
        </div>
        <div class="pagination-row">
          <n-pagination v-model:page="allPage" :page-size="allPageSize" :item-count="allTotal" />
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NSpin, NButton, NTag, NProgress, NPagination } from 'naive-ui'
import { db, type DictationSession, type WordStatus } from '@/db'

const router = useRouter()

// ============================================================
//  待完成计划（上栏）
// ============================================================

const pendingLoading = ref(true)
const pendingSessions = ref<DictationSession[]>([])
const pendingPage = ref(1)
const pendingPageSize = 6
const pendingTotal = ref(0)

async function loadPendingSessions() {
  pendingLoading.value = true
  try {
    // 查询 pending 和 in_progress 状态的记录
    const all = await db.dictation_sessions
      .filter((s) => s.status === 'pending' || s.status === 'in_progress')
      .toArray()

    // 按创建时间倒序排列
    all.sort((a, b) => b.createdAt - a.createdAt)

    pendingTotal.value = all.length

    // 检查分页边界
    const maxPage = Math.ceil(pendingTotal.value / pendingPageSize) || 1
    if (pendingPage.value > maxPage) {
      pendingPage.value = maxPage
      return // watch 会触发重新加载
    }

    const start = (pendingPage.value - 1) * pendingPageSize
    pendingSessions.value = all.slice(start, start + pendingPageSize)
  } finally {
    pendingLoading.value = false
  }
}

// 分页变化时重新加载
watch(pendingPage, () => loadPendingSessions())

// ============================================================
//  所有听写记录（下栏）
// ============================================================

const allLoading = ref(true)
const allSessions = ref<DictationSession[]>([])
const allPage = ref(1)
const allPageSize = 6
const allTotal = ref(0)

async function loadAllSessions() {
  allLoading.value = true
  try {
    const all = await db.dictation_sessions.toArray()

    // 按创建时间倒序排列
    all.sort((a, b) => b.createdAt - a.createdAt)

    allTotal.value = all.length

    // 检查分页边界
    const maxAllPage = Math.ceil(allTotal.value / allPageSize) || 1
    if (allPage.value > maxAllPage) {
      allPage.value = maxAllPage
      return // watch 会触发重新加载
    }

    const start = (allPage.value - 1) * allPageSize
    allSessions.value = all.slice(start, start + allPageSize)
  } finally {
    allLoading.value = false
  }
}

watch(allPage, () => loadAllSessions())

// ============================================================
//  工具函数
// ============================================================

/** 计算听写进度 */
function getProgress(session: DictationSession) {
  const done = session.words.filter((w) => w.status !== 'new').length
  const percentage = session.words.length > 0 ? Math.round((done / session.words.length) * 100) : 0
  return { done, percentage }
}

/** 统计指定状态的字数 */
function countStatus(session: DictationSession, status: WordStatus) {
  return session.words.filter((w) => w.status === status).length
}

/** 格式化时间 */
function formatTime(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 状态标签类型 */
function statusTagType(status: string): 'info' | 'warning' | 'success' {
  if (status === 'in_progress') return 'warning'
  if (status === 'completed') return 'success'
  return 'info'
}

/** 状态文字 */
function statusLabel(status: string) {
  if (status === 'pending') return '📋 待听写'
  if (status === 'in_progress') return '⏳ 进行中'
  return '✅ 已完成'
}

/** 进入听写页面 */
function startDictation(sessionId: number) {
  console.log('startDictation', sessionId)
  router.push({ name: 'dictation', query: { sessionId } })
}

// ============================================================
//  生命周期
// ============================================================

onMounted(async () => {
  await Promise.all([loadPendingSessions(), loadAllSessions()])
})
</script>

<style scoped>
#homePage {
  padding-top: var(--space-lg);
}

/* ---- 欢迎区域 ---- */
.hero {
  text-align: center;
  margin-bottom: var(--space-xl);
}

.hero-title {
  font-family: var(--font-display);
  font-size: 2rem;
  line-height: 1.3;
}

.hero-greeting {
  display: block;
  font-weight: 300;
  color: var(--color-text-secondary);
  font-size: 1.1rem;
}

.hero-highlight {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ---- 章节 ---- */
.section {
  margin-bottom: var(--space-2xl);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.section-title {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--space-lg);
}

.section-header .section-title {
  margin-bottom: 0;
}

/* ---- 卡片网格 ---- */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-lg);
}

.session-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition:
    box-shadow var(--transition-normal),
    transform var(--transition-normal);
  border: 1px solid rgba(242, 153, 74, 0.08);
}

.session-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-3px);
  border-color: rgba(242, 153, 74, 0.2);
}

.session-card--pending {
  border-left: 3px solid var(--color-primary);
}

.session-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}

.session-card-time {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.session-card-name {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--space-xs);
}

.session-card-note {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: var(--space-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-card-progress {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.session-card-progress .n-progress {
  flex: 1;
}

.progress-text {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
  font-weight: 600;
}

.session-card-stats {
  display: flex;
  gap: var(--space-md);
}

.stat {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

/* ---- 空状态/加载 ---- */
.empty-hint {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: var(--space-xl);
}

/* ---- 分页 ---- */
.pagination-row {
  display: flex;
  justify-content: center;
  margin-top: var(--space-lg);
}
</style>
