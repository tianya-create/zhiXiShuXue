<template>
  <div class="kg-page">
    <header class="page-header">
      <div class="header-content">
        <div class="header-text">
          <h2>知识图谱</h2>
          <p>以“初中数学”为根节点，展开五大模块与具体知识点，节点颜色表示掌握状态。</p>
        </div>
        <div class="kg-tools">
          <el-button @click="loadData">重新加载</el-button>
        </div>
      </div>
    </header>

    <el-card class="gradient-card summary-card" v-loading="loading">
      <div class="summary-row">
        <el-tag type="danger">未掌握 {{ summary.weak }}</el-tag>
        <el-tag type="warning">待巩固 {{ summary.learning }}</el-tag>
        <el-tag type="success">已掌握 {{ summary.mastered }}</el-tag>
        <span class="summary-tip">点击具体知识点节点可在弹窗内完成个性化补练作答。</span>
      </div>
    </el-card>

    <el-card v-if="!loading" class="graph-card gradient-card">
      <div ref="graphRef" class="graph-canvas"></div>
    </el-card>

    <el-dialog v-model="practiceDialogVisible" :title="dialogTitle" width="980px" destroy-on-close>
      <div v-if="activeNode" class="dialog-head">
        <el-tag :type="tagType(activeNode.statusLabel)">{{ activeNode.statusLabel }}</el-tag>
        <span>掌握度 {{ activeNode.masteryRate }}%</span>
      </div>

      <el-empty v-if="!practiceQuestions.length && !practiceLoading" description="当前暂无可用个性化补练题" />

      <div v-else v-loading="practiceLoading">
        <el-card v-for="(item, index) in practiceQuestions" :key="item.id" class="practice-pack-card" shadow="hover">
          <div class="practice-pack-title">{{ item.visibleQuestionNo || `第${index + 1}题` }}</div>
          <QuestionCard
            :question="normalizeQuestion(item)"
            :index="index"
            v-model="practiceAnswers[item.id]"
            :result="practiceResults[item.id]"
          />
        </el-card>

        <div class="practice-pack-actions footer-actions">
          <el-button @click="practiceDialogVisible = false">关闭</el-button>
          <el-button type="primary" :loading="practiceSubmitting" @click="submitPracticePack">提交本次作答</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import api from '@/utils/api'
import QuestionCard from '@/components/QuestionCard.vue'
import { buildSharedKnowledgeTree, inferMajorCategory, KNOWLEDGE_TREE_SHARED_CONFIG } from '@/utils/knowledge-meta'

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

const CATEGORY_ORDER = KNOWLEDGE_TREE_SHARED_CONFIG.categories.map(function (item) { return item.name })
const SHARED_ROOT = buildSharedKnowledgeTree()[0]

const summary = computed(() => flatNodes.value.reduce((acc, item) => {
  if (item.statusLabel === '已掌握') acc.mastered += 1
  else if (item.statusLabel === '待巩固') acc.learning += 1
  else acc.weak += 1
  return acc
}, { weak: 0, learning: 0, mastered: 0 }))

const treeData = computed(() => {
  const groups = CATEGORY_ORDER.reduce((acc, key) => {
    acc[key] = []
    return acc
  }, {})

  flatNodes.value.forEach(node => {
    const category = inferMajorCategory(node, '数与式')
    if (!groups[category]) groups[category] = []
    groups[category].push({
      ...node,
      value: node.masteryRate,
      isKnowledgeNode: true,
      collapsed: false,
      itemStyle: { color: statusColor(node.statusLabel) }
    })
  })

  const categoryChildren = CATEGORY_ORDER.map(category => {
    const items = (groups[category] || []).sort((a, b) => Number(a.masteryRate || 0) - Number(b.masteryRate || 0))
    const avg = items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.masteryRate || 0), 0) / items.length) : 0
    return {
      id: `category-${category}`,
      name: category,
      masteryRate: avg,
      statusLabel: avg >= 80 ? '已掌握' : avg >= 60 ? '待巩固' : '未掌握',
      children: items,
      collapsed: false,
      itemStyle: { color: statusColor(avg >= 80 ? '已掌握' : avg >= 60 ? '待巩固' : '未掌握') }
    }
  })

  return [{
    id: SHARED_ROOT.id,
    name: SHARED_ROOT.name,
    masteryRate: Math.round((flatNodes.value.reduce((sum, item) => sum + Number(item.masteryRate || 0), 0) / (flatNodes.value.length || 1))),
    statusLabel: '总览',
    collapsed: false,
    children: categoryChildren,
    itemStyle: { color: '#2563eb' }
  }]
})

const dialogTitle = computed(() => activeNode.value ? `${activeNode.value.name} · 个性化补练` : '个性化补练')

function statusColor(label) {
  if (label === '已掌握') return '#27AE60'
  if (label === '待巩固') return '#F39C12'
  if (label === '未掌握' || label === '薄弱') return '#E74C3C'
  return '#2563eb'
}

