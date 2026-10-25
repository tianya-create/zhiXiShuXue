<template>
  <div class="t-dashboard">
    <header class="greeting">
      <p class="greeting-date">{{ currentDate }}</p>
      <h1 class="greeting-title">{{ teacherName }}，{{ greetingWord }}</h1>
    </header>

    <section class="today">
      <div class="today-label">今天先做这一件</div>
      <div class="today-body">
        <div class="today-text">
          <p class="today-main">{{ nextStep.title }}</p>
          <p class="today-sub">{{ nextStep.detail }}</p>
        </div>
        <el-button type="primary" size="large" @click="nextStep.action()">{{ nextStep.button }}</el-button>
      </div>
    </section>

    <section class="adaptive-overview">
      <div class="adaptive-heading">
        <div><span class="adaptive-kicker">认知—心理适配</span><h2>班级即时学习状态</h2></div>
        <span>仅汇总学生主动提交的轮后感受</span>
      </div>
      <div class="adaptive-grid">
        <div class="adaptive-card control-card">
          <b>学业控制感</b>
          <div class="distribution">
            <span style="--bar:#e88972" :style="{ flex: Math.max(1, adaptive.controlDistribution.low) }">需支持 {{ adaptive.controlDistribution.low }}</span>
            <span style="--bar:#e5bb5e" :style="{ flex: Math.max(1, adaptive.controlDistribution.medium) }">稳定 {{ adaptive.controlDistribution.medium }}</span>
            <span style="--bar:#72b58b" :style="{ flex: Math.max(1, adaptive.controlDistribution.high) }">有把握 {{ adaptive.controlDistribution.high }}</span>
          </div>
          <small>已完成即时自评 {{ adaptive.assessedStudentCount }} / {{ adaptive.studentCount }} 人</small>
          <div class="complexity-tags">
            <span>低认知负荷 {{ adaptive.taskComplexityDistribution.low }}</span>
            <span>中认知负荷 {{ adaptive.taskComplexityDistribution.medium }}</span>
            <span>高认知负荷 {{ adaptive.taskComplexityDistribution.high }}</span>
          </div>
        </div>
        <div class="adaptive-card preference-card">
          <b>资源呈现偏好</b>
          <div class="preference-tags">
            <span>图形 V · {{ adaptive.preferenceDistribution.V }}</span>
            <span>听觉 A · {{ adaptive.preferenceDistribution.A }}</span>
            <span>文字 R · {{ adaptive.preferenceDistribution.R }}</span>
            <span>练习 K · {{ adaptive.preferenceDistribution.K }}</span>
          </div>
          <small>混合偏好会同时计入两个通道，不作为能力标签。</small>
        </div>
        <button type="button" class="adaptive-card support-card" @click="goTo('/teacher/analytics/class')">
          <strong>{{ adaptive.supportRequestCount }}</strong><b>条学生主动求助</b><small>只有学生主动点击后才会出现</small>
        </button>
      </div>
    </section>

    <section class="stat-row">
      <button type="button" class="stat-tile" style="--tile: var(--nb-blue); --tile-soft: var(--nb-blue-soft)" @click="goTo('/teacher/students')">
        <span class="stat-icon"><el-icon><User /></el-icon></span>
        <span class="stat-num nb-num">{{ stats.studentCount }}</span>
        <span class="stat-name">名学生</span>
      </button>
      <button type="button" class="stat-tile" style="--tile: var(--nb-purple); --tile-soft: var(--nb-purple-soft)" @click="goTo('/teacher/papers')">
        <span class="stat-icon"><el-icon><Document /></el-icon></span>
        <span class="stat-num nb-num">{{ stats.paperCount }}</span>
        <span class="stat-name">份试卷</span>
      </button>
      <button type="button" class="stat-tile" style="--tile: var(--nb-red); --tile-soft: var(--nb-red-soft)" @click="goTo('/teacher/grading')">
        <span class="stat-icon"><el-icon><EditPen /></el-icon></span>
        <span class="stat-num nb-num">{{ stats.pendingCount }}</span>
        <span class="stat-name">份待批改</span>
      </button>
      <button type="button" class="stat-tile" style="--tile: var(--nb-green); --tile-soft: var(--nb-green-soft)" @click="goTo('/teacher/analytics/class')">
        <span class="stat-icon"><el-icon><TrendCharts /></el-icon></span>
        <span class="stat-num nb-num">{{ stats.avgScore === null ? '-' : stats.avgScore }}</span>
        <span class="stat-name">已批改答卷平均分</span>
      </button>
    </section>

    <div class="board">
      <el-card class="panel-card">
        <template #header>
          <div class="section-header">
            <span class="section-title">最近作业</span>
            <el-button type="primary" link @click="goTo('/teacher/assignments')">全部作业</el-button>
          </div>
        </template>
        <el-table :data="recentAssignments" style="width: 100%" empty-text="还没有发布作业">
          <el-table-column prop="title" label="作业名称" min-width="140" />
          <el-table-column prop="className" label="班级" min-width="110" />
          <el-table-column prop="submittedCount" label="已交" width="76" />
          <el-table-column label="状态" width="96">
            <template #default="scope">
              <el-tag :type="scope.row.status === 'published' ? 'success' : 'info'">
                {{ scope.row.status === 'published' ? '进行中' : '已结束' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card class="panel-card">
        <template #header>
          <div class="section-header">
            <span class="section-title">我的班级</span>
            <el-button type="primary" link @click="goTo('/teacher/classes')">班级管理</el-button>
          </div>
        </template>
        <el-table :data="classes" style="width: 100%" empty-text="还没有班级">
          <el-table-column prop="name" label="班级" min-width="120" />
          <el-table-column prop="studentCount" label="人数" width="76" />
          <el-table-column label="" width="110">
            <template #default="scope">
              <el-button type="primary" link @click="viewClassAnalytics(scope.row.id)">看学情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <section class="quick">
      <h2 class="quick-title">常用操作</h2>
      <div class="quick-grid">
        <button v-for="item in quickActions" :key="item.label" type="button" class="quick-tile" :style="{ '--tile': item.color, '--tile-soft': item.soft }" @click="goTo(item.path)">
          <span class="quick-icon"><el-icon><component :is="item.icon" /></el-icon></span>
          <span class="quick-text">
            <span class="quick-label">{{ item.label }}</span>
            <span class="quick-desc">{{ item.desc }}</span>
          </span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'
import dayjs from 'dayjs'

const router = useRouter()

const currentDate = computed(() => dayjs().format('M月D日 dddd'))
const greetingWord = computed(() => {
  const hour = dayjs().hour()
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})
const teacherName = computed(() => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user.name || '老师'
  } catch (e) {
    return '老师'
  }
})

