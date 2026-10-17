<template>
  <div class="admin-settings">
    <div class="page-header">
      <h2>系统设置</h2>
      <p>配置系统参数和第三方 API</p>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>OCR 服务配置</template>
          <el-form :model="ocrSettings" label-width="100px">
            <el-form-item label="API Key">
              <el-input v-model="ocrSettings.ocrApiKey" placeholder="请输入 OCR API Key" show-password />
            </el-form-item>
            <el-form-item label="API Secret">
              <el-input v-model="ocrSettings.ocrApiSecret" placeholder="请输入 API Secret" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveOCRSettings">保存配置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>大模型服务配置</template>
          <el-form :model="llmSettings" label-width="100px">
            <el-form-item label="API Key">
              <el-input v-model="llmSettings.llmApiKey" placeholder="请输入大模型 API Key" show-password />
            </el-form-item>
            <el-form-item label="API Endpoint">
              <el-input v-model="llmSettings.llmApiEndpoint" placeholder="请输入 API Endpoint" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveLLMSettings">保存配置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="gradient-card" style="margin-top: 20px;">
      <template #header>AI助教小智配置</template>
      <el-form :model="tutorSettings" label-width="120px">
        <el-form-item label="启用状态">
          <el-switch v-model="tutorSettings.aiTutorEnabled" />
        </el-form-item>
        <el-form-item label="服务类型">
          <el-input v-model="tutorSettings.aiTutorProvider" placeholder="openai-compatible" />
        </el-form-item>
        <el-form-item label="API Endpoint">
          <el-input v-model="tutorSettings.aiTutorApiEndpoint" placeholder="请输入对话接口地址" />
        </el-form-item>
        <el-form-item label="模型名称">
          <el-input v-model="tutorSettings.aiTutorModel" placeholder="请输入模型名称" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="tutorSettings.aiTutorApiKey" :disabled="tutorSettings.aiTutorManagedByEnv" placeholder="请输入 AI 助教 API Key" show-password />
          <div v-if="tutorSettings.aiTutorManagedByEnv" class="masked-hint">
            当前 AI 助教由后端环境变量托管，前端不会保存或暴露真实 Key。
          </div>
          <div v-else-if="tutorSettings.aiTutorApiKeyMasked" class="masked-hint">
            当前已保存密钥：{{ tutorSettings.aiTutorApiKeyMasked }}
          </div>
        </el-form-item>
        <el-form-item label="知识范围">
          <el-select v-model="tutorSettings.aiTutorKnowledgeScope" multiple collapse-tags collapse-tags-tooltip style="width: 100%;">
            <el-option v-for="item in knowledgeScopeOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button :loading="validatingTutor" @click="validateTutorSettings">验证连接</el-button>
          <el-button type="primary" :loading="savingTutor" @click="saveTutorSettings">保存 AI 助教配置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="gradient-card" style="margin-top: 20px;">
      <template #header>系统参数</template>
      <el-form :model="systemSettings" label-width="120px">
        <el-form-item label="系统名称">
          <el-input v-model="systemSettings.systemName" placeholder="请输入系统名称" />
        </el-form-item>
        <el-form-item label="最大上传大小">
          <el-input-number v-model="systemSettings.maxUploadSize" :min="1" :max="100" />
          <span style="margin-left: 10px;">MB</span>
        </el-form-item>
        <el-form-item label="允许文件类型">
          <el-input v-model="fileTypesStr" placeholder="jpg, jpeg, png, pdf" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveSystemSettings">保存配置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

var ocrSettings = reactive({ ocrApiKey: '', ocrApiSecret: '' })
var llmSettings = reactive({ llmApiKey: '', llmApiEndpoint: '' })
var tutorSettings = reactive({
  aiTutorEnabled: true,
  aiTutorProvider: 'openai-compatible',
  aiTutorApiEndpoint: '',
  aiTutorModel: '',
  aiTutorApiKey: '',
  aiTutorApiKeyMasked: '',
  aiTutorManagedByEnv: false,
  aiTutorKnowledgeScope: []
})
var systemSettings = reactive({ systemName: '智析数学', maxUploadSize: 10, allowedFileTypes: [] })

var fileTypesStr = ref('')
var knowledgeScopeOptions = ref([])
var savingTutor = ref(false)
var validatingTutor = ref(false)

function updateFileTypesStr() {
  fileTypesStr.value = systemSettings.allowedFileTypes.join(', ')
}

function parseFileTypes(val) {
  var parts = val.split(',')
  systemSettings.allowedFileTypes = []
  for (var i = 0; i < parts.length; i++) {
    var s = parts[i].trim()
    if (s) systemSettings.allowedFileTypes.push(s)
  }
}

onMounted(function() {
  loadSettings()
  loadTutorSettings()
})

