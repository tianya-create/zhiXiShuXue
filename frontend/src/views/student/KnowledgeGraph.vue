<template>
  <div class="kg-page">
    <header class="page-header">
      <div class="header-content">
        <div class="header-text">
          <h2>知识图谱</h2>
          <p>按五大模块排列初中数学知识点，箭头表示“先学 → 后学”的前置关系，节点颜色表示你的掌握状态。</p>
        </div>
        <div class="kg-tools">
          <el-button @click="loadData">重新加载</el-button>
        </div>
      </div>
    </header>

    <div class="summary-row"><span>尚未测评或样本不足 {{ summary.unassessed }}</span>
      <span class="legend-item is-weak"><i></i>薄弱 <b class="nb-num">{{ summary.weak }}</b></span>
      <span class="legend-item is-learning"><i></i>待巩固 <b class="nb-num">{{ summary.learning }}</b></span>
      <span class="legend-item is-mastered"><i></i>已掌握 <b class="nb-num">{{ summary.mastered }}</b></span>
      <span class="summary-tip">红色连线表示前后两个知识点都还没掌握。点一个知识点，看它的前置知识并开始练习。</span>
    </div>

    <el-card class="graph-card gradient-card" v-loading="loading">
      <el-empty v-if="!loading && !flatNodes.length" description="暂无知识点数据" />
      <div v-show="flatNodes.length" class="graph-scroll-tip">左右滑动查看完整图谱</div>
      <div v-show="flatNodes.length" class="graph-scroll">
        <div ref="graphRef" class="graph-canvas"></div>
      </div>
    </el-card>

    <el-dialog v-model="practiceDialogVisible" :title="dialogTitle" width="980px" class="kg-dialog" destroy-on-close>
      <div v-if="activeNode" class="dialog-head">
        <el-tag :type="tagType(activeNode.statusLabel)">{{ activeNode.statusLabel }}</el-tag>
        <span>{{ activeNode.masteryRate === null ? '尚未测评' : '参考掌握度 ' + activeNode.masteryRate + '%' }}</span>
        <span class="dialog-category">{{ activeNode.categoryName }}</span>
      </div>

      <div v-if="activeNode" class="prereq-box">
        <div class="prereq-title">前置知识</div>
        <div v-if="activePrereqs.length" class="prereq-list">
          <button
            v-for="item in activePrereqs"
            :key="item.id"
            type="button"
            :class="['prereq-item', 'is-' + statusKey(item.statusLabel)]"
            @click="openNode(item)"
          >
            <span>{{ item.name }}</span>
            <small>{{ item.statusLabel }} {{ item.masteryRate === null ? '' : item.masteryRate+'%' }}</small>
          </button>
        </div>
        <div v-else class="prereq-empty">这是起点知识点，没有前置要求。</div>
        <el-alert
          v-if="weakPrereqs.length && activeNode.statusLabel !== '已掌握'"
          class="prereq-alert"
          type="warning"
          :closable="false"
          show-icon
          :title="'这里做错，可能是前置知识没打牢：建议先补「' + weakPrereqs.map(i => i.name).join('」「') + '」'"
        />
      </div>

      <el-empty v-if="!practiceQuestions.length && !practiceLoading" description="当前暂无可用练习题" />

      <div v-else v-loading="practiceLoading">
        <QuestionCard
          v-for="(item, index) in practiceQuestions"
          :key="item.id"
          :question="normalizeQuestion(item)"
          :index="index"
          v-model="practiceAnswers[item.id]"
          :result="practiceResults[item.id]"
        />

        <div class="practice-pack-actions footer-actions"><span>{{ graphDraft.status.value || '作答会自动保存' }}</span>
          <el-button @click="practiceDialogVisible = false">关闭</el-button>
          <el-button
            type="primary"
            :loading="practiceSubmitting"
            :disabled="practiceSubmitted"
            @click="submitPracticePack"
          >
            {{ practiceSubmitted ? '已批改' : '交卷批改' }}
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { NB_ECHARTS_THEME, registerNotebookChartTheme } from '@/utils/notebook-colors'
registerNotebookChartTheme(echarts)
import api from '@/utils/api'
import { useAnswerDraft } from '@/composables/useAnswerDraft'
import QuestionCard from '@/components/QuestionCard.vue'
import { inferMajorCategory, normalizeStatusLabel, KNOWLEDGE_TREE_SHARED_CONFIG } from '@/utils/knowledge-meta'
import { NB, NB_MASTERY, NB_MASTERY_INK, NB_CATEGORY, NB_FONT } from '@/utils/notebook-colors'

