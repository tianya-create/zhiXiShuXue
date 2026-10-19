const db = require('../database/memory-db');

const KNOWLEDGE_GRAPH = [
  ['kp-001', '数与式', '', 1, 101, [], '数与式的基础概念与运算'],
  ['kp-001-01', '有理数', 'kp-001', 2, 111, [], '理解有理数、相反数、绝对值与数轴'],
  ['kp-001-01-01', '正负数与数轴', 'kp-001-01', 3, 112, [], '掌握正负数、相反数、绝对值与数轴表示'],
  ['kp-001-01-02', '整数的加减', 'kp-001-01', 3, 113, ['kp-001-01-01'], '掌握整数加减法则与符号变化'],
  ['kp-001-01-03', '有理数的加减法', 'kp-001-01', 3, 114, ['kp-001-01-02'], '掌握同号、异号有理数加减计算'],
  ['kp-001-01-04', '有理数的乘除法', 'kp-001-01', 3, 115, ['kp-001-01-03'], '掌握有理数乘除法及符号法则'],
  ['kp-001-02', '实数', 'kp-001', 2, 121, ['kp-001-01'], '理解实数、平方根、立方根与无理数'],
  ['kp-001-02-01', '平方根与立方根', 'kp-001-02', 3, 122, ['kp-001-01'], '掌握平方根、算术平方根与立方根'],
  ['kp-001-02-02', '无理数与实数比较', 'kp-001-02', 3, 123, ['kp-001-02-01'], '理解无理数概念并会比较实数大小'],

  ['kp-002', '整式与因式分解', '', 1, 201, ['kp-001'], '整式运算、乘法公式与因式分解'],
  ['kp-002-01', '整式的加减', 'kp-002', 2, 211, ['kp-001'], '掌握同类项合并与整式加减'],
  ['kp-002-01-01', '单项式与多项式', 'kp-002-01', 3, 212, ['kp-001'], '认识单项式、多项式及次数'],
  ['kp-002-01-02', '同类项与合并', 'kp-002-01', 3, 213, ['kp-002-01-01'], '掌握同类项判断与合并'],
  ['kp-002-01-03', '去括号与整式化简', 'kp-002-01', 3, 214, ['kp-002-01-02'], '掌握去括号法则和整式化简'],
  ['kp-002-02', '乘法公式', 'kp-002', 2, 221, ['kp-002-01'], '掌握平方差、完全平方公式'],
  ['kp-002-02-01', '平方差公式', 'kp-002-02', 3, 222, ['kp-002-01'], '掌握平方差公式的识别与应用'],
  ['kp-002-02-02', '完全平方公式', 'kp-002-02', 3, 223, ['kp-002-01'], '掌握完全平方公式的展开与逆用'],
  ['kp-002-03', '因式分解', 'kp-002', 2, 231, ['kp-002-02'], '掌握提公因式与公式法因式分解'],
  ['kp-002-03-01', '提公因式法', 'kp-002-03', 3, 232, ['kp-002-01'], '掌握提取公因式进行因式分解'],
  ['kp-002-03-02', '公式法因式分解', 'kp-002-03', 3, 233, ['kp-002-02'], '掌握利用乘法公式进行因式分解'],

  ['kp-003', '方程与不等式', '', 1, 301, ['kp-001', 'kp-002'], '方程、不等式及其应用'],
  ['kp-003-01', '一元一次方程', 'kp-003', 2, 311, ['kp-001', 'kp-002-01'], '掌握移项、去括号与求解'],
  ['kp-003-01-01', '等式性质', 'kp-003-01', 3, 312, ['kp-001'], '理解等式两边同加同减同乘同除的性质'],
  ['kp-003-01-02', '移项求解', 'kp-003-01', 3, 313, ['kp-003-01-01'], '掌握移项与合并同类项求解方程'],
  ['kp-003-01-03', '去括号与去分母', 'kp-003-01', 3, 314, ['kp-002-01-03'], '掌握含括号、含分母方程的化简求解'],
  ['kp-003-01-04', '一元一次方程应用', 'kp-003-01', 3, 315, ['kp-003-01-02'], '掌握列一元一次方程解决实际问题'],
  ['kp-003-02', '二元一次方程组', 'kp-003', 2, 321, ['kp-003-01'], '掌握代入法与加减法解方程组'],
  ['kp-003-02-01', '代入法', 'kp-003-02', 3, 322, ['kp-003-01'], '掌握代入法解二元一次方程组'],
  ['kp-003-02-02', '加减法', 'kp-003-02', 3, 323, ['kp-003-01'], '掌握加减消元法解二元一次方程组'],
  ['kp-003-03', '不等式与不等式组', 'kp-003', 2, 331, ['kp-003-01'], '掌握不等式性质、解法与数轴表示'],
  ['kp-003-03-01', '不等式性质', 'kp-003-03', 3, 332, ['kp-003-01'], '掌握不等式基本性质及变号规则'],
  ['kp-003-03-02', '一元一次不等式', 'kp-003-03', 3, 333, ['kp-003-01'], '掌握一元一次不等式的解法'],
  ['kp-003-03-03', '一元一次不等式组', 'kp-003-03', 3, 334, ['kp-003-03-02'], '掌握一元一次不等式组解集表示'],

  ['kp-004', '函数', '', 1, 401, ['kp-003'], '函数概念与图像表示'],
  ['kp-004-01', '平面直角坐标系', 'kp-004', 2, 411, ['kp-001'], '掌握坐标系、象限与点的位置'],
  ['kp-004-01-01', '点的坐标表示', 'kp-004-01', 3, 412, ['kp-001'], '掌握有序数对与点的位置表示'],
  ['kp-004-01-02', '象限与坐标特征', 'kp-004-01', 3, 413, ['kp-004-01-01'], '掌握四个象限点的符号特征'],
  ['kp-004-02', '一次函数', 'kp-004', 2, 421, ['kp-004-01', 'kp-003-01'], '掌握一次函数解析式、图像与性质'],
  ['kp-004-02-01', '正比例函数', 'kp-004-02', 3, 422, ['kp-004-01'], '掌握正比例函数图像与性质'],
  ['kp-004-02-02', '一次函数图像', 'kp-004-02', 3, 423, ['kp-004-01'], '掌握一次函数图像画法与斜率意义'],
  ['kp-004-03', '反比例函数', 'kp-004', 2, 431, ['kp-004-01', 'kp-003-01'], '掌握反比例函数图像与性质'],
  ['kp-004-03-01', '反比例函数图像', 'kp-004-03', 3, 432, ['kp-004-01'], '掌握双曲线图像分布特征'],
  ['kp-004-03-02', '反比例函数性质', 'kp-004-03', 3, 433, ['kp-004-03-01'], '掌握增减性与象限分布'],
  ['kp-004-04', '二次函数', 'kp-004', 2, 441, ['kp-004-01', 'kp-002-02'], '掌握二次函数图像、顶点与最值'],
  ['kp-004-04-01', '顶点与对称轴', 'kp-004-04', 3, 442, ['kp-004-01'], '掌握抛物线顶点与对称轴求法'],
  ['kp-004-04-02', '开口方向与最值', 'kp-004-04', 3, 443, ['kp-004-04-01'], '掌握抛物线开口方向与最值判断'],
  ['kp-004-04-03', '二次函数图像平移', 'kp-004-04', 3, 444, ['kp-004-04-01'], '掌握二次函数图像的平移变换'],

  ['kp-005', '图形与几何', '', 1, 501, [], '几何基本图形、三角形与圆'],
  ['kp-005-01', '几何初步', 'kp-005', 2, 511, [], '理解直线、射线、线段、角等基础图形'],
  ['kp-005-01-01', '线段射线直线', 'kp-005-01', 3, 512, [], '区分线段、射线、直线的基本性质'],
  ['kp-005-01-02', '角与角平分线', 'kp-005-01', 3, 513, ['kp-005-01-01'], '掌握角的分类和角平分线概念'],
  ['kp-005-02', '相交线与平行线', 'kp-005', 2, 521, ['kp-005-01'], '掌握平行线性质与判定'],
  ['kp-005-02-01', '同位角内错角同旁内角', 'kp-005-02', 3, 522, ['kp-005-01-02'], '掌握截线形成的特殊角关系'],
  ['kp-005-02-02', '平行线的性质与判定', 'kp-005-02', 3, 523, ['kp-005-02-01'], '掌握平行线性质和判定方法'],
  ['kp-005-03', '三角形', 'kp-005', 2, 531, ['kp-005-02'], '掌握三角形内角和、全等与相似'],
  ['kp-005-03-01', '三角形内角和', 'kp-005-03', 3, 532, ['kp-005-02'], '掌握三角形内角和及外角性质'],
  ['kp-005-03-02', '全等三角形', 'kp-005-03', 3, 533, ['kp-005-03-01'], '掌握全等判定与性质'],
  ['kp-005-03-03', '相似三角形', 'kp-005-03', 3, 534, ['kp-005-03-02'], '掌握相似判定、性质与应用'],
  ['kp-005-04', '圆', 'kp-005', 2, 541, ['kp-005-03'], '掌握圆心角、圆周角与切线性质'],
  ['kp-005-04-01', '半径直径与弦', 'kp-005-04', 3, 542, ['kp-005-01'], '掌握圆的基本元素与关系'],
  ['kp-005-04-02', '圆心角与圆周角', 'kp-005-04', 3, 543, ['kp-005-04-01'], '掌握圆心角与圆周角关系'],
  ['kp-005-04-03', '切线性质', 'kp-005-04', 3, 544, ['kp-005-04-02'], '掌握切线判定与性质'],

  ['kp-006', '统计与概率', '', 1, 601, [], '数据整理、统计分析与概率'],
  ['kp-006-01', '数据的收集与整理', 'kp-006', 2, 611, [], '掌握调查、整理与统计图表'],
  ['kp-006-01-01', '调查方式与样本', 'kp-006-01', 3, 612, [], '掌握普查、抽样与样本概念'],
  ['kp-006-01-02', '统计图表', 'kp-006-01', 3, 613, ['kp-006-01-01'], '掌握条形图、扇形图等图表阅读'],
  ['kp-006-02', '数据分析', 'kp-006', 2, 621, ['kp-006-01'], '掌握平均数、中位数、众数与方差'],
  ['kp-006-02-01', '平均数中位数众数', 'kp-006-02', 3, 622, ['kp-006-01'], '掌握集中趋势指标的意义和计算'],
  ['kp-006-02-02', '方差与波动性', 'kp-006-02', 3, 623, ['kp-006-02-01'], '掌握方差反映数据波动程度'],
  ['kp-006-03', '概率初步', 'kp-006', 2, 631, ['kp-006-01'], '掌握简单随机事件概率的意义与计算'],
  ['kp-006-03-01', '随机事件与概率', 'kp-006-03', 3, 632, ['kp-006-01'], '理解随机事件与概率意义'],
  ['kp-006-03-02', '简单概率计算', 'kp-006-03', 3, 633, ['kp-006-03-01'], '掌握简单等可能事件概率计算']
].map(([id, name, parentId, level, order, prerequisiteIds, description]) => ({
  id,
  name,
  parentId,
  level,
  order,
  prerequisiteIds,
  description
}));

