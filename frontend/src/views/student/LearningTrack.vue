<template>
  <div class="learning-track-page">
    <div class="page-header">
      <h2>学习轨迹</h2>
      <p>串联作业记录与练习记录，看见正确率与掌握度的变化</p>
    </div>

    <el-card class="gradient-card summary-card">
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">作业记录</span>
          <strong>{{ homeworkCount }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">练习记录</span>
          <strong>{{ practiceCount }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">最近一次得分</span>
          <strong>{{ latestScore }}</strong>
        </div>
      </div>
    </el-card>

    <el-row :gutter="20" class="chart-row">
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>历次正确率</template>
          <div id="correctRateChart" style="height: 280px;"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>掌握度变化</template>
          <div id="masteryChart" style="height: 280px;"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="gradient-card" v-loading="loading">
      <el-timeline>
        <el-timeline-item
          v-for="item in trackList"
          :key="item.id"
          :timestamp="formatDate(item.date)"
          :type="item.recordType === 'practice' ? 'warning' : 'primary'"
          placement="top"
        >
          <div class="track-card">
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
              <span v-if="item.score !== undefined && item.score !== null">得分：{{ item.score }}</span>
              <span v-if="item.correctRate !== undefined && item.correctRate !== null">正确率：{{ item.correctRate }}%</span>
              <span v-if="item.masteryAfter !== undefined && item.masteryAfter !== null">掌握度：{{ item.masteryAfter }}%</span>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-if="!loading && trackList.length === 0" description="暂无学习轨迹" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import dayjs from 'dayjs'
import * as echarts from 'echarts'

var loading = ref(false)
var trackList = ref([])
var correctRateChart = null
var masteryChart = null

var homeworkCount = computed(function() {
  return trackList.value.filter(function(item) { return item.recordType === 'homework' }).length
})

var practiceCount = computed(function() {
  return trackList.value.filter(function(item) { return item.recordType === 'practice' }).length
})

var latestScore = computed(function() {
  if (!trackList.value.length) return '-'
  var latest = trackList.value[trackList.value.length - 1]
  return latest.score === undefined || latest.score === null ? '-' : latest.score
})

onMounted(function() {
  loadData()
})

function loadData() {
  loading.value = true
  api.get('/student/learning-track')
    .then(function(res) {
      if (res.success) {
        trackList.value = res.data || []
        return nextTick()
      }
    })
    .then(function() {
      renderCharts()
    })
    .catch(function(error) {
      console.error('加载失败:', error)
      ElMessage.error('加载学习轨迹失败')
    })
    .finally(function() {
      loading.value = false
    })
}

function renderCharts() {
  var rateDom = document.getElementById('correctRateChart')
  var masteryDom = document.getElementById('masteryChart')
  if (!rateDom || !masteryDom) return

  if (correctRateChart) correctRateChart.dispose()
  if (masteryChart) masteryChart.dispose()

  correctRateChart = echarts.init(rateDom)
  masteryChart = echarts.init(masteryDom)

  var xData = trackList.value.map(function(item) { return formatShortDate(item.date) })
  var rateData = trackList.value.map(function(item) { return item.correctRate || 0 })
  var masteryData = trackList.value.map(function(item) { return item.masteryAfter || 0 })

  correctRateChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: xData },
    yAxis: { type: 'value', max: 100 },
    series: [{ type: 'line', smooth: true, data: rateData, lineStyle: { color: '#409EFF' } }]
  })

  masteryChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: xData },
    yAxis: { type: 'value', max: 100 },
    series: [{ type: 'bar', data: masteryData, itemStyle: { color: '#67C23A' } }]
  })
}

function getStatusText(status) {
  if (status === 'graded') return '已完成'
  if (status === 'submitted') return '待批改'
  return status || '-'
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}

function formatShortDate(date) {
  return date ? dayjs(date).format('MM-DD') : '-'
}
</script>

<style scoped>
.summary-card {
  margin-bottom: 20px;
}

.chart-row {
  margin-bottom: 20px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.summary-item {
  padding: 18px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f8fafc, #eef2ff);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-label,
.track-subtitle,
.track-meta {
  color: #6b7280;
}

.track-card {
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
}

.track-head,
.track-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.track-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
}

.track-meta {
  margin-top: 12px;
  flex-wrap: wrap;
}
</style>
