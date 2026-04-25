<template>
  <div class="class-analytics">
    <div class="page-header">
      <h2>班级学情分析</h2>
      <p>查看班级整体学习情况</p>
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
            <el-col :span="6">
              <div class="stat-card" style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); color: #1976d2;">
                <div class="stat-value">{{ analytics.avgScore || 0 }}</div>
                <div class="stat-label">平均分</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card" style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); color: #1976d2;">
                <div class="stat-value">{{ analytics.studentCount || 0 }}</div>
                <div class="stat-label">学生人数</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card" style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); color: #1976d2;">
                <div class="stat-value">{{ analytics.completedCount || 0 }}</div>
                <div class="stat-label">已完成作业</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card" style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); color: #1976d2;">
                <div class="stat-value">{{ avgScorePercent }}%</div>
                <div class="stat-label">平均正确率</div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
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
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>学生层次分布</template>
          <div id="levelChart" style="height: 400px;"></div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>薄弱知识点统计</template>
          <div id="weakKnowledgeChart" style="height: 400px;"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>高频错题类型统计</template>
          <div id="errorTypeChart" style="height: 400px;"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import api from '@/utils/api'
import * as echarts from 'echarts'

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

var avgScorePercent = computed(function() {
  if (!analytics.value || !analytics.value.avgScore) {
    return 0
  }
  return Math.round(analytics.value.avgScore * 10) / 10
})

onMounted(function() {
  loadClasses()
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
  errorTypeChart = echarts.init(chartDom)
  
  // 模拟高频错题类型数据
  var errorTypeData = [
    { type: '选择题', count: 12 },
    { type: '填空题', count: 8 },
    { type: '简答题', count: 5 },
    { type: '计算题', count: 10 },
    { type: '证明题', count: 3 }
  ]
  
  var option = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: errorTypeData.map(item => item.type) },
    yAxis: { type: 'value' },
    series: [{
      name: '错误次数',
      type: 'line',
      data: errorTypeData.map(item => item.count),
      smooth: true,
      itemStyle: {
        color: '#667eea'
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(102, 126, 234, 0.5)' },
          { offset: 1, color: 'rgba(102, 126, 234, 0.1)' }
        ])
      }
    }]
  }
  
  errorTypeChart.setOption(option)
}

function renderWeakKnowledgeChart() {
  var chartDom = document.getElementById('weakKnowledgeChart')
  if (!chartDom) return
  
  if (weakKnowledgeChart) weakKnowledgeChart.dispose()
  weakKnowledgeChart = echarts.init(chartDom)
  
  // 模拟薄弱知识点数据
  var weakKnowledgeData = [
    { knowledge: '有理数运算', mastery: 45 },
    { knowledge: '方程解法', mastery: 60 },
    { knowledge: '几何证明', mastery: 35 },
    { knowledge: '函数性质', mastery: 55 },
    { knowledge: '概率统计', mastery: 65 }
  ]
  
  var option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', max: 100 },
    yAxis: { type: 'category', data: weakKnowledgeData.map(item => item.knowledge) },
    series: [{
      name: '掌握度',
      type: 'bar',
      data: weakKnowledgeData.map(item => item.mastery),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
          { offset: 0, color: '#667eea' },
          { offset: 1, color: '#764ba2' }
        ])
      }
    }]
  }
  
  weakKnowledgeChart.setOption(option)
}

function renderLevelChart() {
  var chartDom = document.getElementById('levelChart')
  if (!chartDom) return
  
  if (levelChart) levelChart.dispose()
  levelChart = echarts.init(chartDom)
  
  var levelData = analytics.value && analytics.value.levelDistribution ? analytics.value.levelDistribution : {}
  var data = [
    { value: levelData.weak || 0, name: '薄弱' },
    { value: levelData.normal || 0, name: '中等' },
    { value: levelData.strong || 0, name: '优秀' }
  ]
  
  var option = {
    tooltip: { trigger: 'item' },
    legend: { top: '5%', left: 'center' },
    series: [{
      name: '学生层次',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: false,
        position: 'center'
      },
      emphasis: {
        label: {
          show: true,
          fontSize: '18',
          fontWeight: 'bold'
        }
      },
      labelLine: {
        show: false
      },
      data: data,
      color: ['#f56c6c', '#e6a23c', '#67c23a']
    }]
  }
  
  levelChart.setOption(option)
}

function getLevelType(level) {
  if (level === 'strong') return 'success'
  if (level === 'weak') return 'danger'
  return 'warning'
}

function getLevelText(level) {
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
  padding: 24px;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-normal) var(--ease-spring);
  position: relative;
  overflow: hidden;
  text-align: center;
}

.stat-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-lg);
}

.stat-card .stat-value {
  font-size: 36px;
  font-weight: 800;
  font-family: 'Noto Serif SC', serif;
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}

.stat-card .stat-label {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.9;
}
</style>
