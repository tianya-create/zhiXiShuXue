<template>
  <div class="student-assignments">
    <div class="page-header">
      <h2>我的作业</h2>
      <p>老师布置的作业都在这里。交卷后可以看到红笔批改的结果。</p>
    </div>
    
    <el-card class="gradient-card">
      <template #header>
        <div class="card-header">
          <span>作业列表</span>
          <el-radio-group v-model="filterStatus" @change="loadAssignments">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button value="pending">待完成</el-radio-button>
            <el-radio-button value="completed">已完成</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      
      <el-table
        class="assignment-table"
        :data="assignments"
        style="width: 100%"
        table-layout="fixed"
        v-loading="loading"
      >
        <el-table-column prop="title" label="作业名称" width="260" show-overflow-tooltip />
        <el-table-column prop="paperTitle" label="试卷" min-width="220" show-overflow-tooltip />
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
        <el-table-column prop="score" label="得分" width="90">
          <template #default="scope">
            <span v-if="scope.row.submitted && scope.row.score !== undefined" class="hand-score">{{ scope.row.score }}</span>
            <span v-else class="no-score">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button
              type="primary"
              link
              size="small"
              @click="scope.row.submitted ? viewResult(scope.row) : startAssignment(scope.row)"
            >
              {{ scope.row.submitted ? '查看结果' : '开始答题' }}
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
</script>

<style scoped>
.student-assignments {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: clip;
}

.hand-score {
  font-family: var(--nb-font-hand);
  font-weight: 700;
  font-size: 26px;
  line-height: 1;
  color: var(--nb-red-ink);
}

.no-score {
  color: var(--nb-ink-3);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.student-assignments :deep(.el-card),
.student-assignments :deep(.el-card__body),
.student-assignments :deep(.assignment-table),
.student-assignments :deep(.el-table__inner-wrapper),
.student-assignments :deep(.el-table__header-wrapper),
.student-assignments :deep(.el-table__body-wrapper) {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0;
  box-sizing: border-box;
}

.student-assignments :deep(.assignment-table .el-table__header),
.student-assignments :deep(.assignment-table .el-table__body) {
  width: 100% !important;
  table-layout: fixed !important;
}

.student-assignments :deep(.assignment-table .cell) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
