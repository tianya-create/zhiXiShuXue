<template>
  <div class="student-dashboard">
    <!-- 页面头部 -->
    <header class="page-header">
      <div class="header-content">
        <div class="header-text">
          <h2>学习工作台</h2>
          <p>今天是 {{ currentDate }}。先完成待办，再处理薄弱知识点，保持稳定的学习节奏。</p>
        </div>
        <div class="header-focus">
          <span class="focus-badge">当前重点</span>
          <strong>{{ weakBreakdown.weak }} 个薄弱知识点待处理</strong>
        </div>
      </div>
    </header>

    <!-- 统计卡片 -->
    <section class="stats-grid">
      <div class="stat-card is-gradient">
        <div class="stat-icon">
          <el-icon :size="22"><Document /></el-icon>
        </div>
        <div class="stat-value">{{ stats.pendingAssignments }}</div>
        <div class="stat-label">待完成作业</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: var(--info-bg); color: var(--info-color);">
          <el-icon :size="22"><TrendCharts /></el-icon>
        </div>
        <div class="stat-value">{{ stats.avgScore }}%</div>
        <div class="stat-label">平均掌握度</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: var(--danger-bg); color: var(--danger-color);">
          <el-icon :size="22"><WarningFilled /></el-icon>
        </div>
        <div class="stat-value">{{ weakBreakdown.weak }}</div>
        <div class="stat-label">薄弱知识点</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: var(--success-bg); color: var(--success-color);">
          <el-icon :size="22"><CircleCheck /></el-icon>
        </div>
        <div class="stat-value">{{ weakBreakdown.mastered }}</div>
        <div class="stat-label">已掌握知识点</div>
      </div>
    </section>

    <!-- 主内容区 -->
    <div class="dashboard-layout">
      <!-- 作业列表 -->
      <el-card class="panel-card" v-loading="loadingAssignments">
        <template #header>
          <div class="section-header">
            <div>
              <div class="section-title">今日待办作业</div>
              <div class="section-desc">保留最重要的主流程入口，优先完成近期任务。</div>
            </div>
            <el-button type="primary" link class="view-all-link" @click="goToAssignments">查看全部</el-button>
          </div>
        </template>
        <div v-if="pendingAssignments.length" class="assignment-list">
          <div v-for="item in pendingAssignments" :key="item.id" class="assignment-item">
            <div class="assignment-info">
              <div class="assignment-title">{{ item.title }}</div>
              <div class="assignment-meta">
                <span><el-icon><Document /></el-icon> {{ item.paperTitle || '未命名试卷' }}</span>
                <span><el-icon><Collection /></el-icon> {{ item.questionCount || 0 }} 题</span>
                <span><el-icon><Clock /></el-icon> {{ formatDate(item.deadline) }}</span>
              </div>
            </div>
            <el-button type="primary" @click="startAssignment(item)">开始答题</el-button>
          </div>
        </div>
        <el-empty v-else-if="!loadingAssignments" description="当前没有待完成作业，继续保持。" />
      </el-card>

      <!-- 侧边栏 -->
      <div class="side-column">
        <!-- 知识诊断 -->
        <el-card class="panel-card" v-loading="loadingWeakPoints">
          <template #header>
            <div class="section-header">
              <div>
                <div class="section-title">知识诊断概览</div>
                <div class="section-desc">用更清晰的状态分层，快速判断接下来该做什么。</div>
              </div>
            </div>
          </template>
          <div class="mastery-breakdown">
            <div class="mastery-item is-weak">
              <span class="mastery-label">薄弱</span>
              <strong class="mastery-value">{{ weakBreakdown.weak }}</strong>
              <small class="mastery-ratio">{{ weakBreakdown.weakRatio }}%</small>
            </div>
            <div class="mastery-item is-middle">
              <span class="mastery-label">待巩固</span>
              <strong class="mastery-value">{{ weakBreakdown.learning }}</strong>
              <small class="mastery-ratio">{{ weakBreakdown.learningRatio }}%</small>
            </div>
            <div class="mastery-item is-strong">
              <span class="mastery-label">已掌握</span>
              <strong class="mastery-value">{{ weakBreakdown.mastered }}</strong>
              <small class="mastery-ratio">{{ weakBreakdown.masteredRatio }}%</small>
            </div>
          </div>
          <div id="knowledgeChart" class="knowledge-chart"></div>
        </el-card>

        <!-- 快捷入口 -->
        <el-card class="panel-card">
          <template #header>
            <div>
              <div class="section-title">快捷入口</div>
              <div class="section-desc">减少彩色拼盘感，只保留三个高频动作。</div>
            </div>
          </template>
          <div class="quick-actions">
            <button class="quick-action" type="button" @click="goToKnowledge">
              <div class="quick-action-icon">
                <el-icon><Share /></el-icon>
              </div>
              <div class="quick-action-text">
                <div class="quick-action-title">知识诊断中心</div>
                <div class="quick-action-desc">查看知识树与当前聚焦知识点</div>
              </div>
              <el-icon class="quick-action-arrow"><ArrowRight /></el-icon>
            </button>

            <button class="quick-action" type="button" @click="goToWeakPoints">
              <div class="quick-action-icon">
                <el-icon><TrendCharts /></el-icon>
              </div>
              <div class="quick-action-text">
                <div class="quick-action-title">进入薄弱补练</div>
                <div class="quick-action-desc">针对未掌握内容继续专项练习</div>
              </div>
              <el-icon class="quick-action-arrow"><ArrowRight /></el-icon>
            </button>

            <button class="quick-action" type="button" @click="goToWrongQuestions">
              <div class="quick-action-icon">
                <el-icon><Edit /></el-icon>
              </div>
              <div class="quick-action-text">
                <div class="quick-action-title">打开错题本</div>
                <div class="quick-action-desc">复盘错误并进入重做模式</div>
              </div>
              <el-icon class="quick-action-arrow"><ArrowRight /></el-icon>
            </button>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { getMasteryStatus } from '@/utils/knowledge-meta'

