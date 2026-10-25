<template>
  <div class="question-manager">
    <header class="page-header">
      <h2>题库与审核</h2>
      <p>先核对题干、答案和解析，审核通过后才能用于作业和补练。</p>
    </header>
    <el-card>
      <div class="tools">
        <el-input
          v-model="filters.keyword"
          placeholder="搜索题干"
          clearable
          style="max-width: 240px"
        />
        <el-select
          v-model="filters.reviewStatus"
          placeholder="审核状态"
          clearable
          style="width: 150px"
          ><el-option label="待审核" value="pending" /><el-option
            label="已审核"
            value="approved" /><el-option label="已下架" value="withdrawn"
        /></el-select>
        <el-select
          v-model="filters.knowledgePoint"
          placeholder="知识点"
          clearable
          filterable
          style="width: 200px"
          ><el-option
            v-for="node in nodes"
            :key="node.id"
            :label="node.name"
            :value="node.id"
        /></el-select>
        <el-select v-model="filters.cognitiveLoadLevel" placeholder="认知负荷" clearable style="width: 140px">
          <el-option label="低负荷" value="low" /><el-option label="中负荷" value="medium" /><el-option label="高负荷" value="high" />
        </el-select>
        <el-button
          @click="
            page = 1;
            load();
          "
          >查询</el-button
        ><el-button type="primary" @click="edit()">录入题目</el-button>
      </div>
      <el-table :data="questions" v-loading="loading">
        <el-table-column
          prop="content"
          label="题干"
          min-width="260"
          show-overflow-tooltip
        />
        <el-table-column prop="knowledgeNodeName" label="知识点" width="140" />
        <el-table-column label="认知负荷" width="100"><template #default="{ row }">{{ loadLabel(row.cognitiveLoadLevel || row.taskComplexity) }}</template></el-table-column>
        <el-table-column label="年级" width="90"
          ><template #default="{ row }">{{
            row.grade ? row.grade + "年级" : "待归类"
          }}</template></el-table-column
        >
        <el-table-column label="状态" width="100"
          ><template #default="{ row }"
            ><el-tag
              :type="
                row.reviewStatus === 'approved'
                  ? 'success'
                  : row.reviewStatus === 'withdrawn'
                    ? 'info'
                    : 'warning'
              "
              >{{ statusName(row.reviewStatus) }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column label="操作" width="200"
          ><template #default="{ row }"
            ><el-button
              link
              type="primary"
              :disabled="!canEdit(row)"
              @click="edit(row)"
              >编辑审核</el-button
            ><el-button
              link
              type="danger"
              :disabled="!canEdit(row)"
              @click="withdraw(row)"
              >下架</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="page"
        :page-size="50"
        :total="total"
        layout="total,prev,pager,next"
        @current-change="load"
      />
    </el-card>
    <el-dialog
      v-model="visible"
      :title="form.id ? '编辑审核题目' : '录入题目'"
      width="min(760px,94vw)"
      :close-on-click-modal="false"
    >
      <el-form label-position="top">
        <div class="two-cols">
          <el-form-item label="知识点"
            ><el-select v-model="form.knowledgePointId" filterable
              ><el-option
                v-for="node in nodes"
                :key="node.id"
                :label="node.name + '（' + node.grade + '年级建议）'"
                :value="node.id" /></el-select
          ></el-form-item>
          <el-form-item label="教材版本"
            ><el-input
              v-model="form.textbookVersion"
              placeholder="例如人教版；请按实际教材核对"
          /></el-form-item>
          <el-form-item label="题型"
            ><el-select v-model="form.type"
              ><el-option label="选择题" value="choice" /><el-option
                label="填空题"
                value="fill" /><el-option
                label="解答题（教师复核）"
                value="subjective" /></el-select
          ></el-form-item>
          <el-form-item label="难度"
            ><el-select v-model="form.difficulty"
              ><el-option label="基础" value="easy" /><el-option
                label="中等"
                value="medium" /><el-option
                label="提高"
                value="hard" /></el-select
          ></el-form-item>
          <el-form-item label="认知负荷等级（认知适配）"
            ><el-select v-model="form.taskComplexity"
              ><el-option label="低：单一步骤、信息精简" value="low" /><el-option
                label="中：常规综合程度"
                value="medium" /><el-option
                label="高：多步、变式或迁移"
                value="high" /></el-select
          ></el-form-item>
        </div>
        <el-form-item label="题干"
          ><el-input
            v-model="form.content"
            type="textarea"
            :rows="3" /><MathText :text="form.content"
        /></el-form-item>
        <el-form-item label="低信息密度题干（可选）"
          ><el-input v-model="form.conciseStem" type="textarea" :rows="2" placeholder="仅精简表达，不改变知识目标和已知条件"
        /></el-form-item>
        <el-form-item v-if="form.type === 'choice'" label="选项（每行一个）"
          ><el-input v-model="optionsText" type="textarea" :rows="4"
        /></el-form-item>
        <el-form-item label="标准答案"
          ><el-input v-model="form.answer" /><MathText :text="form.answer"
        /></el-form-item>
        <el-form-item label="解析（审核通过前必填）"
          ><el-input
            v-model="form.analysis"
            type="textarea"
            :rows="3" /><MathText :text="form.analysis"
        /></el-form-item>
        <el-form-item label="可接受的等价答案（每行一个，可选）"
          ><el-input v-model="acceptedText" type="textarea" :rows="2"
        /></el-form-item>
        <el-form-item label="分步提示（每行一步，可选）"
          ><el-input v-model="hintsText" type="textarea" :rows="2"
        /></el-form-item>
        <el-form-item label="高支架拆解步骤（每行一步，可选）"
          ><el-input v-model="scaffoldText" type="textarea" :rows="3" placeholder="识别已知量&#10;写出关系式&#10;代入并检验"
        /></el-form-item>
        <el-form-item label="总分"
          ><el-input-number v-model="form.score" :min="1" :max="100"
        /></el-form-item>
        <el-form-item
          v-if="form.type === 'subjective'"
          label="步骤评分（每行：分值|步骤说明，分值合计应等于总分）"
          ><el-input
            v-model="rubricText"
            type="textarea"
            :rows="3"
            placeholder="2|列出正确关系式&#10;3|计算并说明结论"
        /></el-form-item>
        <el-form-item label="几何图或题目图片"
          ><input
            type="file"
            accept="image/png,image/jpeg"
            aria-label="上传题目图片"
            @change="upload" /><img
            v-if="form.imageUrl"
            :src="form.imageUrl"
            class="question-image"
            alt="题目附图"
        /></el-form-item>
        <el-form-item label="审核结果"
          ><el-radio-group v-model="form.reviewStatus"
            ><el-radio value="pending">待审核</el-radio
            ><el-radio value="approved">已逐项核对，审核通过</el-radio
            ><el-radio value="withdrawn">下架</el-radio></el-radio-group
          ></el-form-item
        >
      </el-form>
      <template #footer
        ><el-button @click="visible = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save"
          >保存题目</el-button
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
import { KNOWLEDGE_TREE_SHARED_CONFIG } from "@/utils/knowledge-meta";
const props = defineProps({ role: { type: String, required: true } });
const user = JSON.parse(localStorage.getItem("user") || "{}");
const nodes = ref(
  KNOWLEDGE_TREE_SHARED_CONFIG.categories.flatMap((category) => category.nodes),
);
const questions = ref([]),
  loading = ref(false),
  saving = ref(false),
  visible = ref(false),
  page = ref(1),
  total = ref(0);
const filters = reactive({ keyword: "", reviewStatus: "", knowledgePoint: "", cognitiveLoadLevel: "" });
const form = reactive({}),
  optionsText = ref(""),
  acceptedText = ref(""),
  hintsText = ref(""),
  scaffoldText = ref(""),
  rubricText = ref("");
const lines = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
// 系统预置题不带 createdBy，允许本校教师完成补充与审核；
// 其他教师录入的题目仍需由管理员处理，避免越权修改。
const canEdit = (row) =>
  props.role === "admin" || !row.createdBy || row.createdBy === user.id;
const statusName = (status) =>
  status === "approved"
    ? "已审核"
    : status === "withdrawn"
      ? "已下架"
      : "待审核";
const loadLabel = (value) => ({ low: "低", medium: "中", high: "高" })[value] || "中";
async function load() {
  loading.value = true;
  try {
    const [res, catalog] = await Promise.all([
      api.get("/" + props.role + "/questions", {
        ...filters,
        page: page.value,
        pageSize: 50,
      }),
      api.get("/" + props.role + "/knowledge-points/flat"),
    ]);
    nodes.value = catalog.data;
    questions.value = res.data.data;
    total.value = res.data.total;
  } catch (error) {
    ElMessage.error("加载题库失败");
  } finally {
    loading.value = false;
  }
}
function edit(row) {
  for (const key of Object.keys(form)) delete form[key];
  Object.assign(
    form,
    row
      ? JSON.parse(JSON.stringify(row))
      : {
          type: "choice",
          knowledgePointId: "",
          content: "",
          answer: "",
          analysis: "",
          difficulty: "easy",
          taskComplexity: "low",
          conciseStem: "",
          score: 5,
          reviewStatus: "pending",
          textbookVersion: "通用（教师确认）",
          imageUrl: "",
        },
  );
  optionsText.value = (row?.options || []).join("\n");
  acceptedText.value = (row?.acceptedAnswers || []).join("\n");
  hintsText.value = (row?.hints || []).join("\n");
  scaffoldText.value = (row?.scaffoldSteps || []).join("\n");
  rubricText.value = (row?.rubric || [])
    .map((step) => step.points + "|" + step.description)
    .join("\n");
  visible.value = true;
}
async function upload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const data = new FormData();
  data.append("file", file);
  try {
    const res = await api.post(
      "/" + props.role + "/questions/upload-image",
      data,
    );
    form.imageUrl = res.data.filePath;
  } catch (error) {
    ElMessage.error(error.response?.data?.message || "图片上传失败");
  }
}
async function save() {
  saving.value = true;
  try {
    const payload = {
      ...form,
      cognitiveLoadLevel: form.taskComplexity,
      options: form.type === "choice" ? lines(optionsText.value) : [],
      acceptedAnswers: lines(acceptedText.value),
      hints: lines(hintsText.value),
      scaffoldSteps: lines(scaffoldText.value),
      rubric:
        form.type === "subjective"
          ? lines(rubricText.value).map((line) => {
              const split = line.indexOf("|");
              return {
                points: Number(line.slice(0, split)),
                description: line.slice(split + 1),
              };
            })
          : [],
    };
    const url =
      "/" + props.role + "/questions" + (form.id ? "/" + form.id : "");
    await (form.id ? api.put(url, payload) : api.post(url, payload));
    visible.value = false;
    ElMessage.success("题目已保存");
    await load();
  } catch (error) {
    ElMessage.error(error.response?.data?.message || "保存失败");
  } finally {
    saving.value = false;
  }
}
async function withdraw(row) {
  try {
    await ElMessageBox.confirm(
      "下架后停止向学生提供该题，已交答卷仍会保留。",
      "下架题目",
    );
    await api.post("/" + props.role + "/questions/" + row.id + "/review", {
      reviewStatus: "withdrawn",
    });
    await load();
  } catch (error) {
    if (error?.response) ElMessage.error(error.response.data.message);
  }
}
onMounted(load);
</script>
<style scoped>
.question-manager {
  display: grid;
  gap: 20px;
}
.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.two-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 20px;
}
.question-image {
  display: block;
  max-width: 100%;
  max-height: 240px;
  margin-top: 12px;
}
.el-pagination {
  margin-top: 16px;
}
@media (max-width: 640px) {
  .two-cols {
    grid-template-columns: 1fr;
  }
}
</style>
