<template>
  <div class="teacher-dashboard">
    <!-- 页面头部 -->
    <header class="page-header">
      <div class="header-content">
        <div class="header-text">
          <h2>教师工作台</h2>
          <p>欢迎使用智慧教育平台，今天是 {{ currentDate }}</p>
        </div>
      </div>
    </header>

    <!-- 统计卡片 -->
    <section class="stats-grid">
      <div class="stat-card is-gradient">
        <div class="stat-icon">
          <el-icon :size="22"><User /></el-icon>
        </div>
        <div class="stat-value">{{ stats.studentCount }}</div>
        <div class="stat-label">学生总数</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: var(--info-bg); color: var(--info-500);">
          <el-icon :size="22"><Document /></el-icon>
        </div>
        <div class="stat-value">{{ stats.paperCount }}</div>
        <div class="stat-label">试卷总数</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: var(--danger-bg); color: var(--danger-500);">
          <el-icon :size="22"><Edit /></el-icon>
        </div>
        <div class="stat-value">{{ stats.pendingCount }}</div>
        <div class="stat-label">待批改</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: var(--success-bg); color: var(--success-500);">
          <el-icon :size="22"><TrendCharts /></el-icon>
        </div>
        <div class="stat-value">{{ stats.avgScore }}%</div>
        <div class="stat-label">平均正确率</div>
      </div>
    </section>

    <!-- 主内容区 -->
    <div class="dashboard-layout">
      <!-- 最近作业 -->
      <el-card class="panel-card">
        <template #header>
          <div class="section-header">
            <div class="section-title">最近作业</div>
            <el-button type="primary" link @click="goToAssignments">查看全部</el-button>
          </div>
        </template>
        <el-table :data="recentAssignments" style="width: 100%">
          <el-table-column prop="title" label="作业名称" />
          <el-table-column prop="className" label="班级" width="120" />
          <el-table-column prop="submittedCount" label="已提交" width="80" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.status === 'published' ? 'success' : 'info'">
                {{ scope.row.status === 'published' ? '进行中' : '已结束' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 班级概览 -->
      <el-card class="panel-card">
        <template #header>
          <div class="section-header">
            <div class="section-title">班级概览</div>
            <el-button type="primary" link @click="goToClasses">查看全部</el-button>
          </div>
        </template>
        <el-table :data="classes" style="width: 100%">
          <el-table-column prop="name" label="班级名称" />
          <el-table-column prop="grade" label="年级" width="100" />
          <el-table-column prop="studentCount" label="学生数" width="80" />
          <el-table-column label="操作" width="100">
            <template #default="scope">
              <el-button type="primary" link @click="viewClassAnalytics(scope.row.id)">学情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <!-- 快捷操作 -->
    <el-card class="panel-card">
      <template #header>
        <div class="section-title">快捷操作</div>
      </template>
      <div class="quick-actions">
        <el-button type="primary" size="large" @click="goToPapers">
          <el-icon><Upload /></el-icon>
          上传试卷
        </el-button>
        <el-button type="success" size="large" @click="goToAssignments">
          <el-icon><Document /></el-icon>
          发布作业
        </el-button>
        <el-button type="warning" size="large" @click="goToGrading">
          <el-icon><Edit /></el-icon>
          批改作业
        </el-button>
        <el-button type="info" size="large" @click="goToAnalytics">
          <el-icon><TrendCharts /></el-icon>
          学情分析
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'
import dayjs from 'dayjs'

const router = useRouter()

const currentDate = computed(() => dayjs().format('YYYY年MM月DD日 dddd'))

const stats = ref({
  studentCount: 0,
  paperCount: 0,
  pendingCount: 0,
  avgScore: 0
})

const recentAssignments = ref([])
const classes = ref([])

onMounted(() => {
  loadData()
})

function goToAssignments() { router.push('/teacher/assignments') }
function goToClasses() { router.push('/teacher/classes') }
function goToPapers() { router.push('/teacher/papers') }
function goToGrading() { router.push('/teacher/grading') }
function goToAnalytics() { router.push('/teacher/analytics/class') }

function viewClassAnalytics(classId) {
  router.push('/teacher/analytics/class?classId=' + classId)
}

function loadData() {
  api.get('/teacher/classes').then(function(classRes) {
    if (classRes.success) {
      classes.value = classRes.data
      let total = 0
      for (let c of classRes.data) {
        if (c.studentCount) total += c.studentCount
      }
      stats.value.studentCount = total
    }
    return api.get('/teacher/assignments')
  }).then(function(assignmentRes) {
    if (assignmentRes.success) {
      const assignments = assignmentRes.data.slice(0, 5)
      const result = []
      for (let a of assignments) {
        let clsName = '未知班级'
        for (let c of classes.value) {
          if (c.id === a.classId) {
            clsName = c.name
            break
          }
        }
        result.push({
          id: a.id,
          title: a.title,
          className: clsName,
          submittedCount: a.answerCount !== undefined ? a.answerCount : (a.submittedCount || 0),
          status: a.status
        })
      }
      recentAssignments.value = result
    }
    return api.get('/teacher/papers')
  }).then(function(paperRes) {
    if (paperRes.success) {
      stats.value.paperCount = paperRes.data.total || 0
    }
    return api.get('/teacher/answers')
  }).then(function(answerRes) {
    if (answerRes.success) {
      let count = 0
      for (let item of answerRes.data) {
        if (item.status === 'submitted') count++
      }
      stats.value.pendingCount = count
    }
    stats.value.avgScore = 78
  }).catch(function(error) {
    console.error('加载数据失败:', error)
  })
}
</script>

<style scoped>
.teacher-dashboard {
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
  padding: 28px 32px;
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
  top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--brand-gradient);
}

.header-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32px;
}

.header-text h2 {
  font-family: 'Noto Serif SC', serif;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.header-text p {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
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
  top: 0; left: 0;
  width: 4px;
  height: 100%;
  background: var(--brand-gradient);
  opacity: 0;
  transition: opacity var(--duration-normal);
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
.stat-card:hover .stat-icon { transform: scale(1.1) rotate(-5deg); }

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

/* 渐变统计卡片 */
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
  color: white;
}

.stat-card.is-gradient::before { opacity: 1; }

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

/* === 主内容布局 === */
.dashboard-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  animation: slideUp var(--duration-slow) var(--ease-spring);
  animation-delay: 0.1s;
  animation-fill-mode: backwards;
}

/* === 面板卡片 === */
.panel-card {
  border-radius: var(--radius-xl) !important;
  border: 1px solid var(--border-subtle) !important;
  box-shadow: var(--shadow-sm) !important;
  transition: all var(--duration-normal) var(--ease-spring) !important;
  background: var(--surface-raised);
}
.panel-card:hover { box-shadow: var(--shadow-lg) !important; transform: translateY(-2px); }

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

/* === 快捷操作 === */
.quick-actions {
  display: flex;
  gap: 12px;
}
.quick-actions .el-button {
  flex: 1;
  height: 56px;
  font-size: 15px;
  font-weight: 500;
  transition: all var(--duration-normal) var(--ease-spring);
}
.quick-actions .el-button:hover { transform: translateY(-2px); }

/* === 响应式 === */
@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .dashboard-layout { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .stats-grid { grid-template-columns: 1fr; }
  .quick-actions { flex-direction: column; }
  .quick-actions .el-button { width: 100%; }
}
</style>