const SOFT = { 已掌握: NB.greenSoft, 待巩固: NB.orangeSoft, 薄弱: NB.redSoft }

const loading = ref(false)
const graphRef = ref(null)
const flatNodes = ref([])
const practiceDialogVisible = ref(false)
const practiceLoading = ref(false)
const practiceSubmitting = ref(false)
const activeNode = ref(null)
const practiceQuestions = ref([])
const practiceAnswers = ref({})
const practiceResults = ref({})
let chart = null

const CATEGORIES = KNOWLEDGE_TREE_SHARED_CONFIG.categories.map(item => item.name)

// 前置关系来自 shared/knowledge-tree.json
const PREREQ_MAP = computed(() => Object.fromEntries(flatNodes.value.map(node => [node.id, node.prerequisites || []])))

const nodeMap = computed(() => flatNodes.value.reduce((acc, item) => {
  acc[item.id] = item
  return acc
}, {}))

const summary = computed(() => flatNodes.value.reduce((acc, item) => {
  if (item.statusLabel === '已掌握') acc.mastered += 1
  else if (item.statusLabel === '待巩固') acc.learning += 1
  else if (item.statusLabel === '薄弱') acc.weak += 1
  else acc.unassessed += 1
  return acc
}, { weak: 0, learning: 0, mastered: 0, unassessed: 0 }))

const activePrereqs = computed(() => {
  if (!activeNode.value) return []
  return (PREREQ_MAP.value[activeNode.value.id] || []).map(id => nodeMap.value[id]).filter(Boolean)
})

const weakPrereqs = computed(() => activePrereqs.value.filter(item => item.statusLabel === '薄弱'))
const graphDraft = useAnswerDraft(computed(() => 'graph-' + (activeNode.value?.id || '')), practiceAnswers, practiceQuestions)
const practiceSubmitted = computed(() => Object.keys(practiceResults.value).length > 0)

const dialogTitle = computed(() => {
  if (!activeNode.value) return '知识点练习'
  return `${activeNode.value.statusLabel === '已掌握' ? '巩固' : '练习'}：${activeNode.value.name}`
})

function statusKey(label) {
  if (label === '已掌握') return 'mastered'
  if (label === '待巩固') return 'learning'
  return 'weak'
}

function tagType(label) {
  if (label === '尚未测评') return 'info'
  if (label === '样本不足') return 'warning'
  if (label === '已掌握') return 'success'
  if (label === '待巩固') return 'warning'
  return 'danger'
}

function normalizeNodes(list) {
  return (list || []).map((item) => ({
    ...item,
    masteryRate: item.masteryRate === null ? null : Number(item.masteryRate || 0),
    categoryName: inferMajorCategory(item, CATEGORIES[0]),
    statusLabel: normalizeStatusLabel(item.statusLabel, item.masteryRate)
  }))
}

function normalizeQuestion(item) {
  return {
    ...item,
    type: item.type === 'objective' ? 'choice' : item.type,
    difficulty: item.difficulty || item.difficultyLevel || 3,
    answer: item.standardAnswer || item.answerDisplay || item.answer || '-'
  }
}

