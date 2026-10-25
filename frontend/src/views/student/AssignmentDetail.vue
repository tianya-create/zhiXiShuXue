<template>
  <div class="assignment-detail">
    <div class="page-header detail-header">
      <div class="header-text">
        <h2>{{ assignmentTitle }}</h2>
        <p>{{ viewMode ? '这是你交上去的答卷，红笔是批改结果。' : '一共 ' + questions.length + ' 道题，做完点底部的“交卷”。' }}</p>
      </div>
      <div v-if="viewMode && hasAnyResult" class="paper-score" :aria-label="(pendingResults ? '暂计得分 ' : '得分 ') + totalScore + ' 分，满分 ' + fullScore + ' 分'">
        <span v-if="pendingResults" class="q-pending">暂计</span>
        <span class="paper-score-num">{{ totalScore }}</span>
        <span v-if="totalScore <= fullScore" class="paper-score-full">/ {{ fullScore }}</span>
      </div>
    </div>

    <a v-if="paper?.filePath" :href="paper.filePath" target="_blank" rel="noopener">查看试卷附件；请将手写解答拍照上传</a>
    <div v-if="viewMode && answerRecord?.images?.length"><img v-for="image in answerRecord.images" :key="image" :src="image" alt="已提交的手写解答" style="max-width:100%;max-height:320px" /><p v-if="answerRecord.status === 'submitted'">图片作答等待老师复核。</p><p v-if="answerRecord.comments?.__image_review__">老师反馈：{{ answerRecord.comments.__image_review__ }}</p></div>
    <div v-loading="loading" class="paper">
      <article
        v-for="(question, index) in questions"
        :key="question.id"
        :class="['paper-question', viewMode && hasResult(question.id) ? resultClass(question.id) : '']"
      >
        <svg v-if="viewMode && hasResult(question.id) && isGraded(question.id)" class="pen-mark" viewBox="0 0 120 100" aria-hidden="true">
          <path v-if="getResultCorrect(question.id)" class="pen-stroke" d="M14 56 C 26 64, 36 74, 44 86 C 58 58, 80 30, 110 10" />
          <template v-else>
            <path class="pen-stroke" d="M22 18 C 46 40, 70 62, 98 88" />
            <path class="pen-stroke is-second" d="M98 16 C 74 38, 50 62, 20 86" />
          </template>
        </svg>

        <header class="q-head">
          <span class="q-index">第 {{ index + 1 }} 题</span>
          <span class="q-meta">{{ getTypeText(question.type) }}</span>
          <span class="q-meta">{{ question.score || 0 }} 分</span>
          <span v-if="viewMode && hasResult(question.id) && !isGraded(question.id)" class="q-pending">等老师批改</span>
        </header>

        <MathText class="q-stem" tag="div" :text="question.content" />
        <QuestionTools :question="question" :answered="viewMode" />
        <img v-if="question.imageUrl" :src="question.imageUrl" alt="题目附图" style="max-width:100%;max-height:300px" />

        <div v-if="question.type === 'choice'" class="q-options" role="radiogroup" :aria-label="'第 ' + (index + 1) + ' 题选项'">
          <label
            v-for="(opt, optIndex) in question.options"
            :key="optIndex"
            :class="['q-option', { 'is-picked': isPicked(question, opt, optIndex) }]"
          >
            <input
              v-model="answers[question.id]"
              class="q-radio"
              type="radio"
              :name="'q-' + question.id"
              :value="letter(optIndex)"
              :disabled="viewMode"
            >
            <span class="q-letter">{{ letter(optIndex) }}</span>
            <MathText class="q-option-text" :text="opt" />
          </label>
        </div>

        <el-input
          v-else-if="question.type === 'fill'"
          v-model="answers[question.id]"
          class="q-input"
          placeholder="在这里填答案"
          :disabled="viewMode"
        />

        <el-input
          v-else
          v-model="answers[question.id]"
          class="q-input"
          type="textarea"
          :rows="4"
          placeholder="写下你的解题过程和答案"
          :disabled="viewMode"
        />

        <dl v-if="viewMode && hasResult(question.id)" class="q-answers">
          <div>
            <dt>你的答案</dt>
            <dd :class="{ 'is-miss-text': isGraded(question.id) && !getResultCorrect(question.id) }"><MathText :text="getAnswer(question.id)" /></dd>
          </div>
          <div v-if="getCorrectAnswer(question.id)">
            <dt>正确答案</dt>
            <dd class="is-answer-text"><MathText :text="getCorrectAnswer(question.id)" /></dd>
          </div>
          <div>
            <dt>得分</dt>
            <dd v-if="results[question.id]?.needsReview">等待老师复核</dd>
            <dd v-else><b class="nb-num">{{ getScore(question.id) }}</b><template v-if="getScore(question.id) <= (question.score || 0)"> / {{ question.score || 0 }}</template> 分</dd>
          </div>
        </dl>
      </article>

      <el-empty v-if="questions.length === 0 && !loading" description="这份作业里还没有题目。" />

      <div v-if="!viewMode" class="answer-upload"><p>{{ draft.status.value || '作答会自动保存' }}</p><label>上传手写解答（PNG 或 JPEG，最大 5 MB）<input type="file" accept="image/png,image/jpeg" @change="uploadAnswer" /></label><img v-for="image in images" :key="image" :src="image" alt="手写作答预览" style="max-width:200px;max-height:180px" /></div>
      <div v-if="!viewMode && (questions.length || paper?.filePath)" class="submit-bar">
        <span class="submit-progress">已答 <b class="nb-num">{{ answeredCount }}</b> / <span class="nb-num">{{ questions.length }}</span> 题</span>
        <el-button type="primary" size="large" :loading="submitting" @click="submitAnswers">交卷</el-button>
      </div>
    </div>
    <AdaptiveReflectionDialog v-model="reflectionVisible" :round="pendingRound" @completed="handleReflectionCompleted" />
  </div>
