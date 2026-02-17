<template>
  <n-modal
    v-model:show="show"
    preset="card"
    class="hanzi-modal"
    :title="title"
    size="huge"
    :bordered="false"
    :mask-closable="false"
    :mask-style="{ backgroundColor: 'rgba(0,0,0,0.95)' }"
  >
    <div class="practice-container">
      <!-- 顶部信息 -->
      <div class="word-info">
        <div class="pinyin">{{ currentPinyin }}</div>
        <div class="progress">
          进度: {{ currentIndex + 1 }} / {{ words.length }}
        </div>
      </div>

      <!-- 汉字书写区域 -->
      <div class="canvas-wrapper">
        <div
          ref="writerTarget"
          class="writer-target"
        ></div>
        <div
          v-if="loading"
          class="loading-overlay"
        >
          <n-spin size="large" />
        </div>
        <div
          v-if="quizStatus"
          :class="['quiz-status', quizStatus.type]"
        >
          {{ quizStatus.text }}
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="controls">
        <n-space
          justify="center"
          size="large"
        >
          <n-button
            @click="animate"
            :disabled="loading || isQuizzing"
          >
            🎥 播放笔顺
          </n-button>
          <n-button
            :type="isQuizzing ? 'error' : 'primary'"
            @click="toggleQuiz"
            :disabled="loading"
          >
            {{ isQuizzing ? '❌ 取消测试' : '✍️ 书写测试' }}
          </n-button>
          <n-button
            type="info"
            ghost
            @click="toggleOutline"
            :disabled="loading"
          >
            {{ showOutline ? '🙈 隐藏轮廓' : '👁️ 显示轮廓' }}
          </n-button>
        </n-space>
      </div>

      <!-- 底部导航 -->
      <div class="footer-nav">
        <n-button
          @click="prev"
          :disabled="currentIndex === 0 || isQuizzing"
        >
          ⬅️ 上一个
        </n-button>
        <n-button @click="close">
          ❌ 结束练习
        </n-button>
        <n-button
          @click="next"
          :disabled="currentIndex === words.length - 1 || isQuizzing"
          type="primary"
        >
          下一个 ➡️
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import HanziWriter from 'hanzi-writer'
import { NModal, NButton, NSpace, NSpin, useMessage } from 'naive-ui'

interface Props {
  visible: boolean
  words: { char: string; pinyin: string }[] // 传入文字对象数组
}

const props = defineProps<Props>()
const emit = defineEmits(['update:visible'])

const message = useMessage()

// 状态
const currentIndex = ref(0)
const writerTarget = ref<HTMLElement | null>(null)
const loading = ref(false)
const writerInstance = ref<HanziWriter | null>(null)
const isQuizzing = ref(false)
const showOutline = ref(true)
const quizStatus = ref<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

// 计算属性
const show = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const currentWord = computed(() => props.words[currentIndex.value])
const currentChar = computed(() => currentWord.value?.char || '')
const currentPinyin = computed(() => currentWord.value?.pinyin || '')
const title = computed(() => isQuizzing.value ? '📝 书写测试' : `📝 错题练习：${currentChar.value}`)

// 监听显隐和当前字变化
watch(
  () => [props.visible, currentIndex.value],
  async ([newVisible]) => {
    if (newVisible) {
      await nextTick()
      initWriter()
    }
  }
)

