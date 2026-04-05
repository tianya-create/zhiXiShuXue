<template>
  <div class="wrong-questions">
    <div class="page-header">
      <h2>错题本</h2>
      <p>汇总您的错题，帮助巩固学习</p>
    </div>
    
    <el-card class="gradient-card">
      <el-table :data="wrongQuestions" style="width: 100%">
        <el-table-column prop="content" label="题目内容" show-overflow-tooltip />
        <el-table-column prop="type" label="题型" width="100">
          <template #default="scope">
            <el-tag>{{ getTypeText(scope.row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="studentAnswer" label="你的答案" width="120" />
        <el-table-column prop="answer" label="正确答案" width="120" />
        <el-table-column prop="submittedAt" label="答题时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.submittedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button type="primary" link @click="redoQuestion(scope.row)">重做</el-button>
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
var wrongQuestions = ref([])

onMounted(function() {
  loadData()
})

function loadData() {
  api.get('/student/wrong-questions')
    .then(function(res) {
      if (res.success) {
        wrongQuestions.value = res.data
      }
    })
    .catch(function(error) {
      console.error('加载失败:', error)
    })
}

function redoQuestion(row) {
  var kpId = row.knowledgePoints && row.knowledgePoints.length ? row.knowledgePoints[0] : ''
  router.push('/student/practice?kpId=' + kpId + '&questionId=' + row.id)
}

function getTypeText(type) {
  if (type === 'choice') return '选择题'
  if (type === 'fill') return '填空题'
  if (type === 'shortAnswer') return '简答题'
  return '未知'
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}
</script>
