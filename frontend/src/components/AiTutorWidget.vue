<template>
  <div class="ai-tutor-widget">
    <!-- 浮动按钮 -->
    <button
      v-if="!panelVisible"
      class="ai-tutor-fab"
      aria-label="打开AI助教小智"
      type="button"
      @click="panelVisible = true"
    >
      <img class="fab-teacher" src="/images/pixel-math-teacher.png" alt="" aria-hidden="true">
      <div class="fab-content">
        <strong>小智助教</strong>
        <span>和老师一起想</span>
      </div>
    </button>

    <!-- 面板 -->
    <transition name="ai-panel">
      <section v-if="panelVisible" class="ai-tutor-panel" role="dialog" aria-label="AI助教小智" @keydown.esc="panelVisible = false">
        <!-- 面板头部 -->
        <header class="panel-header">
          <div class="header-left">
            <div class="panel-avatar">
              <img src="/images/pixel-math-teacher.png" alt="" aria-hidden="true">
            </div>
            <div class="header-text">
              <div class="panel-title">小智助教</div>
              <div class="panel-status">
                <span class="status-dot"></span>
                {{ configStatus?.ready ? '已配置' : '待就绪' }}
              </div>
            </div>
          </div>
          <button class="panel-close-btn" type="button" aria-label="关闭小智" @click="panelVisible = false">
            <el-icon><Close /></el-icon>
          </button>
        </header>

        <!-- 模式切换 -->
        <div class="mode-switch-bar">
          <button
            type="button"
            aria-label="普通聊天"
            :aria-pressed="activeMode === 'chat'"
            :class="['mode-chip', { 'is-active': activeMode === 'chat' }]"
            @click="switchMode('chat')"
          >
            <el-icon><ChatDotRound /></el-icon>
            普通聊天
          </button>
          <button
            type="button"
            aria-label="题目提问"
            :aria-pressed="activeMode === 'problem'"
            :class="['mode-chip', { 'is-active': activeMode === 'problem' }]"
            @click="switchMode('problem')"
          >
            <el-icon><Document /></el-icon>
            题目提问
          </button>
        </div>

        <!-- 标签栏 -->
        <div class="scope-bar">
          <el-tag size="small" :type="activeMode === 'chat' ? 'primary' : 'warning'" class="scope-tag">
            {{ activeMode === 'chat' ? '普通聊天' : '题目提问' }}
          </el-tag>
          <el-tag size="small" type="info" class="scope-tag">初中数学</el-tag>
          <el-tag v-if="activeMode === 'problem'" size="small" effect="plain" type="warning" class="scope-tag">
            仅提供思路
          </el-tag>
        </div>

        <!-- 配置检测 -->
        <div :class="['config-status', configStatusClass]">
          <div class="config-status-main">
            <span class="config-status-dot"></span>
            <span class="config-status-text">{{ configStatusText }}</span>
          </div>
          <button class="config-check-btn" type="button" :disabled="checkingConfig" @click="checkAiTutorConfig">
            {{ checkingConfig ? '检测中' : '重新检测' }}
          </button>
        </div>
        <div v-if="configStatus && !configStatus.ready" class="config-status-detail">
          {{ configStatus.message }}
        </div>

        <!-- 消息列表 -->
        <div ref="messageListRef" class="message-list">
          <div
            v-for="(item, index) in messages"
            :key="index"
            :class="['message-item', item.role]"
          >
            <div v-if="item.role === 'assistant'" class="message-avatar assistant-avatar">
              <img src="/images/pixel-math-teacher.png" alt="" aria-hidden="true">
            </div>
            <div class="message-bubble">
              <div class="message-text" v-html="renderMath(item.content)"></div>
            </div>
            <div v-if="item.role === 'user'" class="message-avatar ai-user-avatar">
              <el-icon><UserFilled /></el-icon>
            </div>
          </div>

          <div v-if="loading" class="message-item assistant is-loading-item">
            <div class="message-avatar assistant-avatar">
              <img src="/images/pixel-math-teacher.png" alt="" aria-hidden="true">
            </div>
            <div class="message-bubble is-loading-bubble">
              <div class="loading-dots">
                <span class="loading-dot"></span>
                <span class="loading-dot"></span>
                <span class="loading-dot"></span>
              </div>
              <span class="loading-text">正在思考...</span>
            </div>
          </div>
        </div>

        <!-- 错误提示 -->
        <div v-if="validationMessage" class="validation-tip">
          <el-icon><Warning /></el-icon>
          {{ validationMessage }}
        </div>
        <div v-if="errorMessage" class="error-tip">
          <el-icon><Warning /></el-icon>
          {{ errorMessage }}
        </div>

        <!-- 输入区域 -->
        <footer class="panel-footer">
          <el-input
            v-model="inputValue"
            type="textarea"
            :rows="3"
            resize="none"
            maxlength="500"
            show-word-limit
            :placeholder="activeMode === 'chat' ? '可以聊数学概念、学习方法、易错点，例如：函数是什么意思？' : '请输入题目或解题困惑，例如：一元一次方程该怎么列式？'"
            @input="handleInput"
            @keyup.ctrl.enter="sendQuestion"
          />
          <div class="footer-actions">
            <span class="footer-hint">
              <kbd>Ctrl</kbd> + <kbd>Enter</kbd> 发送
            </span>
            <el-button
              type="primary"
              :loading="loading"
              :disabled="!canSend"
              @click="sendQuestion"
            >
              <el-icon v-if="!loading"><Promotion /></el-icon>
              发送
            </el-button>
          </div>
        </footer>
      </section>
    </transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound, Document, UserFilled, Warning, Promotion, Close } from '@element-plus/icons-vue'
