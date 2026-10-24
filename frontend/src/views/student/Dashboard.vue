<template>
  <div class="nb-dashboard">
    <!-- 问候 -->
    <header class="greeting">
      <p class="greeting-date">{{ currentDate }}</p>
      <h1 class="greeting-title">{{ userName }}，{{ greetingWord }}</h1>
    </header>

    <!-- 今天先做这一件 -->
    <section class="today" v-loading="loadingWeakPoints || loadingAssignments">
      <div class="today-label">今天先做这一件</div>
      <div class="today-body">
        <div class="today-text">
          <p class="today-main">{{ nextStep.title }}</p>
          <p class="today-sub">{{ nextStep.detail }}</p>
        </div>
        <div class="today-actions">
          <el-button v-if="nextStep.secondaryText" @click="nextStep.secondary()">{{ nextStep.secondaryText }}</el-button>
          <el-button type="primary" size="large" @click="nextStep.primary()">{{ nextStep.primaryText }}</el-button>
        </div>
      </div>
    </section>

    <div class="board">
      <!-- 知识方格 -->
      <section class="sheet grid-sheet" v-loading="loadingWeakPoints">
        <div class="sheet-head">
          <h2 class="sheet-title">知识方格</h2>
          <div class="legend"><span>尚未测评或样本不足 {{ breakdown.unassessed }}</span>
            <span class="legend-item is-mastered"><i></i>已掌握 <b class="nb-num">{{ breakdown.mastered }}</b></span>
            <span class="legend-item is-learning"><i></i>待巩固 <b class="nb-num">{{ breakdown.learning }}</b></span>
            <span class="legend-item is-weak"><i></i>薄弱 <b class="nb-num">{{ breakdown.weak }}</b></span>
          </div>
        </div>
        <p class="sheet-note">
          每个知识点一格，格子涂得越满掌握得越好。整体平均掌握度
          <b class="nb-num avg">{{ averageMastery === null ? '尚未测评' : averageMastery + '%' }}</b>。点一格就能开始练习。
        </p>

        <div v-if="groups.length" class="kp-rows">
          <div v-for="group in groups" :key="group.name" class="kp-row">
            <div class="kp-row-name" :style="{ '--cat': categoryColor(group.name) }"><i aria-hidden="true"></i>{{ group.name }}</div>
            <div class="kp-tiles">
              <button
                v-for="item in group.items"
                :key="item.id"
                type="button"
                :class="['kp-tile', 'is-' + item.status]"
                :style="{ '--fill': (item.mastery || 0) + '%' }"
                :disabled="!item.eligible"
                :aria-label="item.name + '，' + item.label + (item.mastery === null ? '' : '，参考掌握度 ' + item.mastery + '%') + (item.eligible ? '，点击开始练习' : '，尚未加入已学范围')"
                @click="practice(item)"
              >
                <span class="kp-name">{{ item.name }}</span>
                <span class="kp-foot">
                  <span class="kp-mark" aria-hidden="true">{{ item.mark }}</span>
                  <span class="kp-rate nb-num">{{ item.mastery === null ? item.label : item.mastery + '%' }}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
        <el-empty v-else-if="!loadingWeakPoints" description="还没有答题记录。做一份作业或一组练习后，这里会填上颜色。" />
      </section>

      <div class="side"><ReviewPlan />
        <!-- 作业 -->
        <section class="sheet" v-loading="loadingAssignments">
          <div class="sheet-head">
            <h2 class="sheet-title">待交作业</h2>
            <el-button link type="primary" @click="go('/student/assignments')">全部作业</el-button>
          </div>
          <ul v-if="pendingAssignments.length" class="homework">
            <li v-for="item in pendingAssignments" :key="item.id" class="homework-item">
              <div class="homework-info">
                <span class="homework-title">{{ item.title }}</span>
                <span class="homework-meta">{{ item.questionCount || 0 }} 题，{{ formatDeadline(item.deadline) }}</span>
              </div>
              <el-button size="small" type="primary" @click="go('/student/assignment/' + item.id)">开始答题</el-button>
            </li>
          </ul>
          <p v-else-if="!loadingAssignments" class="side-empty">作业都交了。</p>
        </section>

        <!-- 错题本 -->
        <section class="sheet wrong-sheet">
          <div class="sheet-head">
            <h2 class="sheet-title">错题本</h2>
          </div>
          <div class="wrong-count">
            <span class="nb-num wrong-number">{{ wrongStats.unmasteredCount }}</span>
            <span class="wrong-text">{{ wrongStats.unmasteredCount ? '道错题还没订正' : '道待订正的错题，保持住' }}</span>
          </div>
          <div class="side-links">
            <el-button @click="go('/student/wrong-questions')">打开错题本</el-button>
            <el-button link type="primary" @click="go('/student/learning-track')">看学习轨迹</el-button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import api from '@/utils/api'
