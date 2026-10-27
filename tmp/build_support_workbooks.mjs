import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = "D:/zhiXiShuXue";
const outputDir = path.join(root, "output/支撑材料/02_测试材料");
const previewDir = path.join(root, "tmp/supporting-material-previews");
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const font = "Arial";
const navy = "#1F4E78";
const blue = "#D9EAF7";
const pale = "#F4F8FC";
const line = "#D9E2F3";
const amber = "#FFF2CC";
const red = "#FCE4D6";
const green = "#E2F0D9";

function setBase(sheet, range) {
  sheet.showGridlines = false;
  range.format.font = { name: font, size: 10, color: "#222222" };
  range.format.verticalAlignment = "center";
}

function styleHeader(range) {
  range.format = {
    fill: navy,
    font: { name: font, size: 10, bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { bottom: { color: "#FFFFFF", style: "thin" } },
  };
}

function styleTitle(sheet, title, subtitle, lastCol) {
  sheet.getRange(`A2:${lastCol}2`).merge();
  sheet.getRange("A2").values = [[title]];
  sheet.getRange("A2").format = { font: { name: font, size: 16, bold: true, color: "#111111" }, verticalAlignment: "center" };
  sheet.getRange(`A3:${lastCol}3`).merge();
  sheet.getRange("A3").values = [[subtitle]];
  sheet.getRange("A3").format = { font: { name: font, size: 10, italic: true, color: "#5A6573" }, verticalAlignment: "center" };
  sheet.getRange(`A4:${lastCol}4`).format.fill = navy;
  sheet.getRange(`A4:${lastCol}4`).format.rowHeight = 3;
}

const testCases = [
  ["ENV-01", "环境", "前后端已启动", "访问 /api/health", "返回 200 且 success=true", "P0"],
  ["VARK-01", "VARK触发", "学生无有效VARK，进入白名单薄弱练习", "登录学生端并进入整式、分式或一元一次方程薄弱练习", "先弹出VARK问卷，题目不提前显示", "P0"],
  ["VARK-02", "VARK问卷", "VARK问卷已打开", "检查每题量表", "1至5分别显示非常不符合、比较不符合、一般或不确定、比较符合、非常符合", "P0"],
  ["VARK-03", "VARK问卷", "VARK问卷未全部作答", "直接点击提交", "系统阻止提交并指出未完成题目，不产生空记录", "P0"],
  ["VARK-04", "VARK时序", "12题均已作答", "提交问卷", "先显示单一或双偏好结果，点击开始薄弱练习后才加载题目", "P0"],
  ["VARK-05", "VARK周期", "最近结果未满7天", "再次进入白名单薄弱练习", "使用缓存偏好，不重复弹出问卷", "P0"],
  ["VARK-06", "VARK周期", "最近结果已超过7天", "进入白名单薄弱练习", "强制重新测评，旧结果保留为历史", "P0"],
  ["VARK-07", "VARK计分", "第一名与第二名差值大于0.5", "提交构造答案", "返回最高分单一偏好", "P1"],
  ["VARK-08", "VARK计分", "第一名与第二名差值不超过0.5", "提交构造答案", "返回双偏好混合型并同步推送两类资源", "P0"],
  ["VARK-09", "VARK计分", "三项或四项并列", "提交构造答案", "只保留排序后的前两个维度，同分顺序V、A、R、K", "P1"],
  ["ROUND-01", "五题轮次", "已进入白名单练习", "检查任务包", "同一知识点且题目数量恰好为5", "P0"],
  ["ROUND-02", "五题轮次", "只完成4题", "点击交卷或离开页面", "不能形成有效轮次；不保存正式作答、不触发自评、不更新画像", "P0"],
  ["ROUND-03", "五题轮次", "构造含多个知识点的5题请求", "提交任务包", "返回ROUND_KNOWLEDGE_MISMATCH且不部分写入", "P0"],
  ["ROUND-04", "五题轮次", "准备同一requestId", "重复提交同一任务包", "返回同一roundId，不重复计分或重复弹窗", "P0"],
  ["REVIEW-01", "主观题复核", "5题中存在待教师复核题", "提交任务包", "轮次标记待复核，复核完成前不生成适配决策", "P0"],
  ["REF-01", "轮后自评", "5题全部提交成功", "观察提交后的页面", "自动弹出表情、Q1、Q2、Q3自评", "P0"],
  ["REF-02", "轮后自评", "自评少填任一项", "点击提交", "系统阻止提交且不能进入下一轮", "P0"],
  ["REF-03", "隐私", "自评提交成功", "检查学生端响应和页面", "只显示便利贴与普通安排，不出现控制感分数、高中低标签或原始答案", "P0"],
  ["ADAPT-01", "复杂度规则", "控制感低且Q3感知负荷高，正确率任意", "提交自评", "强制降一级，原因码为低控制感高负荷覆盖", "P0"],
  ["ADAPT-02", "复杂度规则", "未命中强制条件，正确率低于60%", "提交自评", "难度降一级", "P0"],
  ["ADAPT-03", "复杂度规则", "未命中强制条件，正确率恰为60%", "提交自评", "难度维持", "P0"],
  ["ADAPT-04", "复杂度规则", "未命中强制条件，正确率恰为80%", "提交自评", "难度维持", "P0"],
  ["ADAPT-05", "复杂度规则", "未命中强制条件，正确率高于80%", "提交自评", "难度升一级", "P0"],
  ["ADAPT-06", "复杂度规则", "当前复杂度位于边界", "触发升级或降级", "每轮最多一级，结果限制在低至高范围", "P1"],
  ["LAYOUT-01", "页面密度", "目标复杂度为低", "进入下一轮", "题干精简、步骤拆分、留白增加、并列信息减少", "P0"],
  ["LAYOUT-02", "页面密度", "目标复杂度为高", "进入下一轮", "显示同知识点变式题和完整题干，使用标准信息密度", "P1"],
  ["RES-01", "资源适配", "V偏好有效", "进入练习", "优先展示思维导图、示意图或可视化推导", "P1"],
  ["RES-02", "资源适配", "A偏好有效", "进入练习", "优先展示语音讲解、口述思路或步骤旁白，并提供字幕", "P1"],
  ["RES-03", "资源适配", "R偏好有效", "进入练习", "优先展示文字步骤、要点清单和推导文本", "P1"],
  ["RES-04", "资源适配", "K偏好有效", "进入练习", "优先展示变式练习、案例题和即时试错反馈", "P1"],
  ["RES-05", "资源适配", "VK混合偏好有效", "进入练习", "同页同时展示示意图与实操变式练习，且不改变第一层难度", "P0"],
  ["SCOPE-01", "白名单", "选择整式、分式或一元一次方程", "进入薄弱练习", "启用双层适配机制", "P0"],
  ["SCOPE-02", "白名单", "选择白名单外知识点", "进入练习", "沿用原推送逻辑和页面样式，不触发专属问卷", "P0"],
  ["TEACH-01", "教师统计", "班级已有适配记录", "打开教师端首页或统计页", "显示控制感、认知负荷、VARK分布和主动求助数量", "P0"],
  ["TEACH-02", "学生档案", "班级学生有VARK与自评历史", "教师查看学生详情", "显示原始答案、控制感、Q3、偏好与决策历史", "P0"],
  ["ADMIN-01", "管理统计", "管理员登录", "打开统计页和用户档案", "可跨班级查看分布与完整历史", "P1"],
  ["PERM-01", "权限", "教师A尝试访问非所教班级学生", "请求学生适配历史接口", "返回拒绝访问，不泄露记录", "P0"],
  ["PERM-02", "隐私", "学生登录", "直接请求教师或管理员接口", "返回403或等效拒绝", "P0"],
  ["PERSIST-01", "持久化", "已完成VARK、自评和决策", "重启后端并重新登录", "历史结果和有效期仍存在", "P0"],
  ["LONG-01", "长期校正", "至少完成6个有效轮次", "检查长期学习效果事件", "可形成建议增加第二通道的证据事件，但不覆盖原始问卷答案", "P2"],
  ["PAPER-01", "试卷管理", "教师已有试卷", "点击查看", "正常显示试卷信息和题目", "P1"],
  ["PAPER-02", "试卷管理", "教师已有可删除或归档试卷", "执行删除并确认", "列表刷新且数据按安全策略删除或归档，不影响无关记录", "P1"],
];

async function buildTestWorkbook() {
  const wb = Workbook.create();
  const sheet = wb.worksheets.add("测试用例");
  styleTitle(sheet, "智析数学双层学情适配功能测试用例", "范围：VARK、五题轮次、轮后自评、两层适配、权限、持久化和教师端功能", "L");
  const headers = ["用例编号", "模块", "前置条件", "测试步骤", "预期结果", "优先级", "实际结果", "执行状态", "证据文件", "测试人", "执行日期", "备注"];
  sheet.getRange("A6:L6").values = [headers];
  styleHeader(sheet.getRange("A6:L6"));
  const rows = testCases.map((r) => [...r, "", "未执行", "", "", "", ""]);
  sheet.getRange(`A7:L${6 + rows.length}`).values = rows;
  setBase(sheet, sheet.getRange(`A6:L${6 + rows.length}`));
  sheet.getRange(`A7:L${6 + rows.length}`).format.wrapText = true;
  sheet.getRange(`A7:L${6 + rows.length}`).format.fill = "#FFFFFF";
  sheet.getRange(`A8:L${6 + rows.length}`).format.fill = pale;
  sheet.getRange(`A7:B${6 + rows.length}`).format.horizontalAlignment = "center";
  sheet.getRange(`F7:H${6 + rows.length}`).format.horizontalAlignment = "center";
  sheet.getRange(`J7:K${6 + rows.length}`).format.horizontalAlignment = "center";
  sheet.getRange(`A6:L${6 + rows.length}`).format.borders = { bottom: { color: line, style: "thin" } };
  sheet.getRange(`A6:L${6 + rows.length}`).format.autofitRows();
  const widths = [13, 14, 25, 30, 38, 9, 28, 10, 28, 10, 12, 24];
  widths.forEach((w, i) => sheet.getRangeByIndexes(5, i, rows.length + 1, 1).format.columnWidth = w);
  sheet.freezePanes.freezeRows(6);
  sheet.freezePanes.freezeColumns(2);
  sheet.tables.add(`A6:L${6 + rows.length}`, true, "AdaptiveTestCases");
  sheet.getRange(`H7:H${6 + rows.length}`).dataValidation = { rule: { type: "list", values: ["未执行", "通过", "失败", "阻塞", "不适用"] } };
  sheet.getRange(`F7:F${6 + rows.length}`).dataValidation = { rule: { type: "list", values: ["P0", "P1", "P2", "P3"] } };
  sheet.getRange(`H7:H${6 + rows.length}`).conditionalFormats.addCustom('=H7="通过"', { fill: green, font: { color: "#375623", bold: true } });
  sheet.getRange(`H7:H${6 + rows.length}`).conditionalFormats.addCustom('=H7="失败"', { fill: red, font: { color: "#9C0006", bold: true } });
  sheet.getRange(`H7:H${6 + rows.length}`).conditionalFormats.addCustom('=H7="阻塞"', { fill: amber, font: { color: "#7F6000", bold: true } });

  const stats = wb.worksheets.add("执行统计");
  styleTitle(stats, "测试执行统计", "状态由测试用例页自动汇总", "F");
  stats.getRange("A6:B11").values = [
    ["指标", "数量"],
    ["用例总数", testCases.length],
    ["未执行", null],
    ["通过", null],
    ["失败", null],
    ["阻塞", null],
  ];
  styleHeader(stats.getRange("A6:B6"));
  stats.getRange("B8").formulas = [[`=COUNTIF('测试用例'!H7:H${6 + rows.length},"未执行")`]];
  stats.getRange("B9").formulas = [[`=COUNTIF('测试用例'!H7:H${6 + rows.length},"通过")`]];
  stats.getRange("B10").formulas = [[`=COUNTIF('测试用例'!H7:H${6 + rows.length},"失败")`]];
  stats.getRange("B11").formulas = [[`=COUNTIF('测试用例'!H7:H${6 + rows.length},"阻塞")`]];
  setBase(stats, stats.getRange("A6:B11"));
  stats.getRange("A7:A11").format.fill = blue;
  stats.getRange("A6:B11").format.borders = { bottom: { color: line, style: "thin" } };
  stats.getRange("A6:A11").format.columnWidth = 24;
  stats.getRange("B6:B11").format.columnWidth = 14;
  stats.getRange("B7:B11").format.horizontalAlignment = "right";
  stats.getRange("D6:F9").values = [
    ["填写说明", "", ""],
    ["1", "执行后填写实际结果、状态和证据文件", ""],
    ["2", "失败项必须在Bug台账建立对应记录", ""],
    ["3", "性能和浏览器截图必须来自真实运行", ""],
  ];
  stats.getRange("D6:F6").merge();
  styleHeader(stats.getRange("D6:F6"));
  stats.getRange("E7:F9").merge(true);
  setBase(stats, stats.getRange("D6:F9"));
  stats.getRange("D6:F9").format.wrapText = true;
  stats.getRange("D6:D9").format.columnWidth = 8;
  stats.getRange("E6:F9").format.columnWidth = 22;
  stats.getRange("D6:F9").format.borders = { bottom: { color: line, style: "thin" } };
  wb.recalculate();
  const preview = await wb.render({ sheetName: "测试用例", range: `A1:L${Math.min(20, 6 + rows.length)}`, scale: 1.2, format: "png" });
  await fs.writeFile(path.join(previewDir, "test-cases-preview.png"), new Uint8Array(await preview.arrayBuffer()));
  const file = await SpreadsheetFile.exportXlsx(wb);
  await file.save(path.join(outputDir, "02-1_双层学情适配功能测试用例记录表.xlsx"));
}

const bugs = [
  ["D01", "2026-10-25", "学生端作业提交", "V2.0", "本地开发环境", "未答满题目时点击交卷只显示提交失败", "学生只完成4/5题后点击交卷", "前端明确阻止提交并提示剩余未答题目", "发起请求后显示笼统提交失败，用户无法判断原因", "中", "P1", "已修复待回归", "前端提交前完整性校验和错误映射不足", "a610d57", "补充完整性校验、错误码映射和重复结果处理", "待按PAPER以外学生流程回归", "", "", "", ""],
  ["D02", "2026-10-25", "VARK触发", "V2.0", "本地开发环境", "进入白名单薄弱练习时VARK问卷未弹出", "使用无有效偏好学生进入薄弱练习", "后端返回varkDue后阻断题目并强制弹出问卷", "页面直接进入练习或仍使用旧状态", "高", "P0", "已修复待回归", "适配状态读取与前端入口时序不一致，运行进程可能仍加载旧代码", "a610d57", "统一进入练习前的状态检查并增加结果确认流程", "待Chrome和Edge回归", "", "", "", ""],
  ["D03", "2026-10-25", "教师端试卷管理", "V2.0", "本地开发环境", "试卷无法查看且删除无效", "教师登录后在试卷管理点击查看或删除", "查看显示试卷详情；删除或归档后列表刷新", "查看无响应，删除后记录仍显示", "高", "P0", "已修复待回归", "前端操作和后端路由返回契约不一致", "a610d57", "修正查看流程和安全删除或归档逻辑", "待教师账号回归", "", "", "", ""],
  ["D04", "2026-10-25", "VARK问卷", "V2.0", "本地开发环境", "问卷只显示数字1至5，学生不清楚含义", "打开VARK问卷并查看任一题选项", "每个数字同时显示完整语义标签", "仅显示数字，缺少量表解释", "中", "P1", "已修复待回归", "选项组件只渲染分值，未渲染量表文字", "a610d57", "增加1至5分完整说明并保持每题可见", "待学生端视觉回归", "", "", "", ""],
];

async function buildBugWorkbook() {
  const wb = Workbook.create();
  const sheet = wb.worksheets.add("Bug台账");
  styleTitle(sheet, "智析数学双层学情适配 Bug 台账", "只登记实际发现并能够复现的缺陷，不预填虚拟问题", "T");
  const headers = ["缺陷编号", "发现日期", "模块", "发现版本", "环境", "缺陷摘要", "复现步骤", "预期结果", "实际结果", "严重程度", "优先级", "状态", "根因", "修复提交", "修复说明", "回归结果", "证据文件", "负责人", "关闭日期", "备注"];
  sheet.getRange("A6:T6").values = [headers];
  styleHeader(sheet.getRange("A6:T6"));
  sheet.getRange(`A7:T${6 + bugs.length}`).values = bugs;
  setBase(sheet, sheet.getRange(`A6:T${6 + bugs.length}`));
  sheet.getRange(`A7:T${6 + bugs.length}`).format.wrapText = true;
  sheet.getRange(`A7:T${6 + bugs.length}`).format.fill = "#FFFFFF";
  sheet.getRange(`A8:T${6 + bugs.length}`).format.fill = pale;
  sheet.getRange(`A7:E${6 + bugs.length}`).format.horizontalAlignment = "center";
  sheet.getRange(`J7:L${6 + bugs.length}`).format.horizontalAlignment = "center";
  sheet.getRange(`N7:N${6 + bugs.length}`).format.horizontalAlignment = "center";
  sheet.getRange(`R7:S${6 + bugs.length}`).format.horizontalAlignment = "center";
  sheet.getRange(`A6:T${6 + bugs.length}`).format.borders = { bottom: { color: line, style: "thin" } };
  sheet.getRange(`A6:T${6 + bugs.length}`).format.autofitRows();
  const widths = [11, 12, 18, 11, 18, 28, 34, 34, 34, 10, 9, 15, 30, 12, 34, 28, 26, 12, 12, 24];
  widths.forEach((w, i) => sheet.getRangeByIndexes(5, i, bugs.length + 1, 1).format.columnWidth = w);
  sheet.freezePanes.freezeRows(6);
  sheet.freezePanes.freezeColumns(2);
  sheet.tables.add(`A6:T${6 + bugs.length}`, true, "AdaptiveBugLedger");
  sheet.getRange(`J7:J${6 + bugs.length}`).dataValidation = { rule: { type: "list", values: ["致命", "高", "中", "低"] } };
  sheet.getRange(`K7:K${6 + bugs.length}`).dataValidation = { rule: { type: "list", values: ["P0", "P1", "P2", "P3"] } };
  sheet.getRange(`L7:L${6 + bugs.length}`).dataValidation = { rule: { type: "list", values: ["新建", "处理中", "已修复待回归", "已关闭", "延期"] } };
  sheet.getRange(`L7:L${6 + bugs.length}`).conditionalFormats.addCustom('=L7="已关闭"', { fill: green, font: { color: "#375623", bold: true } });
  sheet.getRange(`L7:L${6 + bugs.length}`).conditionalFormats.addCustom('=L7="已修复待回归"', { fill: amber, font: { color: "#7F6000", bold: true } });
  const stats = wb.worksheets.add("缺陷统计");
  styleTitle(stats, "缺陷统计", "状态由Bug台账自动汇总", "F");
  stats.getRange("A6:B12").values = [["指标", "数量"], ["缺陷总数", bugs.length], ["新建", null], ["处理中", null], ["已修复待回归", null], ["已关闭", null], ["延期", null]];
  styleHeader(stats.getRange("A6:B6"));
  ["新建", "处理中", "已修复待回归", "已关闭", "延期"].forEach((status, i) => {
    stats.getRange(`B${8 + i}`).formulas = [[`=COUNTIF('Bug台账'!L7:L${6 + bugs.length},"${status}")`]];
  });
  setBase(stats, stats.getRange("A6:B12"));
  stats.getRange("A7:A12").format.fill = blue;
  stats.getRange("A6:B12").format.borders = { bottom: { color: line, style: "thin" } };
  stats.getRange("A6:A12").format.columnWidth = 24;
  stats.getRange("B6:B12").format.columnWidth = 14;
  wb.recalculate();
  const preview = await wb.render({ sheetName: "Bug台账", range: `A1:T${6 + bugs.length}`, scale: 1, format: "png" });
  await fs.writeFile(path.join(previewDir, "bug-ledger-preview.png"), new Uint8Array(await preview.arrayBuffer()));
  const file = await SpreadsheetFile.exportXlsx(wb);
  await file.save(path.join(outputDir, "02-2_Bug台账_双层学情适配.xlsx"));
}

await buildTestWorkbook();
await buildBugWorkbook();
console.log(JSON.stringify({ testCases: testCases.length, bugs: bugs.length, outputDir, previewDir }, null, 2));