// 计算每个知识点在学习路径上的“层级”（前置链越长越靠右）
function computeDepths(ids) {
  const depth = {}
  const visiting = new Set()
  function walk(id) {
    if (depth[id] !== undefined) return depth[id]
    if (visiting.has(id)) return 0
    visiting.add(id)
    const prereqs = (PREREQ_MAP.value[id] || []).filter(p => ids.has(p))
    depth[id] = prereqs.length ? Math.max(...prereqs.map(walk)) + 1 : 0
    visiting.delete(id)
    return depth[id]
  }
  ids.forEach(walk)
  return depth
}

function buildGraph() {
  const ids = new Set(flatNodes.value.map(item => item.id))
  const depth = computeDepths(ids)
  const lanes = CATEGORIES.slice()
  flatNodes.value.forEach(item => { if (!lanes.includes(item.categoryName)) lanes.push(item.categoryName) })

  const COL_W = 190
  const ROW_H = 72
  const LANE_GAP = 40
  const nodes = []
  const links = []
  let laneTop = 0

  lanes.forEach(lane => {
    const items = flatNodes.value.filter(item => item.categoryName === lane)
    if (!items.length) return
    const slots = {}
    items.forEach(item => {
      const d = depth[item.id] || 0
      slots[d] = (slots[d] || 0) + 1
    })
    const laneRows = Math.max(1, ...Object.values(slots))
    const laneHeight = laneRows * ROW_H
    const used = {}

    nodes.push({
      id: 'lane-' + lane,
      name: lane,
      x: -COL_W * 0.9,
      y: laneTop + laneHeight / 2 - ROW_H / 2,
      symbol: 'rect',
      symbolSize: [112, 34],
      isLane: true,
      itemStyle: { color: 'rgba(0, 0, 0, 0)', borderWidth: 0 },
      label: { show: true, position: 'inside', color: NB_CATEGORY[lane] || NB.blue, fontFamily: "'ZCOOL QingKe HuangYou', " + NB_FONT, fontSize: 20, formatter: lane },
      tooltip: { show: false },
      emphasis: { disabled: true }
    })

    items.forEach(item => {
      const d = depth[item.id] || 0
      const row = used[d] || 0
      used[d] = row + 1
      const offset = (laneRows - slots[d]) * ROW_H / 2
      nodes.push({
        id: item.id,
        name: item.name,
        x: d * COL_W,
        y: laneTop + offset + row * ROW_H,
        // 方格本风格：每个知识点是一个小方格，边框颜色表示掌握状态，薄弱用虚线
        symbol: 'roundRect',
        symbolSize: 32,
        value: item.masteryRate,
        raw: item,
        itemStyle: {
          color: SOFT[item.statusLabel] || NB.blueSoft,
          borderColor: NB_MASTERY[item.statusLabel] || NB.ink3,
          borderWidth: 2.5,
          borderType: item.statusLabel === '薄弱' ? 'dashed' : 'solid',
          borderRadius: 6
        },
        label: {
          show: true,
          position: 'bottom',
          distance: 6,
          color: NB.ink,
          fontFamily: NB_FONT,
          fontWeight: 600,
          fontSize: 14,
          formatter: `${item.name}\n{rate|${item.masteryRate === null ? item.statusLabel : item.masteryRate+'%'}}`,
          rich: { rate: { color: NB_MASTERY_INK[item.statusLabel] || NB.ink3, fontSize: 14, fontWeight: 700, lineHeight: 20 } }
        }
      })
    })
    laneTop += laneHeight + LANE_GAP
  })

  flatNodes.value.forEach(item => {
    (PREREQ_MAP.value[item.id] || []).forEach(pre => {
      if (!ids.has(pre)) return
      const from = nodeMap.value[pre]
      const weakLink = from && from.statusLabel !== '已掌握' && item.statusLabel !== '已掌握'
      links.push({
        source: pre,
        target: item.id,
        lineStyle: {
          color: weakLink ? 'rgba(224, 64, 63, 0.6)' : 'rgba(74, 85, 119, 0.35)',
          width: weakLink ? 2 : 1.4,
          curveness: 0.18
        }
      })
    })
  })

  return { nodes, links }
}