const stats = ref({
  studentCount: 0,
  paperCount: 0,
  pendingCount: 0,
  avgScore: null
})

const recentAssignments = ref([])
const classes = ref([])
const adaptive = ref({
  studentCount: 0,
  assessedStudentCount: 0,
  supportRequestCount: 0,
  controlDistribution: { low: 0, medium: 0, high: 0 },
  preferenceDistribution: { V: 0, A: 0, R: 0, K: 0 },
  taskComplexityDistribution: { low: 0, medium: 0, high: 0 }
})

const quickActions = [
  { label: '上传试卷', desc: '把纸质卷或题目录进来', icon: 'Upload', path: '/teacher/papers', color: 'var(--nb-blue)', soft: 'var(--nb-blue-soft)' },
  { label: '发布作业', desc: '选题目、定截止时间', icon: 'Promotion', path: '/teacher/assignments', color: 'var(--nb-purple)', soft: 'var(--nb-purple-soft)' },
  { label: '批改作业', desc: '主观题需要人工批改', icon: 'EditPen', path: '/teacher/grading', color: 'var(--nb-pink)', soft: 'var(--nb-pink-soft)' },
  { label: '看班级学情', desc: '哪些知识点全班都弱', icon: 'TrendCharts', path: '/teacher/analytics/class', color: 'var(--nb-teal)', soft: 'var(--nb-teal-soft)' }
]