import api from '@/utils/api'
import { renderMath } from '@/utils/math-render'
import 'katex/dist/katex.min.css'

var panelVisible = ref(false)
var loading = ref(false)
var checkingConfig = ref(false)
var configStatus = ref(null)
var activeMode = ref('chat')
var inputValue = ref('')
var validationMessage = ref('')
var errorMessage = ref('')
var messageListRef = ref(null)
var messages = ref([
  {
    role: 'assistant',
    content: '你好，我是小智助教。你可以切换「普通聊天」和「题目提问」两种模式；题目模式下我会先提供思路和步骤提示。回复仅供学习参考，有疑问请向老师确认。'
  }
])

function validateLocally(text, mode) {
  var value = String(text || '').trim()
  var keywords = ['数学', '方程', '不等式', '函数', '几何', '三角形', '圆', '统计', '概率', '有理数', '整式', '分式', '坐标', '勾股', '初中']
  var mathPattern = /[=><≤≥≠≈+\-×÷/\^√π%]|\d+|\b[xyzabc]\b/i
  var questionPattern = /(解|求|计算|证明|已知|若|如图|题目|方法|思路|步骤|怎么)/

  if (!value) return '请输入内容后再发送'
  if (value.length > 500) return '问题请控制在 500 字以内'

  if (mode === 'chat') {
    if (value.indexOf('作文') > -1 || value.indexOf('英语') > -1 || value.indexOf('历史') > -1 || value.indexOf('政治') > -1) {
      return '普通聊天也仅支持初中数学范围'
    }
    return ''
  }

  var hasKeyword = keywords.some(function (item) {
    return value.indexOf(item) > -1
  })
  var looksMath = mathPattern.test(value) && questionPattern.test(value)
  if (!hasKeyword && !looksMath) {
    return '题目提问模式仅支持初中数学题目或知识点'
  }

  return ''
}

function switchMode(mode) {
  activeMode.value = mode
  handleInput(inputValue.value)
}

var canSend = computed(function () {
  return !loading.value && configStatus.value?.ready && !validateLocally(inputValue.value, activeMode.value)
})

var configStatusClass = computed(function () {
  if (checkingConfig.value) return 'is-checking'
  if (!configStatus.value) return 'is-unknown'
  return configStatus.value.ready ? 'is-ready' : 'is-error'
})

var configStatusText = computed(function () {
  if (checkingConfig.value) return '正在检测 AI 助教配置...'
  if (!configStatus.value) return '尚未检测 AI 助教配置'
  if (configStatus.value.ready) {
    return '配置已填写 · ' + (configStatus.value.model || '未知模型')
  }
  return 'AI助教配置异常'
})