</template>

<script setup>
import MathText from '@/components/MathText.vue'
import QuestionTools from '@/components/QuestionTools.vue'
import AdaptiveReflectionDialog from '@/components/adaptive/AdaptiveReflectionDialog.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import { useAnswerDraft } from '@/composables/useAnswerDraft'

var route = useRoute()
var router = useRouter()
var loading = ref(false)
var submitting = ref(false)
const reflectionVisible = ref(false)
const pendingRound = ref(null)
const submittedAnswerId = ref('')

var assignment = ref(null)
const paper = ref(null)
const answerRecord = ref(null)
var questions = ref([])
var answers = reactive({})
var results = reactive({})
const images = ref([])
const draft = useAnswerDraft(computed(() => 'assignment-' + route.params.id), answers, questions, images)
const startedAt = Date.now()

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

function answerCacheKey() {
  var user = {}
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}')
  } catch (error) {
    user = {}
  }
  return 'latest-answer-' + (user.id || 'unknown') + '-' + route.params.id
}

function cacheAnswerId(answerId) {
  if (answerId) sessionStorage.setItem(answerCacheKey(), answerId)
}

function apiErrorMessage(error, fallback) {
  var serverMessage = error?.response?.data?.message
  if (serverMessage) return serverMessage
  if (!navigator.onLine) return '网络已断开，草稿仍保存在本机，请联网后重试'
  if (!error?.response) return '无法连接服务器，请确认后端服务已启动后重试'
  return fallback
}

function openSubmittedAnswer(message) {
  if (message) ElMessage.warning(message)
  draft.clear().then(function() {
    return router.replace({
      path: '/student/assignment/' + route.params.id,
      query: { view: 'result' }
    })
  }).then(function() {
    loadResults()
  })
}

function restoreDraftOrOpenResult() {
  api.get('/student/assignments/' + route.params.id + '/latest-answer').then(function(res) {
    var answerId = res?.data?.answerId
    if (!answerId) {
      draft.restore()
      return
    }
    cacheAnswerId(answerId)
    draft.pause()
    ElMessage.info('这份作业已经交卷，已为你打开答卷')
    router.replace({
      path: '/student/assignment/' + route.params.id,
      query: { view: 'result' }
    }).then(function() {
      loadResults()
    })
  }).catch(function() {
    // 查询交卷状态失败时仍允许恢复本地草稿；真正交卷时会显示服务器的具体原因。
    draft.restore()
  })
}

function loadAssignment() {
  var assignmentId = route.params.id
  if (!assignmentId) return
  
  loading.value = true
  
  api.get('/student/assignments/' + assignmentId + '/questions').then(function(res) {
    if (res.success) {
      assignment.value = res.data.assignment
      paper.value = res.data.paper || null
      questions.value = res.data.questions || []
      if (viewMode.value) {
        loadResults()
      } else {
        restoreDraftOrOpenResult()
      }
    }
  }).catch(function() {
    ElMessage.error('加载作业失败')
  }).finally(function() {
    loading.value = false
  })
}

function loadResults() {
  var cachedAnswerId = sessionStorage.getItem(answerCacheKey())
  var request = cachedAnswerId
    ? Promise.resolve({ success: true, data: { answerId: cachedAnswerId } })
    : api.get('/student/assignments/' + route.params.id + '/latest-answer')

  request.then(function(resultRes) {
    if (!resultRes.success || !resultRes.data || !resultRes.data.answerId) {
      throw new Error('no answer id')
    }
    var answerId = resultRes.data.answerId
    cacheAnswerId(answerId)
    return api.get('/student/answers/' + answerId)
  }).then(function(res) {
    if (res.success) {
      answerRecord.value = res.data
      fillResults(res.data.questions || [])
    }
  }).catch(function() {
    ElMessage.warning('还没有这份作业的答题记录')
  })
}

