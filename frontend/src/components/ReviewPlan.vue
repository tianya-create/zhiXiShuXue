<template>
  <el-card
    ><template #header>复习计划</template>
    <p v-if="!items.length">完成作业或练习后，这里会安排后续复习。</p>
    <div v-for="item in items" :key="item.questionId" class="review-row">
      <div class="review-content">
        <MathText :text="item.content" /><small>{{
          item.due
            ? "今天可以复习"
            : "建议复习时间：" + format(item.nextReviewAt)
        }}</small>
      </div>
      <el-button
        :title="item.due ? '开始复习' : '可提前复习这道题'"
        @click="review(item)"
        >复习</el-button
      >
    </div></el-card
  >
</template>
<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import api from "@/utils/api";
import MathText from "@/components/MathText.vue";
const items = ref([]);
const router = useRouter();
const format = (value) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
const review = (item) => {
  if (!item?.knowledgePointId || !item?.questionId) return;
  router.push({
    path: "/student/practice",
    query: { kpId: item.knowledgePointId, questionId: item.questionId },
  });
};
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--nb-line);
}
.review-content {
  min-width: 0;
  flex: 1;
  line-height: 1.65;
}
.review-row .el-button {
  flex: 0 0 auto;
  min-width: 62px;
  margin-top: 4px;
}
small {
  display: block;
  margin-top: 6px;
  color: var(--nb-ink-3);
}
</style>
