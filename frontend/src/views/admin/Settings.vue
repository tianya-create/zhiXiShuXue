<template>
  <div class="admin-settings">
    <div class="page-header">
      <h2>系统设置</h2>
      <p>平台名称、上传限制，以及 OCR 和自动批改服务配置。</p>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>OCR 服务配置</template>
          <el-form :model="ocrSettings" label-width="124px">
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
          <el-form :model="llmSettings" label-width="124px">
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
    <el-card class="gradient-card" style="margin-top: 20px;">
      <template #header>认知—心理适配参数</template>
      <el-alert title="仅作用于整式、整式加减、分式与分式运算、一元一次方程。阈值修改会随规则版本写入每次决策记录。" type="info" :closable="false" style="margin-bottom: 18px" />
      <el-form :model="adaptiveSettings" label-width="180px">
        <el-form-item label="启用双层适配"><el-switch v-model="adaptiveSettings.enabled" /></el-form-item>
        <el-form-item label="控制感低阈值"><el-input-number v-model="adaptiveSettings.controlLowMax" :min="1" :max="4.9" :step="0.1" /></el-form-item>
        <el-form-item label="控制感高阈值"><el-input-number v-model="adaptiveSettings.controlHighMin" :min="1.1" :max="5" :step="0.1" /></el-form-item>
        <el-form-item label="高心理努力阈值"><el-input-number v-model="adaptiveSettings.highEffortMin" :min="1" :max="5" :step="1" /></el-form-item>
        <el-form-item label="低正确率上界"><el-input-number v-model="adaptiveSettings.accuracyLowMax" :min="0" :max="0.99" :step="0.05" /></el-form-item>
        <el-form-item label="高正确率下界"><el-input-number v-model="adaptiveSettings.accuracyHighMin" :min="0.01" :max="1" :step="0.05" /></el-form-item>
        <el-form-item label="规则版本"><el-input v-model="adaptiveSettings.ruleVersion" maxlength="60" /></el-form-item>
        <el-form-item><el-button type="primary" @click="saveAdaptiveSettings">保存适配参数</el-button></el-form-item>
      </el-form>
    </el-card>
    <AiTutorSettings />
    <DataBackup />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import DataBackup from '@/components/DataBackup.vue'
import AiTutorSettings from '@/components/AiTutorSettings.vue'

var ocrSettings = reactive({ ocrApiKey: '', ocrApiSecret: '' })
var llmSettings = reactive({ llmApiKey: '', llmApiEndpoint: '' })
var systemSettings = reactive({ systemName: '智析数学', maxUploadSize: 10, allowedFileTypes: [] })
var adaptiveSettings = reactive({
  enabled: true,
  controlLowMax: 2.4,
  controlHighMin: 3.8,
  highEffortMin: 4,
  accuracyLowMax: 0.6,
  accuracyHighMin: 0.85,
  ruleVersion: 'adaptive-v1.0'
})

var fileTypesStr = ref('')

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
        if (res.data.adaptiveLearning) Object.assign(adaptiveSettings, res.data.adaptiveLearning)
      }
    })
    .catch(function() {})
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

function saveAdaptiveSettings() {
  api.put('/admin/settings', { adaptiveLearning: { ...adaptiveSettings } })
    .then(function(res) {
      if (res.success) ElMessage.success('认知—心理适配参数已保存')
    })
    .catch(function(error) { ElMessage.error(error.response?.data?.message || '保存失败') })
}

</script>