const router = useRouter()
let chart = null
const loadingAssignments = ref(false)
const loadingWeakPoints = ref(false)
const pendingAssignments = ref([])
const weakPointList = ref([])
const currentDate = computed(() => dayjs().format('YYYY年MM月DD日 dddd'))
const stats = reactive({ pendingAssignments: 0, avgScore: 0 })

const weakBreakdown = computed(() => {
  const result = { mastered: 0, learning: 0, weak: 0, masteredRatio: 0, learningRatio: 0, weakRatio: 0 }
  weakPointList.value.forEach((item) => {
    const status = item.statusLabel || (getMasteryStatus(item.masteryRate) === 'mastered' ? '已掌握' : getMasteryStatus(item.masteryRate) === 'learning' ? '待巩固' : '薄弱')
    if (status === '已掌握') result.mastered += 1
    else if (status === '待巩固') result.learning += 1
    else result.weak += 1
  })
  const total = weakPointList.value.length || 1
  result.masteredRatio = Math.round(result.mastered / total * 100)
  result.learningRatio = Math.round(result.learning / total * 100)
  result.weakRatio = Math.round(result.weak / total * 100)
  return result
})

function loadAssignments() {
  loadingAssignments.value = true
  api.get('/student/assignments', { status: 'pending' }).then((res) => {
    if (res.success) {
      pendingAssignments.value = (res.data || []).slice(0, 5)
      stats.pendingAssignments = (res.data || []).length
    }
  }).catch(() => {
    pendingAssignments.value = []
    stats.pendingAssignments = 0
  }).finally(() => {
    loadingAssignments.value = false
  })
}

function loadWeakPoints() {
  loadingWeakPoints.value = true
  api.get('/student/weak-points').then((res) => {
    if (res.success) {
      weakPointList.value = res.data || []
      stats.avgScore = getAverageMastery(weakPointList.value)
      return nextTick()
    }
    return null
  }).then(() => renderChart()).catch(() => {
    weakPointList.value = []
    stats.avgScore = 0
  }).finally(() => {
    loadingWeakPoints.value = false
  })
}

function getAverageMastery(list) {
  if (!list.length) return 0
  return Math.round(list.reduce((sum, item) => sum + parseInt(item.masteryRate || 0, 10), 0) / list.length)
}

function renderChart() {
  const chartDom = document.getElementById('knowledgeChart')
  if (!chartDom) return
  if (chart) chart.dispose()
  chart = echarts.init(chartDom)
  chart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['56%', '74%'],
      label: { color: '#78716C', fontSize: 12 },
      data: [
        { value: Math.max(weakBreakdown.value.mastered, 1), name: '已掌握', itemStyle: { color: '#059669' } },
        { value: Math.max(weakBreakdown.value.learning, 1), name: '待巩固', itemStyle: { color: '#D97706' } },
        { value: Math.max(weakBreakdown.value.weak, 1), name: '薄弱', itemStyle: { color: '#DC2626' } }
      ]
    }]
  })
}

function goToAssignments() { router.push('/student/assignments') }
function goToKnowledge() { router.push('/student/knowledge') }
function goToWeakPoints() { router.push('/student/weak-points') }
function goToWrongQuestions() { router.push('/student/wrong-questions') }
function startAssignment(row) { router.push('/student/assignment/' + row.id) }
function formatDate(date) { return date ? dayjs(date).format('MM-DD HH:mm') : '未设置' }

