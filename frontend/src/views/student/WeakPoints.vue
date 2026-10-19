<template>
  <div class="weak-points">
    <div class="page-header weak-header">
      <div class="header-left">
        <h2>薄弱知识点</h2>
        <p>还没掌握的知识点都列在这里，掌握度低的排在前面。</p>
      </div>
      <el-button type="primary" size="large" :disabled="!weakPoints.length" @click="generatePracticePlan">
        按顺序补最弱的 3 个
      </el-button>
    </div>

    <section v-if="newRecommendations.length" class="teacher-note">
      <h3 class="note-title">老师批改后，这些知识点需要先补</h3>
      <ul class="note-list">
        <li v-for="item in newRecommendations" :key="item.id" class="note-item">
          <div class="note-main">
            <span class="note-name">{{ item.name }}</span>
            <span class="note-meta">
              错了 <b class="nb-num">{{ item.wrongCount }}</b> 次，掌握度 <b class="nb-num">{{ item.masteryRate }}%</b>
              <template v-if="item.lastHomeworkAt">，{{ formatDate(item.lastHomeworkAt) }} 的作业</template>
            </span>
          </div>
          <el-button type="primary" @click="startPractice(item)">去练习</el-button>
        </li>
      </ul>
    </section>

    <div v-loading="loading" class="category-list">
      <section v-for="group in groupedWeakPoints" :key="group.name" class="category-item">
        <button
          type="button"
          class="category-head"
          :aria-expanded="isCategoryExpanded(group.name)"
          @click="toggleCategory(group.name)"
        >
          <span class="category-title">{{ group.name }}</span>
          <span class="category-desc">{{ group.summary }}</span>
          <span class="category-count nb-num">{{ group.items.length }}</span>
          <el-icon :class="['category-arrow', { 'is-open': isCategoryExpanded(group.name) }]"><ArrowDown /></el-icon>
        </button>

        <div v-show="isCategoryExpanded(group.name)" class="category-content">
          <ul v-if="group.items.length" class="kp-list">
            <li v-for="item in group.items" :key="item.id" :class="['kp-item', 'is-' + getMasteryStatus(item.masteryRate)]">
              <div class="kp-main">
                <div class="kp-name-row">
                  <span class="kp-name">{{ item.name }}</span>
                  <span class="kp-status">{{ item.statusLabel }}</span>
                  <span v-if="item.hasNewRecommendation" class="kp-new">老师推荐</span>
                </div>
                <div class="kp-bar" role="progressbar" :aria-valuenow="parseInt(item.masteryRate || 0, 10)" aria-valuemin="0" aria-valuemax="100" :aria-label="item.name + ' 掌握度'">
                  <span :style="{ width: parseInt(item.masteryRate || 0, 10) + '%' }"></span>
                </div>
                <div class="kp-meta">
                  <span>掌握度 <b class="nb-num">{{ parseInt(item.masteryRate || 0, 10) }}%</b></span>
                  <span v-if="item.suggestedStudyTime">建议学 {{ item.suggestedStudyTime }} 分钟</span>
                  <span v-if="item.lastWrongTime">最近答错 {{ formatDate(item.lastWrongTime) }}</span>
                </div>
              </div>
              <el-button @click="startPractice(item)">去练习</el-button>
            </li>
          </ul>
          <p v-else class="category-empty">这一类没有薄弱知识点。</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { NB_CHART as CHART_COLORS } from '@/utils/notebook-colors'
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import dayjs from 'dayjs'
import { MAJOR_CATEGORY_CONFIG, getMasteryStatus, inferMajorCategory } from '@/utils/knowledge-meta'
import { ArrowDown } from '@element-plus/icons-vue'

var router = useRouter()
var weakPoints = ref([])
var loading = ref(false)
var categoryExpandedMap = ref({})

var newRecommendations = computed(function() {
  return weakPoints.value.filter(function(item) {
    return !!item.hasNewRecommendation && Number(item.wrongCount || 0) > 0
  })
})

