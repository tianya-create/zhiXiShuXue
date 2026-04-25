<template>
  <div class="student-assignments">
    <div class="page-header">
      <h2>我的作业</h2>
      <p>查看和完成作业任务</p>
    </div>
    
    <el-card class="gradient-card">
      <template #header>
        <div class="card-header">
          <span>作业列表</span>
          <el-radio-group v-model="filterStatus" @change="loadAssignments">
            <el-radio-button label="">全部</el-radio-button>
            <el-radio-button label="pending">待完成</el-radio-button>
            <el-radio-button label="completed">已完成</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      
      <el-table :data="assignments" style="width: 100%" v-loading="loading">
        <el-table-column prop="title" label="作业名称" />
        <el-table-column prop="paperTitle" label="试卷" width="150" />
        <el-table-column prop="questionCount" label="题目数" width="80" />
        <el-table-column prop="deadline" label="截止时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.deadline) }}
          </template>
        </el-table-column>
        <el-table-column prop="submitted" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.submitted ? 'success' : 'warning'">
              {{ scope.row.submitted ? '已完成' : '待完成' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="score" label="得分" width="80">
          <template #default="scope">
            {{ scope.row.score !== undefined ? scope.row.score : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button
              type="primary"
              size="small"
              @click="scope.row.submitted ? viewResult(scope.row) : startAssignment(scope.row)"
            >
              {{ scope.row.submitted ? '查看结果' : '开始答题' }}
            </el-button>
            <el-button
              v-if="scope.row.hasPdfPaper && scope.row.paperFilePath"
              type="info"
              size="small"
              @click="viewPaper(scope.row)"
            >
              查看试卷
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'
import dayjs from 'dayjs'

var router = useRouter()
var loading = ref(false)
var filterStatus = ref('')
var assignments = ref([])

onMounted(function() {
  loadAssignments()
})

function loadAssignments() {
  loading.value = true
  api.get('/student/assignments', { status: filterStatus.value })
    .then(function(res) {
      if (res.success) {
        assignments.value = res.data
      }
    })
    .catch(function(error) {
      console.error('加载失败:', error)
    })
    .finally(function() {
      loading.value = false
    })
}

function startAssignment(row) {
  router.push('/student/assignment/' + row.id)
}

function viewResult(row) {
  router.push('/student/assignment/' + row.id + '?view=result')
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '未设置'
}

function getFilePreviewUrl(filePath) {
  if (!filePath) return ''
  if (/^https?:\/\//i.test(filePath)) return filePath

  var origin = window.location.origin
  if (origin.indexOf(':5000') !== -1) {
    origin = origin.replace(':5000', ':5001')
  }

  return origin + filePath
}

function viewPaper(row) {
  if (!row || !row.paperFilePath || !row.hasPdfPaper) return
  var url = getFilePreviewUrl(row.paperFilePath)
  window.open(url, '_blank')
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
