<template>
  <el-dialog
    v-model="visible"
    title="班级教材与已学范围"
    width="min(720px,94vw)"
  >
    <p>
      选择这个班已经学过的知识点。推荐会遵循已学范围；年级建议需要按实际教材核对。
    </p>
    <el-form label-position="top"
      ><el-form-item label="教材版本"
        ><el-input
          v-model="version"
          placeholder="例如：人教版，七年级上册" /></el-form-item
    ></el-form>
    <el-checkbox-group v-model="selected" class="node-list"
      ><el-checkbox v-for="node in nodes" :key="node.id" :value="node.id"
        >{{ node.name }}（{{ node.grade }}年级建议）</el-checkbox
      ></el-checkbox-group
    >
    <template #footer
      ><el-button @click="visible = false">取消</el-button
      ><el-button type="primary" :loading="saving" @click="save"
        >保存已学范围</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup>
import { ref } from "vue";
import { ElMessage } from "element-plus";
import api from "@/utils/api";
const visible = ref(false),
  nodes = ref([]),
  selected = ref([]),
  version = ref(""),
  classId = ref(""),
  saving = ref(false);
async function open(row) {
  try {
    const res = await api.get("/teacher/classes/" + row.id + "/curriculum");
    classId.value = row.id;
    nodes.value = res.data.nodes;
    selected.value = res.data.class.taughtKnowledgePointIds || [];
    version.value = res.data.class.textbookVersion || "";
    visible.value = true;
  } catch {
    ElMessage.error("加载已学范围失败");
  }
}
async function save() {
  saving.value = true;
  try {
    await api.put("/teacher/classes/" + classId.value + "/curriculum", {
      taughtKnowledgePointIds: selected.value,
      textbookVersion: version.value,
    });
    visible.value = false;
    ElMessage.success("已学范围已保存");
  } catch (error) {
    ElMessage.error(error.response?.data?.message || "保存失败");
  } finally {
    saving.value = false;
  }
}
defineExpose({ open });
</script>
<style scoped>
.node-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.node-list .el-checkbox {
  height: auto;
  white-space: normal;
}
@media (max-width: 600px) {
  .node-list {
    grid-template-columns: 1fr;
  }
}
</style>