function renderChart() {
  if (!graphRef.value || !flatNodes.value.length) return
  if (chart) chart.dispose()
  chart = echarts.init(graphRef.value, NB_ECHARTS_THEME)
  const { nodes, links } = buildGraph()
  chart.setOption({
    tooltip: {
      trigger: 'item',
      formatter(params) {
        if (params.dataType === 'edge') {
          const s = nodeMap.value[params.data.source]
          const t = nodeMap.value[params.data.target]
          return s && t ? `先学「${s.name}」→ 再学「${t.name}」` : ''
        }
        const data = params.data || {}
        if (!data.raw) return ''
        const pre = (PREREQ_MAP.value[data.id] || []).map(id => nodeMap.value[id]).filter(Boolean)
        return `<b>${data.raw.name}</b><br/>状态：${data.raw.statusLabel}<br/>掌握度：${data.raw.masteryRate === null ? '尚未测评' : data.raw.masteryRate+'%'}` +
          (pre.length ? `<br/>前置：${pre.map(p => p.name).join('、')}` : '')
      }
    },
    series: [{
      type: 'graph',
      layout: 'none',
      data: nodes,
      links,
      roam: true,
      draggable: false,
      left: 90,
      right: 70,
      top: 30,
      bottom: 60,
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: [0, 8],
      emphasis: {
        focus: 'adjacency',
        lineStyle: { width: 3 }
      },
      blur: { itemStyle: { opacity: 0.25 }, lineStyle: { opacity: 0.1 }, label: { opacity: 0.35 } },
      animationDuration: 450
    }]
  })
  chart.off('click')
  chart.on('click', function (params) {
    if (params.dataType === 'node' && params.data && params.data.raw) openNode(params.data.raw)
  })
}

function resetPracticeState() {
  practiceQuestions.value = []
  practiceAnswers.value = {}
  practiceResults.value = {}
}

async function openNode(node) {
  if (!node) return
  if (!node.eligible) { ElMessage.info('请老师先将这个知识点加入班级已学范围'); return }
  graphDraft.pause()
  activeNode.value = nodeMap.value[node.id] || node
  practiceDialogVisible.value = true
  practiceLoading.value = true
  resetPracticeState()

  api.get(`/student/practice/${encodeURIComponent(node.id)}`)
    .then(res => {
      if (res.success) {
        const data = res.data || {}
        practiceQuestions.value = data.questions || []
        graphDraft.restore()
      }
    })
    .catch(() => {
      ElMessage.error('练习题加载失败，请稍后重试')
    })
    .finally(() => {
      practiceLoading.value = false
    })
}

function submitPracticePack() {
  const ids = practiceQuestions.value.map(item => item.id)
  const incomplete = ids.some(id => !String(practiceAnswers.value[id] || '').trim())
  if (incomplete) {
    ElMessage.warning('请先完成全部题目再提交')
    return
  }

  practiceSubmitting.value = true
  api.student.submitPractice(activeNode.value.id, {
    answers: ids.reduce((acc, id) => {
      acc[id] = String(practiceAnswers.value[id] || '').trim()
      return acc
    }, {}),
    questionIds: ids,
    mode: 'knowledge-graph',
    requestId: graphDraft.requestId.value,
    title: `${activeNode.value.name} · 个性化补练`
  }).then(res => {
    if (res.success) {
      const data = res.data || {}
      graphDraft.clear()
      ;(data.questionResults || []).forEach(item => {
        practiceResults.value[item.questionId] = {
          isCorrect: item.correct,
          needsReview: item.needsReview,
          explanation: item.explanation,
          userAnswer: item.answer || '',
          correctAnswer: item.correctAnswer || '-'
        }
      })
      ElMessage.success('作答已保存，解答题等待老师复核')
      loadData(true)
    }
  }).catch(() => {
    ElMessage.error('提交失败')
  }).finally(() => {
    practiceSubmitting.value = false
  })
}

