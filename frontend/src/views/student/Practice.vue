<template>
  <div class="practice-page" v-loading="loading">
    <div class="page-header">
      <h2>薄弱补练</h2>
      <p>{{ pageDesc }}</p>
    </div>

    <el-card class="gradient-card overview-card" v-if="practiceMeta.title || practiceMeta.latestPractice || practiceMeta.chatPractice">
      <div class="overview-head">
        <div>
          <div class="overview-title">{{ practiceMeta.title || '专项练习' }}</div>
          <div class="overview-subtitle">
            {{ practiceMeta.mode === 'wrong-question' ? '错题将通过对话方式重新作答，提交后自动刷新掌握状态' : '每个知识点都会提供相关练习题，完成后自动判分并更新薄弱点与错题状态' }}
          </div>
        </div>
        <el-tag :type="practiceMeta.mode === 'wrong-question' ? 'danger' : 'warning'">
          {{ practiceMeta.mode === 'wrong-question' ? '错题重做' : '知识点补练' }}
        </el-tag>
      </div>

      <div v-if="practiceMeta.chatPractice" class="chat-intro-panel">
        <div class="chat-intro-title">智能推荐补练</div>
        <div class="chat-intro-desc">{{ practiceMeta.chatPractice.openingMessage }}</div>

        <div v-if="practiceMeta.chatPractice.knowledgePoint" class="chat-kp-meta">
          <el-tag type="warning">知识点：{{ practiceMeta.chatPractice.knowledgePoint.name }}</el-tag>
          <span class="chat-kp-desc">{{ practiceMeta.chatPractice.knowledgePoint.description }}</span>
        </div>

        <div v-if="relatedKnowledgePoints.length" class="chat-section">
          <div class="chat-section-title">薄弱板块知识练习题总览</div>
          <div class="knowledge-point-list">
            <div v-for="item in relatedKnowledgePoints" :key="item.id" class="knowledge-point-item">
              <div class="knowledge-point-main">
                <div class="knowledge-point-name-row">
                  <span class="knowledge-point-name">{{ item.name }}</span>
                  <el-tag v-if="item.id === practiceMeta.knowledgePointId" size="small" type="warning">当前补练</el-tag>
                  <el-tag v-else-if="item.fromPractice" size="small" type="info" effect="plain">关联知识点</el-tag>
                  <el-tag v-if="item.hasNewRecommendation" size="small" type="danger" effect="dark">新推荐</el-tag>
                </div>
                <div v-if="item.description" class="knowledge-point-desc">{{ item.description }}</div>
                <div class="knowledge-point-extra">
                  <span>掌握度 {{ item.masteryRate }}%</span>
                  <span>错误次数 {{ item.wrongCount }}</span>
                  <span>练习题 {{ item.questionCount }}</span>
                </div>
              </div>
              <div class="knowledge-point-meta">
                <span>{{ item.questionCount ? '已生成题目' : '待生成题目' }}</span>
                <el-button type="primary" link @click="openKnowledgePointPractice(item)">查看补练</el-button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="practiceMeta.chatPractice.wrongQuestions && practiceMeta.chatPractice.wrongQuestions.length" class="chat-section">
          <div class="chat-section-title">关联错题</div>
          <div class="chat-chip-list">
            <div v-for="wrong in practiceMeta.chatPractice.wrongQuestions" :key="wrong.id" class="chat-chip is-wrong">
              {{ wrong.content }}
            </div>
          </div>
        </div>

        <div v-if="questions.length" class="chat-section">
          <div class="chat-section-title">本次补练内容</div>
          <div class="practice-question-list">
            <div v-for="(question, index) in questions" :key="question.id" class="practice-question-item">
              <div class="practice-question-head">
                <span>第 {{ index + 1 }} 题 · {{ getQuestionTypeLabel(question.type) }}</span>
                <el-tag size="small" effect="plain">{{ getDifficultyLabel(question.difficulty) }}</el-tag>
              </div>
              <div class="practice-question-content">{{ question.content }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="practiceMeta.latestPractice" class="latest-practice">
        最近一次练习：{{ formatDate(practiceMeta.latestPractice.completedAt) }}
        · 正确 {{ practiceMeta.latestPractice.correctCount }}/{{ practiceMeta.latestPractice.questionCount }}
      </div>
    </el-card>

    <el-card class="gradient-card chat-card" v-if="chatMessages.length || chatCurrentQuestion || !loading">
      <template #header>
        <div class="card-header">
          <span>{{ practiceMeta.mode === 'wrong-question' ? '重做对话' : '补练对话' }}</span>
          <div class="chat-header-actions" v-if="practiceMeta.mode !== 'wrong-question'">
            <el-tag type="info">已完成 {{ answeredQuestionIds.length }}/{{ totalChatQuestions }}</el-tag>
            <el-button type="primary" :disabled="!canAskNextQuestion" @click="askNextQuestion">下一题</el-button>
          </div>
        </div>
      </template>

      <div class="chat-window">
        <div v-for="(message, index) in chatMessages" :key="index" :class="['chat-message', message.role === 'assistant' ? 'is-assistant' : 'is-user']">
          <div class="chat-bubble">{{ message.content }}</div>
        </div>
      </div>

      <div class="chat-input-row" v-if="chatCurrentQuestion">
        <el-input
          v-model="chatAnswer"
          type="textarea"
          :rows="3"
          :placeholder="practiceMeta.mode === 'wrong-question' ? '请输入这道错题的重做答案' : '请输入你的作答内容'"
        />
        <div class="chat-actions">
          <el-button v-if="practiceMeta.mode !== 'wrong-question'" @click="askNextQuestion" :disabled="!canAskNextQuestion">换一题</el-button>
          <el-button type="primary" @click="sendChatAnswer" :disabled="!chatAnswer.trim()">发送答案</el-button>
        </div>
      </div>

      <el-empty v-else-if="!questions.length && !loading" description="当前没有可作答题目" />

      <div class="chat-submit-bar" v-if="answeredQuestionIds.length">
        <div class="submit-summary">已完成 {{ answeredQuestionIds.length }} 道题，提交后将自动判分，并同步更新薄弱点与错题状态。</div>
        <el-button type="success" :loading="submitting" @click="submitPractice">提交本次补练</el-button>
      </div>
    </el-card>

    <el-card v-if="resultVisible" class="gradient-card result-card">
      <template #header>
        <div class="card-header">
          <span>本次结果</span>
          <el-tag :type="resultData.allCorrect ? 'success' : 'warning'">
            {{ resultData.allCorrect ? '已全部掌握' : '仍需继续巩固' }}
          </el-tag>
        </div>
      </template>
      <div class="result-summary">
        <div class="result-score">得分 {{ resultData.totalScore }}</div>
        <div class="result-status">状态：{{ getStatusText(resultData.status) }}</div>
      </div>
      <div v-if="resultData.knowledgePointChanges.length" class="kp-change-panel">
        <div class="kp-change-title">薄弱知识点变化</div>
        <div class="kp-change-list">
          <div v-for="item in resultData.knowledgePointChanges" :key="item.knowledgePointId" class="kp-change-item">
            <div class="kp-change-main">
              <div class="kp-change-name-row">
                <span class="kp-change-name">{{ item.knowledgePointName }}</span>
                <el-tag size="small" :type="item.statusType">{{ item.statusLabel }}</el-tag>
                <el-tag v-if="item.isInitialWeakPoint" size="small" type="danger" effect="plain">原始薄弱点</el-tag>
              </div>
              <div class="kp-change-meta">
                <span>题目 {{ item.questionCount }}</span>
                <span>正确 {{ item.correctCount }}</span>
                <span>错误 {{ item.wrongCount }}</span>
              </div>
            </div>
            <div class="kp-change-rate">掌握度 {{ item.masteryAfter }}%</div>
          </div>
        </div>
      </div>
      <div class="result-list">
        <div v-for="item in resultData.questionResults" :key="item.questionId" :class="['result-item', item.correct ? 'is-correct' : 'is-wrong']">
          <span>{{ getQuestionTitle(item.questionId) }}</span>
          <span>{{ item.correct ? '正确' : '错误' }} · {{ item.score }}分</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import dayjs from 'dayjs'

var route = useRoute()
var router = useRouter()
var loading = ref(false)
var submitting = ref(false)
var questions = ref([])
var answers = reactive({})
var practiceMeta = reactive({
  mode: 'weak-point',
  title: '',
  knowledgePointId: '',
  latestPractice: null,
  chatPractice: null
})
var resultVisible = ref(false)
var resultData = reactive({
  totalScore: 0,
  questionResults: [],
  knowledgePointChanges: [],
  status: '',
  allCorrect: false
})
var chatMessages = ref([])
var chatQuestionPool = ref([])
var chatCurrentQuestion = ref(null)
var chatAnswer = ref('')
var answeredQuestionIds = ref([])
var askedQuestionIds = ref([])
var relatedKnowledgePoints = computed(function() {
  var baseList = practiceMeta.chatPractice && Array.isArray(practiceMeta.chatPractice.relatedKnowledgePoints)
    ? practiceMeta.chatPractice.relatedKnowledgePoints
    : []

  var map = {}
  for (var i = 0; i < baseList.length; i++) {
    var item = baseList[i]
    map[item.id] = {
      id: item.id,
      name: item.name,
      description: item.description || '',
      questionCount: 0,
      masteryRate: parseInt(item.masteryRate || 0),
      wrongCount: item.wrongCount || 0,
      hasNewRecommendation: !!item.hasNewRecommendation,
      fromPractice: item.id !== practiceMeta.knowledgePointId,
      appearedAfterPractice: item.id !== practiceMeta.knowledgePointId
    }
  }

  for (var j = 0; j < questions.value.length; j++) {
    var question = questions.value[j]
    var kpIds = Array.isArray(question.knowledgePoints) ? question.knowledgePoints : []
    for (var k = 0; k < kpIds.length; k++) {
      var kpId = kpIds[k]
      if (!map[kpId]) {
        map[kpId] = {
          id: kpId,
          name: kpId,
          description: '',
          questionCount: 0,
          masteryRate: 0,
          wrongCount: 0,
          hasNewRecommendation: false,
          fromPractice: kpId !== practiceMeta.knowledgePointId,
          appearedAfterPractice: true
        }
      }
      map[kpId].questionCount += 1
      if (kpId !== practiceMeta.knowledgePointId) {
        map[kpId].fromPractice = true
      }
    }
  }

  return Object.keys(map).map(function(key) { return map[key] })
})

var pageDesc = computed(function() {
  return practiceMeta.mode === 'wrong-question'
    ? '错题将通过对话方式重新作答，提交后自动刷新掌握状态'
    : '每个知识点都会提供相关练习题，完成后自动判分并更新薄弱点与错题状态'
})

var totalChatQuestions = computed(function() {
  return questions.value.length
})

var canAskNextQuestion = computed(function() {
  return !!chatQuestionPool.value.length && !chatCurrentQuestion.value
})

onMounted(function() {
  syncPracticeByRoute()
})

watch(function() {
  return [route.query.kpId, route.query.questionId]
}, function() {
  syncPracticeByRoute()
})

function syncPracticeByRoute() {
  var kpId = route.query.kpId
  var questionId = route.query.questionId
  if (questionId) {
    loadPractice(kpId || 'custom', questionId)
  } else if (kpId) {
    loadPractice(kpId)
  } else {
    loadWeakPointOverview()
  }
}

function loadWeakPointOverview() {
  resetState()
  loading.value = true
  practiceMeta.title = '薄弱知识板块总览'

  api.get('/student/weak-points')
    .then(function(res) {
      if (res.success) {
        var list = res.data || []
        practiceMeta.chatPractice = {
          openingMessage: list.length
            ? '这里展示了你当前所有薄弱知识点及对应练习题入口，可以直接进入任一板块开始补练。'
            : '当前还没有检测到需要补练的薄弱知识点，继续保持。',
          knowledgePoint: null,
          relatedKnowledgePoints: list.map(function(item) {
            return {
              id: item.id,
              name: item.name,
              description: item.description || '',
              masteryRate: item.masteryRate,
              wrongCount: item.wrongCount || 0,
              questionCount: item.practiceCount || 0,
              hasNewRecommendation: !!item.hasNewRecommendation
            }
          }),
          wrongQuestions: []
        }
      }
    })
    .catch(function(error) {
      console.error('加载薄弱点总览失败:', error)
      ElMessage.error('加载薄弱点总览失败')
    })
    .finally(function() {
      loading.value = false
    })
}

function resetState() {
  questions.value = []
  resultVisible.value = false
  resultData.totalScore = 0
  resultData.questionResults = []
  resultData.knowledgePointChanges = []
  resultData.status = ''
  resultData.allCorrect = false
  practiceMeta.mode = 'weak-point'
  practiceMeta.title = ''
  practiceMeta.knowledgePointId = ''
  practiceMeta.latestPractice = null
  practiceMeta.chatPractice = null
  chatMessages.value = []
  chatQuestionPool.value = []
  chatCurrentQuestion.value = null
  chatAnswer.value = ''
  answeredQuestionIds.value = []
  askedQuestionIds.value = []

  var keys = Object.keys(answers)
  for (var i = 0; i < keys.length; i++) {
    delete answers[keys[i]]
  }
}

function loadPractice(kpId, questionId) {
  resetState()
  loading.value = true

  var url = '/student/practice/' + kpId
  if (questionId) {
    url += '?questionId=' + questionId
  }

  api.get(url)
    .then(function(res) {
      if (res.success && res.data) {
        practiceMeta.mode = res.data.mode || 'weak-point'
        practiceMeta.title = res.data.title || ''
        practiceMeta.knowledgePointId = res.data.knowledgePointId || ''
        practiceMeta.latestPractice = res.data.latestPractice || null
        practiceMeta.chatPractice = res.data.chatPractice || null
        questions.value = res.data.questions || []
        chatQuestionPool.value = questions.value.slice()

        if (practiceMeta.chatPractice && practiceMeta.chatPractice.openingMessage) {
          chatMessages.value = [{ role: 'assistant', content: practiceMeta.chatPractice.openingMessage }]
        } else {
          chatMessages.value = [{ role: 'assistant', content: '我们开始补练吧，我会逐题和你对话。' }]
        }

        if (questions.value.length > 0) {
          askNextQuestion()
        }
      }
    })
    .catch(function(error) {
      console.error('加载失败:', error)
      ElMessage.error('加载练习失败')
    })
    .finally(function() {
      loading.value = false
    })
}

function askNextQuestion() {
  if (!chatQuestionPool.value.length) {
    chatCurrentQuestion.value = null
    chatMessages.value.push({ role: 'assistant', content: '当前推荐题目已经练完了，你可以直接提交本次补练。' })
    return
  }

  chatCurrentQuestion.value = chatQuestionPool.value.shift()
  chatMessages.value.push({
    role: 'assistant',
    content: buildQuestionPrompt(chatCurrentQuestion.value)
  })
  chatAnswer.value = ''
}

function buildQuestionPrompt(question) {
  var prefix = practiceMeta.mode === 'wrong-question' ? '我们先重做这道错题：' : '请回答这一题：'
  var optionText = ''

  if (question.type === 'choice' && question.options && question.options.length) {
    optionText = '\n' + question.options.map(function(opt, index) {
      return String.fromCharCode(65 + index) + '. ' + opt
    }).join('\n')
  }

  return prefix + question.content + optionText
}

function sendChatAnswer() {
  if (!chatCurrentQuestion.value || !chatAnswer.value.trim()) {
    return
  }

  var answerText = chatAnswer.value.trim()
  var currentQuestion = chatCurrentQuestion.value
  var standardAnswer = currentQuestion.answer || '略'

  chatMessages.value.push({ role: 'user', content: answerText })
  answers[currentQuestion.id] = answerText
  if (answeredQuestionIds.value.indexOf(currentQuestion.id) === -1) {
    answeredQuestionIds.value.push(currentQuestion.id)
  }

  chatMessages.value.push({
    role: 'assistant',
    content: buildPracticeFeedback(currentQuestion, answerText, standardAnswer)
  })

  chatCurrentQuestion.value = null
  chatAnswer.value = ''

  if (practiceMeta.mode !== 'wrong-question' && chatQuestionPool.value.length) {
    chatMessages.value.push({ role: 'assistant', content: '如果准备好了，可以继续下一题。' })
  }
}

function openKnowledgePointPractice(item) {
  if (!item || !item.id) {
    return
  }
  router.push({ path: '/student/practice', query: { kpId: item.id } })
}

function buildPracticeFeedback(question, studentAnswer, standardAnswer) {
  var normalizedStudent = String(studentAnswer || '').trim().toLowerCase()
  var normalizedStandard = String(standardAnswer || '').trim().toLowerCase()
  var isCorrect = normalizedStudent && normalizedStandard && normalizedStudent === normalizedStandard

  if (question.type === 'choice') {
    return isCorrect
      ? '回答正确，参考答案：' + standardAnswer + '。这道题你已经掌握得不错。'
      : '这道题暂时答错了，参考答案是：' + standardAnswer + '。建议再看一下选项和题干关系。'
  }

  if (question.type === 'fill') {
    return isCorrect
      ? '填空结果正确，参考答案：' + standardAnswer + '。继续保持。'
      : '答案暂时不对，参考答案是：' + standardAnswer + '。建议检查计算过程。'
  }

  return '我已经记录了你的作答。参考答案：' + standardAnswer + '。主观题更重要的是思路完整。'
}

function submitPractice() {
  var questionIds = answeredQuestionIds.value.slice()

  if (questionIds.length === 0) {
    ElMessage.warning('请至少完成一道题')
    return
  }

  ElMessageBox.confirm('确定提交本次补练吗？已完成 ' + questionIds.length + ' 道题', '提示')
    .then(function() {
      submitting.value = true
      return api.post('/student/practice/' + (route.query.kpId || 'custom') + '/submit', {
        answers: answers,
        questionIds: questionIds,
        mode: practiceMeta.mode,
        title: practiceMeta.title
      })
    })
    .then(function(res) {
      if (res && res.success) {
        resultVisible.value = true
        resultData.totalScore = res.data.totalScore
        resultData.questionResults = res.data.questionResults || []
        resultData.knowledgePointChanges = res.data.knowledgePointChanges || []
        resultData.status = res.data.status
        resultData.allCorrect = !!res.data.allCorrect
        ElMessage.success(res.message || '补练提交成功')

        if (practiceMeta.mode === 'wrong-question') {
          router.replace('/student/wrong-questions')
        }
      }
    })
    .catch(function(error) {
      if (error !== 'cancel') {
        console.error('提交失败:', error)
        ElMessage.error('提交失败')
      }
    })
    .finally(function() {
      submitting.value = false
    })
}

function getQuestionTitle(questionId) {
  var question = questions.value.find(function(item) { return item.id === questionId })
  return question ? question.content : questionId
}

function getQuestionTypeLabel(type) {
  if (type === 'choice') return '选择题'
  if (type === 'fill') return '填空题'
  if (type === 'shortAnswer') return '简答题'
  return '??'
}

function getDifficultyLabel(level) {
  if (level === 'easy') return '简单'
  if (level === 'medium') return '中等'
  if (level === 'hard') return '困难'
  return '??'
}

function getStatusText(status) {
  if (status === 'graded') return '已自动判分'
  if (status === 'submitted') return '待教师批改'
  return status || '-'
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}
</script>

<style scoped>
.overview-card,
.result-card,
.chat-card {
  margin-bottom: 20px;
}

.overview-head,
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.overview-title {
  font-size: 18px;
  font-weight: 700;
}

.overview-subtitle,
.latest-practice,
.result-status,
.chat-intro-desc,
.chat-kp-desc,
.submit-summary {
  color: #6b7280;
}

.chat-intro-panel {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #fff7e6, #fff1f0);
}

.chat-intro-title,
.chat-section-title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 8px;
}

