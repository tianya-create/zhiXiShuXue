<template>
  <div class="student-dashboard">
    <div class="page-header">
      <h2>学习中心</h2>
      <p>今天是 {{ currentDate }}，继续努力学习吧！</p>
    </div>

    <el-row :gutter="20" class="stat-cards">
      <el-col :span="6">
        <div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <el-icon :size="32"><Document /></el-icon>
          <div class="stat-value">{{ stats.pendingAssignments }}</div>
          <div class="stat-label">待完成作业</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
          <el-icon :size="32"><TrendCharts /></el-icon>
          <div class="stat-value">{{ stats.avgScore }}%</div>
          <div class="stat-label">平均掌握度</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card weak-card">
          <el-icon :size="32"><WarningFilled /></el-icon>
          <div class="stat-value">{{ weakBreakdown.weak }}</div>
          <div class="stat-label">薄弱知识点</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card mastered-card">
          <el-icon :size="32"><CircleCheck /></el-icon>
          <div class="stat-value">{{ weakBreakdown.mastered }}</div>
          <div class="stat-label">已掌握知识点</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="16">
        <el-card class="gradient-card" v-loading="loadingAssignments">
          <template #header>
            <div class="card-header">
              <span>待完成作业</span>
              <el-button class="dashboard-primary-btn" type="primary" text @click="goToAssignments">
                查看全部
              </el-button>
            </div>
          </template>
          <el-table :data="pendingAssignments" style="width: 100%">
            <el-table-column prop="title" label="作业名称" />
            <el-table-column prop="paperTitle" label="试卷" width="150" />
            <el-table-column prop="questionCount" label="题目数" width="80" />
            <el-table-column prop="deadline" label="截止时间" width="180">
              <template #default="scope">
                {{ formatDate(scope.row.deadline) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="scope">
                <el-button class="dashboard-primary-btn" type="primary" size="small" @click="startAssignment(scope.row)">
                  开始答题
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!loadingAssignments && pendingAssignments.length === 0" description="暂无待完成作业" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="gradient-card" v-loading="loadingWeakPoints">
          <template #header>
            <div class="card-header">
              <span>知识掌握概览</span>
              <el-tag type="danger">薄弱 {{ weakBreakdown.weak }}</el-tag>
            </div>
          </template>
          <div class="mastery-breakdown">
            <div class="mastery-item is-strong">
              <span class="mastery-name">已掌握</span>
              <strong>{{ weakBreakdown.mastered }}</strong>
            </div>
            <div class="mastery-item is-middle">
              <span class="mastery-name">待巩固</span>
              <strong>{{ weakBreakdown.learning }}</strong>
            </div>
            <div class="mastery-item is-weak">
              <span class="mastery-name">薄弱</span>
              <strong>{{ weakBreakdown.weak }}</strong>
            </div>
          </div>
          <div id="knowledgeChart" style="height: 220px;"></div>
        </el-card>

        <el-card class="gradient-card quick-entry-card" style="margin-top: 20px;">
          <template #header>快捷入口</template>
          <div class="quick-actions-grid">
            <el-button class="quick-action-btn quick-action-primary dashboard-primary-btn" type="primary" @click="goToKnowledge">
              <span class="quick-action-title">知识图谱</span>
              <span class="quick-action-subtitle">查看知识结构</span>
            </el-button>
            <el-button class="quick-action-btn quick-action-warning" type="warning" @click="goToWeakPoints">
              <span class="quick-action-title">薄弱点</span>
              <span class="quick-action-subtitle">进入专项补练</span>
            </el-button>
            <el-button class="quick-action-btn quick-action-danger" type="danger" @click="goToWrongQuestions">
              <span class="quick-action-title">错题本</span>
              <span class="quick-action-subtitle">原地重做错题</span>
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'
import * as echarts from 'echarts'
import dayjs from 'dayjs'

var router = useRouter()
var chart = null
var loadingAssignments = ref(false)
var loadingWeakPoints = ref(false)
var pendingAssignments = ref([])
var weakPointList = ref([])

var currentDate = computed(function() {
  return dayjs().format('YYYY年MM月DD日 dddd')
})

var stats = reactive({
  pendingAssignments: 0,
  avgScore: 0
})

var weakBreakdown = computed(function() {
  var result = { mastered: 0, learning: 0, weak: 0 }
  weakPointList.value.forEach(function(item) {
    var rate = parseInt(item.masteryRate || 0)
    if (rate >= 80) result.mastered++
    else if (rate >= 60) result.learning++
    else result.weak++
  })
  return result
})

onMounted(function() {
  loadAssignments()
  loadWeakPoints()
})

function loadAssignments() {
  loadingAssignments.value = true
  api.get('/student/assignments', { status: 'pending' })
    .then(function(res) {
      if (res.success) {
        pendingAssignments.value = (res.data || []).slice(0, 5)
        stats.pendingAssignments = (res.data || []).length
      }
    })
    .catch(function(error) {
      console.error('首页作业加载失败:', error)
      pendingAssignments.value = []
      stats.pendingAssignments = 0
    })
    .finally(function() {
      loadingAssignments.value = false
    })
}

function loadWeakPoints() {
  loadingWeakPoints.value = true
  api.get('/student/weak-points')
    .then(function(res) {
      if (res.success) {
        weakPointList.value = res.data || []
        stats.avgScore = getAverageMastery(weakPointList.value)
        return nextTick()
      }
    })
    .then(function() {
      renderChart()
    })
    .catch(function(error) {
      console.error('首页薄弱点加载失败:', error)
      weakPointList.value = []
      stats.avgScore = 0
    })
    .finally(function() {
      loadingWeakPoints.value = false
    })
}

function getAverageMastery(list) {
  if (!list.length) return 0
  var total = list.reduce(function(sum, item) {
    return sum + parseInt(item.masteryRate || 0)
  }, 0)
  return Math.round(total / list.length)
}

function renderChart() {
  var chartDom = document.getElementById('knowledgeChart')
  if (!chartDom) return

  if (chart) chart.dispose()
  chart = echarts.init(chartDom)

  chart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      name: '掌握情况',
      type: 'pie',
      radius: ['50%', '70%'],
      data: [
        { value: weakBreakdown.value.mastered, name: '已掌握', itemStyle: { color: '#67C23A' } },
        { value: weakBreakdown.value.learning, name: '待巩固', itemStyle: { color: '#E6A23C' } },
        { value: weakBreakdown.value.weak, name: '薄弱', itemStyle: { color: '#F56C6C' } }
      ]
    }]
  })
}

