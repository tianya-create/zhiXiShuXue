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
        <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
          <el-icon :size="32"><Edit /></el-icon>
          <div class="stat-value">{{ stats.completedAssignments }}</div>
          <div class="stat-label">已完成作业</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
          <el-icon :size="32"><TrendCharts /></el-icon>
          <div class="stat-value">{{ stats.avgScore }}%</div>
          <div class="stat-label">平均正确率</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
          <el-icon :size="32"><Warning /></el-icon>
          <div class="stat-value">{{ stats.weakPoints }}</div>
          <div class="stat-label">薄弱知识点</div>
        </div>
      </el-col>
    </el-row>

    <el-card v-if="newRecommendations.length" class="gradient-card recommend-panel">
      <template #header>
        <div class="card-header">
          <span>新的补练推荐</span>
          <el-tag type="danger">{{ newRecommendations.length }} 个知识点待处理</el-tag>
        </div>
      </template>
      <div class="recommend-desc">老师刚完成批改，以下知识点根据你的作业结果生成了新的补练建议。</div>
      <div class="recommend-grid">
        <div v-for="item in newRecommendations" :key="item.id" class="recommend-card-item">
          <div class="recommend-card-head">
            <div class="recommend-card-name">{{ item.name }}</div>
            <el-tag type="warning" effect="dark">新推荐</el-tag>
          </div>
          <div class="recommend-card-meta">
            <span>错误 {{ item.wrongCount }}</span>
            <span>掌握度 {{ item.masteryRate }}%</span>
          </div>
          <el-button type="danger" @click="goToPractice(item)">立即补练</el-button>
        </div>
      </div>
    </el-card>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="16">
        <el-card class="gradient-card">
          <template #header>
            <div class="card-header">
              <span>待完成作业</span>
              <el-button type="primary" text @click="goToAssignments">
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
                <el-button type="primary" size="small" @click="startAssignment(scope.row)">
                  开始答题
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="gradient-card">
          <template #header>知识掌握概览</template>
          <div id="knowledgeChart" style="height: 250px;"></div>
        </el-card>

        <el-card class="gradient-card" style="margin-top: 20px;">
          <template #header>快捷入口</template>
          <div class="quick-actions">
            <el-button type="primary" @click="goToKnowledge">
              知识图谱
            </el-button>
            <el-button type="warning" @click="goToWeakPoints">
              薄弱点
            </el-button>
            <el-button type="danger" @click="goToWrongQuestions">
              错题本
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
var currentDate = computed(function() {
  return dayjs().format('YYYY年MM月DD日 dddd')
})

var stats = reactive({
  pendingAssignments: 0,
  completedAssignments: 0,
  avgScore: 0,
  weakPoints: 0
})

var pendingAssignments = ref([])
var weakPointList = ref([])
var chart = null

var newRecommendations = computed(function() {
  return weakPointList.value.filter(function(item) {
    return !!item.hasNewRecommendation
  }).slice(0, 3)
})

onMounted(function() {
  loadData()
})

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

function loadData() {
  Promise.all([
    api.get('/student/assignments', { status: 'pending' }),
    api.get('/student/weak-points')
  ]).then(function(results) {
    var assignmentRes = results[0]
    var weakPointRes = results[1]

    if (assignmentRes.success) {
      pendingAssignments.value = assignmentRes.data.slice(0, 5)
      stats.pendingAssignments = assignmentRes.data.length
    }

    if (weakPointRes.success) {
      weakPointList.value = weakPointRes.data || []
      stats.weakPoints = weakPointList.value.length
    }

    stats.completedAssignments = 0
    stats.avgScore = getAverageMastery(weakPointList.value)

    return nextTick()
  }).then(function() {
    renderChart()
  }).catch(function(error) {
    console.error('加载数据失败:', error)
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

  var mastered = 0
  var learning = 0
  var weak = 0

  weakPointList.value.forEach(function(item) {
    var rate = parseInt(item.masteryRate || 0)
    if (rate >= 80) mastered++
    else if (rate >= 60) learning++
    else weak++
  })

  chart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      name: '掌握情况',
      type: 'pie',
      radius: ['50%', '70%'],
      data: [
        { value: mastered, name: '已掌握', itemStyle: { color: '#67C23A' } },
        { value: learning, name: '学习中', itemStyle: { color: '#E6A23C' } },
        { value: weak, name: '薄弱', itemStyle: { color: '#F56C6C' } }
      ]
    }]
  })
}

function startAssignment(row) {
  router.push('/student/assignment/' + row.id)
}

function goToPractice(row) {
  router.push({ path: '/student/practice', query: { kpId: row.id } })
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

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.quick-actions .el-button {
  width: 100%;
}

.recommend-panel {
  margin-top: 20px;
}

.recommend-desc {
  margin-bottom: 14px;
  color: #6b7280;
}

.recommend-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.recommend-card-item {
  padding: 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, #fff1f0, #fff7e6);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recommend-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.recommend-card-name {
  font-size: 15px;
  font-weight: 700;
}

.recommend-card-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  color: #6b7280;
  font-size: 13px;
}
</style>
