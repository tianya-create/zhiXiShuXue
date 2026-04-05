<template>
  <div class="grading-center">
    <div class="page-header">
      <h2>批改中心</h2>
      <p>批改学生作业和试卷</p>
    </div>
    
    <el-card class="gradient-card">
      <template #header>
        <span>待批改列表</span>
      </template>
      
      <el-table :data="answers" style="width: 100%" v-loading="loading">
        <el-table-column prop="studentName" label="学生" width="120" />
        <el-table-column prop="assignmentTitle" label="作业名称" />
        <el-table-column prop="submittedAt" label="提交时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.submittedAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'graded' ? 'success' : 'warning'">
              {{ scope.row.status === 'graded' ? '已批改' : '待批改' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalScore" label="得分" width="100">
          <template #default="scope">
            {{ scope.row.totalScore !== undefined ? scope.row.totalScore : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="scope">
            <el-button type="primary" link @click="viewAnswer(scope.row)">查看</el-button>
            <el-button type="primary" link @click="gradeAnswer(scope.row)">
              {{ scope.row.status === 'graded' ? '重新批改' : '批改' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-dialog v-model="gradeDialogVisible" :title="dialogTitle" width="900px">
      <div v-if="currentAnswer">
        <div class="dialog-summary">
          <span>学生：{{ currentAnswer.student && currentAnswer.student.name ? currentAnswer.student.name : '-' }}</span>
          <span>作业：{{ currentAnswer.assignment && currentAnswer.assignment.title ? currentAnswer.assignment.title : '-' }}</span>
          <span>总分：{{ currentAnswer.answer && currentAnswer.answer.totalScore !== undefined ? currentAnswer.answer.totalScore : 0 }}</span>
        </div>

        <div
          v-for="(item, index) in currentAnswer.questionResults"
          :key="item.questionId"
          class="question-card"
        >
          <div class="question-title">
            <strong>第{{ index + 1 }}题</strong>
            <span>满分 {{ item.fullScore || 0 }} 分</span>
          </div>
          <div class="question-line"><span>题干：</span>{{ item.content || '-' }}</div>
          <div class="question-line"><span>学生答案：</span>{{ item.studentAnswer || '未作答' }}</div>
          <div class="question-line"><span>标准答案：</span>{{ item.standardAnswer || '无' }}</div>
          <div class="question-score">
            <span>得分：</span>
            <el-input-number
              v-model="gradeScores[item.questionId]"
              :min="0"
              :max="item.fullScore || 100"
              :disabled="viewOnly"
            />
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="gradeDialogVisible = false">关闭</el-button>
        <el-button v-if="!viewOnly" type="primary" @click="submitGrade">提交批改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import dayjs from 'dayjs'

var loading = ref(false)
var gradeDialogVisible = ref(false)
var answers = ref([])
var currentAnswer = ref(null)
var viewOnly = ref(false)
var gradeScores = reactive({})

var dialogTitle = computed(function() {
  return viewOnly.value ? '查看答题详情' : '批改答题'
})

onMounted(function() {
  loadAnswers()
})

function resetGradeScores() {
  var keys = Object.keys(gradeScores)
  for (var i = 0; i < keys.length; i++) {
    delete gradeScores[keys[i]]
  }
}

function loadAnswers() {
  loading.value = true
  api.get('/teacher/answers')
    .then(function(res) {
      if (res.success) {
        answers.value = res.data || []
      }
    })
    .catch(function() {
      ElMessage.error('加载答题列表失败')
    })
    .finally(function() {
      loading.value = false
    })
}

function openAnswerDialog(row, onlyView) {
  api.get('/teacher/answers/' + row.id)
    .then(function(res) {
      if (res.success) {
        currentAnswer.value = res.data
        viewOnly.value = onlyView
        resetGradeScores()
        var list = res.data.questionResults || []
        for (var i = 0; i < list.length; i++) {
          gradeScores[list[i].questionId] = list[i].score || 0
        }
        gradeDialogVisible.value = true
      }
    })
    .catch(function() {
      ElMessage.error('加载答题详情失败')
    })
}

function viewAnswer(row) {
  openAnswerDialog(row, true)
}

function gradeAnswer(row) {
  openAnswerDialog(row, false)
}

function submitGrade() {
  api.post('/teacher/answers/' + currentAnswer.value.answer.id + '/grade', { scores: gradeScores })
    .then(function(res) {
      if (res.success) {
        ElMessage.success('批改成功')
        gradeDialogVisible.value = false
        loadAnswers()
      }
    })
    .catch(function() {
      ElMessage.error('批改失败')
    })
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}
</script>

<style scoped>
.dialog-summary {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
  color: #606266;
  flex-wrap: wrap;
}

.question-card {
  margin-bottom: 16px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.question-title {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.question-line {
  margin-bottom: 8px;
  line-height: 1.6;
}

.question-line span,
.question-score span {
  color: #909399;
}

.question-score {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
</style>
