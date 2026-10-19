<template>
  <div class="grading-center">
    <div class="page-header">
      <h2>批改中心</h2>
      <p>查看作业答卷和历史评分。解答题、图片作答和专项练习请进入复核与纠错。</p><el-button type="primary" @click="$router.push('/teacher/review-center')">进入复核与纠错</el-button>
    </div>

    <el-card class="gradient-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span>答题列表</span>
            <el-badge :value="pendingCount" type="danger" />
          </div>
          <el-button type="success" @click="exportExcel">导出Excel</el-button>
        </div>
      </template>

      <el-table :data="answers" style="width: 100%" v-loading="loading">
        <el-table-column prop="studentName" label="学生" width="120" />
        <el-table-column prop="assignmentTitle" label="作业名称" />
        <el-table-column prop="submittedAt" label="提交时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.submittedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="客观题结果" width="120">
          <template #default="scope">
            <el-tag type="info">{{ getObjectiveSummary(scope.row) }}</el-tag>
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

    <el-dialog v-model="gradeDialogVisible" :title="dialogTitle" width="1280px" top="4vh">
      <div v-if="currentAnswer">
        <div class="dialog-summary">
          <span>学生：{{ currentAnswer.student && currentAnswer.student.name ? currentAnswer.student.name : '-' }}</span>
          <span>作业：{{ currentAnswer.assignment && currentAnswer.assignment.title ? currentAnswer.assignment.title : '-' }}</span>
          <span>总分：{{ currentAnswer.answer && currentAnswer.answer.totalScore !== undefined ? currentAnswer.answer.totalScore : 0 }}</span>
        </div>

        <div v-if="hasImageSubmission" class="review-board">
          <div class="review-preview-panel">
            <div class="preview-card paper-preview-card">
              <div class="preview-card-header">
                <div>
                  <div class="preview-card-title">原始 PDF 试卷</div>
                  <div class="preview-card-desc">
                    {{ currentAnswer.paper && currentAnswer.paper.fileName ? currentAnswer.paper.fileName : '未获取到试卷文件' }}
                  </div>
                </div>
                <el-button
                  v-if="paperPreviewUrl"
                  type="primary"
                  plain
                  size="small"
                  @click="openPaperPreview"
                >
                  新窗口打开
                </el-button>
              </div>

              <div v-if="paperPreviewUrl" class="paper-preview-frame-wrap">
                <iframe
                  :src="paperPreviewUrl"
                  class="paper-preview-frame"
                  title="PDF试卷预览"
                />
              </div>
              <el-empty v-else description="该作业未上传 PDF 试卷" />
            </div>

            <div class="preview-card image-preview-card">
              <div class="preview-card-header image-preview-header">
                <div>
                  <div class="preview-card-title">学生作答图片</div>
                  <div class="preview-card-desc">
                    第 {{ activeImageIndex + 1 }}/{{ currentImageList.length }} 张，支持逐张核对与放大预览
                  </div>
                </div>
                <div class="image-toolbar">
                  <el-button
                    size="small"
                    :disabled="activeImageIndex === 0"
                    @click="prevImage"
                  >上一张</el-button>
                  <el-button
                    size="small"
                    :disabled="activeImageIndex >= currentImageList.length - 1"
                    @click="nextImage"
                  >下一张</el-button>
                  <el-button
                    type="primary"
                    plain
                    size="small"
                    :disabled="!currentPreviewImage"
                    @click="previewCurrentImage"
                  >放大查看</el-button>
                </div>
              </div>

              <div v-if="currentPreviewImage" class="current-image-stage">
                <el-image
                  :src="currentPreviewImage"
                  :preview-src-list="currentImageList"
                  :initial-index="activeImageIndex"
                  fit="contain"
                  class="current-answer-image"
                />
              </div>
              <el-empty v-else description="学生未上传图片" />

              <div v-if="currentImageList.length > 1" class="image-thumb-list">
                <button
                  v-for="(image, index) in currentImageList"
                  :key="image"
                  type="button"
                  class="image-thumb-btn"
                  :class="{ 'is-active': index === activeImageIndex }"
                  @click="setActiveImage(index)"
                >
                  <img :src="image" :alt="`作答图片${index + 1}`" class="image-thumb" />
                  <span>第{{ index + 1 }}张</span>
                </button>
              </div>
            </div>
          </div>

          <div class="review-editor-panel">
            <div class="teacher-note">
              <div class="teacher-note-title">图片作答说明</div>
              <div class="teacher-note-text">
                左侧可并排查看原始 PDF 与学生上传图片。建议先对照原题，再逐张查看作答图片，最后填写分数、评语和订正建议。
              </div>
            </div>

            <div class="overall-comment-card">
              <div class="question-title">
                <strong>图片作答总评</strong>
                <span>可按整份作业给出综合反馈</span>
              </div>
              <div class="question-score">
                <span>总评得分：</span>
                <el-input-number
                  v-model="gradeScores.__image_review__"
                  :min="0"
                  :max="getImageReviewMaxScore()"
                  :disabled="viewOnly"
                />
              </div>
              <div class="question-comment">
                <span>总评评语：</span>
                <el-input
                  v-model="gradeComments.__image_review__"
                  type="textarea"
                  :rows="3"
                  placeholder="请输入对整份图片作业的总体评价"
                  :disabled="viewOnly"
                />
              </div>
              <div class="question-comment">
                <span>整体订正建议：</span>
                <el-input
                  v-model="gradeCorrections.__image_review__"
                  type="textarea"
                  :rows="3"
                  placeholder="请输入整份作业的订正方向或复习建议"
                  :disabled="viewOnly"
                />
              </div>
            </div>
          </div>
        </div>

        <div v-if="!hasImageSubmission || hasRegularQuestionResults">
          <div
            v-for="(item, index) in displayQuestionResults"
            :key="item.questionId"
            class="question-card"
          >
            <div class="question-title">
              <strong>{{ item.questionType === 'imageUpload' ? '图片作答' : `第${index + 1}题` }}</strong>
              <span>满分 {{ item.fullScore || 0 }} 分</span>
            </div>
            <div class="question-line"><span>题型：</span>{{ getTypeText(item.questionType) }}</div>
            <div class="question-line"><span>题干：</span><MathText :text="item.content || '-'" /></div>
            <div class="question-line"><span>学生答案：</span><MathText :text="item.studentAnswer || '未作答'" /></div>
            <div class="question-line"><span>标准答案：</span><MathText :text="item.standardAnswer || '无'" /></div>
            <div v-if="item.questionType !== 'shortAnswer' && item.questionType !== 'imageUpload'" class="question-line">
              <span>自动判定：</span>
              <el-tag :type="item.correct ? 'success' : 'danger'">{{ item.correct ? '正确' : '错误' }}</el-tag>
            </div>
            <div class="question-score">
              <span>得分：</span>
              <el-input-number
                v-model="gradeScores[item.questionId]"
                :min="0"
                :max="item.fullScore || 100"
                :disabled="viewOnly || (item.questionType !== 'shortAnswer' && item.questionType !== 'imageUpload')"
              />
            </div>
            <div class="question-comment">
              <span>教师评语：</span>
              <el-input
                v-model="gradeComments[item.questionId]"
                type="textarea"
                :rows="2"
                placeholder="请输入评语"
                :disabled="viewOnly"
              />
            </div>
            <div class="question-comment">
              <span>订正建议：</span>
              <el-input
                v-model="gradeCorrections[item.questionId]"
                type="textarea"
                :rows="2"
                placeholder="例如：步骤缺失 / 概念混淆 / 计算错误"
                :disabled="viewOnly"
              />
            </div>
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
import MathText from '@/components/MathText.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import dayjs from 'dayjs'

