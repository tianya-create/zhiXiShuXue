<template>
  <div class="a-dashboard">
    <header class="greeting">
      <p class="greeting-date">{{ currentDate }}</p>
      <h1 class="greeting-title">{{ adminName }}，{{ greetingWord }}</h1>
    </header>

    <section class="today" v-loading="loading">
      <div class="today-label">今天先做这一件</div>
      <div class="today-body">
        <div class="today-text">
          <p class="today-main">{{ nextStep.title }}</p>
          <p class="today-sub">{{ nextStep.detail }}</p>
        </div>
        <el-button type="primary" size="large" @click="goTo(nextStep.path)">{{ nextStep.button }}</el-button>
      </div>
    </section>

    <section class="stat-row">
      <button
        v-for="item in statTiles"
        :key="item.label"
        type="button"
        class="stat-tile"
        :style="{ '--tile': item.color, '--tile-soft': item.soft }"
        @click="goTo(item.path)"
      >
        <span class="stat-icon"><el-icon><component :is="item.icon" /></el-icon></span>
        <span class="stat-num nb-num">{{ item.value }}</span>
        <span class="stat-name">{{ item.label }}</span>
      </button>
    </section>

    <div class="board">
      <el-card class="panel-card">
        <template #header>
          <div class="section-header">
            <span class="section-title">平台用户</span>
            <el-button type="primary" link @click="goTo('/admin/users')">用户管理</el-button>
          </div>
        </template>
        <p class="users-total"><b class="nb-num">{{ stats.userCount }}</b> 个账号</p>
        <div class="users-bar" role="img" :aria-label="usersAria">
          <span
            v-for="seg in userSegments"
            :key="seg.label"
            class="users-seg"
            :style="{ flexGrow: seg.value, background: seg.color }"
          ></span>
        </div>
        <ul class="users-legend">
          <li v-for="seg in userSegments" :key="seg.label">
            <i :style="{ background: seg.color }"></i>
            <span class="legend-name">{{ seg.label }}</span>
            <b class="nb-num">{{ seg.value }}</b>
          </li>
        </ul>
      </el-card>

      <el-card class="panel-card">
        <template #header>
          <div class="section-header">
            <span class="section-title">最近操作</span>
            <el-button type="primary" link @click="goTo('/admin/logs')">全部日志</el-button>
          </div>
        </template>
        <ul v-if="recentLogs.length" class="log-list">
          <li v-for="log in recentLogs" :key="log.id" class="log-item">
            <span :class="['log-dot', 'is-' + String(log.action || '').toLowerCase()]" aria-hidden="true"></span>
            <span class="log-text">{{ describeLog(log) }}</span>
            <span class="log-time">{{ fromNow(log.timestamp) }}</span>
          </li>
        </ul>
        <p v-else class="empty-text">还没有操作记录。</p>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import api from '@/utils/api'
import { describeLog } from '@/utils/log-text'

const router = useRouter()
const loading = ref(false)
const recentLogs = ref([])

const stats = reactive({
  userCount: 0,
  teacherCount: 0,
  studentCount: 0,
  classCount: 0,
  paperCount: 0,
  questionCount: 0,
  answerCount: 0
})

const currentDate = computed(() => dayjs().format('M月D日 dddd'))
const greetingWord = computed(() => {
  const hour = dayjs().hour()
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})
const adminName = computed(() => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user.name || '管理员'
  } catch (e) {
    return '管理员'
  }
})

const statTiles = computed(() => [
  { label: '个班级', value: stats.classCount, icon: 'OfficeBuilding', path: '/admin/classes', color: 'var(--nb-blue)', soft: 'var(--nb-blue-soft)' },
  { label: '道题目', value: stats.questionCount, icon: 'Document', path: '/admin/questions', color: 'var(--nb-purple)', soft: 'var(--nb-purple-soft)' },
  { label: '份试卷', value: stats.paperCount, icon: 'Notebook', path: '/admin/statistics', color: 'var(--nb-pink)', soft: 'var(--nb-pink-soft)' },
  { label: '条答题记录', value: stats.answerCount, icon: 'TrendCharts', path: '/admin/statistics', color: 'var(--nb-teal)', soft: 'var(--nb-teal-soft)' }
])

const userSegments = computed(() => {
  const admins = Math.max(0, stats.userCount - stats.teacherCount - stats.studentCount)
  return [
    { label: '学生', value: stats.studentCount, color: 'var(--nb-blue)' },
    { label: '教师', value: stats.teacherCount, color: 'var(--nb-pink)' },
    { label: '管理员', value: admins, color: 'var(--nb-orange)' }
  ].filter(seg => seg.value > 0)
})

const usersAria = computed(() => '用户构成：' + userSegments.value.map(seg => seg.label + ' ' + seg.value + ' 人').join('，'))

