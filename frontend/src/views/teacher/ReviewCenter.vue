<template>
  <div class="review-center">
    <header class="page-header">
      <h2>复核与题目纠错</h2>
      <p>检查学生的解题过程，按评分步骤给分。保存后更新错题本和掌握度。</p>
    </header>
    <el-tabs v-model="tab"
      ><el-tab-pane label="待复核答卷" name="queue"
        ><el-table :data="queue" v-loading="loading"
          ><el-table-column prop="studentName" label="学生" /><el-table-column
            prop="title"
            label="作业或练习"
          /><el-table-column label="操作"
            ><template #default="{ row }"
              ><el-button type="primary" link @click="open(row)"
                >复核答卷</el-button
              ></template
            ></el-table-column
          ></el-table
        ><el-empty
          v-if="!loading && !queue.length"
          description="暂无待复核答卷" /></el-tab-pane
      ><el-tab-pane label="题目纠错" name="reports"
        ><el-card v-for="report in reports" :key="report.id" class="report"
          ><p>{{ report.question?.content }}</p>
          <p>{{ report.message }}</p>
          <p v-if="report.status === 'resolved'">
            处理结果：{{ report.resolution }}
          </p>
          <el-button v-else @click="resolve(report)"
            >填写处理结果</el-button
          ></el-card
        ><el-empty
          v-if="!reports.length"
          description="暂无题目纠错反馈" /></el-tab-pane
    ></el-tabs>
    <el-dialog
      v-model="visible"
      title="复核答卷"
      width="min(820px,95vw)"
      :close-on-click-modal="false"
    >
      <article
        v-for="(result, index) in current?.questionResults || []"
        :key="result.questionId"
        class="review-question"
      >
        <h3>
          第 {{ index + 1 }} 题
          <el-tag v-if="result.needsReview" type="warning">待复核</el-tag>
        </h3>
        <MathText :text="result.snapshot?.content || ''" />
        <img
          v-if="result.snapshot?.imageUrl"
          :src="result.snapshot.imageUrl"
          alt="题目附图"
          class="image"
        />
        <p>学生作答</p>
        <MathText :text="result.answer || '未作答'" />
        <p>参考答案</p>
        <MathText
          :text="result.snapshot?.answer || result.correctAnswer || ''"
        />
        <div v-if="result.snapshot?.rubric?.length">
          <div
            v-for="(step, i) in result.snapshot.rubric"
            :key="i"
            class="step"
          >
            <span>{{ step.description }}</span
            ><el-input-number
              v-model="stepScores[result.questionId][i]"
              :min="0"
              :max="Number(step.points)"
            />
            / {{ step.points }} 分
          </div>
        </div>
        <div v-else class="step">
          <span>得分</span
          ><el-input-number
            v-model="scores[result.questionId]"
            :min="0"
            :max="result.fullScore"
          />
          / {{ result.fullScore }} 分
        </div>
        <el-input
          v-model="comments[result.questionId]"
          placeholder="给学生的反馈与改进建议"
          type="textarea"
        />
      </article>
      <div v-for="image in current?.images || []" :key="image">
        <img :src="image" alt="学生手写解答" class="image" />
      </div>
      <el-input v-if="current?.images?.length && !current?.questionResults?.length" v-model="comments.__image_review__" type="textarea" placeholder="图片作答的整体反馈" />
      <el-input-number
        v-if="current?.images?.length && !current?.questionResults?.length"
        v-model="scores.__image_review__"
        :min="0"
        :max="100"
      />
      <template #footer
        ><el-button @click="visible = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save"
          >保存复核结果</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import api from "@/utils/api";
import MathText from "@/components/MathText.vue";
const queue = ref([]),
  reports = ref([]),
  loading = ref(false),
  saving = ref(false),
  visible = ref(false),
  current = ref(null),
  tab = ref("queue");
const scores = reactive({}),
  stepScores = reactive({}),
  comments = reactive({});
async function load() {
  loading.value = true;
  try {
    const [a, b] = await Promise.all([
      api.get("/teacher/review-queue"),
      api.get("/teacher/question-reports"),
    ]);
    queue.value = a.data;
    reports.value = b.data;
  } catch {
    ElMessage.error("加载复核记录失败");
  } finally {
    loading.value = false;
  }
}
function open(row) {
  current.value = row;
  for (const state of [scores, stepScores, comments])
    for (const key of Object.keys(state)) delete state[key];
  for (const result of row.questionResults || []) {
    scores[result.questionId] = result.score;
    comments[result.questionId] = result.comment || "";
    if (result.snapshot?.rubric?.length)
      stepScores[result.questionId] =
        result.stepScores || result.snapshot.rubric.map(() => 0);
  }
  visible.value = true;
}
async function save() {
  saving.value = true;
  try {
    await api.post("/teacher/review-queue/" + current.value.id, {
      collection: current.value.collection,
      scores,
      stepScores,
      comments,
    });
    visible.value = false;
    ElMessage.success("复核已保存，学习记录已更新");
    await load();
  } catch (error) {
    ElMessage.error(error.response?.data?.message || "保存复核失败");
  } finally {
    saving.value = false;
  }
}
async function resolve(report) {
  try {
    const { value } = await ElMessageBox.prompt(
      "核对题目后填写处理说明。有内容错误时，请先在题库中更正或下架。",
      "处理题目反馈",
      {
        inputType: "textarea",
        inputValidator: (value) => !!value?.trim() || "请填写处理说明",
      },
    );
    await api.put("/teacher/question-reports/" + report.id, {
      resolution: value,
    });
    await load();
  } catch (error) {
    if (error.response) ElMessage.error("保存失败");
  }
}
onMounted(load);
</script>
<style scoped>
.review-center {
  display: grid;
  gap: 20px;
}
.review-question {
  padding: 16px 0;
  border-bottom: 1px solid var(--nb-line);
}
.step {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}
.step span {
  flex: 1;
}
.image {
  max-width: 100%;
  max-height: 400px;
}
.report {
  margin-bottom: 12px;
}
@media (max-width: 600px) {
  .step {
    flex-wrap: wrap;
  }
}
</style>