var loading = ref(false)
var gradeDialogVisible = ref(false)
var answers = ref([])
var currentAnswer = ref(null)
var viewOnly = ref(false)
var activeImageIndex = ref(0)
var gradeScores = reactive({})
var gradeComments = reactive({})
var gradeCorrections = reactive({})

var dialogTitle = computed(function() {
  return viewOnly.value ? '查看答题详情' : '批改答题'
})

var pendingCount = computed(function() {
  return answers.value.filter(function(a) { return a.status !== 'graded' }).length
})

var hasImageSubmission = computed(function() {
  return !!(currentAnswer.value && currentAnswer.value.answer && Array.isArray(currentAnswer.value.answer.images) && currentAnswer.value.answer.images.length > 0)
})

var currentImageList = computed(function() {
  if (!hasImageSubmission.value) return []
  return currentAnswer.value.answer.images.map(function(image) {
    return getFileUrl(image)
  })
})

var currentPreviewImage = computed(function() {
  return currentImageList.value[activeImageIndex.value] || ''
})

var hasRegularQuestionResults = computed(function() {
  if (!currentAnswer.value || !Array.isArray(currentAnswer.value.questionResults)) return false
  return currentAnswer.value.questionResults.some(function(item) {
    return item.questionType !== 'imageUpload'
  })
})

