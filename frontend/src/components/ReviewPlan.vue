<template>
  <el-card
    ><template #header>复习计划</template>
    <p v-if="!items.length">完成作业或练习后，这里会安排后续复习。</p>
    <div v-for="item in items" :key="item.questionId" class="review-row">
      <div>
        <MathText :text="item.content" /><small>{{
          item.due
            ? "今天可以复习"
            : "建议复习时间：" + format(item.nextReviewAt)
        }}</small>
      </div>
      <el-button
        :disabled="!item.due"
        @click="
          $router.push({
            path: '/student/practice',
            query: { kpId: item.knowledgePointId, questionId: item.questionId },
          })
        "
        >复习</el-button
      >
    </div></el-card
  >
</template>
<script setup>
import { ref, onMounted } from "vue";
import api from "@/utils/api";
import MathText from "@/components/MathText.vue";
const items = ref([]);
const format = (value) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
onMounted(async () => {
  try {
    const res = await api.get("/student/review-plan");
    items.value = res.data;
  } catch {}
});
</script>
<style scoped>
.review-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--nb-line);
}
small {
  display: block;
  margin-top: 6px;
  color: var(--nb-ink-3);
}
</style>