// 首页只给一个明确的下一步：有待批改的先批改
const nextStep = computed(() => {
  if (stats.value.pendingCount > 0) {
    return {
      title: `有 ${stats.value.pendingCount} 份作业等你批改`,
      detail: '主观题要老师批改后，学生才能看到分数，薄弱知识点也会随之更新。',
      button: '去批改',
      action: () => goTo('/teacher/grading')
    }
  }
  return {
    title: '作业都批改完了',
    detail: '看看班级学情，找出全班都没掌握的知识点，再针对性地布置一份作业。',
    button: '看班级学情',
    action: () => goTo('/teacher/analytics/class')
  }
})

onMounted(() => {
  loadData()
})

function goTo(path) { router.push(path) }

function viewClassAnalytics(classId) {
  router.push('/teacher/analytics/class?classId=' + classId)
}

function loadData() {
  api.get('/teacher/classes').then(function(classRes) {
    if (classRes.success) {
      classes.value = classRes.data
      let total = 0
      for (let c of classRes.data) {
        total += c.studentCount || (Array.isArray(c.students) ? c.students.length : 0)
      }
      stats.value.studentCount = total
    }
    return api.get('/teacher/assignments')
  }).then(function(assignmentRes) {
    if (assignmentRes.success) {
      const assignments = assignmentRes.data.slice(0, 5)
      recentAssignments.value = assignments.map(function(a) {
        const cls = classes.value.find(function(c) { return c.id === a.classId })
        return {
          id: a.id,
          title: a.title,
          className: cls ? cls.name : '未分班',
          submittedCount: a.answerCount !== undefined ? a.answerCount : (a.submittedCount || 0),
          status: a.status
        }
      })
    }
    return api.get('/teacher/papers')
  }).then(function(paperRes) {
    if (paperRes.success) {
      stats.value.paperCount = paperRes.data.total || 0
    }
    return api.get('/teacher/answers')
  }).then(function(answerRes) {
    if (answerRes.success) {
      const list = answerRes.data || []
      stats.value.pendingCount = list.filter(function(item) { return item.status === 'submitted' }).length
      // 只统计已经出分的答卷
      const graded = list.filter(function(item) { return item.status !== 'submitted' && typeof item.totalScore === 'number' })
      stats.value.avgScore = graded.length
        ? Math.round(graded.reduce(function(sum, item) { return sum + item.totalScore }, 0) / graded.length)
        : null
    }
    return api.get('/teacher/adaptation/overview')
  }).then(function(adaptiveRes) {
    if (adaptiveRes.success) adaptive.value = adaptiveRes.data
  }).catch(function(error) {
    console.error('加载数据失败:', error)
  })
}
</script>

<style scoped>
.t-dashboard { display: flex; flex-direction: column; gap: 28px; }

.greeting-date { margin: 0 0 6px; color: var(--nb-ink-3); font-size: 15px; }
.greeting-title { margin: 0; font-family: var(--nb-font-display); font-weight: 400; font-size: clamp(32px, 3.4vw, 42px); line-height: 1.2; color: var(--nb-ink); letter-spacing: 0.02em; }

.today { position: relative; padding: 22px 26px 24px 30px; background: var(--nb-sheet); border: 1px solid var(--nb-line); border-radius: var(--nb-radius); box-shadow: var(--nb-shadow); }
.today::before { content: ''; position: absolute; left: 0; top: 18px; bottom: 18px; width: 5px; border-radius: 0 5px 5px 0; background: var(--nb-red); }
.today-label { font-family: var(--nb-font-display); font-size: 19px; color: var(--nb-red-ink); letter-spacing: 0.04em; }
.today-body { margin-top: 8px; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
.today-text { flex: 1 1 380px; min-width: 0; }
.today-main { margin: 0; font-size: 25px; font-weight: 700; line-height: 1.4; color: var(--nb-ink); }
.today-sub { margin: 6px 0 0; max-width: 58ch; color: var(--nb-ink-2); font-size: 16px; line-height: 1.7; }

/* 数据卡：每张一种颜色，可点击进入对应页面 */
.stat-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.stat-tile {
  position: relative; display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 14px; align-items: center;
  padding: 18px 20px; border: 1px solid var(--nb-line); border-radius: var(--nb-radius); background: var(--nb-sheet); box-shadow: var(--nb-shadow);
  font: inherit; text-align: left; cursor: pointer; overflow: hidden; transition: transform .15s ease, border-color .15s ease;
}
.stat-tile::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: var(--tile); }
.stat-tile:hover { transform: translateY(-2px); border-color: var(--tile); }
.stat-icon { grid-row: span 2; width: 48px; height: 48px; display: grid; place-items: center; border-radius: 14px; background: var(--tile-soft); color: var(--tile); font-size: 24px; }
.stat-num { font-size: 34px; line-height: 1.1; color: var(--nb-ink); }
.stat-name { font-size: 15px; color: var(--nb-ink-2); }