function tagType(label) {
  if (label === '已掌握') return 'success'
  if (label === '待巩固') return 'warning'
  return 'danger'
}

function normalizeNodes(list) {
  return (list || []).map((item) => ({
    ...item,
    categoryName: inferMajorCategory(item, '数与式'),
    statusLabel: item.statusLabel === '薄弱' ? '未掌握' : (item.statusLabel || (Number(item.masteryRate || 0) >= 80 ? '已掌握' : Number(item.masteryRate || 0) >= 60 ? '待巩固' : '未掌握'))
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

function resetPracticeState() {
  practiceQuestions.value = []
  practiceAnswers.value = {}
  practiceResults.value = {}
}

function renderChart() {
  if (!graphRef.value) return
  if (chart) chart.dispose()
  chart = echarts.init(graphRef.value)
  chart.setOption({
    tooltip: {
      trigger: 'item',
      formatter(params) {
        const data = params.data || {}
        if (data.id === SHARED_ROOT.id) return `${data.name}<br/>整体掌握度：${data.masteryRate || 0}%`
        return `${data.name}<br/>状态：${data.statusLabel || '-'}<br/>掌握度：${data.masteryRate || 0}%`
      }
    },
    series: [{
      type: 'tree',
      data: treeData.value,
      top: '4%',
      left: '10%',
      bottom: '4%',
      right: '20%',
      symbolSize: 22,
      initialTreeDepth: 2,
      roam: true,
      expandAndCollapse: true,
      animationDuration: 450,
      animationDurationUpdate: 500,
      label: {
        position: 'left',
        verticalAlign: 'middle',
        align: 'right',
        fontSize: 14,
        formatter(params) {
          const data = params.data || {}
          if (data.id === SHARED_ROOT.id) return SHARED_ROOT.name
          return `${data.name} ${data.masteryRate || 0}%`
        }
      },
      leaves: {
        label: {
          position: 'right',
          align: 'left'
        }
      },
      lineStyle: {
        color: '#94a3b8',
        width: 1.3,
        curveness: 0.35
      }
    }]
  })
  chart.off('click')
  chart.on('click', function(params) {
    const data = params.data || {}
    if (data.isKnowledgeNode) handleNodeClick(data)
  })
}

function handleNodeClick(node) {
  if (!node || (node.statusLabel !== '未掌握' && node.statusLabel !== '待巩固')) return
  activeNode.value = node
  practiceDialogVisible.value = true
  practiceLoading.value = true
  resetPracticeState()

  api.get(`/student/practice/${encodeURIComponent(node.id)}`)
    .then(res => {
      if (res.success) {
        const data = res.data || {}
        practiceQuestions.value = data.questions || []
      }
    })
    .finally(() => {
      practiceLoading.value = false
    })
}

function submitPracticePack() {
  const ids = practiceQuestions.value.map(item => item.id)
  const incomplete = ids.some(id => !String(practiceAnswers.value[id] || '').trim())
  if (incomplete) {
    ElMessage.warning('请先完成弹窗内全部题目再提交')
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
    title: `${activeNode.value.name} · 个性化补练`
  }).then(res => {
    if (res.success) {
      const data = res.data || {}
      ;(data.questionResults || []).forEach(item => {
        practiceResults.value[item.questionId] = {
          isCorrect: !!item.correct,
          userAnswer: item.answer || '',
          correctAnswer: item.correctAnswer || '-',
          explanation: item.correct ? '回答正确，继续保持。' : '本题已记入错题本，可继续针对性巩固。'
        }
      })
      ElMessage.success('提交成功，已展示正确答案；错题已同步写入错题本并记录到学习轨迹')
      loadData()
    }
  }).catch(() => {
    ElMessage.error('提交失败')
  }).finally(() => {
    practiceSubmitting.value = false
  })
}

function loadData() {
  loading.value = true
  api.get('/student/weak-points')
    .then(res => {
      if (res.success) flatNodes.value = normalizeNodes(res.data || [])
    })
    .finally(async () => {
      loading.value = false
      await nextTick()
      renderChart()
    })
}

onMounted(loadData)
onBeforeUnmount(() => { if (chart) chart.dispose() })
</script>

<style scoped>
.kg-page { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.header-content { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.header-text { flex: 1; }
.kg-tools { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.gradient-card { border-radius: 20px; }
.summary-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.summary-tip { color: #6b7280; font-size: 13px; }
.graph-canvas { height: 72vh; min-height: 620px; }
.dialog-head { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; color: #475569; }
.practice-pack-card { border-radius: 16px; margin-bottom: 12px; }
.practice-pack-title { font-weight: 700; color: #0f172a; margin-bottom: 8px; }
.practice-pack-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
.footer-actions { margin-top: 18px; gap: 12px; }
</style>
