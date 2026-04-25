<template>
  <div class="assignment-detail">
    <div class="page-header">
      <h2>{{ viewMode ? '答题结果' : '在线答题' }}</h2>
      <p>{{ assignmentTitle }}</p>
    </div>
    
    <el-card class="gradient-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>题目列表</span>
          <div v-if="!viewMode">
            <el-button type="primary" @click="submitAnswers" :loading="submitting">
              提交答案
            </el-button>
          </div>
        </div>
      </template>
      
      <div v-for="(question, index) in questions" :key="question.id" class="question-item">
        <div class="question-header">
          <span class="question-number">第{{ index + 1 }}题</span>
          <el-tag>{{ getTypeText(question.type) }}</el-tag>
          <el-tag type="info">{{ question.score }}分</el-tag>
        </div>
        
        <div class="question-content">{{ question.content }}</div>
        
        <div v-if="question.type === 'choice'" class="question-options">
          <el-radio-group v-model="answers[question.id]" :disabled="viewMode">
            <el-radio
              v-for="(opt, optIndex) in question.options"
              :key="optIndex"
              :label="String.fromCharCode(65 + optIndex)"
              class="option-item"
            >
              {{ String.fromCharCode(65 + optIndex) }}. {{ opt }}
            </el-radio>
          </el-radio-group>
        </div>
        
        <div v-else-if="question.type === 'fill'" class="question-fill">
          <el-input
            v-model="answers[question.id]"
            placeholder="请输入答案"
            :disabled="viewMode"
          />
        </div>
        
        <div v-else class="question-short">
          <el-input
            v-model="answers[question.id]"
            type="textarea"
            :rows="4"
            placeholder="请输入答案"
            :disabled="viewMode"
          />
        </div>
        
        <div v-if="viewMode && hasResult(question.id)" class="answer-result">
          <div :class="['result-item', getResultCorrect(question.id) ? 'correct' : 'wrong']">
            <span>你的答案：{{ getAnswer(question.id) }}</span>
          </div>
          <div class="correct-answer">
            标准答案：{{ getCorrectAnswer(question.id) || '待教师批改' }}
          </div>
          <div class="score">得分：{{ getScore(question.id) }}/{{ question.score || 0 }}分</div>
        </div>
      </div>
      
      <el-empty v-if="questions.length === 0 && !loading" description="暂无题目" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

var route = useRoute()
var router = useRouter()
var loading = ref(false)
var submitting = ref(false)

var assignment = ref(null)
var questions = ref([])
var answers = reactive({})
var results = reactive({})

var viewMode = computed(function() {
  return route.query.view === 'result'
})

var assignmentTitle = computed(function() {
  if (!assignment.value || !assignment.value.title) {
    return '加载中...'
  }
  return assignment.value.title
})

onMounted(function() {
  loadAssignment()
})

function resetResults() {
  var keys = Object.keys(results)
  for (var i = 0; i < keys.length; i++) {
    delete results[keys[i]]
  }
}

function hasResult(questionId) {
  return results[questionId] !== undefined
}

function getResultCorrect(questionId) {
  var result = results[questionId]
  return result ? result.correct : false
}

function getAnswer(questionId) {
  var answer = answers[questionId]
  return answer || '未作答'
}

function getCorrectAnswer(questionId) {
  var result = results[questionId]
  return result ? result.correctAnswer : ''
}

function getScore(questionId) {
  var result = results[questionId]
  return result ? result.score : 0
}

function fillResults(questionList) {
  resetResults()
  for (var i = 0; i < questionList.length; i++) {
    var item = questionList[i]
    results[item.questionId] = item
    answers[item.questionId] = item.answer || ''
  }
}

function loadAssignment() {
  var assignmentId = route.params.id
  if (!assignmentId) return
  
  loading.value = true
  
  api.get('/student/assignments/' + assignmentId + '/questions').then(function(res) {
    if (res.success) {
      assignment.value = res.data.assignment
      questions.value = res.data.questions || []
      
      if (viewMode.value) {
        loadResults()
      }
    }
  }).catch(function() {
    ElMessage.error('加载作业失败')
  }).finally(function() {
    loading.value = false
  })
}

function loadResults() {
  var cachedAnswerId = sessionStorage.getItem('latest-answer-' + route.params.id)
  var request = cachedAnswerId
    ? Promise.resolve({ success: true, data: { answerId: cachedAnswerId } })
    : api.get('/student/assignments/' + route.params.id + '/latest-answer')

  request.then(function(resultRes) {
    if (!resultRes.success || !resultRes.data || !resultRes.data.answerId) {
      throw new Error('no answer id')
    }
    var answerId = resultRes.data.answerId
    sessionStorage.setItem('latest-answer-' + route.params.id, answerId)
    return api.get('/student/answers/' + answerId)
  }).then(function(res) {
    if (res.success) {
      fillResults(res.data.questions || [])
    }
  }).catch(function() {
    ElMessage.warning('暂无答题结果')
  })
}

function submitAnswers() {
  var answeredCount = 0
  var answerKeys = Object.keys(answers)
  for (var i = 0; i < answerKeys.length; i++) {
    if (answers[answerKeys[i]]) {
      answeredCount++
    }
  }
  
  if (answeredCount === 0) {
    ElMessage.warning('请至少回答一道题目')
    return
  }
  
  ElMessageBox.confirm('确定提交答案吗？已答' + answeredCount + '/' + questions.value.length + '题', '提示').then(function() {
    submitting.value = true
    
    api.post('/student/assignments/' + route.params.id + '/submit', {
      answers: answers
    }).then(function(res) {
      if (res.success) {
        ElMessage.success('提交成功')
        if (res.data && res.data.answerId) {
          sessionStorage.setItem('latest-answer-' + route.params.id, res.data.answerId)
        }
        router.replace('/student/assignment/' + route.params.id + '?view=result')
        loadResults()
      }
    }).catch(function() {
      ElMessage.error('提交失败')
    }).finally(function() {
      submitting.value = false
    })
  }).catch(function() {})
}

function getTypeText(type) {
  var map = { choice: '选择题', fill: '填空题', shortAnswer: '简答题' }
  return map[type] || '未知'
}
</script>

<style scoped>
.question-item {
  margin-bottom: 24px;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.question-number {
  font-size: 16px;
  font-weight: bold;
}

.question-content {
  margin-bottom: 16px;
  line-height: 1.6;
}

.question-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-item {
  display: flex;
  padding: 12px;
  background: white;
  border-radius: 4px;
}

.answer-result {
  margin-top: 16px;
  padding: 16px;
  background: white;
  border-radius: 8px;
}

.result-item {
  padding: 8px;
  border-radius: 4px;
}

.result-item.correct {
  background: #f0f9ff;
  color: #67C23A;
}

.result-item.wrong {
  background: #fef0f0;
  color: #F56C6C;
}

.correct-answer {
  margin-top: 8px;
  color: #67C23A;
}

.score {
  margin-top: 8px;
  font-weight: bold;
}
</style>