function goToAssignments() {
  router.push('/student/assignments')
}

function goToKnowledge() {
  router.push('/student/knowledge')
}

function goToWeakPoints() {
  router.push('/student/weak-points')
}

function goToWrongQuestions() {
  router.push('/student/wrong-questions')
}

function startAssignment(row) {
  router.push('/student/assignment/' + row.id)
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '未设置'
}
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dashboard-primary-btn {
  color: #ffffff !important;
}

.quick-entry-card :deep(.el-card__body) {
  padding: 18px;
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.quick-action-btn {
  margin: 0;
  min-height: 72px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 6px;
  padding: 14px 18px;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.1);
}

.quick-action-title,
.quick-action-subtitle {
  width: 100%;
  text-align: left;
}

.quick-action-title {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
}

.quick-action-subtitle {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.88);
}

.quick-action-primary {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-color: #1d4ed8;
}

.quick-action-warning {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  border-color: #d97706;
  color: #ffffff;
}

.quick-action-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  border-color: #dc2626;
  color: #ffffff;
}

.mastery-breakdown {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.mastery-item {
  padding: 12px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mastery-item strong {
  font-size: 24px;
}

.mastery-name {
  font-size: 13px;
  color: #475569;
}

.mastery-item.is-strong {
  background: #f0fdf4;
  color: #166534;
}

.mastery-item.is-middle {
  background: #fffbeb;
  color: #b45309;
}

.mastery-item.is-weak {
  background: #fef2f2;
  color: #b91c1c;
}

.weak-card {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.mastered-card {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
}
</style>
