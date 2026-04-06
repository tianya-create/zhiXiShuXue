<template>
  <div class="teacher-dashboard">
    <div class="page-header">
      <h2>教师工作台</h2>
      <p>欢迎使用智慧教育平台，今天是 {{ currentDate }}</p>
    </div>
    
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-cards">
      <el-col :span="6">
        <div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <el-icon :size="32"><User /></el-icon>
          <div class="stat-value">{{ stats.studentCount }}</div>
          <div class="stat-label">学生总数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
          <el-icon :size="32"><Document /></el-icon>
          <div class="stat-value">{{ stats.paperCount }}</div>
          <div class="stat-label">试卷总数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
          <el-icon :size="32"><Edit /></el-icon>
          <div class="stat-value">{{ stats.pendingCount }}</div>
          <div class="stat-label">待批改</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
          <el-icon :size="32"><TrendCharts /></el-icon>
          <div class="stat-value">{{ stats.avgScore }}%</div>
          <div class="stat-label">平均正确率</div>
        </div>
      </el-col>
    </el-row>
    
    <el-row :gutter="20" style="margin-top: 20px;">
      <!-- 最近作业 -->
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>
            <div class="card-header">
              <span>最近作业</span>
              <el-button type="primary" text @click="goToAssignments">
                查看全部
              </el-button>
            </div>
          </template>
          <el-table :data="recentAssignments" style="width: 100%">
            <el-table-column prop="title" label="作业名称" />
            <el-table-column prop="className" label="班级" width="120" />
            <el-table-column prop="submittedCount" label="已提交" width="80" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'published' ? 'success' : 'info'">
                  {{ scope.row.status === 'published' ? '进行中' : '已结束' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      
      <!-- 班级概览 -->
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>
            <div class="card-header">
              <span>班级概览</span>
              <el-button type="primary" text @click="goToClasses">
                查看全部
              </el-button>
            </div>
          </template>
          <el-table :data="classes" style="width: 100%">
            <el-table-column prop="name" label="班级名称" />
            <el-table-column prop="grade" label="年级" width="100" />
            <el-table-column prop="studentCount" label="学生数" width="80" />
            <el-table-column label="操作" width="100">
              <template #default="scope">
                <el-button type="primary" link @click="viewClassAnalytics(scope.row.id)">
                  学情
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 快捷操作 -->
    <el-card class="gradient-card" style="margin-top: 20px;">
      <template #header>
        <span>快捷操作</span>
      </template>
      <div class="quick-actions">
        <el-button type="primary" size="large" @click="goToPapers">
          <el-icon><Upload /></el-icon>
          上传试卷
        </el-button>
        <el-button type="success" size="large" @click="goToAssignments">
          <el-icon><Document /></el-icon>
          发布作业
        </el-button>
        <el-button type="warning" size="large" @click="goToGrading">
          <el-icon><Edit /></el-icon>
          批改作业
        </el-button>
        <el-button type="info" size="large" @click="goToAnalytics">
          <el-icon><TrendCharts /></el-icon>
          学情分析
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'
import dayjs from 'dayjs'

var router = useRouter()

var currentDate = computed(function() {
  return dayjs().format('YYYY年MM月DD日 dddd')
})

var stats = ref({
  studentCount: 0,
  paperCount: 0,
  pendingCount: 0,
  avgScore: 0
})
var recentAssignments = ref([])
var classes = ref([])

onMounted(function() {
  loadData()
})

function goToAssignments() {
  router.push('/teacher/assignments')
}

function goToClasses() {
  router.push('/teacher/classes')
}

function goToPapers() {
  router.push('/teacher/papers')
}

function goToGrading() {
  router.push('/teacher/grading')
}

function goToAnalytics() {
  router.push('/teacher/analytics/class')
}

function loadData() {
  // 加载班级列表
  api.get('/teacher/classes').then(function(classRes) {
    if (classRes.success) {
      classes.value = classRes.data
      var total = 0
      for (var i = 0; i < classRes.data.length; i++) {
        var c = classRes.data[i]
        if (c.studentCount) {
          total = total + c.studentCount
        }
      }
      stats.value.studentCount = total
    }
    
    // 加载作业列表
    return api.get('/teacher/assignments')
  }).then(function(assignmentRes) {
    if (assignmentRes.success) {
      var assignments = assignmentRes.data.slice(0, 5)
      var result = []
      for (var i = 0; i < assignments.length; i++) {
        var a = assignments[i]
        var clsName = '未知班级'
        for (var j = 0; j < classes.value.length; j++) {
          if (classes.value[j].id === a.classId) {
            clsName = classes.value[j].name
            break
          }
        }
        result.push({
          id: a.id,
          title: a.title,
          className: clsName,
          submittedCount: a.submittedCount || 0,
          status: a.status
        })
      }
      recentAssignments.value = result
    }
    
    // 加载试卷统计
    return api.get('/teacher/papers')
  }).then(function(paperRes) {
    if (paperRes.success) {
      stats.value.paperCount = paperRes.data.total || 0
    }
    
    // 加载待批改数量
    return api.get('/teacher/answers')
  }).then(function(answerRes) {
    if (answerRes.success) {
      var count = 0
      for (var i = 0; i < answerRes.data.length; i++) {
        if (answerRes.data[i].status === 'submitted') {
          count++
        }
      }
      stats.value.pendingCount = count
    }
    
    // 模拟平均正确率
    stats.value.avgScore = 78
  }).catch(function(error) {
    console.error('加载数据失败:', error)
  })
}

function viewClassAnalytics(classId) {
  router.push('/teacher/analytics/class?classId=' + classId)
}
</script>

<style scoped>
.stat-cards {
  margin-top: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header .el-button {
  color: white;
}

.quick-actions {
  display: flex;
  gap: 16px;
}

.quick-actions .el-button {
  flex: 1;
  height: 60px;
  font-size: 16px;
}

.quick-actions .el-button:nth-child(4) {
  background-color: #667eea;
  border-color: #667eea;
}

.quick-actions .el-button:nth-child(4):hover {
  background-color: #5a6fe5;
  border-color: #5a6fe5;
}
</style>
