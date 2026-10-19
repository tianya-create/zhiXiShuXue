<template>
  <el-button type="primary" @click="open">创建账号</el-button
  ><el-dialog v-model="visible" title="创建账号" width="min(500px,94vw)"
    ><el-form label-position="top"
      ><el-form-item label="角色"
        ><el-select v-model="form.role"
          ><el-option label="教师" value="teacher" /><el-option
            label="学生"
            value="student" /><el-option
            label="管理员"
            value="admin" /></el-select></el-form-item
      ><el-form-item label="姓名"><el-input v-model="form.name" /></el-form-item
      ><el-form-item label="登录账号"
        ><el-input
          v-model="form.username"
          placeholder="3 到 60 位字母、数字、下划线或短横线" /></el-form-item
      ><el-form-item label="初始密码"
        ><el-input
          v-model="form.password"
          show-password
          placeholder="至少 8 位，请通过学校认可的方式交给本人" /></el-form-item
      ><el-form-item v-if="form.role === 'student'" label="班级"
        ><el-select v-model="form.classId"
          ><el-option
            v-for="cls in classes"
            :key="cls.id"
            :label="cls.name"
            :value="cls.id" /></el-select></el-form-item></el-form
    ><template #footer
      ><el-button @click="visible = false">取消</el-button
      ><el-button type="primary" :loading="busy" @click="save"
        >创建账号</el-button
      ></template
    ></el-dialog
  >
</template>
<script setup>
import { ref, reactive } from "vue";
import { ElMessage } from "element-plus";
import api from "@/utils/api";
const emit = defineEmits(["created"]),
  visible = ref(false),
  busy = ref(false),
  classes = ref([]),
  form = reactive({
    role: "teacher",
    name: "",
    username: "",
    password: "",
    classId: "",
  });
async function open() {
  Object.assign(form, {
    role: "teacher",
    name: "",
    username: "",
    password: "",
    classId: "",
  });
  try {
    const res = await api.get("/common/classes");
    classes.value = res.data;
    visible.value = true;
  } catch {
    ElMessage.error("加载班级失败");
  }
}
async function save() {
  busy.value = true;
  try {
    await api.post("/admin/users", form);
    form.password = "";
    visible.value = false;
    emit("created");
    ElMessage.success("账号已创建");
  } catch (error) {
    ElMessage.error(error.response?.data?.message || "创建失败");
  } finally {
    busy.value = false;
  }
}
</script>
