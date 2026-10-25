<template>
  <div class="paper-management">
    <div class="page-header">
      <h2>试卷管理</h2>
      <p>上传纸质试卷的图片或 PDF，也可以直接从题库组卷。</p>
    </div>
    
    <el-card class="gradient-card">
      <template #header>
        <div class="card-header">
          <span>试卷列表</span>
          <el-upload
            ref="uploadRef"
            :action="uploadUrl"
            :headers="uploadHeaders"
            :on-success="handleUploadSuccess"
            :on-error="handleUploadError"
            :before-upload="beforeUpload"
            :show-file-list="false"
            accept=".jpg,.jpeg,.png,.pdf"
          >
            <el-button type="primary">
              <el-icon><Upload /></el-icon>
              上传试卷
            </el-button>
          </el-upload>
        </div>
      </template>
      
      <el-table :data="papers" style="width: 100%" v-loading="loading">
        <el-table-column prop="title" label="试卷名称" />
        <el-table-column label="文件类型" width="110">
          <template #default="scope">{{ getFileTypeText(scope.row) }}</template>
        </el-table-column>
        <el-table-column prop="fileSize" label="文件大小" width="100">
          <template #default="scope">
            {{ formatFileSize(scope.row.fileSize) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="上传时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="270">
          <template #default="scope">
            <el-button type="primary" link @click="viewPaper(scope.row)">查看</el-button>
            <el-button type="primary" link @click="addQuestions(scope.row)">添加题目</el-button>
            <el-button type="danger" link @click="deletePaper(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="loadPapers"
        @size-change="loadPapers"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>

    <el-dialog v-model="detailDialogVisible" :title="currentPaper.title || '试卷详情'" width="min(900px, 94vw)">
      <div v-loading="detailLoading" class="paper-detail">
        <el-descriptions v-if="currentPaper.id" :column="2" border>
          <el-descriptions-item label="文件类型">{{ getFileTypeText(currentPaper) }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ getStatusText(currentPaper.status) }}</el-descriptions-item>
          <el-descriptions-item label="题目数量">{{ currentPaper.questionDetails?.length || 0 }} 题</el-descriptions-item>
          <el-descriptions-item label="使用情况">
            {{ currentPaper.usage?.assignmentCount || 0 }} 份作业，{{ currentPaper.usage?.answerCount || 0 }} 份答卷
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="currentPaper.filePath" class="original-file">
          <el-button type="primary" @click="openOriginalFile(currentPaper)">在新窗口打开原试卷</el-button>
          <span>{{ currentPaper.fileName || currentPaper.title }}</span>
        </div>

        <h3 v-if="currentPaper.questionDetails?.length" class="detail-title">试卷题目</h3>
        <el-table v-if="currentPaper.questionDetails?.length" :data="currentPaper.questionDetails" max-height="460" border>
          <el-table-column type="index" label="题号" width="70" />
          <el-table-column label="题型" width="90"><template #default="scope">{{ getQuestionTypeText(scope.row.type) }}</template></el-table-column>
          <el-table-column label="题目内容" min-width="280"><template #default="scope"><MathText :text="scope.row.content" /></template></el-table-column>
          <el-table-column label="答案" min-width="130"><template #default="scope"><MathText :text="scope.row.answer || '-'" /></template></el-table-column>
          <el-table-column prop="score" label="分值" width="75" />
        </el-table>
        <el-empty v-else-if="!detailLoading && !currentPaper.filePath" description="这份试卷还没有文件或题目" />
      </div>
      <template #footer><el-button @click="detailDialogVisible = false">关闭</el-button></template>
    </el-dialog>
    
    <!-- 添加题目对话框 -->
    <el-dialog
      v-model="questionDialogVisible"
      title="添加题目"
      width="600px"
    >
      <el-form
        ref="questionFormRef"
        :model="questionForm"
        :rules="questionRules"
        label-width="104px"
      >
        <el-form-item label="题目类型" prop="type">
          <el-select v-model="questionForm.type" placeholder="请选择题型">
            <el-option label="选择题" value="choice" />
            <el-option label="填空题" value="fill" />
            <el-option label="简答题" value="shortAnswer" />
          </el-select>
        </el-form-item>
        <el-form-item label="题目内容" prop="content">
          <el-input
            v-model="questionForm.content"
            type="textarea"
            :rows="3"
            placeholder="请输入题目内容"
          />
        </el-form-item>
        <el-form-item label="选项" prop="options" v-if="questionForm.type === 'choice'">
          <div v-for="(opt, index) in questionForm.options" :key="index" style="margin-bottom: 8px;">
            <el-input v-model="questionForm.options[index]" placeholder="选项">
              <template #prepend>{{ String.fromCharCode(65 + index) }}</template>
            </el-input>
          </div>
          <el-button @click="addOption" v-if="questionForm.options.length < 6">添加选项</el-button>
        </el-form-item>
        <el-form-item label="答案" prop="answer">
          <el-input v-model="questionForm.answer" placeholder="请输入答案" />
        </el-form-item>
        <el-form-item label="分值" prop="score">
          <el-input-number v-model="questionForm.score" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="难度" prop="difficulty">
          <el-radio-group v-model="questionForm.difficulty">
            <el-radio label="easy">简单</el-radio>
            <el-radio label="medium">中等</el-radio>
            <el-radio label="hard">困难</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="questionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitQuestion">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import dayjs from 'dayjs'
import MathText from '@/components/MathText.vue'

function getFilePreviewUrl(filePath) {
  if (!filePath) return ''
  if (/^https?:\/\//i.test(filePath)) return filePath

  var origin = window.location.origin
  if (origin.indexOf(':5000') !== -1) {
    origin = origin.replace(':5000', ':5001')
  }

  return origin + filePath
}

var loading = ref(false)
var papers = ref([])
var detailDialogVisible = ref(false)
var detailLoading = ref(false)
var currentPaper = ref({})
var pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

var questionDialogVisible = ref(false)
var questionFormRef = ref(null)
var currentPaperId = ref('')

var questionForm = reactive({
  paperId: '',
  type: 'choice',
  content: '',
  options: ['', '', '', ''],
  answer: '',
  score: 5,
  difficulty: 'medium'
})

var questionRules = {
  type: [{ required: true, message: '请选择题型', trigger: 'change' }],
  content: [{ required: true, message: '请输入题目内容', trigger: 'blur' }],
  answer: [{ required: true, message: '请输入答案', trigger: 'blur' }]
}

var uploadUrl = computed(function() {
  return '/api/teacher/papers/upload'
})

var uploadHeaders = computed(function() {
  var token = localStorage.getItem('token')
  var userStr = localStorage.getItem('user')
  var user = {}
  if (userStr) {
    try {
      user = JSON.parse(userStr)
    } catch (e) {
      user = {}
    }
  }
  return {
    Authorization: 'Bearer ' + token,
    'X-User-Id': user.id || ''
  }
})

onMounted(function() {
  loadPapers()
})

function loadPapers() {
  loading.value = true
  api.get('/teacher/papers', {
    page: pagination.page,
    pageSize: pagination.pageSize
  })
  .then(function(res) {
    if (res.success) {
      papers.value = res.data.data
      pagination.total = res.data.total
    }
  })
  .catch(function(error) {
    ElMessage.error('加载试卷列表失败')
  })
  .finally(function() {
    loading.value = false
  })
}

function beforeUpload(file) {
  var allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
  var isAllowed = allowedTypes.indexOf(file.type) !== -1
  
  if (!isAllowed) {
    ElMessage.error('只能上传 JPG、PNG 或 PDF 格式的文件')
    return false
  }
  
  var isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    ElMessage.error('文件大小不能超过 10MB')
    return false
  }
  
  return true
}

function handleUploadSuccess(response) {
  if (response.success) {
    ElMessage.success('上传成功')
    loadPapers()
  } else {
    ElMessage.error(response.message || '上传失败')
  }
}

function handleUploadError() {
  ElMessage.error('上传失败，请重试')
}

function deletePaper(row) {
  var confirmText = row.removalMode === 'archive'
    ? `这份题集已用于 ${row.assignmentCount} 份作业。移除后不会再出现在试卷列表中，但历史作业和答卷会继续保留。`
    : '确定要删除该试卷吗？未用于作业的试卷将被永久删除。'
  ElMessageBox.confirm(confirmText, row.removalMode === 'archive' ? '移除题集' : '删除试卷', {
    type: 'warning',
    confirmButtonText: row.removalMode === 'archive' ? '确认移除' : '确认删除',
    cancelButtonText: '取消'
  })
    .then(function() {
      api.delete('/teacher/papers/' + row.id)
        .then(function(res) {
          if (res.success) {
            ElMessage.success(res.message || '删除成功')
            loadPapers()
          }
        })
        .catch(function(error) {
          ElMessage.error(error.response?.data?.message || '删除失败，请稍后重试')
        })
    })
    .catch(function() {})
}

function viewPaper(row) {
  detailDialogVisible.value = true
  detailLoading.value = true
  currentPaper.value = { ...row, questionDetails: [] }
  api.get('/teacher/papers/' + row.id)
    .then(function(res) {
      if (res.success) currentPaper.value = res.data || {}
    })
    .catch(function(error) {
      ElMessage.error(error.response?.data?.message || '试卷详情加载失败')
    })
    .finally(function() {
      detailLoading.value = false
    })
}

function openOriginalFile(row) {
  var previewUrl = getFilePreviewUrl(row.filePath)
  if (!previewUrl) {
    ElMessage.warning('这份题集没有上传原文件，请在下方查看题目')
    return
  }
  window.open(previewUrl, '_blank', 'noopener')
}

function addQuestions(row) {
  currentPaperId.value = row.id
  questionForm.paperId = row.id
  questionForm.type = 'choice'
  questionForm.content = ''
  questionForm.options = ['', '', '', '']
  questionForm.answer = ''
  questionForm.score = 5
  questionForm.difficulty = 'medium'
  questionDialogVisible.value = true
}

function addOption() {
  if (questionForm.options.length < 6) {
    questionForm.options.push('')
  }
}

function submitQuestion() {
  questionFormRef.value.validate()
    .then(function() {
      api.post('/teacher/questions', questionForm)
        .then(function(res) {
          if (res.success) {
            ElMessage.success('题目添加成功')
            questionDialogVisible.value = false
          }
        })
        .catch(function(error) {
          ElMessage.error('添加失败')
        })
    })
    .catch(function() {})
}

function getStatusType(status) {
  if (status === 'pending') return 'info'
  if (status === 'processing') return 'warning'
  if (status === 'completed') return 'success'
  if (status === 'published') return 'success'
  if (status === 'archived') return 'info'
  return 'info'
}

function getStatusText(status) {
  if (status === 'pending') return '待处理'
  if (status === 'processing') return '处理中'
  if (status === 'completed') return '已完成'
  if (status === 'published') return '已发布'
  if (status === 'archived') return '已移除'
  return '未知'
}

function getFileTypeText(row) {
  if (row.source === 'question-bank' || row.fileType === 'manual') return '题库组卷'
  var type = String(row.fileType || '').replace('.', '').toUpperCase()
  return type || '未上传文件'
}

function getQuestionTypeText(type) {
  return ({ choice: '选择题', fill: '填空题', shortAnswer: '简答题', subjective: '解答题' })[type] || '题目'
}

function formatFileSize(size) {
  if (!size) return '-'
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB'
  return (size / 1024 / 1024).toFixed(2) + ' MB'
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.paper-detail { min-height: 120px; }
.original-file { display: flex; align-items: center; gap: 12px; margin-top: 18px; color: var(--nb-ink-2); }
.detail-title { margin: 20px 0 10px; font-size: 17px; }
</style>