function loadData(silent) {
  if (silent !== true) loading.value = true
  api.get('/student/weak-points')
    .then(res => {
      if (res.success) {
        flatNodes.value = normalizeNodes(res.data || [])
        if (activeNode.value) activeNode.value = nodeMap.value[activeNode.value.id] || activeNode.value
      }
    })
    .catch(() => {
      ElMessage.error('知识图谱加载失败')
    })
    .finally(async () => {
      loading.value = false
      await nextTick()
      renderChart()
    })
}

function handleResize() {
  if (chart) chart.resize()
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (chart) chart.dispose()
})
</script>

<style scoped>
.kg-page { display: flex; flex-direction: column; gap: 18px; }
.header-content { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.header-text { flex: 1; min-width: 0; }
.kg-tools { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

.summary-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; font-size: 14px; color: var(--nb-ink-2); }
.legend-item { display: inline-flex; align-items: center; gap: 6px; }
.legend-item i { width: 12px; height: 12px; border-radius: 3px; border: 2px solid var(--c); background: var(--c-soft); }
.legend-item.is-weak i { border-style: dashed; }
.legend-item b { color: var(--nb-ink); }
.is-mastered { --c: var(--nb-green); --c-ink: var(--nb-green-ink); --c-soft: var(--nb-green-soft); }
.is-learning { --c: var(--nb-orange); --c-ink: var(--nb-orange-ink); --c-soft: var(--nb-orange-soft); }
.is-weak { --c: var(--nb-red); --c-ink: var(--nb-red-ink); --c-soft: var(--nb-red-soft); }
.summary-tip { color: var(--nb-ink-3); }

/* 图谱画在方格纸上 */
.graph-card :deep(.el-card__body) {
  background-color: var(--nb-sheet);
  background-image:
    linear-gradient(var(--nb-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--nb-grid) 1px, transparent 1px);
  background-size: 24px 24px;
  border-radius: var(--nb-radius);
}
.graph-scroll-tip { display: none; color: var(--nb-ink-3); font-size: 14px; margin-bottom: 6px; }
.graph-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.graph-canvas { height: 72vh; min-height: 560px; min-width: 980px; }

.dialog-head { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; color: var(--nb-ink-2); flex-wrap: wrap; }
.dialog-category { color: var(--nb-ink-3); font-size: 14px; }
.prereq-box { margin-bottom: 18px; padding: 14px 16px; border-radius: 10px; border: 1px dashed var(--nb-line-strong); background: #f8fafd; }
.prereq-title { font-weight: 700; color: var(--nb-ink); margin-bottom: 10px; font-size: 14px; }
.prereq-list { display: flex; flex-wrap: wrap; gap: 8px; }
.prereq-item {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  padding: 8px 12px; border-radius: 8px; border: 1.5px solid var(--c, var(--nb-line)); background: var(--nb-sheet);
  cursor: pointer; font: inherit; font-size: 14px; font-weight: 600; color: var(--nb-ink); transition: background-color .15s;
}
.prereq-item.is-weak { border-style: dashed; }
.prereq-item:hover { background: var(--c-soft, #f3f6fb); }
.prereq-item small { font-size: 14px; font-weight: 700; color: var(--c-ink); }
.prereq-empty { color: var(--nb-ink-3); font-size: 14px; }
.prereq-alert { margin-top: 12px; }
.practice-pack-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
.footer-actions { margin-top: 18px; gap: 12px; }
@media (max-width: 768px) {
  .graph-canvas { height: 70vh; min-height: 560px; }
  .graph-scroll-tip { display: block; }
}
</style>