onMounted(() => { loadAssignments(); loadWeakPoints(); window.addEventListener('resize', renderChart) })
onBeforeUnmount(() => { window.removeEventListener('resize', renderChart); if (chart) chart.dispose() })
</script>

<style scoped>
.student-dashboard {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* === 页面头部 === */
.page-header {
  background: var(--surface-overlay);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: var(--radius-xl);
  padding: 32px 36px;
  border: 1px solid hsla(0, 0%, 100%, 0.9);
  box-shadow: var(--shadow-md);
  position: relative;
  overflow: hidden;
  animation: slideUp var(--duration-slow) var(--ease-spring);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.page-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--brand-gradient);
}

.page-header::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 300px;
  height: 100%;
  background: radial-gradient(ellipse at top right, hsla(var(--brand-hue), 84%, 68%, 0.06) 0%, transparent 70%);
  pointer-events: none;
}

.header-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32px;
  position: relative;
  z-index: 1;
}

.header-text h2 {
  font-family: 'Noto Serif SC', serif;
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: 0.02em;
}

.header-text p {
  margin: 12px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
}

.header-focus {
  flex-shrink: 0;
  padding: 20px 24px;
  background: hsla(var(--brand-hue), 84%, 68%, 0.06);
  border-radius: var(--radius-lg);
  border: 1px solid hsla(var(--brand-hue), 84%, 68%, 0.12);
  text-align: center;
  transition: all var(--duration-normal) var(--ease-spring);
}

.header-focus:hover {
  transform: scale(1.02);
  box-shadow: var(--shadow-md);
  border-color: hsla(var(--brand-hue), 84%, 68%, 0.2);
}

.focus-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  color: var(--primary-500);
  background: var(--surface-raised);
  padding: 5px 12px;
  border-radius: var(--radius-full);
  margin-bottom: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  box-shadow: var(--shadow-sm);
}

.header-focus strong {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 8px;
}

/* === 统计卡片网格 === */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.stat-card {
  padding: 24px;
  border-radius: var(--radius-xl);
  background: var(--surface-raised);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-normal) var(--ease-spring);
  position: relative;
  overflow: hidden;
  animation: cardEnter var(--duration-slow) var(--ease-spring) backwards;
}

.stat-card:nth-child(1) { animation-delay: 0.05s; }
.stat-card:nth-child(2) { animation-delay: 0.1s; }
.stat-card:nth-child(3) { animation-delay: 0.15s; }
.stat-card:nth-child(4) { animation-delay: 0.2s; }

@keyframes cardEnter {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--brand-gradient);
  opacity: 0;
  transition: opacity var(--duration-normal);
}

.stat-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 100px;
  height: 100px;
  background: radial-gradient(circle at top right, hsla(var(--brand-hue), 84%, 68%, 0.04) 0%, transparent 70%);
  pointer-events: none;
}

.stat-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-lg);
  border-color: hsla(var(--brand-hue), 84%, 68%, 0.2);
}

.stat-card:hover::before { opacity: 1; }

.stat-card .stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-50);
  color: var(--primary-500);
  margin-bottom: 18px;
  transition: all var(--duration-normal) var(--ease-spring);
}

.stat-card:hover .stat-icon {
  transform: scale(1.1) rotate(-5deg);
}

.stat-card .stat-value {
  font-size: 36px;
  font-weight: 800;
  color: var(--text-primary);
  font-family: 'Noto Serif SC', serif;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.stat-card .stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 8px;
  font-weight: 600;
}

.stat-card.is-gradient {
  background: var(--brand-gradient);
  border: none;
}

.stat-card.is-gradient .stat-icon {
  background: hsla(0, 0%, 100%, 0.2);
  color: white;
}

.stat-card.is-gradient .stat-value,
.stat-card.is-gradient .stat-label {
  color: var(--text-primary);
}

.stat-card.is-gradient .stat-label {
  color: var(--text-secondary);
}

.stat-card.is-gradient::before { opacity: 0; }
.stat-card.is-gradient:hover::before { opacity: 1; }

/* === 主内容布局 === */
.dashboard-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 24px;
  animation: slideUp var(--duration-slow) var(--ease-spring);
  animation-delay: 0.2s;
  animation-fill-mode: backwards;
}

.side-column {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* === 面板卡片 === */
.panel-card {
  border-radius: var(--radius-xl) !important;
  border: 1px solid var(--border-subtle) !important;
  box-shadow: var(--shadow-sm) !important;
  transition: all var(--duration-normal) var(--ease-spring) !important;
  background: var(--surface-raised);
}

.panel-card:hover {
  box-shadow: var(--shadow-lg) !important;
  transform: translateY(-2px);
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 0;
}

.section-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.01em;
}

.section-desc {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
  font-weight: 500;
}