function submitAnswers() {
  var completedCount = answeredCount.value
  
  if (completedCount === 0 && !images.value.length) {
    ElMessage.warning('一道题都还没做，先答几道再交卷')
    return
  }
  
  ElMessageBox.confirm((questions.value.length ? '已答 ' + completedCount + ' / ' + questions.value.length + ' 题' : '将提交 ' + images.value.length + ' 张作答图片') + '，交卷后就不能再改了。', '交卷', { confirmButtonText: '交卷', cancelButtonText: '再检查一下' }).then(function() {
    submitting.value = true
    
    api.post('/student/assignments/' + route.params.id + '/submit', {
      answers: answers,
      images: images.value,
      requestId: draft.requestId.value,
      costTime: Math.round((Date.now() - startedAt) / 1000)
    }).then(function(res) {
      if (res.success) {
        draft.clear()
        ElMessage.success('已交卷')
        if (res.data && res.data.answerId) {
          submittedAnswerId.value = res.data.answerId
          cacheAnswerId(res.data.answerId)
        }
        pendingRound.value = res.data?.learningRound || null
        if (pendingRound.value?.reflectionRequired) reflectionVisible.value = true
        else finishSubmission()
      }
    }).catch(function(error) {
      var message = apiErrorMessage(error, '提交失败，请稍后重试')
      if (error?.response?.status === 409 && message.includes('已交卷')) {
        openSubmittedAnswer(message)
        return
      }
      ElMessage.error(message)
    }).finally(function() {
      submitting.value = false
    })
  }).catch(function() {})
}

function finishSubmission() {
  router.replace({
    path: '/student/assignment/' + route.params.id,
    query: { view: 'result' }
  }).then(function() {
    loadResults()
  })
}

function handleReflectionCompleted() {
  if (!pendingRound.value?.id) {
    finishSubmission()
    return
  }
  router.replace({
    name: 'StudentAdaptiveFeedback',
    params: { roundId: pendingRound.value.id },
    query: { source: 'assignment', assignmentId: route.params.id }
  })
}

async function uploadAnswer(event) {
  const file = event.target.files?.[0]; if (!file) return;
  const data = new FormData(); data.append('file', file);
  try { const res = await api.post('/student/answers/upload', data); images.value.push(res.data.filePath) } catch (error) { ElMessage.error(error.response?.data?.message || '上传失败') }
}

function getTypeText(type) {
  var map = { choice: '选择题', fill: '填空题', shortAnswer: '解答题', subjective: '解答题' }
  return map[type] || '解答题'
}

// 交卷后服务器存的可能是选项字母，也可能是选项原文
function isPicked(question, option, index) {
  var value = String(answers[question.id] || '').trim()
  return !!value && (value === letter(index) || value === String(option).trim())
}

function letter(index) {
  return String.fromCharCode(65 + index)
}

// 有标准答案的题才算批改完；主观题要等老师批改
function isGraded(questionId) {
  return !results[questionId]?.needsReview && !!getCorrectAnswer(questionId)
}

function resultClass(questionId) {
  if (!isGraded(questionId)) return 'is-pending'
  return getResultCorrect(questionId) ? 'is-right' : 'is-wrong'
}

var answeredCount = computed(function() {
  return questions.value.filter(function(q) { return String(answers[q.id] || '').trim() }).length
})

var hasAnyResult = computed(function() {
  return Object.keys(results).length > 0 || !!answerRecord.value
})

const pendingResults = computed(() => answerRecord.value?.status === 'submitted' || Object.values(results).some(result => result.needsReview))
var totalScore = computed(function() {
  if (answerRecord.value) return answerRecord.value.totalScore
  return questions.value.reduce(function(sum, q) { return sum + (Number(getScore(q.id)) || 0) }, 0)
})

var fullScore = computed(function() {
  if (!questions.value.length) return (answerRecord.value?.questionResults || []).reduce((sum,item) => sum + (item.fullScore || 0), 0) || 100
  return questions.value.reduce(function(sum, q) { return sum + (Number(q.score) || 0) }, 0)
})
</script>

<style scoped>
.assignment-detail { display: flex; flex-direction: column; gap: 20px; max-width: 900px; }
.detail-header { display: flex !important; align-items: flex-end; justify-content: space-between; gap: 20px; }
.header-text { min-width: 0; }

/* 卷面总分：红笔手写 */
.paper-score { flex-shrink: 0; display: flex; align-items: baseline; gap: 4px; transform: rotate(-6deg); }
.paper-score-num { font-family: var(--nb-font-hand); font-weight: 700; font-size: 76px; line-height: 0.9; color: var(--nb-red-ink); }
.paper-score-full { font-family: var(--nb-font-hand); font-weight: 700; font-size: 28px; color: var(--nb-red-ink); }