function scrollToBottom() {
  nextTick(function () {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

async function checkAiTutorConfig() {
  checkingConfig.value = true
  try {
    var res = await api.student.getAiTutorStatus()
    if (res.success && res.data) {
      configStatus.value = res.data
      if (!res.data.ready) {
        errorMessage.value = res.data.message || 'AI助教配置异常'
      } else if (errorMessage.value && errorMessage.value.indexOf('AI助教配置') > -1) {
        errorMessage.value = ''
      }
      return
    }
    throw new Error(res.message || 'AI助教配置检测失败')
  } catch (error) {
    configStatus.value = {
      ready: false,
      configured: false,
      enabled: false,
      message: error && error.message ? error.message : 'AI助教配置检测失败，请确认后端服务是否正常运行'
    }
    errorMessage.value = configStatus.value.message
  } finally {
    checkingConfig.value = false
  }
}

function handleInput(value) {
  validationMessage.value = validateLocally(value, activeMode.value)
  errorMessage.value = ''
}

async function sendQuestion() {
  if (loading.value) return
  var question = String(inputValue.value || '').trim()
  validationMessage.value = validateLocally(question, activeMode.value)
  errorMessage.value = ''
  if (validationMessage.value) return

  if (configStatus.value && !configStatus.value.ready) {
    errorMessage.value = configStatus.value.message || 'AI助教配置异常，请先完成配置检测'
    ElMessage.error(errorMessage.value)
    return
  }

  messages.value.push({ role: 'user', content: question })
  inputValue.value = ''
  loading.value = true
  scrollToBottom()

  try {
    var history = messages.value.slice(-9, -1)
    var res = await api.student.askAiTutor({ question: question, history: history, mode: activeMode.value })
    if (res.success && res.data) {
      messages.value.push({ role: 'assistant', content: res.data.content })
      scrollToBottom()
      return
    }
    throw new Error(res.message || 'AI助教暂时不可用')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.message || '发送失败，请稍后重试'
    inputValue.value = question
    messages.value.pop()
    ElMessage.error(errorMessage.value)
  } finally {
    loading.value = false
    scrollToBottom()
  }
}

watch(panelVisible, function (visible) {
  if (visible) {
    scrollToBottom()
    checkAiTutorConfig()
  }
})

onMounted(function () {
  handleInput('')
  checkAiTutorConfig()
})
</script>

<style scoped>
.ai-tutor-widget {
  position: fixed;
  right: 20px;
  bottom: 28px;
  z-index: 1100;
}

/* === 浮动按钮 === */
.ai-tutor-fab {
  position: relative;
  width: 92px;
  min-height: 96px;
  border: 1px solid #b9d6f5;
  border-radius: 20px 20px 16px 16px;
  padding: 6px 6px 8px;
  background: rgba(255, 255, 255, .96);
  color: var(--nb-ink, #173a7b);
  box-shadow: 0 12px 28px -16px rgba(24, 87, 164, .6);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  overflow: visible;
  transition: all var(--duration-normal) var(--ease-spring);
}

.ai-tutor-fab:hover {
  transform: translateY(-4px) rotate(-1deg);
  border-color: #4c9af3;
  box-shadow: 0 18px 32px -16px rgba(24, 87, 164, .58);
}

.ai-tutor-fab:active {
  transform: scale(1.02);
}

.fab-teacher {
  position: relative;
  z-index: 1;
  width: 56px;
  height: 56px;
  object-fit: contain;
  image-rendering: pixelated;
  filter: drop-shadow(0 4px 3px rgba(34, 80, 142, .18));
}

.fab-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  margin: -2px 0 0;
}

.fab-content strong {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.fab-content span {
  font-size: 10px;
  color: var(--nb-ink-3, #5b76a2);
  font-weight: 600;
}

/* === 面板主体 === */
.ai-tutor-panel {
  position: absolute;
  right: 0;
  bottom: 108px;
  width: min(380px, calc(100vw - 24px));
  border-radius: var(--radius-2xl);
  overflow: hidden;
  box-shadow: var(--shadow-xl), 0 0 0 1px hsla(var(--brand-hue), 84%, 68%, 0.1);
  background: var(--surface-raised);
  display: flex;
  flex-direction: column;
  height: min(600px, calc(100dvh - 160px));
  max-height: calc(100dvh - 160px);
}

/* === 面板头部 === */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--brand-gradient);
  color: #fff;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, .2);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  border: 1.5px solid hsla(0, 0%, 100%, 0.25);
  box-shadow: 0 2px 8px hsla(0, 0%, 0%, 0.1);
}
.panel-avatar img { width: 36px; height: 36px; object-fit: contain; image-rendering: pixelated; }

.header-text { display: flex; flex-direction: column; gap: 2px; }

.panel-title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.panel-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  opacity: 0.85;
  font-weight: 500;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #34D399;
  box-shadow: 0 0 0 2px hsla(158, 90%, 65%, 0.3);
  animation: status-pulse 2s ease-in-out infinite;
}

@keyframes status-pulse {
  0%, 100% { box-shadow: 0 0 0 2px hsla(158, 90%, 65%, 0.3); }
  50% { box-shadow: 0 0 0 4px hsla(158, 90%, 65%, 0.15); }
}

.panel-close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: hsla(0, 0%, 100%, 0.15);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) var(--ease-spring);
}

.panel-close-btn:hover {
  background: hsla(0, 0%, 100%, 0.25);
  transform: scale(1.1) rotate(90deg);
}

/* === 模式切换 === */
.mode-switch-bar {
  display: flex;
  gap: 8px;
  padding: 14px 16px 0;
  flex-shrink: 0;
}

.mode-chip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1.5px solid var(--border-default);
  background: var(--surface-raised);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  padding: 9px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-spring);
}

.mode-chip:hover {
  border-color: hsla(var(--brand-hue), 84%, 68%, 0.4);
  color: var(--primary-500);
  background: var(--primary-50);
}