function loadSettings() {
  api.get('/admin/settings')
    .then(function(res) {
      if (res.success) {
        if (res.data.ocrApiKey !== undefined) ocrSettings.ocrApiKey = res.data.ocrApiKey
        if (res.data.ocrApiSecret !== undefined) ocrSettings.ocrApiSecret = res.data.ocrApiSecret
        if (res.data.llmApiKey !== undefined) llmSettings.llmApiKey = res.data.llmApiKey
        if (res.data.llmApiEndpoint !== undefined) llmSettings.llmApiEndpoint = res.data.llmApiEndpoint
        if (res.data.systemName !== undefined) systemSettings.systemName = res.data.systemName
        if (res.data.maxUploadSize !== undefined) systemSettings.maxUploadSize = res.data.maxUploadSize
        if (res.data.allowedFileTypes !== undefined) {
          systemSettings.allowedFileTypes = res.data.allowedFileTypes
          updateFileTypesStr()
        }
      }
    })
    .catch(function() {})
}

function loadTutorSettings() {
  api.admin.getAiTutorSettings()
    .then(function(res) {
      if (res.success && res.data) {
        tutorSettings.aiTutorEnabled = res.data.aiTutorEnabled !== false
        tutorSettings.aiTutorProvider = res.data.aiTutorProvider || 'openai-compatible'
        tutorSettings.aiTutorApiEndpoint = res.data.aiTutorApiEndpoint || ''
        tutorSettings.aiTutorModel = res.data.aiTutorModel || ''
        tutorSettings.aiTutorApiKeyMasked = res.data.aiTutorApiKeyMasked || ''
        tutorSettings.aiTutorManagedByEnv = res.data.aiTutorManagedByEnv === true
        tutorSettings.aiTutorKnowledgeScope = res.data.aiTutorKnowledgeScope || []
        knowledgeScopeOptions.value = (res.data.aiTutorKnowledgeScope || []).slice()
      }
    })
    .catch(function() {
      ElMessage.error('加载 AI 助教配置失败')
    })
}

function saveOCRSettings() {
  api.put('/admin/settings', ocrSettings)
    .then(function(res) {
      if (res.success) ElMessage.success('OCR 配置保存成功')
    })
    .catch(function() { ElMessage.error('保存失败') })
}

function saveLLMSettings() {
  api.put('/admin/settings', llmSettings)
    .then(function(res) {
      if (res.success) ElMessage.success('大模型配置保存成功')
    })
    .catch(function() { ElMessage.error('保存失败') })
}

function saveSystemSettings() {
  parseFileTypes(fileTypesStr.value)
  api.put('/admin/settings', systemSettings)
    .then(function(res) {
      if (res.success) ElMessage.success('系统配置保存成功')
    })
    .catch(function() { ElMessage.error('保存失败') })
}

function validateTutorSettings() {
  validatingTutor.value = true
  api.admin.validateAiTutorSettings({
    aiTutorEnabled: tutorSettings.aiTutorEnabled,
    aiTutorProvider: tutorSettings.aiTutorProvider,
    aiTutorApiEndpoint: tutorSettings.aiTutorApiEndpoint,
    aiTutorModel: tutorSettings.aiTutorModel,
    aiTutorApiKey: tutorSettings.aiTutorManagedByEnv ? '' : tutorSettings.aiTutorApiKey
  })
    .then(function(res) {
      if (res.success) ElMessage.success(res.data.message || '连接验证成功')
    })
    .catch(function(error) {
      ElMessage.error(error && error.message ? error.message : '连接验证失败')
    })
    .finally(function() {
      validatingTutor.value = false
    })
}

function saveTutorSettings() {
  savingTutor.value = true
  api.admin.saveAiTutorSettings({
    aiTutorEnabled: tutorSettings.aiTutorEnabled,
    aiTutorProvider: tutorSettings.aiTutorProvider,
    aiTutorApiEndpoint: tutorSettings.aiTutorApiEndpoint,
    aiTutorModel: tutorSettings.aiTutorModel,
    aiTutorApiKey: tutorSettings.aiTutorManagedByEnv ? '' : tutorSettings.aiTutorApiKey,
    aiTutorKnowledgeScope: tutorSettings.aiTutorKnowledgeScope
  })
    .then(function(res) {
      if (res.success) {
        tutorSettings.aiTutorApiKey = ''
        tutorSettings.aiTutorApiKeyMasked = res.data.aiTutorApiKeyMasked || tutorSettings.aiTutorApiKeyMasked
        tutorSettings.aiTutorManagedByEnv = res.data.aiTutorManagedByEnv === true
        ElMessage.success('AI助教配置保存成功')
      }
    })
    .catch(function(error) {
      ElMessage.error(error && error.message ? error.message : '保存失败')
    })
    .finally(function() {
      savingTutor.value = false
    })
}
</script>

<style scoped>
.masked-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