var groupedWeakPoints = computed(function() {
  return MAJOR_CATEGORY_CONFIG.map(function(config) {
    var items = weakPoints.value
      .filter(function(item) {
        return getCategoryName(item) === config.name
      })
      // 不需要在这里额外排序，后端已经排好序（红->黄->绿，同级按最近答错时间）

    var weakCount = items.filter(function(item) { return getMasteryStatus(item.masteryRate) === 'weak' }).length
    var summary = items.length
      ? (weakCount ? ('当前有 ' + weakCount + ' 个知识点需要优先突破。') : '当前主要是稳定性巩固。')
      : '该分类下暂时没有薄弱环节。'

    return {
      name: config.name,
      items: items,
      summary: summary,
      tagType: weakCount ? 'danger' : items.length ? 'warning' : 'success'
    }
  })
})

onMounted(function() {
  loadData()
})

function loadData() {
  loading.value = true
  api.get('/student/weak-points')
    .then(function(res) {
      if (res.success) {
        // 后端已经过滤并排序好了，只保留掌握度 < 80 的（即红和黄）
        weakPoints.value = (res.data || []).filter(function(p) { return p.eligible && p.masteryRate !== null && p.masteryRate < 80 })
        ensureExpandedState()
      }
    })
    .catch(function(error) {
      console.error('加载失败:', error)
    })
    .finally(function() {
      loading.value = false
    })
}

function getMasteryLabel(rate) {
  if (rate < 60) return '薄弱'
  if (rate < 80) return '待巩固'
  return '已掌握'
}

function getMasteryTagType(rate) {
  if (rate < 60) return 'danger'
  if (rate < 80) return 'warning'
  return 'success'
}

function generatePracticePlan() {
  const topN = 3
  const targetKPs = weakPoints.value
    .slice()
    .sort(function(a, b) { return Number(a.masteryRate || 0) - Number(b.masteryRate || 0) })
    .slice(0, topN)
  if (!targetKPs.length) return

  ElMessageBox.confirm(
    `将按掌握度从低到高，依次练习以下 ${targetKPs.length} 个知识点：${targetKPs.map(k => k.name).join('、')}。每完成一组题目会自动进入下一个知识点。`,
    '专项补练计划',
    {
      confirmButtonText: '开始练习',
      cancelButtonText: '取消',
      type: 'info',
    }
  ).then(() => {
    router.push({
      path: '/student/practice',
      query: {
        kpId: targetKPs[0].id,
        plan: targetKPs.map(k => k.id).join(','),
        planNames: targetKPs.map(k => k.name).join(',')
      }
    })
  }).catch(() => {})
}

function getCategoryName(item) {
  return inferMajorCategory(item, '数与式')
}

function ensureExpandedState() {
  var nextMap = Object.assign({}, categoryExpandedMap.value)
  var hasExpanded = false
  groupedWeakPoints.value.forEach(function(group) {
    if (typeof nextMap[group.name] !== 'boolean') nextMap[group.name] = false
    if (nextMap[group.name]) hasExpanded = true
  })
  if (!hasExpanded) {
    var firstWithData = groupedWeakPoints.value.find(function(group) { return group.items.length })
    if (firstWithData) nextMap[firstWithData.name] = true
  }
  categoryExpandedMap.value = nextMap
}

function toggleCategory(name) {
  categoryExpandedMap.value[name] = !categoryExpandedMap.value[name]
}

function isCategoryExpanded(name) {
  return !!categoryExpandedMap.value[name]
}

function getProgressColor(rate) {
  var status = getMasteryStatus(rate)
  if (status === 'mastered') return CHART_COLORS.mastered
  if (status === 'learning') return CHART_COLORS.learning
  return CHART_COLORS.weak
}

function startPractice(row) {
  router.push({ path: '/student/practice', query: { kpId: row.id } })
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}
</script>

