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
          <div v-if="!viewMode" class="header-actions">
            <div class="upload-status">
              已上传 {{ imageUrls.length }} 张图片
            </div>
            <el-upload
              class="upload-demo"
              action="/api/student/answers/upload"
              :headers="{ Authorization: 'Bearer ' + (localStorage ? localStorage.getItem('token') : '') }"
              :on-success="handleImageUpload"
              :on-error="handleImageUploadError"
              :on-remove="handleImageRemove"
              :show-file-list="true"
              ref="uploadRef"
              accept="image/*"
              capture="camera"
            >
              <el-button type="info" :icon="Camera">
                拍照上传
              </el-button>
            </el-upload>
            <el-button type="primary" @click="submitAnswers" :loading="submitting">
              提交答案
            </el-button>
          </div>
        </div>
      </template>
      
      <!-- 试卷信息 -->
      <div v-if="paper && paper.filePath && !viewMode" class="paper-info">
        <el-card shadow="hover" class="paper-card">
          <template #header>
            <div class="paper-header">
              <span>试卷：{{ paper.title }}</span>
              <el-button type="primary" size="small" @click="viewPaper(paper)">
                查看试卷
              </el-button>
            </div>
          </template>
          <div class="paper-details">
            <p><strong>文件名称：</strong>{{ paper.fileName }}</p>
            <p><strong>文件大小：</strong>{{ formatFileSize(paper.fileSize) }}</p>
            <p><strong>上传时间：</strong>{{ formatDate(paper.createdAt) }}</p>
          </div>
        </el-card>
      </div>

      <!-- 题目列表 -->
      <div v-if="viewMode && paper && paper.filePath" class="paper-result-panel">
        <div class="paper-result-header">
          <div>
            <div class="paper-result-title">PDF 试卷内容</div>
            <div class="paper-result-desc">老师批改完成后，你仍然可以对照原始试卷与评语进行复盘。</div>
          </div>
          <el-button type="primary" @click="viewPaper(paper)">查看试卷</el-button>
        </div>
        <iframe v-if="canPreviewPdfInFrame" :src="paperPreviewSrc" class="paper-result-frame" title="学生PDF试卷预览" />
        <div v-else class="paper-preview-fallback">
          当前环境下无法内嵌显示 PDF，请点击右上角“查看试卷”按钮打开。
        </div>
      </div>

      <div v-if="viewMode && gradedImages.length" class="uploaded-image-panel">
        <div class="paper-result-title">已上传的作答图片</div>
        <div class="uploaded-image-list">
          <el-image
            v-for="(image, index) in gradedImages"
            :key="index"
            :src="getFilePreviewUrl(image)"
            :preview-src-list="gradedImages.map(getFilePreviewUrl)"
            fit="cover"
            class="uploaded-image-item"
          />
        </div>
      </div>

      <div v-if="viewMode" class="teacher-summary-card">
        <div class="paper-result-title">老师整体评语</div>
        <div class="teacher-summary-line teacher-summary-block"><strong>总体评价：</strong><span>{{ overallComment || '老师暂未填写评语' }}</span></div>
        <div class="teacher-summary-line teacher-summary-block"><strong>订正建议：</strong><span>{{ overallCorrection || '老师暂未填写订正建议' }}</span></div>
      </div>

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
          <div v-if="getTeacherComment(question.id)" class="teacher-feedback"><strong>老师评语：</strong>{{ getTeacherComment(question.id) }}</div>
          <div v-if="getTeacherCorrection(question.id)" class="teacher-feedback"><strong>老师建议：</strong>{{ getTeacherCorrection(question.id) }}</div>
        </div>
      </div>
      
      <el-empty v-if="questions.length === 0 && !loading && !paper" description="暂无题目" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Camera } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import api from '@/utils/api'

var route = useRoute()
var router = useRouter()
var loading = ref(false)
var submitting = ref(false)

var assignment = ref(null)
var questions = ref([])
var answers = reactive({})
var results = reactive({})
var uploadRef = ref(null)
var imageUrls = ref([])
var paper = ref(null)
var gradedImages = ref([])
var overallComment = ref('')
var overallCorrection = ref('')

var canPreviewPdfInFrame = computed(function() {
  return !!(paper.value && paper.value.filePath && String(paper.value.fileType || '').toLowerCase() === '.pdf')
})

var paperPreviewSrc = computed(function() {
  if (!canPreviewPdfInFrame.value) return ''
  return getFilePreviewUrl(paper.value.filePath)
})

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

onUnmounted(function() {
  // 清理uploadRef，避免内存泄漏
  uploadRef.value = null
})

function resetImageUploads() {
  imageUrls.value = []
  if (uploadRef.value && typeof uploadRef.value.clearFiles === 'function') {
    uploadRef.value.clearFiles()
  }
}

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

function getTeacherComment(questionId) {
  var result = results[questionId]
  return result ? (result.teacherComment || result.comment || '') : ''
}

