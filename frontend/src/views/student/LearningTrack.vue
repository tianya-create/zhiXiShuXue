<template>
  <div class="learning-track-page">
    <div class="page-header">
      <h2>学习轨迹</h2>
      <p>每次作业和练习都记在这里，看看正确率和掌握度是怎么变化的。</p>
    </div>

    <el-card class="gradient-card summary-card">
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">作业记录</span>
          <strong>{{ stats.homeworkCount }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">练习记录</span>
          <strong>{{ stats.practiceCount }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">最近得分</span>
          <strong>{{ stats.latestScore }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">平均正确率</span>
          <strong>{{ stats.averageCorrectRate === null ? '尚无已判定记录' : stats.averageCorrectRate + '%' }}</strong>
        </div>
      </div>
    </el-card>

    <!-- 图表分析区 -->
    <el-card class="gradient-card chart-main-card">
      <template #header>
        <div class="chart-header">
          <span>综合学情分析</span>
          <div class="date-picker-wrapper">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              size="small"
              @change="handleDateRangeChange"
            />
          </div>
        </div>
      </template>
      <div id="combinedChart" style="height: 350px;"></div>
    </el-card>

    <div class="track-container">
      <div class="timeline-section">
        <el-card class="gradient-card" v-loading="loading">
          <template #header>
            <div class="section-header">
              <span>时间轴轨迹</span>
            </div>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="item in filteredTrackList"
              :key="item.id"
              :timestamp="formatDate(item.date)"
              :type="item.recordType === 'practice' ? 'warning' : 'primary'"
              placement="top"
            >
              <div class="track-card" @click="showDetail(item)">
                <div class="track-head">
                  <div>
                    <div class="track-title">{{ item.assignmentTitle || '学习记录' }}</div>
                    <div class="track-subtitle">{{ item.paperTitle || '—' }}</div>
                  </div>
                  <el-tag :type="item.recordType === 'practice' ? 'warning' : 'success'">
                    {{ item.recordType === 'practice' ? '练习记录' : '作业记录' }}
                  </el-tag>
                </div>
                <div class="track-meta">
                  <span>状态：{{ getStatusText(item.status) }}</span>
                  <span v-if="item.score !== undefined">得分：{{ item.score }}</span>
                  <span v-if="item.correctRate !== undefined">正确率：{{ item.correctRate }}%</span>
                </div>
              </div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-if="!loading && filteredTrackList.length === 0" description="暂无该时间段学习轨迹" />
        </el-card>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      :title="detailData.title"
      width="800px"
      destroy-on-close
    >
      <div v-loading="loadingDetail" class="detail-container">
        <el-row :gutter="20">
          <el-col :span="10">
            <div class="detail-info-card">
              <div class="detail-stat-row">
                <div class="detail-stat-item">
                  <div class="label">得分</div>
                  <div class="value">{{ detailData.score }}</div>
                </div>
                <div class="detail-stat-item">
                  <div class="label">正确率</div>
                  <div class="value">{{ detailData.correctRate }}%</div>
                </div>
                <div class="detail-stat-item">
                  <div class="label">耗时</div>
                  <div class="value">{{ detailData.duration === null ? '未记录' : detailData.duration + 'min' }}</div>
                </div>
              </div>
              <div class="radar-title">知识点掌握分布</div>
              <div id="radarChart" style="height: 250px;"></div>
            </div>
          </el-col>
          <el-col :span="14">
            <div class="detail-question-list">
              <div class="section-title">答题详情</div>
              <el-scrollbar height="350px">
                <div v-for="(q, idx) in detailData.questions" :key="idx" class="q-detail-item">
                  <div class="q-head">
                    <span class="q-idx">第 {{ idx + 1 }} 题</span>
                    <el-tag :type="q.isCorrect ? 'success' : 'danger'" size="small">
                      {{ q.isCorrect ? '正确' : '错误' }}
                    </el-tag>
                  </div>
                  <MathText class="q-content" tag="div" :text="q.content" />
                  <div class="q-ans-box">
                    <div>你的答案：<MathText :class="q.isCorrect ? 'correct' : 'wrong'" :text="q.userAnswer || '未填'" /></div>
                    <div>正确答案：<MathText class="correct" :text="q.answer" /></div>
                  </div>
                </div>
              </el-scrollbar>
            </div>
          </el-col>
        </el-row>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { NB } from '@/utils/notebook-colors'

const CHART_COLORS = { brand: NB.blue, brandAlt: NB.orange, axis: NB.ink3 }
import MathText from '@/components/MathText.vue'
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import { NB_ECHARTS_THEME, registerNotebookChartTheme } from '@/utils/notebook-colors'
registerNotebookChartTheme(echarts)

const loading = ref(false)
const trackList = ref([])
const stats = ref({
  homeworkCount: 0,
  practiceCount: 0,
  latestScore: 0,
  averageCorrectRate: 0
})
const dateRange = ref([])
let combinedChart = null

const filteredTrackList = computed(() => {
  if (!dateRange.value || dateRange.value.length !== 2) return trackList.value
  const start = dayjs(dateRange.value[0]).startOf('day')
  const end = dayjs(dateRange.value[1]).endOf('day')
  return trackList.value.filter(item => {
    const d = dayjs(item.date)
    return d.isAfter(start) && d.isBefore(end)
  })
})

onMounted(() => {
  loadData()
  window.addEventListener('resize', () => combinedChart?.resize())
})

function loadData() {
  loading.value = true
  api.get('/student/learning-track')
    .then(res => {
      if (res.success) {
        trackList.value = res.data || []
        stats.value = res.stats || stats.value
        return nextTick()
      }
    })
    .then(() => {
      renderCombinedChart()
    })
    .catch(error => {
      console.error('加载失败:', error)
      ElMessage.error('加载学习轨迹失败')
    })
    .finally(() => {
      loading.value = false
    })
}

function handleDateRangeChange() {
  renderCombinedChart()
}

function renderCombinedChart() {
  const chartDom = document.getElementById('combinedChart')
  if (!chartDom) return
  if (combinedChart) combinedChart.dispose()
  combinedChart = echarts.init(chartDom, NB_ECHARTS_THEME)

  const data = filteredTrackList.value
  const xData = data.map(item => dayjs(item.date).format('MM-DD'))
  const rateData = data.map(item => item.correctRate || 0)
  const masteryData = data.map(item => item.masteryAfter ?? null)

  combinedChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['答题正确率', '知识点掌握度'],
      bottom: 0
    },
    grid: {
      top: 40,
      left: 50,
      right: 50,
      bottom: 50
    },
    xAxis: {
      type: 'category',
      data: xData,
      axisTick: { alignWithLabel: true }
    },
    yAxis: [
      {
        type: 'value',
        name: '正确率',
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}%' }
      },
      {
        type: 'value',
        name: '参考掌握度',
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}%' },
        splitLine: { show: false }
      }
    ],
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', bottom: 30, height: 20 }
    ],
    series: [
      {
        name: '答题正确率',
        type: 'line',
        smooth: true,
        data: rateData,
        itemStyle: { color: CHART_COLORS.brand },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(35,80,216,0.22)' },
            { offset: 1, color: 'rgba(35,80,216,0)' }
          ])
        }
      },
      {
        name: '知识点掌握度',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: masteryData,
        itemStyle: { color: CHART_COLORS.brandAlt },
        lineStyle: { width: 3, type: 'dashed' }
      }
    ]
  })
}