const LEAF_KNOWLEDGE_POINTS = KNOWLEDGE_GRAPH.filter(item => !KNOWLEDGE_GRAPH.some(other => other.parentId === item.id));

const DIFFICULTY_LABELS = { easy: '基础', medium: '中等', hard: '提升' };
const TYPE_LABELS = { choice: '选择', fill: '填空', shortAnswer: '解答' };
const TYPES = ['choice', 'fill', 'shortAnswer'];
const DIFFS = ['easy', 'medium', 'hard'];

function ensureCollection(name) { if (!Array.isArray(db.data[name])) db.data[name] = []; }
function difficultyRank(level) { return level === 'easy' ? 1 : level === 'medium' ? 2 : 3; }
function getStudentId(id) { const s = db.findById('students', id) || db.findOne('students', { userId: id }); return s ? s.id : id; }
function getKnowledgePoint(id) { return db.findById('knowledgePoints', id) || KNOWLEDGE_GRAPH.find(item => item.id === id) || null; }

function ensureKnowledgeGraph() {
  ['studentKnowledgeProfiles', 'studentQuestionAttempts', 'wrongQuestionRecords', 'recommendationLogs'].forEach(ensureCollection);
  KNOWLEDGE_GRAPH.forEach((item) => {
    const payload = { ...item, category: 'junior-math' };
    const existed = db.findById('knowledgePoints', item.id);
    existed ? db.updateById('knowledgePoints', item.id, payload) : db.create('knowledgePoints', payload);
  });
}