function getTeacherCorrection(questionId) {
  var result = results[questionId]
  return result ? (result.teacherCorrection || result.correction || '') : ''
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
      
      if (res.data.paper) {
        paper.value = res.data.paper
      } else {
        paper.value = null
      }
      
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
      if (res.data.paper) {
        paper.value = res.data.paper
      }
      gradedImages.value = Array.isArray(res.data.images) ? res.data.images : []
      var imageReviewResult = Array.isArray(res.data.questions)
        ? res.data.questions.find(function(item) { return item.questionId === '__image_review__' })
        : null
      overallComment.value = res.data.overallComment || (imageReviewResult && imageReviewResult.teacherComment) || (res.data.questions || []).map(function(item) { return item.teacherComment || '' }).filter(Boolean).join('；') || ''
      overallCorrection.value = res.data.overallCorrection || (imageReviewResult && imageReviewResult.teacherCorrection) || (res.data.questions || []).map(function(item) { return item.teacherCorrection || '' }).filter(Boolean).join('；') || ''
    }
  }).catch(function() {
    ElMessage.warning('暂无答题结果')
  })
}



function formatFileSize(size) {
  if (!size) return '0 B'
  var units = ['B', 'KB', 'MB', 'GB']
  var index = Math.floor(Math.log(size) / Math.log(1024))
  return (size / Math.pow(1024, index)).toFixed(2) + ' ' + units[index]
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
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

function viewPaper(paper) {
  if (!paper || !paper.filePath) return
  // 直接访问后端文件路径，与教师端一致
  var url = getFilePreviewUrl(paper.filePath)
  window.open(url, '_blank')
}

function getTypeText(type) {
  var map = { choice: '选择题', fill: '填空题', shortAnswer: '简答题' }
  return map[type] || '未知'
}

function handleImageUpload(response, uploadFile) {
  if (response.success && response.data && response.data.filePath) {
    if (imageUrls.value.indexOf(response.data.filePath) === -1) {
      imageUrls.value.push(response.data.filePath)
    }
    if (uploadFile) {
      uploadFile.uploadedPath = response.data.filePath
    }
    ElMessage.success('\u56fe\u7247\u4e0a\u4f20\u6210\u529f')
  } else {
    ElMessage.error('\u56fe\u7247\u4e0a\u4f20\u5931\u8d25')
  }
}

function handleImageRemove(uploadFile) {
  var targetPath = uploadFile && uploadFile.uploadedPath
  if (!targetPath && uploadFile && uploadFile.response && uploadFile.response.data) {
    targetPath = uploadFile.response.data.filePath
  }
  if (!targetPath) return
  imageUrls.value = imageUrls.value.filter(function(item) {
    return item !== targetPath
  })
}
function handleImageUploadError() {
  ElMessage.error('图片上传失败，请重试')
}

function submitAnswers() {
  var answeredCount = 0
  var answerKeys = Object.keys(answers)
  for (var i = 0; i < answerKeys.length; i++) {
    if (answers[answerKeys[i]]) {
      answeredCount++
    }
  }
  
  if (answeredCount === 0 && imageUrls.value.length === 0) {
    ElMessage.warning('\u8bf7\u81f3\u5c11\u56de\u7b54\u4e00\u9053\u9898\u76ee\u6216\u4e0a\u4f20\u4e00\u5f20\u56fe\u7247')
    return
  }
  
  ElMessageBox.confirm('\u786e\u5b9a\u63d0\u4ea4\u7b54\u6848\u5417\uff1f\u63d0\u4ea4\u540e\u5c06\u8fdb\u5165\u6559\u5e08\u624b\u52a8\u6279\u6539\u3002', '\u63d0\u793a').then(function() {
    submitting.value = true
    
    api.post('/student/assignments/' + route.params.id + '/submit', {
      answers: answers,
      images: imageUrls.value
    }).then(function(res) {
      if (res.success) {
        resetImageUploads()
        ElMessage.success('\u63d0\u4ea4\u6210\u529f\uff0c\u7b49\u5f85\u6559\u5e08\u6279\u6539')
        if (res.data && res.data.answerId) {
          sessionStorage.setItem('latest-answer-' + route.params.id, res.data.answerId)
        }
        router.replace('/student/assignment/' + route.params.id + '?view=result')
        loadResults()
      }
    }).catch(function() {
      ElMessage.error('\u63d0\u4ea4\u5931\u8d25')
    }).finally(function() {
      submitting.value = false
    })
  }).catch(function() {})
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

.paper-info {
  margin-bottom: 20px;
}

.paper-card {
  margin-bottom: 20px;
}

.paper-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.paper-details {
  margin-top: 12px;
  color: #606266;
}

.paper-details p {
  margin-bottom: 8px;
}

.paper-result-panel,
.uploaded-image-panel,
.teacher-summary-card {
  margin-bottom: 20px;
  padding: 20px;
  background: #f8fafc;
  border: 1px solid #e5eaf3;
  border-radius: 12px;
}

.paper-result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.paper-result-title {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
}

.paper-result-desc {
  margin-top: 6px;
  color: #909399;
}

.paper-result-frame {
  width: 100%;
  height: 560px;
  border: 1px solid #dfe6ee;
  border-radius: 10px;
  background: #fff;
}

.paper-preview-fallback {
  padding: 20px;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  background: #fff;
  color: #64748b;
  line-height: 1.7;
}

.uploaded-image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 16px;
}

.uploaded-image-item {
  width: 160px;
  height: 160px;
  border-radius: 10px;
  overflow: hidden;
}

.teacher-summary-line,
.teacher-feedback {
  margin-top: 10px;
  line-height: 1.7;
  color: #475467;
}
</style>