.board { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 24px; align-items: start; }
.adaptive-overview { padding: 22px; border: 1px solid var(--nb-line); border-radius: var(--nb-radius); background: var(--nb-sheet); box-shadow: var(--nb-shadow); }
.adaptive-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; margin-bottom: 15px; }.adaptive-heading h2 { margin: 3px 0 0; font-family: var(--nb-font-display); font-size: 24px; font-weight: 500; }.adaptive-heading > span { color: var(--nb-ink-3); font-size: 13px; }.adaptive-kicker { color: var(--nb-blue); font-size: 13px; font-weight: 800; }
.adaptive-grid { display: grid; grid-template-columns: 1.4fr 1.2fr .7fr; gap: 13px; }.adaptive-card { padding: 15px; border: 1px solid var(--nb-line); border-radius: 12px; background: color-mix(in srgb, var(--nb-sheet) 92%, var(--nb-blue-soft)); color: var(--nb-ink); text-align: left; }.adaptive-card > b { display: block; margin-bottom: 11px; }.adaptive-card small { display: block; margin-top: 10px; color: var(--nb-ink-3); line-height: 1.45; }
.distribution { display: flex; min-height: 54px; overflow: hidden; border-radius: 9px; }.distribution span { display: grid; place-items: center; min-width: 72px; padding: 8px; background: color-mix(in srgb, var(--bar) 28%, white); border-bottom: 4px solid var(--bar); font-size: 13px; text-align: center; }
.preference-tags { display: flex; flex-wrap: wrap; gap: 7px; }.preference-tags span { padding: 7px 9px; border-radius: 8px; background: var(--nb-blue-soft); color: var(--nb-blue); font-size: 13px; font-weight: 700; }
.complexity-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }.complexity-tags span { padding: 4px 7px; border-radius: 6px; background: rgba(255,255,255,.75); color: var(--nb-ink-2); font-size: 12px; }
.support-card { border-color: #e3c676; background: #fff7cf; font: inherit; cursor: pointer; }.support-card strong { display: block; color: #9b6719; font-family: var(--nb-font-display); font-size: 40px; }.support-card b { margin-bottom: 0; }
.section-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.section-title { font-family: var(--nb-font-display); font-weight: 400; font-size: 22px; color: var(--nb-ink); }

/* 常用操作：四个彩色入口 */
.quick-title { margin: 0 0 14px; font-family: var(--nb-font-display); font-weight: 400; font-size: 22px; color: var(--nb-ink); }
.quick-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.quick-tile {
  display: flex; align-items: center; gap: 14px; padding: 18px; border: 1.5px solid var(--tile-soft); border-radius: var(--nb-radius);
  background: var(--tile-soft); font: inherit; text-align: left; cursor: pointer; transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;
}
.quick-tile:hover { transform: translateY(-2px); border-color: var(--tile); box-shadow: 0 12px 24px -16px var(--tile); }
.quick-icon { width: 46px; height: 46px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%; background: var(--tile); color: #fff; font-size: 22px; }
.quick-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.quick-label { font-size: 17px; font-weight: 700; color: var(--nb-ink); }
.quick-desc { font-size: 14px; color: var(--nb-ink-2); }

@media (max-width: 1200px) {
  .stat-row, .quick-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .board { grid-template-columns: minmax(0, 1fr); }
  .adaptive-grid { grid-template-columns: 1fr 1fr; }.support-card { grid-column: span 2; }
}
@media (max-width: 560px) {
  .stat-row, .quick-grid { grid-template-columns: minmax(0, 1fr); }
  .today-main { font-size: 21px; }
  .adaptive-grid { grid-template-columns: 1fr; }.support-card { grid-column: auto; }.adaptive-heading { align-items: flex-start; flex-direction: column; }
}
</style>
