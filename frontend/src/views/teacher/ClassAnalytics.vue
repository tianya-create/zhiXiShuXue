<template>
  <div class="class-analytics">
    <div class="page-header">
      <h2>班级学情分析</h2>
      <p>全班的分数、层次和薄弱知识点。排在最上面的知识点，最值得在课堂上再讲一遍。</p>
    </div>
    
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card class="gradient-card">
          <template #header>
            <div class="card-header">
              <span>选择班级</span>
              <el-select v-model="selectedClassId" placeholder="选择班级" @change="loadAnalytics" style="width: 200px;">
                <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </div>
          </template>
          
          <el-row :gutter="20" v-if="analytics">
            <el-col :xs="12" :sm="12" :md="6">
              <div class="stat-card tone-blue">
                <div class="stat-value">{{ analytics.avgScore ?? '尚无成绩' }}</div>
                <div class="stat-label">平均分</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="12" :md="6">
              <div class="stat-card tone-purple">
                <div class="stat-value">{{ analytics.studentCount || 0 }}</div>
                <div class="stat-label">学生人数</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="12" :md="6">
              <div class="stat-card tone-pink">
                <div class="stat-value">{{ analytics.completedCount || 0 }}</div>
                <div class="stat-label">已完成作业</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="12" :md="6">
              <div class="stat-card tone-teal">
                <div class="stat-value">{{ avgMastery }}%</div>
                <div class="stat-label">知识点平均掌握度</div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :xs="24" :md="12" class="chart-col">
        <el-card class="gradient-card">
          <template #header>学生成绩排名</template>
          <el-table :data="studentScores" max-height="400">
            <el-table-column prop="studentName" label="学生" />
            <el-table-column prop="score" label="得分" width="100" />
            <el-table-column label="层次" width="100">
              <template #default="scope">
                <el-tag :type="getLevelType(scope.row.level)">{{ getLevelText(scope.row.level) }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12" class="chart-col">
        <el-card class="gradient-card">
          <template #header>学生层次分布</template>
          <div id="levelChart" style="height: 400px;"></div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :xs="24" :md="12" class="chart-col">
        <el-card class="gradient-card">
          <template #header>薄弱知识点统计</template>
          <div id="weakKnowledgeChart" style="height: 400px;"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12" class="chart-col">
        <el-card class="gradient-card">
          <template #header>高频错题类型统计</template>
          <div id="errorTypeChart" style="height: 400px;"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import api from '@/utils/api'
import * as echarts from 'echarts'
import { NB_ECHARTS_THEME, registerNotebookChartTheme } from '@/utils/notebook-colors'
registerNotebookChartTheme(echarts)
import { NB_CHART as CHART_COLORS, nbBrandGradient as brandGradient } from '@/utils/notebook-colors'

var classes = ref([])
var selectedClassId = ref('')
var analytics = ref(null)
var levelChart = null
var errorTypeChart = null
var weakKnowledgeChart = null

var studentScores = computed(function() {
  if (!analytics.value || !analytics.value.studentScores) {
    return []
  }
  return analytics.value.studentScores
})

var avgMastery = computed(function() {
  var list = analytics.value && analytics.value.knowledgePointMasteryList ? analytics.value.knowledgePointMasteryList : []
  if (!list.length) return 0
  return Math.round(list.reduce(function(sum, item) { return sum + Number(item.mastery || 0) }, 0) / list.length)
})

function emptyTitle(show) {
  return show ? {
    text: '暂无数据',
    left: 'center',
    top: 'middle',
    textStyle: { color: CHART_COLORS.axis, fontSize: 14, fontWeight: 'normal' }
  } : undefined
}

function resizeCharts() {
  [levelChart, errorTypeChart, weakKnowledgeChart].forEach(function(chart) { if (chart) chart.resize() })
}

onMounted(function() {
  loadClasses()
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(function() {
  window.removeEventListener('resize', resizeCharts)
  ;[levelChart, errorTypeChart, weakKnowledgeChart].forEach(function(chart) { if (chart) chart.dispose() })
})

function loadClasses() {
  api.get('/teacher/classes').then(function(res) {
    if (res.success) {
      classes.value = res.data
      if (res.data.length > 0) {
        selectedClassId.value = res.data[0].id
        loadAnalytics()
      }
    }
  }).catch(function(error) {
    console.error('加载班级失败:', error)
  })
}

function loadAnalytics() {
  if (!selectedClassId.value) return
  
  api.get('/teacher/analytics/class/' + selectedClassId.value).then(function(res) {
    if (res.success) {
      analytics.value = res.data
      return nextTick()
    }
  }).then(function() {
    renderWeakKnowledgeChart()
    renderErrorTypeChart()
    renderLevelChart()
  }).catch(function(error) {
    console.error('加载分析数据失败:', error)
  })
}

function renderErrorTypeChart() {
  var chartDom = document.getElementById('errorTypeChart')
  if (!chartDom) return

  if (errorTypeChart) errorTypeChart.dispose()
  errorTypeChart = echarts.init(chartDom, NB_ECHARTS_THEME)

  // 来自本班真实答题记录：按题型统计答错次数
  var list = analytics.value && analytics.value.errorTypeStats ? analytics.value.errorTypeStats : []

  errorTypeChart.setOption({
    title: emptyTitle(!list.length),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: list.map(function(item) { return item.label }), axisLabel: { color: CHART_COLORS.axis } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { color: CHART_COLORS.axis }, splitLine: { lineStyle: { color: CHART_COLORS.splitLine } } },
    series: list.length ? [{
      name: '答错次数',
      type: 'bar',
      barMaxWidth: 42,
      data: list.map(function(item) { return item.count }),
      itemStyle: { color: brandGradient(echarts, false), borderRadius: [8, 8, 0, 0] }
    }] : []
  })
}

function renderWeakKnowledgeChart() {
  var chartDom = document.getElementById('weakKnowledgeChart')
  if (!chartDom) return

  if (weakKnowledgeChart) weakKnowledgeChart.dispose()
  weakKnowledgeChart = echarts.init(chartDom, NB_ECHARTS_THEME)

  // 来自本班真实答题记录：各知识点平均得分率，掌握度最低的排在最上面
  var list = (analytics.value && analytics.value.knowledgePointMasteryList ? analytics.value.knowledgePointMasteryList : []).slice(0, 8).reverse()

  weakKnowledgeChart.setOption({
    title: emptyTitle(!list.length),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: function(v) { return v + '%' } },
    grid: { left: '3%', right: '6%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', max: 100, axisLabel: { color: CHART_COLORS.axis, formatter: '{value}%' }, splitLine: { lineStyle: { color: CHART_COLORS.splitLine } } },
    yAxis: { type: 'category', data: list.map(function(item) { return item.name }), axisLabel: { color: CHART_COLORS.axis } },
    series: list.length ? [{
      name: '掌握度',
      type: 'bar',
      barMaxWidth: 26,
      data: list.map(function(item) {
        var v = Math.round(item.mastery)
        var color = v >= 80 ? CHART_COLORS.mastered : v >= 60 ? CHART_COLORS.learning : CHART_COLORS.weak
        return { value: v, itemStyle: { color: color, borderRadius: [0, 8, 8, 0] } }
      }),
      label: { show: true, position: 'right', formatter: '{c}%', color: CHART_COLORS.axis }
    }] : []
  })
}

function renderLevelChart() {
  var chartDom = document.getElementById('levelChart')
  if (!chartDom) return

  if (levelChart) levelChart.dispose()
  levelChart = echarts.init(chartDom, NB_ECHARTS_THEME)

  var levelData = analytics.value && analytics.value.levelDistribution ? analytics.value.levelDistribution : {}
  var data = [
    { value: levelData.unassessed || 0, name: '尚未测评', itemStyle: { color: '#94a3b8' } },
    { value: levelData.weak || 0, name: '薄弱', itemStyle: { color: CHART_COLORS.weak } },
    { value: levelData.normal || 0, name: '中等', itemStyle: { color: CHART_COLORS.learning } },
    { value: levelData.strong || 0, name: '优秀', itemStyle: { color: CHART_COLORS.mastered } }
  ]
  var total = data.reduce(function(sum, item) { return sum + item.value }, 0)

  levelChart.setOption({
    title: emptyTitle(!total),
    tooltip: { trigger: 'item', formatter: '{b}：{c} 份（{d}%）' },
    legend: { top: '5%', left: 'center' },
    series: total ? [{
      name: '学生层次',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: false, position: 'center' },
      emphasis: { label: { show: true, fontSize: 18, fontWeight: 'bold' } },
      labelLine: { show: false },
      data: data.filter(function(item) { return item.value > 0 })
    }] : []
  })
}

