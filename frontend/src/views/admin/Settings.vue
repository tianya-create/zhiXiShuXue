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

</script>