<style scoped>
.weak-points { display: flex; flex-direction: column; gap: 22px; max-width: 980px; }
.weak-header { display: flex !important; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.header-left { min-width: 0; }

/* 老师批改后的提醒：像贴在本子上的红笔便条 */
.teacher-note {
  position: relative;
  padding: 18px 22px 18px 26px;
  background: var(--nb-sheet);
  border: 1px solid var(--nb-line);
  border-radius: var(--nb-radius);
  box-shadow: var(--nb-shadow);
}
.teacher-note::before { content: ''; position: absolute; left: 0; top: 16px; bottom: 16px; width: 4px; border-radius: 0 4px 4px 0; background: var(--nb-red); }
.note-title { margin: 0 0 6px; font-family: var(--nb-font-display); font-weight: 400; font-size: 19px; color: var(--nb-red-ink); }
.note-list { list-style: none; margin: 0; padding: 0; }
.note-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px dashed var(--nb-line-strong); }
.note-item:first-child { border-top: none; }
.note-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.note-name { font-size: 16px; font-weight: 700; color: var(--nb-ink); }
.note-meta { font-size: 14px; color: var(--nb-ink-2); }
.note-meta b { color: var(--nb-ink); }

/* 分类 */
.category-list { display: flex; flex-direction: column; gap: 12px; }
.category-item { background: var(--nb-sheet); border: 1px solid var(--nb-line); border-radius: var(--nb-radius); box-shadow: var(--nb-shadow); overflow: hidden; }
.category-head {
  width: 100%; display: flex; align-items: center; gap: 12px; padding: 16px 20px;
  border: none; background: transparent; font: inherit; text-align: left; cursor: pointer; color: var(--nb-ink);
}
.category-head:hover { background: #f8fafd; }
.category-title { font-family: var(--nb-font-display); font-size: 20px; flex-shrink: 0; }
.category-desc { flex: 1; min-width: 0; font-size: 14px; color: var(--nb-ink-3); }
.category-count { min-width: 28px; height: 28px; display: grid; place-items: center; border-radius: 8px; background: #f1f4f9; color: var(--nb-ink); font-size: 14px; }
.category-arrow { color: var(--nb-ink-3); transition: transform .2s ease; }
.category-arrow.is-open { transform: rotate(180deg); }
.category-content { border-top: 1px dashed var(--nb-line-strong); padding: 6px 20px 12px; }
.category-empty { margin: 10px 0; color: var(--nb-ink-3); font-size: 14px; }

/* 知识点 */
.kp-list { list-style: none; margin: 0; padding: 0; }
.kp-item { display: flex; align-items: center; gap: 16px; padding: 14px 0; border-top: 1px solid var(--nb-line); }
.kp-item:first-child { border-top: none; }
.kp-item.is-mastered { --c: var(--nb-green); --c-ink: var(--nb-green-ink); --c-soft: var(--nb-green-soft); }
.kp-item.is-learning { --c: var(--nb-orange); --c-ink: var(--nb-orange-ink); --c-soft: var(--nb-orange-soft); }
.kp-item.is-weak { --c: var(--nb-red); --c-ink: var(--nb-red-ink); --c-soft: var(--nb-red-soft); }
.kp-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.kp-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.kp-name { font-size: 16px; font-weight: 700; color: var(--nb-ink); }
.kp-status { padding: 1px 8px; border-radius: 5px; background: var(--c-soft); color: var(--c-ink); font-size: 14px; font-weight: 700; }
.kp-new { padding: 1px 8px; border-radius: 5px; border: 1px solid var(--nb-red); color: var(--nb-red-ink); font-size: 14px; font-weight: 700; }
.kp-bar { height: 8px; border-radius: 4px; background: #edf1f7; overflow: hidden; max-width: 520px; }
.kp-bar span { display: block; height: 100%; border-radius: 4px; background: var(--c); }
.kp-meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: 14px; color: var(--nb-ink-3); }
.kp-meta b { color: var(--nb-ink); }

@media (max-width: 640px) {
  .category-desc { display: none; }
  .kp-item { flex-direction: column; align-items: stretch; }
  .note-item { flex-direction: column; align-items: stretch; }
}
</style>