// 详情逻辑
const detailVisible = ref(false)
const loadingDetail = ref(false)
const detailData = ref({
  title: '',
  score: 0,
  correctRate: 0,
  duration: 0,
  radarData: [],
  questions: []
})
let radarChart = null

function showDetail(item) {
  detailVisible.value = true
  loadingDetail.value = true
  api.get(`/student/learning-track/${item.id}/detail`, { type: item.recordType })
    .then(res => {
      if (res.success) {
        detailData.value = res.data
        nextTick(() => renderRadarChart())
      }
    })
    .finally(() => {
      loadingDetail.value = false
    })
}

function renderRadarChart() {
  const chartDom = document.getElementById('radarChart')
  if (!chartDom) return
  if (radarChart) radarChart.dispose()
  radarChart = echarts.init(chartDom, NB_ECHARTS_THEME)

  const indicator = detailData.value.radarData.map(d => ({ name: d.name, max: 100 }))
  const values = detailData.value.radarData.map(d => d.value)

  radarChart.setOption({
    radar: {
      indicator,
      radius: '65%',
      splitNumber: 4,
      axisName: { color: CHART_COLORS.axis }
    },
    series: [{
      type: 'radar',
      data: [{
        value: values,
        name: '掌握度',
        areaStyle: { color: 'rgba(232, 137, 12, 0.22)' },
        itemStyle: { color: CHART_COLORS.brandAlt }
      }]
    }]
  })
}

function getStatusText(status) {
  const map = { graded: '已完成', submitted: '待批改', completed: '已完成', pending_review: '等待复核' }
  return map[status] || status || '-'
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}
</script>

<style scoped>
.summary-card { margin-bottom: 20px; }
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.summary-item {
  padding: 18px;
  border-radius: 12px;
  background: #f8fafd;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.summary-item strong { font-family: var(--nb-font-num); font-size: 28px; color: var(--nb-ink); }
.summary-label { color: var(--nb-ink-3); font-size: 14px; }

.chart-main-card { margin-bottom: 20px; }
.chart-header { display: flex; justify-content: space-between; align-items: center; }
.date-picker-wrapper { display: flex; justify-content: center; }
.date-picker-wrapper :deep(.el-range-editor.el-input__wrapper) { width: 260px; }

.track-card {
  padding: 16px;
  background: #f8fafd;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid transparent;
}
.track-card:hover {
  background: #fff;
  border-color: var(--nb-blue);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.track-head { display: flex; justify-content: space-between; }
.track-title { font-size: 16px; font-weight: 700; color: var(--nb-ink); }
.track-subtitle { font-size: 14px; color: var(--nb-ink-3); margin-top: 2px; }
.track-meta { margin-top: 12px; display: flex; gap: 20px; color: var(--nb-ink-3); font-size: 14px; }

.detail-stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
.detail-stat-item {
  text-align: center;
  padding: 10px;
  background: var(--nb-green-soft);
  border-radius: 8px;
}
.detail-stat-item .label { font-size: 14px; color: var(--nb-green-ink); }
.detail-stat-item .value { font-size: 18px; font-weight: bold; color: var(--nb-ink); }

.radar-title { font-weight: bold; margin: 15px 0 10px; text-align: center; }
.section-title { font-weight: bold; margin-bottom: 15px; padding-left: 10px; border-left: 4px solid var(--nb-blue); }

.q-detail-item {
  padding: 12px;
  background: #f8fafd;
  border-radius: 8px;
  margin-bottom: 12px;
}
.q-head { display: flex; justify-content: space-between; margin-bottom: 8px; }
.q-idx { font-weight: bold; color: var(--nb-ink-3); }
.q-content { font-size: 14px; line-height: 1.6; margin-bottom: 10px; }
.q-ans-box {
  display: grid;
  grid-template-columns: 1fr 1fr;
  font-size: 14px;
  padding-top: 8px;
  border-top: 1px dashed var(--nb-line-strong);
}
.correct { color: var(--nb-green-ink); font-weight: bold; }
.wrong { color: var(--nb-red-ink); font-weight: bold; }
</style>