function buildQuestion(topic, type, difficulty, seed) {

  const n = seed + difficultyRank(difficulty);
  const difficultyValue = difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.6 : 0.85;
  const discrimination = 0.3 + (Math.random() * 0.5); // 随机生成 0.3-0.8 之间的区分度

  const map = {
    '数与式': {
      choice: [`若 a=${n}，b=-${n - 1}，则 a+b 的值是？`, ['1', `${n}`, `${2 * n - 1}`, `${n + 1}`], '1', '有理数加法：同号相加取相同符号并把绝对值相加，异号相加取绝对值大的符号。', 'a + b', '异号相加时容易忘记符号。'],
      fill: [`化简：${n + 3}-(${n - 2})=____。`, [], '5', '去括号法则：括号前是负号，去掉括号后里面各项都要变号。', 'a - (b - c) = a - b + c', '负负得正容易出错。'],
      shortAnswer: [`已知 x=${n}，y=-${n - 1}，请写出求 x-y 与 x+y 的步骤。`, [], `先代入数值，再计算 x-y=${2 * n - 1}，x+y=1。`, '有理数混合运算：先乘方，再乘除，最后加减。', '代数式求值', '代入负数时未加括号。']
    },
    '整式与因式分解': {
      choice: [`下列式子中，能因式分解为 (x+${n})(x-${n}) 的是？`, [`x²-${n * n}`, `x²+${n * n}`, `x²-${2 * n}x`, `x²+${2 * n}x`], `x²-${n * n}`, '平方差公式：两个数的平方差等于这两个数的和与这两个数的差的积。', 'a² - b² = (a+b)(a-b)', '容易与完全平方公式混淆。'],
      fill: [`分解因式：x²-${n * n}=____。`, [], `(x+${n})(x-${n})`, '因式分解步骤：先提公因式，再看公式法。', '提公因式 & 公式法', '分解不彻底。'],
      shortAnswer: [`请说明 x²+${2 * n}x+${n * n} 的因式分解过程。`, [], `利用完全平方公式，原式=(x+${n})²。`, '完全平方公式：首平方，尾平方，积的二倍在中央。', '(a±b)² = a² ± 2ab + b²', '中间项符号看错。']
    },
    '方程基础': {
      choice: [`方程 2x+${n}=${3 * n} 的解为？`, [`${n - 1}`, `${n}`, `${n + 1}`, `${n + 2}`], `${n}`, '等式的基本性质：等式两边同时加减乘除（除数不为0）同一个数，等式仍然成立。', 'ax + b = c', '移项不换号。'],
      fill: [`解方程：x-${n}=${n + 4}，则 x=____。`, [], `${2 * n + 4}`, '解一元一次方程步骤：去分母、去括号、移项、合并同类项、系数化为1。', 'x = b/a', '去分母时漏乘常数项。'],
      shortAnswer: [`请解方程 3x-${n}=2x+${n + 2}。`, [], `移项得 x=${2 * n + 2}。`, '移项法则：把方程中的某一项移到另一边时，一定要变号。', '移项变号', '移项忘记变号。']
    },
    '方程与不等式': {
      choice: [`不等式 x+${n}>${n + 6} 的解集是？`, ['x>6', `x>${n}`, `x>${n + 6}`, `x<${n + 6}`], 'x>6', '不等式的性质：两边同时乘或除以一个负数，不等号方向改变。', 'x + a > b', '除以负数不改变不等号方向。'],
      fill: [`解不等式 2x<${4 * n}，则 x<____。`, [], `${2 * n}`, '一元一次不等式解法与方程类似，注意变号。', 'ax < b', '负数除法忘记变号。'],
      shortAnswer: [`请解不等式组 {x>${n - 1}，x≤${n + 3}}。`, [], `${n - 1}<x≤${n + 3}`, '不等式组的解集：同大取大，同小取小，大小小大中间找，大大小小找不着。', '不等式组解集', '数轴表示错误。']
    },
    '函数': {
      choice: ['下列关系中，属于函数关系的是？', ['每个x只对应一个y', '一个x对应多个y', '没有自变量', '函数值恒不变'], '每个x只对应一个y', '函数的定义：对于每一个自变量x，都有唯一确定的y与之对应。', 'y = f(x)', '一对多关系误判为函数。'],
      fill: [`函数 y=${n}x+1 中，当 x=2 时，y=____。`, [], `${2 * n + 1}`, '自变量的取值范围：使解析式有意义，且符合实际情况。', '函数求值', '自变量取值范围判断错误。'],
      shortAnswer: [`请结合 y=${n}x-3 说明如何判断一个关系是否是函数。`, [], '判断标准是每个自变量只能对应唯一函数值。', '函数的表示方法：解析法、列表法、图像法。', '三位一体', '混淆自变量与因变量。']
    },
    '一次与反比例函数': {
      choice: [`一次函数 y=${n}x-1 的图像一定经过哪一象限？`, ['第一、三象限', '第二、四象限', '第一、二、三象限', '四个象限都可能'], '第一、三象限', '一次函数性质：k>0图像过一、三象限，k<0图像过二、四象限。', 'y = kx + b', '忽略截距b对象限的影响。'],
      fill: [`反比例函数 y=${2 * n}/x 中，当 x=${n} 时，y=____。`, [], '2', '反比例函数图像：k>0过一、三象限，k<0过二、四象限。', 'y = k/x', '双曲线分支画反。'],
      shortAnswer: ['请比较一次函数与反比例函数图像特征。', [], '一次函数图像是直线，反比例函数图像是双曲线。', '函数增减性：观察图像从左向右是上升还是下降。', '增减性判断', '忽略反比例函数在每一象限内的增减性。']
    },
    '二次函数': {
      choice: [`二次函数 y=x²-${2 * n}x 的对称轴是？`, [`x=${n}`, `x=${2 * n}`, `x=-${n}`, 'x=0'], `x=${n}`, '二次函数顶点式：y=a(x-h)²+k，顶点坐标为(h,k)。', 'x = -b/2a', '对称轴公式记错。'],
      fill: [`抛物线 y=(x-${n})²+1 的顶点坐标是____。`, [], `(${n},1)`, '二次函数性质：a>0开口向上，有最小值；a<0开口向下，有最大值。', '顶点 (h, k)', '平移方向（左加右减）弄混。'],
      shortAnswer: [`请说明二次函数 y=x²-${2 * n}x+${n * n - 1} 的开口方向、对称轴和最小值。`, [], `开口向上，对称轴是 x=${n}，最小值是 -1。`, '二次函数图像平移：左加右减，上加下减。', '平移法则', '最值与顶点坐标y值混淆。']
    },
    '几何': {
      choice: [`一个角比它的余角大 ${n * 5}°，则这个角是？`, ['35°', '45°', '55°', '65°'], '55°', '余角与补角：和为90°互为余角，和为180°互为补角。', 'α + β = 90°/180°', '补角与余角定义记反。'],
      fill: [`若∠A=${n * 10}°，其补角为____°。`, [], `${180 - n * 10}`, '平行线性质：同位角相等，内错角相等，同旁内角互补。', '平行线判定/性质', '判定与性质逆用。'],
      shortAnswer: ['请说明平行线性质“同位角相等”的一个基本用法。', [], '可把未知角转化为已知角，用于角度计算和证明。', '角平分线：将一个角分成两个相等角的射线。', '角平分线', '角平分线性质漏掉距离相等。']
    },
    '三角形': {
      choice: [`三角形两个内角分别为 ${n * 10}° 和 ${n * 5}°，第三个角为？`, ['30°', '45°', '60°', `${180 - 15 * n}°`], `${180 - 15 * n}°`, '三角形内角和定理：三角形三个内角的和等于180°。', '∠A+∠B+∠C=180°', '外角等于不相邻两内角和漏掉。'],
      fill: [`等腰三角形顶角为 ${n * 10}°，则每个底角为____°。`, [], `${(180 - n * 10) / 2}`, '等腰三角形性质：等边对等角，三线合一。', '三线合一', '底角与顶角分不清。'],
      shortAnswer: ['请写出一个判断三角形全等的条件。', [], '例如边角边、角边角或边边边。', '三角形全等判定：SSS, SAS, ASA, AAS, HL(直角三角形)。', '判定定理', 'SSA误判为全等。']
    },
    '圆': {
      choice: [`半径为 ${n} 的圆，其直径是？`, [`${n}`, `${2 * n}`, `${3 * n}`, `${4 * n}`], `${2 * n}`, '圆的定义：平面内到定点的距离等于定长的点的集合。', 'd = 2r', '直径与半径关系弄错。'],
      fill: [`若圆的直径为 ${2 * n}，则半径为____。`, [], `${n}`, '圆周角定理：同弧所对的圆周角等于圆心角的一半。', '圆周角=1/2圆心角', '圆心角与圆周角位置看错。'],
      shortAnswer: ['请说明圆周角与同弧所对圆心角的关系。', [], '同弧所对圆周角等于圆心角的一半。', '切线的性质：圆的切线垂直于经过切点的半径。', '切线垂直半径', '切线判定条件漏掉经过半径外端。']
    },
    '统计与概率': {
      choice: ['抛掷一枚均匀硬币一次，正面朝上的概率是？', ['1/4', '1/3', '1/2', '1'], '1/2', '概率的定义：事件发生的可能性大小，范围在0到1之间。', 'P(A) = m/n', '不可能事件概率误认为1。'],
      fill: [`一组数据 2、4、${2 * n} 的平均数是____。`, [], `${Math.round((2 + 4 + 2 * n) / 3)}`, '概率计算：所有可能结果n，目标结果m，P=m/n。', '等可能事件', '计算漏掉样本总量。'],
      shortAnswer: ['请说明频率与概率的联系。', [], '频率会逐渐稳定并接近概率。', '频率与概率：大量重复试验中，频率趋于稳定值即为概率。', '稳定性', '频率等同于概率。']
    },
    '数据分析': {
      choice: ['下列哪个统计量更能反映数据波动大小？', ['平均数', '方差', '众数', '频率'], '方差', '方差：反映一组数据的波动大小，方差越小越稳定。', 'S² = Σ(x-μ)²/n', '方差大代表数据稳定。'],
      fill: ['数据 3、5、7、9 的中位数是____。', [], '6', '中位数：数据从小到大排列，中间的一个数或中间两个数的平均数。', '中位数', '排序前找中位数。'],
      shortAnswer: ['请说明平均数、中位数、众数在分析成绩时的作用。', [], '平均数看整体，中位数看中间水平，众数看最常见成绩。', '统计量的选择：根据分析目的选择合适的代表值。', '三数一差', '平均数受极端值影响。']
    }
  };
  const [content, options, answer, concept, formula, warning] = (map[topic.name] || {
    choice: [`关于“${topic.name}”的说法正确的是？`, ['A', 'B', 'C', 'D'], 'A', '基础定义', '无', '注意边界条件'],
    fill: [`请完成“${topic.name}”基础练习：结果为____。`, [], '略', '计算步骤', '无', '计算准确'],
    shortAnswer: [`请简述你解决“${topic.name}”相关题目时的基本思路。`, [], '先审题、再匹配方法、最后检查结果', '解题思路', '无', '逻辑清晰']
  })[type];
  return { type, content, options, answer, concept, formula, warning, score: difficulty === 'easy' ? 8 : difficulty === 'medium' ? 12 : 18, difficulty, difficultyLabel: DIFFICULTY_LABELS[difficulty], questionTypeLabel: TYPE_LABELS[type], knowledgePoints: [topic.id], knowledgePointId: topic.id, source: 'generated', curriculumTag: 'junior-math-structured-bank', uniqueKey: `${topic.id}-${type}-${difficulty}-${seed}`, discrimination, difficultyValue };
}