// 首页只给一个明确的下一步
const nextStep = computed(() => {
  if (!stats.classCount) {
    return {
      title: '还没有班级',
      detail: '先导入班级和学生名单，老师才能布置作业。',
      button: '去导入班级',
      path: '/admin/users'
    }
  }
  return {
    title: '平台一切正常',
    detail: `共有 ${stats.studentCount} 名学生、${stats.teacherCount} 名教师在使用。可以看看数据统计，了解答题情况。`,
    button: '看数据统计',
    path: '/admin/statistics'
  }
})

function goTo(path) { router.push(path) }

function fromNow(time) {
  if (!time) return '-'
  const minutes = dayjs().diff(dayjs(time), 'minute')
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return minutes + ' 分钟前'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + ' 小时前'
  return dayjs(time).format('M月D日 HH:mm')
}

function loadData() {
  loading.value = true
  Promise.all([
    api.get('/admin/statistics/overview').then((res) => {
      if (res.success) Object.assign(stats, res.data || {})
    }),
    api.get('/admin/logs', { pageSize: 8 }).then((res) => {
      if (res.success && res.data && res.data.data) recentLogs.value = res.data.data.slice(0, 8)
    })
  ]).catch((error) => {
    console.error('加载首页数据失败:', error)
  }).finally(() => {
    loading.value = false
  })
}

onMounted(loadData)
</script>

<style scoped>
.a-dashboard { display: flex; flex-direction: column; gap: 28px; }

.greeting-date { margin: 0 0 6px; color: var(--nb-ink-3); font-size: 15px; }
.greeting-title { margin: 0; font-family: var(--nb-font-display); font-weight: 400; font-size: clamp(32px, 3.4vw, 42px); line-height: 1.2; color: var(--nb-ink); letter-spacing: 0.02em; }

.today { position: relative; padding: 22px 26px 24px 30px; background: var(--nb-sheet); border: 1px solid var(--nb-line); border-radius: var(--nb-radius); box-shadow: var(--nb-shadow); }
.today::before { content: ''; position: absolute; left: 0; top: 18px; bottom: 18px; width: 5px; border-radius: 0 5px 5px 0; background: var(--nb-red); }
.today-label { font-family: var(--nb-font-display); font-size: 19px; color: var(--nb-red-ink); letter-spacing: 0.04em; }
.today-body { margin-top: 8px; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
.today-text { flex: 1 1 380px; min-width: 0; }
.today-main { margin: 0; font-size: 25px; font-weight: 700; line-height: 1.4; color: var(--nb-ink); }
.today-sub { margin: 6px 0 0; max-width: 58ch; color: var(--nb-ink-2); font-size: 16px; line-height: 1.7; }

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

.board { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 24px; align-items: start; }
.section-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.section-title { font-family: var(--nb-font-display); font-weight: 400; font-size: 22px; color: var(--nb-ink); }

/* 用户构成：一条按比例分段的色条 */
.users-total { margin: 0 0 14px; font-size: 16px; color: var(--nb-ink-2); }
.users-total b { font-size: 34px; color: var(--nb-ink); margin-right: 4px; }
.users-bar { display: flex; gap: 4px; height: 18px; }
.users-seg { min-width: 10px; border-radius: 6px; }
.users-legend { list-style: none; margin: 18px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.users-legend li { display: flex; align-items: center; gap: 10px; font-size: 16px; }
.users-legend i { width: 14px; height: 14px; border-radius: 4px; }
.legend-name { flex: 1; color: var(--nb-ink-2); }
.users-legend b { font-size: 18px; color: var(--nb-ink); }

/* 最近操作 */
.log-list { list-style: none; margin: 0; padding: 0; }
.log-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px dashed var(--nb-line-strong); font-size: 15px; }
.log-item:first-child { border-top: none; padding-top: 0; }
.log-dot { width: 10px; height: 10px; flex-shrink: 0; border-radius: 50%; background: var(--nb-ink-3); }
.log-dot.is-login { background: var(--nb-green); }
.log-dot.is-logout { background: var(--nb-ink-3); }
.log-dot.is-create { background: var(--nb-blue); }
.log-dot.is-update { background: var(--nb-orange); }
.log-dot.is-delete { background: var(--nb-red); }
.log-text { flex: 1; min-width: 0; color: var(--nb-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.log-time { flex-shrink: 0; color: var(--nb-ink-3); font-size: 14px; }
.empty-text { margin: 0; color: var(--nb-ink-3); font-size: 15px; }

@media (max-width: 1200px) {
  .stat-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .board { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 560px) {
  .stat-row { grid-template-columns: minmax(0, 1fr); }
  .today-main { font-size: 21px; }
}
</style>