.paper { display: flex; flex-direction: column; gap: 14px; }
.paper-question {
  position: relative;
  padding: 20px 22px 22px;
  background: var(--nb-sheet);
  border: 1px solid var(--nb-line);
  border-radius: var(--nb-radius);
  box-shadow: var(--nb-shadow);
}

.q-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; padding-right: 72px; }
.q-index { font-family: var(--nb-font-display); font-size: 19px; color: var(--nb-blue); }
.q-meta { padding: 1px 8px; border-radius: 5px; background: #f1f4f9; color: var(--nb-ink-3); font-size: 14px; }
.q-pending { padding: 1px 8px; border-radius: 5px; background: var(--nb-orange-soft); color: var(--nb-orange-ink); font-size: 14px; font-weight: 700; }
.q-stem { margin-top: 10px; padding-right: 72px; font-size: 16px; line-height: 1.8; color: var(--nb-ink); }

.q-options { margin-top: 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
.q-option {
  position: relative; display: flex; align-items: center; gap: 12px; min-height: 48px;
  padding: 8px 14px 8px 10px; border: 1.5px solid var(--nb-line); border-radius: 10px;
  background: var(--nb-sheet); cursor: pointer; transition: border-color .15s ease, background-color .15s ease;
}
.q-option:hover { border-color: var(--nb-line-strong); background: #f8fafd; }
.q-option.is-picked { border-color: var(--nb-blue); background: var(--nb-blue-soft); }
.q-option:has(.q-radio:focus-visible) { outline: 2px solid var(--nb-blue); outline-offset: 2px; }
.q-option:has(.q-radio:disabled) { cursor: default; }
.q-radio { position: absolute; opacity: 0; pointer-events: none; }
.q-letter {
  width: 30px; height: 30px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%;
  border: 1.5px solid var(--nb-line-strong); font-family: var(--nb-font-num); font-weight: 700; font-size: 14px; color: var(--nb-ink-2);
}
.q-option.is-picked .q-letter { border-color: var(--nb-blue); background: var(--nb-blue); color: #fff; }
.is-wrong .q-option.is-picked { border-color: var(--nb-red); background: var(--nb-red-soft); }
.is-wrong .q-option.is-picked .q-letter { border: 2px solid var(--nb-red); background: transparent; color: var(--nb-red-ink); transform: rotate(-8deg) scale(1.08); }
.is-right .q-option.is-picked { border-color: var(--nb-green); background: var(--nb-green-soft); }
.is-right .q-option.is-picked .q-letter { border-color: var(--nb-green); background: var(--nb-green); }
.q-option-text { flex: 1; min-width: 0; font-size: 15px; color: var(--nb-ink); }
.q-input { margin-top: 14px; }

.q-answers { margin: 16px 0 0; padding-top: 12px; border-top: 1px dashed var(--nb-line-strong); display: flex; flex-direction: column; gap: 6px; }
.q-answers > div { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 8px; }
.q-answers dt { color: var(--nb-ink-3); font-size: 14px; line-height: 1.8; }
.q-answers dd { margin: 0; color: var(--nb-ink); font-size: 15px; line-height: 1.7; }
.q-answers .is-miss-text { color: var(--nb-ink-2); text-decoration: line-through; text-decoration-color: var(--nb-red); text-decoration-thickness: 2px; }
.q-answers .is-answer-text { color: var(--nb-red-ink); font-weight: 700; }

.pen-mark { position: absolute; top: 10px; right: 14px; width: 76px; height: 64px; overflow: visible; pointer-events: none; }
.pen-stroke {
  fill: none; stroke: var(--nb-red); stroke-width: 9; stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 200; stroke-dashoffset: 200; animation: pen-draw .45s cubic-bezier(.6, 0, .3, 1) forwards;
}
.pen-stroke.is-second { animation-delay: .3s; }
@keyframes pen-draw { to { stroke-dashoffset: 0; } }

.submit-bar {
  position: sticky; bottom: 16px; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 14px 12px 20px; background: var(--nb-sheet); border: 1px solid var(--nb-line-strong); border-radius: 12px;
  box-shadow: 0 16px 30px -18px rgba(28, 37, 65, .45);
}
.submit-progress { color: var(--nb-ink-2); font-size: 14px; }
.submit-progress b { color: var(--nb-ink); font-size: 18px; }

@media (max-width: 640px) {
  .detail-header { flex-direction: column; align-items: flex-start; }
  .paper-question { padding: 16px 16px 18px; }
  .pen-mark { width: 56px; height: 48px; }
  .q-head, .q-stem { padding-right: 52px; }
  .q-answers > div { grid-template-columns: minmax(0, 1fr); gap: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .pen-stroke { animation: none; stroke-dashoffset: 0; }
}
</style>