function ensureGeneratedQuestions(perKnowledgePoint) {
  ensureKnowledgeGraph();
  const existing = new Set(db.find('questions').map(item => item.content));
  const created = [];
  LEAF_KNOWLEDGE_POINTS.forEach(topic => {
    let count = 0, seed = 1;
    while (count < perKnowledgePoint && seed < perKnowledgePoint * 8) {
      const question = buildQuestion(topic, TYPES[Math.floor(count / DIFFS.length) % TYPES.length], DIFFS[count % DIFFS.length], seed);
      if (!existing.has(question.content)) { created.push(db.create('questions', question)); existing.add(question.content); count += 1; }
      seed += 1;
    }
  });
  return created;
}

function upsertStats(collection, query, initial, updater) {
  const existed = db.findOne(collection, query);
  const next = updater(existed ? { ...existed } : { ...initial });
  existed ? db.updateById(collection, existed.id, next) : db.create(collection, next);
}

function recordQuestionResults(studentLikeId, results, options = {}) {
  ensureKnowledgeGraph();
  const studentId = getStudentId(studentLikeId);
  const answeredAt = options.answeredAt || new Date().toISOString();
  const skipTypes = new Set(options.skipTypes || []);
  const saved = [];
  (results || []).forEach(result => {
    const question = db.findById('questions', result.questionId);
    if (!question || skipTypes.has(question.type)) return;
    const normalized = { questionId: question.id, correct: !!result.correct, answer: result.answer || '' };
    upsertStats('studentQuestionAttempts', { studentId, questionId: question.id }, { studentId, questionId: question.id, knowledgePoints: question.knowledgePoints || [], attemptCount: 0, correctCount: 0, wrongCount: 0 }, item => { item.attemptCount += 1; item.lastAnsweredAt = answeredAt; item.lastResult = normalized.correct ? 'correct' : 'wrong'; normalized.correct ? item.correctCount += 1 : item.wrongCount += 1; return item; });
    if (normalized.correct) {
      const wrong = db.findOne('wrongQuestionRecords', { studentId, questionId: question.id });
      if (wrong) db.updateById('wrongQuestionRecords', wrong.id, { status: 'resolved', lastCorrectAt: answeredAt });
    } else {
      upsertStats('wrongQuestionRecords', { studentId, questionId: question.id }, { studentId, questionId: question.id, knowledgePoints: question.knowledgePoints || [], firstWrongAt: answeredAt, wrongCount: 0 }, item => { item.lastWrongAt = answeredAt; item.lastAnswer = normalized.answer; item.status = 'active'; item.source = options.source || 'manual-record'; item.wrongCount += 1; return item; });
    }
    (question.knowledgePoints || []).forEach(knowledgePointId => upsertStats('studentKnowledgeProfiles', { studentId, knowledgePointId }, { studentId, knowledgePointId, attemptCount: 0, correctCount: 0, wrongCount: 0, masteryRate: 0, masteryLevel: 'low' }, item => { item.attemptCount += 1; normalized.correct ? item.correctCount += 1 : item.wrongCount += 1; item.masteryRate = item.attemptCount ? Math.round(item.correctCount / item.attemptCount * 100) : 0; item.masteryLevel = item.masteryRate >= 80 ? 'high' : (item.masteryRate >= 60 ? 'medium' : 'low'); return item; }));
    saved.push(normalized);
  });
  return saved;
}