function getLevelType(level) {
  if (level === 'unassessed') return 'info'
  if (level === 'strong') return 'success'
  if (level === 'weak') return 'danger'
  return 'warning'
}

function getLevelText(level) {
  if (level === 'unassessed') return '尚未测评'
  if (level === 'strong') return '优秀'
  if (level === 'weak') return '薄弱'
  return '中等'
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-card {
  position: relative;
  padding: 20px 18px 22px !important;
  border-radius: var(--nb-radius) !important;
  border: 1px solid var(--nb-line) !important;
  background: var(--tile-soft) !important;
  box-shadow: none !important;
  text-align: left;
  overflow: hidden;
}

.stat-card::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4px;
  background: var(--tile);
}

.tone-blue { --tile: var(--nb-blue); --tile-soft: var(--nb-blue-soft); }
.tone-purple { --tile: var(--nb-purple); --tile-soft: var(--nb-purple-soft); }
.tone-pink { --tile: var(--nb-pink); --tile-soft: var(--nb-pink-soft); }
.tone-teal { --tile: var(--nb-teal); --tile-soft: var(--nb-teal-soft); }

.stat-card .stat-value {
  font-family: var(--nb-font-num) !important;
  font-size: 38px !important;
  font-weight: 700 !important;
  line-height: 1.1;
  color: var(--nb-ink) !important;
  margin-bottom: 6px;
}

.stat-card .stat-label {
  font-size: 15px !important;
  font-weight: 600;
  color: var(--nb-ink-2) !important;
}

@media (max-width: 991px) {
  .chart-col { margin-bottom: 20px; }
  .stat-card { margin-bottom: 12px; }
  .card-header { flex-wrap: wrap; gap: 10px; }
}
</style>
