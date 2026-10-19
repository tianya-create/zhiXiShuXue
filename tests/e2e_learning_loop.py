# -*- coding: utf-8 -*-
"""智析数学 V1.0 —— 学习闭环端到端验收脚本

用法（后端需已启动）：
    set BASE_URL=http://127.0.0.1:5001/api
    python tests/e2e_learning_loop.py

账号密码默认取本地开发配置，可用环境变量覆盖：
    E2E_ADMIN / E2E_ADMIN_PASSWORD
    E2E_TEACHER / E2E_TEACHER_PASSWORD
    E2E_STUDENT / E2E_STUDENT_PASSWORD
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:5001/api")
ACCOUNTS = {
    "admin": (os.environ.get("E2E_ADMIN", "admin"), os.environ.get("E2E_ADMIN_PASSWORD", "")),
    "teacher": (os.environ.get("E2E_TEACHER", "teacher"), os.environ.get("E2E_TEACHER_PASSWORD", "")),
    "student": (os.environ.get("E2E_STUDENT", "student"), os.environ.get("E2E_STUDENT_PASSWORD", "")),
}

OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))
PASS = 0
FAIL = 0
FAILED = []


def call(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(BASE + path, data=data, method=method)
    request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", "Bearer " + token)
    try:
        with OPENER.open(request, timeout=30) as response:
            return response.status, json.loads(response.read().decode() or "{}")
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read().decode() or "{}")
        except Exception:
            return error.code, {}
    except Exception as error:  # 连接失败等
        return 0, {"message": str(error)}


def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print("  [PASS] %s %s" % (name, detail))
    else:
        FAIL += 1
        FAILED.append(name)
        print("  [FAIL] %s %s" % (name, detail))


def login(role):
    username, password = ACCOUNTS[role]
    if not password:
        print("缺少 %s 的密码环境变量" % role)
        sys.exit(2)
    status, payload = call("POST", "/auth/login", body={"username": username, "password": password})
    if status != 200:
        print("%s 登录失败：%s" % (role, payload.get("message")))
        sys.exit(2)
    data = payload.get("data") or {}
    return data.get("token"), data.get("user") or {}


def main():
    print("== 0. 三端登录 ==")
    admin_token, admin_user = login("admin")
    teacher_token, teacher_user = login("teacher")
    student_token, student_user = login("student")
    check("管理员登录", bool(admin_token))
    check("教师登录", bool(teacher_token))
    check("学生登录", bool(student_token))

    print("== 1. 知识点目录 ==")
    status, payload = call("GET", "/common/knowledge-points/flat", admin_token)
    leaves = [item for item in (payload.get("data") or []) if item.get("level") == 2 and item.get("curriculum")]
    check("教材目录包含 30 个知识点", len(leaves) == 30, "n=%d" % len(leaves))

    status, payload = call("GET", "/student/weak-points", student_token)
    nodes = payload.get("data") or []
    check("学生知识图谱 30 个节点", len(nodes) == 30, "n=%d" % len(nodes))
    target = next((item for item in nodes if item.get("questionCount")), None)
    check("存在可练习的知识点", bool(target), target.get("id", "") if target else "")
    kp = target["id"] if target else "alg-1"

    print("== 2. 学生练习 + 草稿 + 提交 ==")
    status, payload = call("GET", "/student/practice/%s" % kp, student_token)
    questions = ((payload.get("data") or {}).get("questions")) or []
    check("能取到练习题", len(questions) > 0, "n=%d" % len(questions))
    if not questions:
        print("\n练习题为 0，后续用例跳过")
        return summarize()

    ids = [item["id"] for item in questions]
    answers = {}
    for item in questions:
        options = item.get("options") or []
        if item.get("type") == "choice":
            answer = item.get("answer") or (options[0] if options else "A")
            answers[item["id"]] = chr(65 + options.index(answer)) if answer in options else "A"
        else:
            answers[item["id"]] = item.get("answer") or "1"

    draft_key = "practice-e2e-%s" % kp
    status, payload = call("PUT", "/student/drafts/" + draft_key, student_token,
                           {"answers": answers, "questionIds": ids, "requestId": str(uuid.uuid4())})
    check("保存答题草稿", status == 200 and payload.get("success"))
    status, payload = call("GET", "/student/drafts/" + draft_key, student_token)
    check("恢复答题草稿", len(((payload.get("data") or {}).get("answers")) or {}) == len(ids))

    request_id = str(uuid.uuid4())
    status, payload = call("POST", "/student/practice/%s/submit" % kp, student_token, {
        "answers": answers,
        "questionIds": ids,
        "requestId": request_id,
        "title": "E2E 专项练习",
    })
    record = payload.get("data") or {}
    check("提交练习", status == 200 and record.get("id"), payload.get("message", ""))
    check("提交返回逐题结果", len(record.get("questionResults") or []) == len(ids))
    check("提交返回知识点掌握变化", len(record.get("knowledgePointChanges") or []) >= 1)

    status, payload = call("POST", "/student/practice/%s/submit" % kp, student_token, {
        "answers": answers,
        "questionIds": ids,
        "requestId": request_id,
        "title": "E2E 专项练习",
    })
    duplicate = payload.get("data") or {}
    check("重复提交幂等", duplicate.get("id") == record.get("id"))

    status, payload = call("GET", "/student/review-plan", student_token)
    check("复习计划可读取", status == 200 and isinstance(payload.get("data"), list),
          "n=%d" % len(payload.get("data") or []))

    status, payload = call("POST", "/student/questions/%s/report" % ids[0], student_token,
                           {"message": "E2E：题干排版需要核对"})
    check("学生提交题目纠错", status == 200 and payload.get("success"))

    print("== 3. 教师已学范围 ==")
    status, payload = call("GET", "/teacher/classes", teacher_token)
    classes = payload.get("data") or []
    check("教师读取自己班级", status == 200 and len(classes) > 0, "n=%d" % len(classes))
    if classes:
        class_id = classes[0]["id"]
        original = classes[0].get("taughtKnowledgePointIds") or []
        version = classes[0].get("textbookVersion") or "人教版"
        status, payload = call("GET", "/teacher/classes/%s/curriculum" % class_id, teacher_token)
        check("读取班级教材目录", status == 200 and len(payload.get("data", {}).get("nodes") or []) == 30)
        status, payload = call("PUT", "/teacher/classes/%s/curriculum" % class_id, teacher_token,
                               {"taughtKnowledgePointIds": original, "textbookVersion": version})
        check("保存已学范围", status == 200 and payload.get("success"))
        status, payload = call("PUT", "/teacher/classes/%s/curriculum" % class_id, teacher_token,
                               {"taughtKnowledgePointIds": ["not-a-node"], "textbookVersion": version})
        check("非法知识点被拒绝", status == 400)

    print("== 4. 复核中心 ==")
    # 解答题一律进入复核：建题 → 布置作业 → 学生提交 → 检查队列
    review_question = {
        "type": "subjective",
        "content": "E2E：请写出解方程 2x+3=7 的完整过程。",
        "answer": "x=2",
        "analysis": "移项得 2x=4，两边同除以 2 得 x=2",
        "knowledgePointId": kp,
        "score": 10,
    }
    status, payload = call("POST", "/teacher/questions", teacher_token, review_question)
    created_q = payload.get("data") or {}
    check("创建解答题", status == 200 and created_q.get("id"), payload.get("message", ""))
    if created_q.get("id"):
        call("POST", "/teacher/questions/%s/review" % created_q["id"], teacher_token,
             {"reviewStatus": "approved"})
        status, payload = call("POST", "/teacher/assignments", teacher_token, {
            "title": "E2E 复核作业",
            "classId": class_id,
            "questionIds": [created_q["id"]],
            "levels": ["strong", "medium", "weak"],
        })
        assignment = payload.get("data") or {}
        check("布置含解答题的作业", status == 200 and assignment.get("id"), payload.get("message", ""))
        if assignment.get("id"):
            status, payload = call("POST", "/student/assignments/%s/submit" % assignment["id"],
                                   student_token,
                                   {"answers": {created_q["id"]: "2x=4，所以 x=2"},
                                    "requestId": str(uuid.uuid4())})
            submitted = payload.get("data") or {}
            check("学生提交含解答题的作业",
                  status == 200 and submitted.get("id"), payload.get("message", ""))

    status, payload = call("GET", "/teacher/review-queue", teacher_token)
    queue = payload.get("data") or []
    check("读取待复核队列", status == 200, "n=%d" % len(queue))
    queued = next((item for item in queue if item.get("studentId") == student_user.get("id")), None)
    if queued:
        scores = {item["questionId"]: item.get("fullScore", 5)
                  for item in queued.get("questionResults") or []}
        status, payload = call("POST", "/teacher/review-queue/%s" % queued["id"], teacher_token, {
            "collection": queued.get("collection"),
            "scores": scores,
            "comments": {},
        })
        check("保存复核结果", status == 200
              and (payload.get("data") or {}).get("status") in ("completed", "graded"))
    else:
        check("解答题进入复核队列", False, "队列中未找到该学生的答卷")


    print("== 5. 学情统计 ==")
    status, payload = call("GET", "/teacher/analytics/student/%s" % student_user.get("id"), teacher_token)
    data = payload.get("data") or {}
    check("学生学情读取", status == 200 and "knowledgePointMastery" in data)
    if classes:
        status, payload = call("GET", "/teacher/analytics/class/%s" % classes[0]["id"], teacher_token)
        data = payload.get("data") or {}
        check("班级学情读取", status == 200 and "studentScores" in data and "knowledgePointMasteryList" in data)

    print("== 6. 题库质量校验 ==")
    base_question = {
        "type": "choice",
        "content": "E2E：1+1 等于几？",
        "options": ["1", "2"],
        "answer": "2",
        "analysis": "1+1=2",
        "knowledgePointId": kp,
        "score": 5,
    }
    status, payload = call("POST", "/teacher/questions", teacher_token,
                           dict(base_question, options=["1", "1"]))
    check("重复选项被拒绝", status == 400)
    status, payload = call("POST", "/teacher/questions", teacher_token,
                           dict(base_question, score=0))
    check("非法分值被拒绝", status == 400)
    status, payload = call("POST", "/teacher/questions", teacher_token, base_question)
    created = payload.get("data") or {}
    check("合规题目可保存", status == 200 and created.get("id"), payload.get("message", ""))
    if created.get("id"):
        status, payload = call("POST", "/teacher/questions/%s/review" % created["id"], teacher_token,
                               {"reviewStatus": "approved"})
        check("题目审核通过", status == 200 and (payload.get("data") or {}).get("reviewStatus") == "approved")
        call("DELETE", "/teacher/questions/%s" % created["id"], teacher_token)

    print("== 7. 越权与脱敏 ==")
    status, payload = call("GET", "/admin/users", student_token)
    check("学生访问管理端被拒绝", status == 403, "status=%d" % status)
    status, payload = call("GET", "/teacher/review-queue", student_token)
    check("学生访问教师端被拒绝", status == 403, "status=%d" % status)
    status, payload = call("GET", "/admin/users?pageSize=50", admin_token)
    check("用户列表不返回密码字段", "password" not in json.dumps(payload, ensure_ascii=False))
    status, payload = call("GET", "/student/assignments", "forged.token.value")
    check("伪造令牌被拒绝", status == 401, "status=%d" % status)

    return summarize()


def summarize():
    print("\n结果：PASS=%d FAIL=%d" % (PASS, FAIL))
    if FAILED:
        print("失败项：" + "、".join(FAILED))
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
