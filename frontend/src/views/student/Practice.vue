<template>
  <div class="practice-page">
    <div class="page-header">
      <h2>薄弱补练</h2>
      <p>针对薄弱知识点进行强化练习</p>
    </div>
    
    <el-card class="gradient-card">
      <template #header>
        <span>练习题目</span>
      </template>
      
      <div v-for="(question, index) in questions" :key="question.id" class="question-item">
        <div class="question-header">
          <span>第{{ index + 1 }}题</span>
          <el-tag>{{ question.difficulty }}</el-tag>
        </div>
        <div class="question-content">{{ question.content }}</div>

        <div v-if="question.type === 'choice'" class="question-options">
          <el-radio-group v-model="answers[question.id]">
            <el-radio v-for="(opt, i) in question.options" :key="i" :label="String.fromCharCode(65 + i)">
              {{ String.fromCharCode(65 + i) }}. {{ opt }}
            </el-radio>
          </el-radio-group>
        </div>

        <div v-else-if="question.type === 'fill'">
          <el-input v-model="answers[question.id]" placeholder="请输入答案" />
        </div>

        <div v-else>
          <el-input v-model="answers[question.id]" type="textarea" :rows="4" placeholder="请输入答案" />
        </div>
      </div>
      
      <el-empty v-if="questions.length === 0" description="暂无练习题目" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/utils/api'

var route = useRoute()
var questions = ref([])
var answers = reactive({})

onMounted(function() {
  var kpId = route.query.kpId
  var questionId = route.query.questionId
  if (questionId) {
    loadPractice(kpId || 'custom', questionId)
  } else if (kpId) {
    loadPractice(kpId)
  }
})

function loadPractice(kpId, questionId) {
  var url = '/student/practice/' + kpId
  if (questionId) {
    url += '?questionId=' + questionId
  }
  api.get(url)
    .then(function(res) {
      if (res.success) {
        questions.value = res.data
      }
    })
    .catch(function(error) {
      console.error('加载失败:', error)
    })
}
</script>

<style scoped>
.question-item {
  padding: 20px;
  margin-bottom: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.question-content {
  margin-bottom: 16px;
  line-height: 1.6;
}

.question-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