.section-header :deep(.view-all-link.el-button--primary.is-link),
.section-header :deep(.view-all-link.el-button--primary.is-link:hover),
.section-header :deep(.view-all-link.el-button--primary.is-link:focus) {
  color: #fff !important;
}

/* === 作业列表 === */
.assignment-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.assignment-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 24px;
  border-radius: var(--radius-lg);
  border: 1.5px solid var(--border-subtle);
  background: var(--surface-muted);
  transition: all var(--duration-normal) var(--ease-spring);
  cursor: pointer;
}

.assignment-item:hover {
  border-color: hsla(var(--brand-hue), 84%, 68%, 0.3);
  background: var(--surface-raised);
  transform: translateX(6px);
  box-shadow: var(--shadow-md);
}

.assignment-info { flex: 1; min-width: 0; }

.assignment-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.assignment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: var(--text-muted);
  font-size: 13px;
}

.assignment-meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
}

/* === 知识掌握度 === */
.mastery-breakdown {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.mastery-item {
  padding: 20px 16px;
  border-radius: var(--radius-lg);
  text-align: center;
  transition: all var(--duration-normal) var(--ease-spring);
  position: relative;
  overflow: hidden;
}

.mastery-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  opacity: 0;
  transition: opacity var(--duration-normal);
}

.mastery-item:hover { transform: scale(1.03); }
.mastery-item:hover::before { opacity: 1; }

.mastery-item.is-weak {
  background: var(--danger-bg);
  border: 1px solid hsla(var(--danger-hue), 84%, 60%, 0.15);
}
.mastery-item.is-weak::before { background: var(--brand-gradient); }
.mastery-item.is-middle {
  background: var(--warning-bg);
  border: 1px solid hsla(var(--warning-hue), 90%, 50%, 0.15);
}
.mastery-item.is-middle::before { background: var(--brand-gradient); }
.mastery-item.is-strong {
  background: var(--success-bg);
  border: 1px solid hsla(var(--success-hue), 90%, 45%, 0.15);
}
.mastery-item.is-strong::before { background: var(--brand-gradient); }

.mastery-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mastery-value {
  display: block;
  font-size: 28px;
  font-weight: 800;
  color: var(--text-primary);
  font-family: 'Noto Serif SC', serif;
}

.mastery-ratio {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 6px;
  font-weight: 600;
}

.knowledge-chart {
  height: 220px;
  border-radius: var(--radius-md);
  overflow: hidden;
}

/* === 快捷入口 === */
.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-action {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 18px 20px;
  border: 1.5px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface-muted);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-spring);
  text-align: left;
  position: relative;
  overflow: hidden;
}

.quick-action::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--brand-gradient);
  opacity: 0;
  transition: opacity var(--duration-normal);
}

.quick-action:hover {
  border-color: hsla(var(--brand-hue), 84%, 68%, 0.3);
  background: var(--surface-raised);
  transform: translateX(6px);
  box-shadow: var(--shadow-md);
}

.quick-action:hover::before { opacity: 1; }

.quick-action-icon {
  width: 46px;
  height: 46px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-50);
  color: var(--primary-500);
  flex-shrink: 0;
  transition: all var(--duration-normal) var(--ease-spring);
}

.quick-action:nth-child(1) .quick-action-icon {
  background: linear-gradient(135deg, rgba(45, 142, 232, 0.1), rgba(52, 199, 193, 0.14));
  color: #2488dd;
}

.quick-action:nth-child(2) .quick-action-icon {
  background: linear-gradient(135deg, rgba(52, 199, 193, 0.14), rgba(143, 222, 220, 0.2));
  color: #169ca3;
}

.quick-action:nth-child(3) .quick-action-icon {
  background: linear-gradient(135deg, rgba(111, 203, 229, 0.14), rgba(229, 250, 255, 0.92));
  color: #2f8fb8;
}

.quick-action:hover .quick-action-icon {
  transform: scale(1.1) rotate(-5deg);
}

.quick-action-text { flex: 1; min-width: 0; }

.quick-action-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.quick-action-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  font-weight: 500;
}

.quick-action-arrow {
  color: var(--text-muted);
  font-size: 16px;
  transition: all var(--duration-normal) var(--ease-spring);
}

.quick-action:hover .quick-action-arrow {
  transform: translateX(6px);
  color: var(--primary-500);
}

/* === 响应式 === */
@media (max-width: 1200px) {
  .dashboard-layout { grid-template-columns: 1fr; }
  .side-column { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
}

@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .header-content { flex-direction: column; }
  .stats-grid { grid-template-columns: 1fr; }
  .side-column { grid-template-columns: 1fr; }
  .mastery-breakdown { grid-template-columns: 1fr; }
  .assignment-item { flex-direction: column; align-items: flex-start; }
  .assignment-item .el-button { width: 100%; margin-top: 16px; }
}
</style>
