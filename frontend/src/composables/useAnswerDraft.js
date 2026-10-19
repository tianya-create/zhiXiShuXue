import { ref, watch, onBeforeUnmount, unref } from "vue";
import api from "@/utils/api";

// crypto.randomUUID 仅在安全上下文（https/localhost）可用，
// 线上是 http 直连，必须降级为随机字符串，否则练习页直接报错。
const newRequestId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "req-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
};

export function useAnswerDraft(key, answers, questions, images = ref([])) {
  const status = ref(""),
    requestId = ref(newRequestId());
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const localKey = () => `answer-draft:${user.id}:${unref(key)}`;
  let timer,
    active = false,
    saving = false,
    again = false,
    disposed = false;
  const payload = () => ({
    answers: JSON.parse(JSON.stringify(unref(answers))),
    images: unref(images),
    questionIds: unref(questions).map((item) => item.id),
    requestId: requestId.value,
    updatedAt: Date.now(),
  });
  async function save() {
    if (!active || disposed) return;
    const data = payload();
    try {
      localStorage.setItem(localKey(), JSON.stringify(data));
    } catch {
      status.value = "浏览器存储已满，请保持页面打开";
    }
    if (saving) {
      again = true;
      return;
    }
    if (!navigator.onLine) {
      status.value = "网络中断，草稿已保存在本机";
      return;
    }
    saving = true;
    try {
      await api.put("/student/drafts/" + encodeURIComponent(unref(key)), data);
      status.value = "草稿已保存，可刷新或稍后继续";
    } catch {
      status.value = "暂未同步，草稿已保存在本机";
    } finally {
      saving = false;
      if (again) {
        again = false;
        save();
      }
    }
  }
  async function read() {
    let local = null;
    try {
      local = JSON.parse(localStorage.getItem(localKey()) || "null");
    } catch {}
    try {
      const res = await api.get(
        "/student/drafts/" + encodeURIComponent(unref(key)),
      );
      const remote = res.data;
      if (
        remote &&
        (!local || new Date(remote.updatedAt).getTime() > local.updatedAt)
      )
        return remote;
    } catch {}
    return local;
  }
  async function restore(saved) {
    active = false;
    const data = saved || (await read());
    if (data) {
      const validIds = new Set(unref(questions).map((item) => item.id));
      const target = unref(answers);
      for (const [id, value] of Object.entries(data.answers || {}))
        if (validIds.has(id)) target[id] = value;
      images.value = data.images || [];
      requestId.value = data.requestId || newRequestId();
      status.value = "已恢复上次作答草稿";
    }
    active = true;
    if (unref(questions).length) save();
  }
  async function clear() {
    active = false;
    clearTimeout(timer);
    localStorage.removeItem(localKey());
    try {
      await api.delete("/student/drafts/" + encodeURIComponent(unref(key)));
    } catch {}
    status.value = "已交卷";
    requestId.value = newRequestId();
  }
  watch(
    [() => unref(answers), images],
    () => {
      if (!active) return;
      try {
        localStorage.setItem(localKey(), JSON.stringify(payload()));
      } catch {}
      clearTimeout(timer);
      timer = setTimeout(save, 700);
    },
    { deep: true },
  );
  const online = () => save(),
    hide = () => {
      if (document.visibilityState === "hidden") save();
    };
  window.addEventListener("online", online);
  document.addEventListener("visibilitychange", hide);
  onBeforeUnmount(() => {
    clearTimeout(timer);
    save();
    disposed = true;
    window.removeEventListener("online", online);
    document.removeEventListener("visibilitychange", hide);
  });
  return {
    status,
    requestId,
    read,
    restore,
    save,
    clear,
    pause: () => {
      active = false;
      clearTimeout(timer);
    },
  };
}
