<template>
  <div class="question-tools">
    <template v-if="!answered && question.hints?.length"
      ><el-button
        size="small"
        :disabled="hintCount >= question.hints.length"
        @click="hintCount++"
        >看一步提示</el-button
      >
      <p v-for="(hint, i) in question.hints.slice(0, hintCount)" :key="i">
        {{ hint }}
      </p></template
    >
    <el-button link size="small" @click="report">反馈题目问题</el-button>
  </div>
</template>
<script setup>
import { ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import api from "@/utils/api";
const props = defineProps({
    question: { type: Object, required: true },
    answered: Boolean,
  }),
  hintCount = ref(0);
watch(
  () => props.question.id,
  () => {
    hintCount.value = 0;
  },
);
async function report() {
  try {
    const { value } = await ElMessageBox.prompt(
      "请描述题干、答案或解析的问题。",
      "反馈题目问题",
      {
        inputType: "textarea",
        inputValidator: (value) =>
          value?.trim().length >= 3 || "请至少填写 3 个字",
      },
    );
    await api.post("/student/questions/" + props.question.id + "/report", {
      message: value,
    });
    ElMessage.success("已提交给老师核查");
  } catch (error) {
    if (error.response)
      ElMessage.error(error.response.data.message || "提交失败");
  }
}
</script>
<style scoped>
.question-tools {
  margin: 10px 0;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.question-tools p {
  width: 100%;
  margin: 4px 0;
  color: var(--nb-ink-2);
}
</style>