var displayQuestionResults = computed(function() {
  if (!currentAnswer.value || !Array.isArray(currentAnswer.value.questionResults)) return []
  return hasImageSubmission.value
    ? currentAnswer.value.questionResults.filter(function(item) { return item.questionType !== 'imageUpload' })
    : currentAnswer.value.questionResults
})

var paperPreviewUrl = computed(function() {
  if (!currentAnswer.value || !currentAnswer.value.paper || !currentAnswer.value.paper.filePath) return ''
  var fileUrl = getFileUrl(currentAnswer.value.paper.filePath)
  return fileUrl ? (fileUrl + '#toolbar=1&navpanes=0&scrollbar=1') : ''
})

onMounted(function() {
  loadAnswers()
})

function resetGradeData() {
  ;[gradeScores, gradeComments, gradeCorrections].forEach(function(target) {
    var keys = Object.keys(target)
    for (var i = 0; i < keys.length; i++) {
      delete target[keys[i]]
    }
  })
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
        activeImageIndex.value = 0
        resetGradeData()
        var list = res.data.questionResults || []
        for (var i = 0; i < list.length; i++) {
          gradeScores[list[i].questionId] = list[i].score || 0
          gradeComments[list[i].questionId] = list[i].comment || ''
          gradeCorrections[list[i].questionId] = list[i].correction || ''
        }
        if (hasImageSubmission.value) {
          if (gradeScores.__image_review__ === undefined) gradeScores.__image_review__ = Number(res.data.answer && res.data.answer.totalScore) || 0
          if (gradeComments.__image_review__ === undefined) gradeComments.__image_review__ = ''
          if (gradeCorrections.__image_review__ === undefined) gradeCorrections.__image_review__ = ''
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
  api.post('/teacher/answers/' + currentAnswer.value.answer.id + '/grade', {
    scores: gradeScores,
    comments: gradeComments,
    corrections: gradeCorrections
  })
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

function exportExcel() {
  var stamp = dayjs().format('YYYY-MM-DD')
  api.download('/teacher/answers/export/excel', {}, '批改结果_' + stamp + '.xlsx')
    .then(function() {
      ElMessage.success('已导出 Excel')
    })
    .catch(function() {
      ElMessage.error('导出失败，请稍后重试')
    })
}

function getObjectiveSummary(row) {
  var result = row.questionResults || []
  var objective = result.filter(function(item) {
    return item.questionType === 'choice' || item.questionType === 'fill'
  })
  var correctCount = objective.filter(function(item) { return item.correct }).length
  return objective.length ? (correctCount + '/' + objective.length) : '无'
}

function getTypeText(type) {
  var map = { choice: '选择题', fill: '填空题', shortAnswer: '简答题', imageUpload: '图片作答' }
  return map[type] || '未知题型'
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}

function getFileUrl(imagePath) {
  if (!imagePath) return ''
  if (/^https?:\/\//i.test(imagePath)) return imagePath

  var origin = window.location.origin
  if (origin.indexOf(':5000') !== -1) {
    origin = origin.replace(':5000', ':5001')
  }

  return origin + imagePath
}

function setActiveImage(index) {
  if (index >= 0 && index < currentImageList.value.length) {
    activeImageIndex.value = index
  }
}

function prevImage() {
  setActiveImage(activeImageIndex.value - 1)
}

function nextImage() {
  setActiveImage(activeImageIndex.value + 1)
}

function previewCurrentImage() {
  if (currentPreviewImage.value) {
    window.open(currentPreviewImage.value, '_blank')
  }
}

function openPaperPreview() {
  if (paperPreviewUrl.value) {
    window.open(paperPreviewUrl.value, '_blank')
  }
}

function getImageReviewMaxScore() {
  var imageReview = currentAnswer.value && Array.isArray(currentAnswer.value.questionResults)
    ? currentAnswer.value.questionResults.find(function(item) { return item.questionType === 'imageUpload' })
    : null
  return imageReview && imageReview.fullScore ? imageReview.fullScore : 100
}


function previewImage(imagePath) {
  var imageUrl = getFileUrl(imagePath)
  if (imageUrl) {
    window.open(imageUrl, '_blank')
  }
}
</script>

<style scoped>
.card-header,
.header-left,
.dialog-summary {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-header {
  justify-content: space-between;
}

.dialog-summary {
  margin-bottom: 16px;
  color: var(--nb-ink-2);
  flex-wrap: wrap;
}

.review-board {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.9fr);
  gap: 20px;
  margin-bottom: 20px;
}

.review-preview-panel,
.review-editor-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-card,
.overall-comment-card,
.question-card {
  padding: 16px;
  background: #f5f8ff;
  border-radius: 12px;
}

.preview-card-header,
.question-title {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.preview-card-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--nb-ink);
}

.preview-card-desc {
  margin-top: 4px;
  color: var(--nb-ink-3);
  font-size: 14px;
}

.paper-preview-frame-wrap {
  min-height: 520px;
  border-radius: 10px;
  overflow: hidden;
  background: #e9edf3;
  border: 1px solid #dfe6ee;
}

.paper-preview-frame {
  width: 100%;
  height: 520px;
  border: none;
  background: #fff;
}

.image-preview-header {
  align-items: flex-start;
}

.image-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.current-image-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 420px;
  background: linear-gradient(135deg, #eef3f8 0%, #f5f8ff 100%);
  border: 1px solid #e3e8ef;
  border-radius: 10px;
  padding: 12px;
}

.current-answer-image {
  width: 100%;
  max-height: 420px;
  border-radius: 8px;
}

.image-thumb-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 10px;
}

.image-thumb-btn {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--nb-line);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--nb-ink-2);
}