.mode-chip.is-active {
  background: var(--brand-gradient);
  border-color: transparent;
  color: white;
  box-shadow: var(--brand-glow);
}

.mode-chip .el-icon { font-size: 15px; }

/* === 标签栏 === */
.scope-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.scope-tag {
  font-weight: 600;
  border: none;
}

/* === 配置检测 === */
.config-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0 16px 10px;
  padding: 9px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-muted);
  flex-shrink: 0;
}

.config-status-main {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.config-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}

.config-status-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-status.is-ready {
  background: var(--success-bg);
  border-color: hsla(var(--success-hue), 90%, 45%, 0.22);
}

.config-status.is-ready .config-status-dot {
  background: var(--success-500);
  box-shadow: 0 0 0 3px hsla(var(--success-hue), 90%, 45%, 0.14);
}

.config-status.is-ready .config-status-text {
  color: var(--success-500);
}

.config-status.is-error {
  background: var(--danger-bg);
  border-color: hsla(var(--danger-hue), 84%, 60%, 0.22);
}

.config-status.is-error .config-status-dot {
  background: var(--danger-500);
  box-shadow: 0 0 0 3px hsla(var(--danger-hue), 84%, 60%, 0.14);
}

.config-status.is-error .config-status-text {
  color: var(--danger-500);
}

.config-status.is-checking .config-status-dot {
  background: var(--warning-500);
  animation: status-pulse 1.2s ease-in-out infinite;
}

.config-check-btn {
  border: none;
  background: transparent;
  color: var(--primary-500);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.config-check-btn:disabled {
  color: var(--text-disabled);
  cursor: not-allowed;
}

.config-status-detail {
  margin: -4px 16px 10px;
  padding: 0 2px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--danger-500);
  flex-shrink: 0;
}

/* === 消息列表 === */
.message-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--surface-base);
}

.message-item {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.message-item.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.assistant-avatar {
  overflow: hidden;
  background: #e7f4ff;
  border: 1px solid #b9d6f5;
}

.assistant-avatar img {
  width: 27px;
  height: 27px;
  object-fit: contain;
  image-rendering: pixelated;
}

.ai-user-avatar {
  background: var(--surface-muted);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}

.message-bubble {
  max-width: 75%;
  padding: 12px 14px;
  border-radius: 16px;
  line-height: 1.7;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--surface-raised);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-subtle);
  transition: all var(--duration-fast);
}

.message-bubble:hover {
  box-shadow: var(--shadow-md);
}

.message-item.user .message-bubble {
  background: var(--brand-gradient);
  color: white;
  border-color: transparent;
  box-shadow: var(--brand-glow);
}

.message-text {
  word-break: break-word;
  white-space: pre-wrap;
}

.message-text :deep(.katex) {
  font-size: 1em;
}

.message-text :deep(.katex-display) {
  margin: 8px 0;
  overflow-x: auto;
  overflow-y: hidden;
}

/* === 加载状态 === */
.is-loading-item .message-bubble {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.loading-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary-500);
  animation: loading-bounce 1.2s ease-in-out infinite;
}

.loading-dot:nth-child(2) { animation-delay: 0.15s; }
.loading-dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes loading-bounce {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.loading-text {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

/* === 提示 === */
.validation-tip,
.error-tip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 16px 4px;
  font-size: 12px;
  font-weight: 500;
}

.validation-tip { color: var(--warning-500); }
.error-tip { color: var(--danger-500); }

/* === 底部输入 === */
.panel-footer {
  padding: 12px 16px 16px;
  background: var(--surface-raised);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.footer-actions {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.footer-hint {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.footer-hint kbd {
  display: inline-block;
  padding: 2px 5px;
  font-size: 10px;
  font-family: inherit;
  background: var(--surface-muted);
  border: 1px solid var(--border-default);
  border-radius: 4px;
  box-shadow: 0 1px 0 var(--border-default);
}

.footer-actions .el-button {
  border-radius: var(--radius-md);
  font-weight: 600;
}

/* === 面板动画 === */
.ai-panel-enter-active,
.ai-panel-leave-active {
  transition: all var(--duration-normal) var(--ease-spring);
}
.ai-panel-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.96);
}
.ai-panel-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

/* === 响应式 === */
@media (max-width: 768px) {
  .ai-tutor-widget {
    right: 12px;
    bottom: 18px;
  }

  .ai-tutor-fab {
    width: 68px;
    min-height: 76px;
    border-radius: 16px;
    padding: 4px;
  }

  .fab-teacher { width: 48px; height: 48px; }
  .fab-content span { display: none; }
  .fab-content strong { font-size: 11px; }

  .ai-tutor-panel {
    width: min(340px, calc(100vw - 16px));
    right: -8px;
    bottom: 78px;
  }
}
</style>