.chat-kp-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.chat-section {
  margin-top: 14px;
}

.chat-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chat-chip {
  padding: 8px 10px;
  border-radius: 999px;
  background: #f5f7fa;
  font-size: 12px;
}

.chat-chip.is-wrong {
  background: #fff1f0;
  color: #c45656;
}

.knowledge-point-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.knowledge-point-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #f1f5f9;
}

.knowledge-point-main {
  flex: 1;
}

.knowledge-point-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.knowledge-point-name {
  font-weight: 700;
  color: #1f2937;
}

.knowledge-point-desc,
.knowledge-point-meta,
.knowledge-point-extra {
  margin-top: 6px;
  color: #6b7280;
  font-size: 13px;
}

.knowledge-point-extra {
  margin-top: 6px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.knowledge-point-meta {
  min-width: 120px;
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.practice-question-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.practice-question-item {
  padding: 12px 14px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #f1f5f9;
}

.practice-question-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #6b7280;
}

.practice-question-content {
  color: #1f2937;
  line-height: 1.7;
}

.latest-practice {
  margin-top: 12px;
}

.chat-window {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 420px;
  overflow: auto;
  margin-bottom: 16px;
}

.chat-message {
  display: flex;
}

.chat-message.is-assistant {
  justify-content: flex-start;
}

.chat-message.is-user {
  justify-content: flex-end;
}

.chat-bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 14px;
  line-height: 1.6;
  background: #f5f7fa;
  white-space: pre-wrap;
}

.chat-message.is-user .chat-bubble {
  background: #ecf5ff;
}

.chat-input-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.chat-submit-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.result-summary {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
}

.result-score {
  font-size: 24px;
  font-weight: 700;
}

.kp-change-panel {
  margin-bottom: 18px;
  padding: 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, #f0f9ff, #f8fafc);
}

.kp-change-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 12px;
}

.kp-change-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kp-change-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
}

.kp-change-main {
  flex: 1;
}

.kp-change-name-row,
.kp-change-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.kp-change-name {
  font-weight: 700;
  color: #111827;
}

.kp-change-meta {
  margin-top: 8px;
  color: #6b7280;
  font-size: 13px;
}

.kp-change-rate {
  font-size: 16px;
  font-weight: 700;
  color: #2563eb;
  white-space: nowrap;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 8px;
}

.result-item.is-correct {
  background: #f0f9eb;
  color: #67c23a;
}

.result-item.is-wrong {
  background: #fef0f0;
  color: #f56c6c;
}
</style>
