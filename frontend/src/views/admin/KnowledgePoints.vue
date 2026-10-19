<template>
  <div class="knowledge-points-management">
    <div class="page-header">
      <h2>知识点管理</h2>
      <p>初中数学的知识点树。题目、练习和学情分析都按这里的知识点归类。</p>
    </div>
    
    <el-card class="gradient-card">
      <template #header>
        <div class="card-header">
          <span>知识点树形结构</span>
          <el-button type="primary" @click="showAddDialog">
            <el-icon><Plus /></el-icon>
            添加知识点
          </el-button>
        </div>
      </template>
      
      <el-tree
        :data="knowledgeTree"
        :props="{ label: 'name', children: 'children' }"
        node-key="id"
        default-expand-all
        :expand-on-click-node="false"
      >
        <template #default="scope">
          <div class="tree-node">
            <span>{{ scope.data.name }}</span>
            <span class="tree-actions">
              <el-button type="primary" link size="small" @click="editKP(scope.data)" :disabled="scope.data.isCategory">编辑</el-button>
              <el-button type="primary" link size="small" @click="addChild(scope.data)">添加子节点</el-button>
              <el-button type="danger" link size="small" @click="deleteKP(scope.data)" :disabled="scope.data.isCategory">删除</el-button>
            </span>
          </div>
        </template>
      </el-tree>
    </el-card>
    
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑知识点' : '添加知识点'" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="104px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入知识点名称" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="年级建议"><el-select v-model="form.grade"><el-option label="七年级" :value="7" /><el-option label="八年级" :value="8" /><el-option label="九年级" :value="9" /></el-select></el-form-item>
        <el-form-item label="前置知识"><el-select v-model="form.prerequisites" multiple filterable><el-option v-for="item in flatNodes.filter(node => node.id !== form.id)" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

var dialogVisible = ref(false)
var isEdit = ref(false)
var formRef = ref(null)
var knowledgeTree = ref([])
var flatNodes = ref([])

var form = reactive({ id: '', name: '', description: '', parentId: null, level: 1 })
var rules = { name: [{ required: true, message: '请输入名称', trigger: 'blur' }] }

onMounted(function() {
  loadKnowledgePoints()
})

function loadKnowledgePoints() {
  api.get('/admin/knowledge-points')
    .then(function(res) {
      if (res.success) {
        knowledgeTree.value = res.data
        const walk = items => items.flatMap(item => item.isCategory ? walk(item.children || []) : [item, ...walk(item.children || [])])
        flatNodes.value = walk(res.data)
      }
    })
    .catch(function(error) {
      console.error('加载失败:', error)
    })
}

function showAddDialog() {
  isEdit.value = false
  form.grade = 7
  form.prerequisites = []
  form.id = ''
  form.name = ''
  form.description = ''
  form.parentId = null
  form.level = 1
  dialogVisible.value = true
}

function editKP(data) {
  isEdit.value = true
  form.grade = data.grade || 7
  form.prerequisites = data.prerequisites || []
  form.id = data.id
  form.name = data.name
  form.description = data.description || ''
  form.parentId = data.parentId
  form.level = data.level
  dialogVisible.value = true
}

function addChild(data) {
  isEdit.value = false
  form.id = ''
  form.name = ''
  form.description = ''
  form.parentId = data.id
  form.level = data.level + 1
  dialogVisible.value = true
}

function deleteKP(data) {
  ElMessageBox.confirm('确定删除该知识点？', '提示', { type: 'warning' })
    .then(function() {
      api.delete('/admin/knowledge-points/' + data.id)
        .then(function(res) {
          if (res.success) {
            ElMessage.success('删除成功')
            loadKnowledgePoints()
          }
        })
        .catch(function(error) {
          ElMessage.error('删除失败')
        })
    })
    .catch(function() {})
}

function submitForm() {
  formRef.value.validate()
    .then(function() {
      var request
      if (isEdit.value) {
        request = api.put('/admin/knowledge-points/' + form.id, form)
      } else {
        request = api.post('/admin/knowledge-points', form)
      }
      
      request
        .then(function(res) {
          if (res.success) {
            ElMessage.success(isEdit.value ? '更新成功' : '添加成功')
            dialogVisible.value = false
            loadKnowledgePoints()
          }
        })
        .catch(function(error) {
          ElMessage.error('操作失败')
        })
    })
    .catch(function() {})
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tree-node {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding-right: 20px;
}

.tree-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  visibility: hidden;
}

.tree-node:hover .tree-actions {
  visibility: visible;
}

.tree-actions :deep(.el-button.is-link) {
  flex: 0 0 auto;
  min-height: 26px;
  padding: 3px 8px !important;
  border: 1px solid var(--nb-blue-soft) !important;
  border-radius: 999px !important;
  background: var(--nb-blue-soft) !important;
  color: var(--nb-blue) !important;
  font-size: 14px !important;
  font-weight: 900 !important;
  line-height: 1.2;
  box-shadow: none !important;
}

.tree-actions :deep(.el-button + .el-button) {
  margin-left: 0 !important;
}

.tree-actions :deep(.el-button.is-link:hover),
.tree-actions :deep(.el-button.is-link:focus-visible) {
  border-color: transparent !important;
  background: var(--nb-blue) !important;
  color: #ffffff !important;
  box-shadow: none !important;
}

.tree-actions :deep(.el-button.is-link.el-button--danger) {
  border-color: var(--nb-red-soft) !important;
  background: var(--nb-red-soft) !important;
  color: var(--nb-red-ink) !important;
}

.tree-actions :deep(.el-button.is-link.el-button--danger:hover),
.tree-actions :deep(.el-button.is-link.el-button--danger:focus-visible) {
  background: var(--nb-red-ink) !important;
  color: #ffffff !important;
  box-shadow: none !important;
}
</style>