// 初始化 Writer
async function initWriter () {
  if (!writerTarget.value || !currentChar.value) return

  // 清理旧实例
  if (writerInstance.value) {
    // 似乎没有显式的 destroy 方法，但重新 create 会覆盖 innerHTML
    // 可以把 target 的 innerHTML 清空
    writerTarget.value.innerHTML = ''
    writerInstance.value = null
  }

  loading.value = true
  quizStatus.value = null
  isQuizzing.value = false

  try {
    writerInstance.value = HanziWriter.create(writerTarget.value, currentChar.value, {
      width: 300,
      height: 300,
      padding: 20,
      showOutline: showOutline.value,
      strokeAnimationSpeed: 1, // 动画速度
      delayBetweenStrokes: 200, // 笔画间隔
      charDataLoader: (char, onComplete) => {
        // 使用 jsdelivr CDN
        fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${char}.json`)
          .then(res => res.json())
          .then(onComplete)
          .catch(() => {
            loading.value = false
            message.error('汉字数据加载失败')
          })
      },
      onLoadCharDataSuccess: () => {
        loading.value = false
        // 加载完成后自动播放一次
        writerInstance.value?.animateCharacter()
      },
      onLoadCharDataError: () => {
        loading.value = false
        message.warning(`无法加载汉字 "${currentChar.value}" 的数据`)
      }
    })
  } catch (err) {
    console.error(err)
    loading.value = false
  }
}

// 播放动画
function animate () {
  if (!writerInstance.value) return
  isQuizzing.value = false
  quizStatus.value = null
  writerInstance.value.animateCharacter()
}

// 切换测试状态
function toggleQuiz () {
  if (isQuizzing.value) {
    cancelQuiz()
  } else {
    startQuiz()
  }
}

// 取消测试
function cancelQuiz () {
  if (!writerInstance.value) return
  writerInstance.value.cancelQuiz()
  isQuizzing.value = false
  quizStatus.value = null
  // 显示轮廓
  writerInstance.value.showOutline()
  showOutline.value = true
}

// 开始测试
function startQuiz () {
  if (!writerInstance.value) return
  isQuizzing.value = true
  quizStatus.value = { type: 'info', text: '请在方格中书写...' }

  // 隐藏轮廓
  writerInstance.value.hideOutline()
  showOutline.value = false

  writerInstance.value.quiz({
    onMistake: function (strokeData) {
      quizStatus.value = { type: 'error', text: '笔画错误，请重试' }
      // 震动反馈或提示
    },
    onCorrectStroke: function (strokeData) {
      quizStatus.value = { type: 'info', text: '笔画正确！' }
    },
    onComplete: function (summaryData) {
      quizStatus.value = { type: 'success', text: '🎉 恭喜！书写正确' }
      isQuizzing.value = false
      message.success('书写正确！')

      // 1.5秒后自动跳到下一个（如果有）
      setTimeout(() => {
        if (currentIndex.value < props.words.length - 1) {
          next()
        }
      }, 1500)
    }
  })
}

// 切换轮廓
function toggleOutline () {
  if (!writerInstance.value) return
  showOutline.value = !showOutline.value
  if (showOutline.value) {
    writerInstance.value.showOutline()
  } else {
    writerInstance.value.hideOutline()
  }
}

// 导航
function prev () {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

function next () {
  if (currentIndex.value < props.words.length - 1) {
    currentIndex.value++
  }
}

function close () {
  show.value = false
  // 重置索引以便下次打开从头开始？或者保留？
  // 保留用户习惯可能更好，或者外部控制
  currentIndex.value = 0
}

</script>

<style scoped>
.hanzi-modal {
  height: 100px;
  width: 100px;
  /* max-width: 600px; */
}

.practice-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px 0;
}

.word-info {
  text-align: center;
}

.pinyin {
  font-size: 2rem;
  font-weight: bold;
  color: var(--color-primary);
  margin-bottom: 5px;
  font-family: Arial, Helvetica, sans-serif;
}

.progress {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.canvas-wrapper {
  position: relative;
  width: 300px;
  height: 300px;
  background-color: #fff;
  /* Use white background for better contrast */
  border: 4px solid var(--color-border);
  border-radius: 10px;
  /* Rice grid with dashed lines using SVG */
  background-image: url("data:image/svg+xml,%3Csvg width='300' height='300' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='300' height='300' patternUnits='userSpaceOnUse'%3E%3Cpath d='M0 0 L300 300 M300 0 L0 300 M150 0 L150 300 M0 150 L300 150' stroke='%23ddd' stroke-width='1' stroke-dasharray='5,5' fill='none'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='300' height='300' fill='url(%23grid)' /%3E%3C/svg%3E");
  background-size: 100% 100%;
}

.writer-target {
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  z-index: 10;
}

.quiz-status {
  position: absolute;
  bottom: 0px;
  left: 0;
  right: 0;
  text-align: center;
  padding: 5px;
  font-weight: bold;
  background: rgba(255, 255, 255, 0.9);
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
}

.quiz-status.error {
  color: var(--color-error);
}

.quiz-status.success {
  color: var(--color-success);
}

.quiz-status.info {
  color: var(--color-info);
}

.controls {
  width: 100%;
}

.footer-nav {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-top: 20px;
  border-top: 1px solid var(--color-border);
  padding-top: 20px;
}
</style>
