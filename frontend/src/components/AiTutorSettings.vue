<template>
  <el-card class="gradient-card" style="margin-top:20px">
    <template #header>AI助教小智</template>
    <p>为学生提供数学概念讲解与解题提示。模型回复仅供学习参考。</p>
    <el-alert v-if="managedByEnv" title="当前使用环境变量配置，修改环境变量后需重启后端。" type="info" :closable="false" />
    <el-form label-width="124px" @submit.prevent>
      <el-form-item label="开启小智"><el-switch v-model="form.aiTutorEnabled" /></el-form-item>
      <el-form-item label="接口地址"><el-input v-model="form.aiTutorApiEndpoint" :disabled="managedByEnv" placeholder="完整的 OpenAI 兼容 chat/completions 接口地址" /></el-form-item>
      <el-form-item label="模型名称"><el-input v-model="form.aiTutorModel" :disabled="managedByEnv" placeholder="服务商提供的模型名称" /></el-form-item>
      <el-form-item label="接口密钥"><el-input v-model="form.aiTutorApiKey" :disabled="managedByEnv" type="password" show-password :placeholder="maskedKey ? '已配置，留空保留原密钥' : '请输入接口密钥'" autocomplete="new-password" /></el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="busy === 'save'" :disabled="!!busy" @click="submit('save')">保存小智配置</el-button>
        <el-button :loading="busy === 'test'" :disabled="!!busy" @click="submit('test')">测试连接</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>
<script setup>
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
const form = reactive({ aiTutorEnabled: true, aiTutorApiEndpoint: '', aiTutorModel: '', aiTutorApiKey: '' })
const managedByEnv = ref(false), maskedKey = ref(''), busy = ref('')
function update(data) {
  form.aiTutorEnabled = data.aiTutorEnabled
  form.aiTutorApiEndpoint = data.aiTutorApiEndpoint
  form.aiTutorModel = data.aiTutorModel
  form.aiTutorApiKey = ''
  managedByEnv.value = data.aiTutorManagedByEnv
  maskedKey.value = data.aiTutorApiKeyMasked
}
onMounted(async () => {
  try { const res = await api.get('/ai-tutor/settings'); update(res.data) }
  catch (e) { ElMessage.error(e.response?.data?.message || '加载小智配置失败') }
})
async function submit(action) {
  busy.value = action
  try {
    const res = action === 'save' ? await api.put('/ai-tutor/settings', form) : await api.post('/ai-tutor/validate', form)
    if (action === 'save') update(res.data)
    ElMessage.success(action === 'save' ? '小智配置已保存' : '连接测试成功')
  } catch (e) { ElMessage.error(e.response?.data?.message || '操作失败') }
  finally { busy.value = '' }
}
</script>