function getQuestionBank(filters = {}) {
  ensureKnowledgeGraph();
  return db.find('questions').filter(item => {
    if (filters.knowledgePointId && !(item.knowledgePoints || []).includes(filters.knowledgePointId)) return false;
    if (filters.difficulty && item.difficulty !== filters.difficulty) return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.source && (item.source || 'example') !== filters.source) return false;
    return true;
  }).map(item => ({
    ...item,
    difficultyLabel: item.difficultyLabel || DIFFICULTY_LABELS[item.difficulty] || item.difficulty,
    questionTypeLabel: item.questionTypeLabel || TYPE_LABELS[item.type] || item.type,
    knowledgePointNames: (item.knowledgePoints || []).map(id => (getKnowledgePoint(id) || { name: id }).name)
  }));
}

function getWrongStats(studentLikeId) {
  ensureKnowledgeGraph();
  const studentId = getStudentId(studentLikeId);
  const wrongRecords = db.find('wrongQuestionRecords').filter(item => item.studentId === studentId);
  const profiles = db.find('studentKnowledgeProfiles').filter(item => item.studentId === studentId);
  const attempts = db.find('studentQuestionAttempts').filter(item => item.studentId === studentId);
  return {
    studentId,
    questionBook: wrongRecords,
    knowledgePointStats: KNOWLEDGE_GRAPH.map(topic => {
      const profile = profiles.find(item => item.knowledgePointId === topic.id);
      const relatedAttempts = attempts.filter(item => (item.knowledgePoints || []).includes(topic.id));
      const relatedWrong = wrongRecords.filter(item => (item.knowledgePoints || []).includes(topic.id));
      const attemptCount = relatedAttempts.reduce((sum, item) => sum + (item.attemptCount || 0), 0);
      const correctCount = relatedAttempts.reduce((sum, item) => sum + (item.correctCount || 0), 0);
      const wrongCount = relatedWrong.reduce((sum, item) => sum + (item.wrongCount || 0), 0);
      return {
        knowledgePointId: topic.id,
        knowledgePointName: topic.name,
        prerequisiteIds: topic.prerequisiteIds,
        wrongCount,
        wrongRate: attemptCount ? Math.round((attemptCount - correctCount) / attemptCount * 100) : 0,
        masteryRate: profile ? profile.masteryRate : (attemptCount ? Math.round(correctCount / attemptCount * 100) : 100),
        masteryLevel: profile ? profile.masteryLevel : (attemptCount && correctCount / attemptCount < 0.6 ? 'low' : attemptCount && correctCount / attemptCount < 0.8 ? 'medium' : 'high')
      };
    }).sort((a, b) => b.wrongRate - a.wrongRate || a.masteryRate - b.masteryRate)
  };
}

