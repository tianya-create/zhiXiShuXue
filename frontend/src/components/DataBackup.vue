<template>
  <el-card style="margin-top: 20px"
    ><template #header>数据备份与恢复</template>
    <p>
      备份包含账号和学习记录，请保存在仅管理员能访问的位置。图片文件还需要单独备份后端上传目录。
    </p>
    <el-button :loading="busy" @click="download">下载数据备份</el-button
    ><label class="restore"
      >选择备份恢复<input
        type="file"
        accept="application/json,.json"
        @change="restore"
    /></label>
    <p>{{ message }}</p></el-card
  >
</template>
<script setup>
import { ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import api from "@/utils/api";
const busy = ref(false),
  message = ref("");
async function download() {
  busy.value = true;
  try {
    const res = await api.get("/admin/backup");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "zhixi-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message.value = "数据备份已下载";
  } catch {
    ElMessage.error("备份失败");
  } finally {
    busy.value = false;
  }
}
async function restore(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    ElMessage.error("备份文件最大为 8 MB");
    return;
  }
  try {
    const backup = JSON.parse(await file.text());
    if (!backup.data || !backup.timestamp) throw new Error("备份格式无效");
    await ElMessageBox.confirm(
      "恢复会覆盖当前账号、作业和学习记录，请先下载当前备份。确认恢复所选文件？",
      "恢复数据",
      {
        type: "warning",
        confirmButtonText: "恢复所选备份",
        cancelButtonText: "取消",
      },
    );
    busy.value = true;
    await api.post("/admin/restore", { data: backup.data });
    message.value = "数据已恢复，请重新登录核对";
    ElMessage.success(message.value);
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(
      error.response?.data?.message || error.message || "恢复失败",
    );
  } finally {
    busy.value = false;
    event.target.value = "";
  }
}
</script>
<style scoped>
.restore {
  display: inline-flex;
  gap: 12px;
  align-items: center;
  margin: 12px;
  flex-wrap: wrap;
}
</style>