import ReviewPlan from '@/components/ReviewPlan.vue'
import { NB_CATEGORY } from '@/utils/notebook-colors'
import { KNOWLEDGE_TREE_SHARED_CONFIG, inferMajorCategory, normalizeStatusLabel, parseMasteryRate } from '@/utils/knowledge-meta'

const router = useRouter()
const loadingAssignments = ref(false)
const loadingWeakPoints = ref(false)
const pendingAssignments = ref([])
const weakPointList = ref([])
const wrongStats = ref({ unmasteredCount: 0 })

const STATUS_KEY = { 已掌握: 'mastered', 待巩固: 'learning', 薄弱: 'weak' }
const STATUS_MARK = { mastered: '✓', learning: '', weak: '✗' }
const CATEGORY_ORDER = KNOWLEDGE_TREE_SHARED_CONFIG.categories.map(item => item.name)

const userName = computed(() => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user.name || '同学'
  } catch (e) {
    return '同学'
  }
})

const currentDate = computed(() => dayjs().format('M月D日 dddd'))
const greetingWord = computed(() => {
  const hour = dayjs().hour()
  if (hour < 6) return '夜深了，早点休息'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const knowledgeItems = computed(() => weakPointList.value.map((item) => {
  const mastery = item.masteryRate === null ? null : parseMasteryRate(item.masteryRate)
  const label = normalizeStatusLabel(item.statusLabel, mastery)
  const status = STATUS_KEY[label] || 'unassessed'
  return {
    eligible: item.eligible,
    id: item.id,
    name: item.name,
    mastery,
    label,
    status,
    mark: STATUS_MARK[status],
    category: inferMajorCategory(item, '数与式')
  }
}))

const groups = computed(() => {
  const map = {}
  knowledgeItems.value.forEach((item) => {
    if (!map[item.category]) map[item.category] = []
    map[item.category].push(item)
  })
  const ordered = CATEGORY_ORDER.concat(Object.keys(map).filter(name => !CATEGORY_ORDER.includes(name)))
  return ordered
    .filter(name => map[name] && map[name].length)
    .map(name => ({ name, items: map[name] }))
})

const breakdown = computed(() => {
  const result = { mastered: 0, learning: 0, weak: 0, unassessed: 0 }
  knowledgeItems.value.forEach((item) => { result[item.status] += 1 })
  return result
})

const averageMastery = computed(() => {
  const list = knowledgeItems.value.filter(item => item.mastery !== null)
  if (!list.length) return null
  return Math.round(list.reduce((sum, item) => sum + item.mastery, 0) / list.length)
})

const weakest = computed(() => {
  return knowledgeItems.value
    .filter(item => item.eligible && item.mastery !== null && item.status !== 'mastered')
    .sort((a, b) => a.mastery - b.mastery)[0] || null
})

// 首页只给一个明确的下一步：先交作业，其次补最薄弱的知识点
const nextStep = computed(() => {
  const homework = pendingAssignments.value[0]
  if (homework) {
    return {
      title: `先完成作业「${homework.title}」`,
      detail: `${homework.questionCount || 0} 道题，${formatDeadline(homework.deadline)}。`,
      primaryText: '开始答题',
      primary: () => go('/student/assignment/' + homework.id),
      secondaryText: weakest.value ? '先补薄弱点' : '',
      secondary: () => practice(weakest.value)
    }
  }
  if (weakest.value) {
    return {
      title: `补一补「${weakest.value.name}」`,
      detail: `它是你现在掌握度最低的知识点，参考掌握度为 ${weakest.value.mastery}%。继续练习不同题目，样本充足后再判断掌握情况。`,
      primaryText: '开始练习',
      primary: () => practice(weakest.value),
      secondaryText: '看它的前置知识',
      secondary: () => go('/student/knowledge')
    }
  }
  if (knowledgeItems.value.length && knowledgeItems.value.every(item => item.status === 'mastered')) {
    return {
      title: '所有知识点都达标了',
      detail: '去错题本把以前做错的题再做一遍，巩固一下。',
      primaryText: '打开错题本',
      primary: () => go('/student/wrong-questions'),
      secondaryText: '',
      secondary: () => {}
    }
  }
  return {
    title: '从第一份练习开始',
    detail: '尚未测评的知识点不会判定薄弱。先完成老师布置的作业，或练习班级已经学过的内容。',
    primaryText: '去知识图谱',
    primary: () => go('/student/knowledge'),
    secondaryText: '',
    secondary: () => {}
  }
})

function go(path) { router.push(path) }

function categoryColor(name) { return NB_CATEGORY[name] || 'var(--nb-blue)' }

function practice(item) {
  if (!item) return
  router.push({ path: '/student/practice', query: { kpId: item.id } })
}

function formatDeadline(date) {
  if (!date) return '没有截止时间'
  const d = dayjs(date)
  const days = d.startOf('day').diff(dayjs().startOf('day'), 'day')
  if (days < 0) return '已过截止时间'
  if (days === 0) return '今天 ' + d.format('HH:mm') + ' 截止'
  if (days === 1) return '明天 ' + d.format('HH:mm') + ' 截止'
  return d.format('M月D日') + ' 截止'
}

function loadAssignments() {
  loadingAssignments.value = true
  api.get('/student/assignments', { status: 'pending' }).then((res) => {
    if (res.success) pendingAssignments.value = (res.data || []).slice(0, 4)
  }).catch(() => {
    pendingAssignments.value = []
  }).finally(() => {
    loadingAssignments.value = false
  })
}

function loadWeakPoints() {
  loadingWeakPoints.value = true
  api.get('/student/weak-points').then((res) => {
    if (res.success) weakPointList.value = res.data || []
  }).catch(() => {
    weakPointList.value = []
  }).finally(() => {
    loadingWeakPoints.value = false
  })
}

function loadWrongStats() {
  api.get('/student/wrong-questions/stats').then((res) => {
    if (res.success && res.data) wrongStats.value = res.data
  }).catch(() => {})
}

onMounted(() => {
  loadAssignments()
  loadWeakPoints()
  loadWrongStats()
})
</script>

<style scoped>
.nb-dashboard {
  display: flex;
  flex-direction: column;
  gap: 28px;
  /* 给固定在右下角的助教留出页尾安全区，避免遮挡最后一张卡片。 */
  padding-bottom: 132px;
}

/* ---------- 问候 ---------- */
.greeting-date {
  margin: 0 0 6px;
  color: var(--nb-ink-3);
  font-size: 14px;
}

.greeting-title {
  margin: 0;
  font-family: var(--nb-font-display);
  font-weight: 400;
  font-size: clamp(30px, 3.4vw, 40px);
  line-height: 1.2;
  color: var(--nb-ink);
  letter-spacing: 0.02em;
}

/* ---------- 今天先做这一件 ---------- */
.today {
  position: relative;
  padding: 22px 26px 24px;
  background: var(--nb-sheet);
  border: 1px solid var(--nb-line);
  border-radius: var(--nb-radius);
  box-shadow: var(--nb-shadow);
}

.today::before {
  content: '';
  position: absolute;
  left: 0;
  top: 18px;
  bottom: 18px;
  width: 4px;
  border-radius: 0 4px 4px 0;
  background: var(--nb-red);
}

.today-label {
  font-family: var(--nb-font-display);
  font-size: 17px;
  color: var(--nb-red-ink);
  letter-spacing: 0.04em;
}

.today-body {
  margin-top: 8px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}

.today-text {
  flex: 1 1 380px;
  min-width: 0;
}

.today-main {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--nb-ink);
}

.today-sub {
  margin: 6px 0 0;
  max-width: 56ch;
  color: var(--nb-ink-2);
  font-size: 15px;
  line-height: 1.7;
}

.today-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* ---------- 版面 ---------- */
.board {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  align-items: start;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.sheet {
  padding: 20px 22px 22px;
  background: var(--nb-sheet);
  border: 1px solid var(--nb-line);
  border-radius: var(--nb-radius);
  box-shadow: var(--nb-shadow);
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.sheet-title {
  margin: 0;
  font-family: var(--nb-font-display);
  font-weight: 400;
  font-size: 22px;
  color: var(--nb-ink);
}

.sheet-note {
  margin: 8px 0 18px;
  color: var(--nb-ink-2);
  font-size: 14px;
  line-height: 1.7;
}

.sheet-note .avg {
  color: var(--nb-ink);
  font-size: 16px;
}

/* ---------- 图例 ---------- */
.legend {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 14px;
  color: var(--nb-ink-2);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-item i {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1.5px solid var(--c);
  background: var(--c-soft);
}

.legend-item b {
  color: var(--nb-ink);
}

.is-mastered { --c: var(--nb-green); --c-ink: var(--nb-green-ink); --c-soft: var(--nb-green-soft); }
.is-learning { --c: var(--nb-orange); --c-ink: var(--nb-orange-ink); --c-soft: var(--nb-orange-soft); }
.is-weak { --c: var(--nb-red); --c-ink: var(--nb-red-ink); --c-soft: var(--nb-red-soft); }

/* ---------- 知识方格 ---------- */
.kp-rows {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.kp-row {
  display: grid;
  grid-template-columns: 124px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.kp-row-name {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  font-size: 15px;
  font-weight: 700;
  color: var(--nb-ink);
}

.kp-row-name i {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--cat);
  flex-shrink: 0;
}

.kp-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 10px;
}

.kp-tile.is-unassessed { background: #f1f4f9; color: var(--nb-ink-3); }
.kp-tile:disabled { cursor: default; opacity: 0.65; }
.kp-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  min-height: 76px;
  padding: 10px 11px 9px;
  border: 1.5px solid var(--c);
  border-radius: 8px;
  font: inherit;
  text-align: left;
  cursor: pointer;
  color: var(--nb-ink);
  /* 从下往上按掌握度涂色 */
  background:
    linear-gradient(to top, var(--c-soft) var(--fill), transparent var(--fill)),
    var(--nb-sheet);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.kp-tile.is-weak {
  border-style: dashed;
}

.kp-tile:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 0 -2px var(--c-soft), 0 8px 16px -10px rgba(28, 37, 65, 0.35);
}

.kp-name {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
  word-break: break-all;
}

.kp-foot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.kp-mark {
  font-size: 15px;
  font-weight: 700;
  color: var(--c-ink);
}

.kp-rate {
  font-size: 15px;
  color: var(--c-ink);
}

/* ---------- 作业 ---------- */
.homework {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
}

.homework-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px dashed var(--nb-line-strong);
}

.homework-item:first-child {
  border-top: none;
  padding-top: 4px;
}

.homework-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.homework-title {
  font-weight: 700;
  color: var(--nb-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.homework-meta {
  margin-top: 2px;
  font-size: 14px;
  color: var(--nb-ink-3);
}

.side-empty {
  margin: 14px 0 0;
  color: var(--nb-ink-3);
  font-size: 14px;
}

/* ---------- 错题本 ---------- */
.wrong-count {
  margin: 12px 0 16px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.wrong-number {
  font-size: 44px;
  line-height: 1;
  color: var(--nb-red-ink);
}

.wrong-text {
  color: var(--nb-ink-2);
  font-size: 14px;
}

.side-links {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* ---------- 小屏 ---------- */
@media (max-width: 1100px) {
  .board {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .kp-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }

  .kp-row-name {
    padding-top: 0;
  }

  .kp-tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .today {
    padding: 18px 18px 20px 22px;
  }

  .today-main {
    font-size: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .kp-tile:hover {
    transform: none;
  }
}
</style>