function recommendQuestions(studentLikeId, limit = 6) {
  ensureKnowledgeGraph();
  const studentId = getStudentId(studentLikeId);
  const stats = getWrongStats(studentId);
  const attempts = db.find('studentQuestionAttempts').filter(item => item.studentId === studentId);
  const solvedIds = new Set(attempts.filter(item => item.correctCount > 0).map(item => item.questionId));
  const picked = [];
  const pickedIds = new Set();
  const reasons = [];

  const addForKnowledgePoint = (knowledgePointId, allowedDifficulties, reason) => {
    getQuestionBank({ knowledgePointId })
      .filter(item => !solvedIds.has(item.id) && !pickedIds.has(item.id) && (!allowedDifficulties || allowedDifficulties.includes(item.difficulty)))
      .sort((a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty))
      .forEach(item => {
        if (picked.length >= limit) return;
        picked.push({ ...item, recommendationReason: reason });
        pickedIds.add(item.id);
      });
  };

  stats.knowledgePointStats
    .filter(item => item.wrongCount > 0 || item.masteryLevel !== 'high')
    .forEach(item => {
      if (picked.length >= limit) return;
      addForKnowledgePoint(
        item.knowledgePointId,
        ['easy', 'medium', 'hard'],
        `优先强化 ${item.knowledgePointName}：错误率 ${item.wrongRate}%，掌握度${item.masteryLevel === 'low' ? '低' : item.masteryLevel === 'medium' ? '中' : '高'}。`
      );
      if (item.wrongCount > 0) reasons.push(`${item.knowledgePointName}分层训练`);
      (item.prerequisiteIds || []).forEach(preId => {
        if (picked.length >= limit) return;
        const pre = getKnowledgePoint(preId);
        addForKnowledgePoint(preId, ['easy'], `同步巩固前置知识 ${pre ? pre.name : preId} 的基础题。`);
        if (pre) reasons.push(`巩固前置知识${pre.name}`);
      });
    });

  if (!picked.length) {
    getQuestionBank({ source: 'generated' })
      .sort((a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty))
      .forEach(item => {
        if (picked.length >= limit || solvedIds.has(item.id) || pickedIds.has(item.id)) return;
        picked.push({ ...item, recommendationReason: '当前整体掌握较好，推荐综合巩固题保持训练多样性。' });
        pickedIds.add(item.id);
      });
    reasons.push('综合巩固当前知识结构');
  }

  const recommendationReason = reasons.length
    ? `本次推荐重点：${[...new Set(reasons)].slice(0, 4).join('；')}。`
    : '本次推荐以基础巩固与前置知识回补为主。';

  db.create('recommendationLogs', {
    studentId,
    questionIds: picked.map(item => item.id),
    reason: recommendationReason
  });

  return {
    studentId,
    recommendationReason,
    focusKnowledgePoints: stats.knowledgePointStats.slice(0, 3).map(item => item.knowledgePointName),
    questions: picked
  };
}