.image-thumb-btn:hover,
.image-thumb-btn.is-active {
  border-color: var(--nb-blue);
  box-shadow: 0 8px 20px rgba(64, 158, 255, 0.14);
  color: var(--nb-blue);
}

.image-thumb {
  width: 100%;
  height: 72px;
  object-fit: cover;
  border-radius: 6px;
  background: #f4f4f5;
}

.question-card {
  margin-bottom: 16px;
}

.question-line {
  margin-bottom: 8px;
  line-height: 1.6;
}

.question-line span,
.question-score span,
.question-comment span {
  color: var(--nb-ink-3);
}

.question-score {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.question-comment {
  margin-top: 12px;
}

.teacher-note {
  margin-bottom: 16px;
  padding: 14px 16px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 8px;
  color: var(--nb-orange-ink);
}

.teacher-note-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.teacher-note-text {
  line-height: 1.6;
}

:deep(.submit-grade-btn.el-button--primary) {
  color: #fff;
}

:deep(.submit-grade-btn.el-button--primary:hover),
:deep(.submit-grade-btn.el-button--primary:focus) {
  color: #fff;
}

@media (max-width: 1100px) {
  .review-board {
    grid-template-columns: 1fr;
  }

  .paper-preview-frame-wrap,
  .paper-preview-frame {
    min-height: 420px;
    height: 420px;
  }
}
</style>