function getPersonalizedRecommendations(studentLikeId, limit = 15) {
  ensureKnowledgeGraph();
  const studentId = getStudentId(studentLikeId);
  const attempts = db.find('studentQuestionAttempts').filter(item => item.studentId === studentId);
  const now = Date.now();
  const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);

  // 1. 计算用户能力估值 (正确回答题目的平均难度)
  const correctAttempts = attempts.filter(a => a.correctCount > 0);
  let abilityValue = 0.5; // 默认中等难度
  if (correctAttempts.length > 0) {
    const totalDifficulty = correctAttempts.reduce((sum, a) => {
      const q = db.findById('questions', a.questionId);
      return sum + (q ? (q.difficultyValue || 0.5) : 0.5);
    }, 0);
    abilityValue = totalDifficulty / correctAttempts.length;
  }

  // 2. 计算每个知识点的掌握度（引入时间衰减）
  const kpStats = {};
  db.find('knowledgePoints').forEach(kp => {
    kpStats[kp.id] = { 
      id: kp.id, 
      name: kp.name, 
      correctCount: 0, 
      totalCount: 0, 
      mastery: 100, 
      lastAnsweredAt: 0,
      concept: kp.concept,
      formula: kp.formula,
      warning: kp.warning
    };
  });

  attempts.forEach(attempt => {
    const question = db.findById('questions', attempt.questionId);
    if (!question || !question.knowledgePointId) return;
    
    const kpId = question.knowledgePointId;
    if (!kpStats[kpId]) return;

    const lastAnswered = attempt.lastAnsweredAt ? new Date(attempt.lastAnsweredAt).getTime() : now;
    if (lastAnswered > kpStats[kpId].lastAnsweredAt) {
      kpStats[kpId].lastAnsweredAt = lastAnswered;
    }

    // 时间衰减
    const daysAgo = Math.max(0, (now - lastAnswered) / (1000 * 60 * 60 * 24));
    const weight = Math.pow(0.5, daysAgo / 30);

    kpStats[kpId].totalCount += (attempt.attemptCount || 0) * weight;
    kpStats[kpId].correctCount += (attempt.correctCount || 0) * weight;
  });

  const redKPs = Object.values(kpStats).filter(stat => {
    if (stat.totalCount > 0) {
      stat.mastery = (stat.correctCount / stat.totalCount) * 100;
    } else {
      stat.mastery = 0; // 没做过也算红
    }
    // 规则：掌握度 < 60% (红色)
    return stat.mastery < 60;
  });

  const pickedQuestions = [];
  const pickedIds = new Set();
  const kpGroups = [];

  // 3. 从红色知识点中筛选：近两周未练习、区分度 > 0.4、难度 ± 0.3
  // 按掌握度升序排列红色知识点
  redKPs.sort((a, b) => a.mastery - b.mastery);

  for (const kp of redKPs) {
    if (pickedQuestions.length >= limit) break;

    // 筛选题目
    const candidateQuestions = db.find('questions').filter(q => {
      if (q.knowledgePointId !== kp.id) return false;
      if (pickedIds.has(q.id)) return false;

      // 区分度 > 0.4
      if ((q.discrimination || 0) <= 0.4) return false;

      // 难度 ± 0.3
      const diff = q.difficultyValue || 0.5;
      if (Math.abs(diff - abilityValue) > 0.3) return false;

      // 近两周未练习 (针对该具体题目)
      const attempt = attempts.find(a => a.questionId === q.id);
      if (attempt) {
        const lastTime = new Date(attempt.lastAnsweredAt || 0).getTime();
        if (lastTime > twoWeeksAgo) return false;
      }

      return true;
    });

    if (candidateQuestions.length > 0) {
      const kpQuestions = candidateQuestions.slice(0, 3); // 每个KP最多选3道
      kpQuestions.forEach(q => {
        if (pickedQuestions.length < limit) {
          pickedQuestions.push(q);
          pickedIds.add(q.id);
        }
      });

      kpGroups.push({
        knowledgePointId: kp.id,
        knowledgePointName: kp.name,
        masteryRate: Math.round(kp.mastery),
        knowledgeCard: {
          concept: kp.concept || '核心概念加载中...',
          formula: kp.formula || '相关公式加载中...',
          warning: kp.warning || '注意审题，避免陷阱。'
        },
        questions: kpQuestions
      });
    }
  }

  return {
    studentId,
    recommendationReason: `基于红色知识点（掌握度 < 60%）且符合能力区间（±0.3）的题目推荐。`,
    abilityValue: Math.round(abilityValue * 100) / 100,
    groups: kpGroups,
    questions: pickedQuestions
  };
}

ensureKnowledgeGraph();
module.exports = { KNOWLEDGE_GRAPH, LEAF_KNOWLEDGE_POINTS, ensureKnowledgeGraph, ensureGeneratedQuestions, getQuestionBank, recordQuestionResults, getWrongStats, recommendQuestions, getPersonalizedRecommendations, DIFFICULTY_LABELS, TYPE_LABELS };
