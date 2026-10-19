"""本地/线上端到端验收启动器。

把账号密码写在文件里，避免通过命令行传参时被 shell 转义或改写。
用法：python tests/run_e2e.py [BASE_URL]
"""

import os
import runpy
import sys

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://123.56.75.115/api"

os.environ["BASE_URL"] = BASE
os.environ["E2E_ADMIN"] = "admin"
os.environ["E2E_ADMIN_PASSWORD"] = "Admin@2026"
os.environ["E2E_TEACHER"] = "teacher"
os.environ["E2E_TEACHER_PASSWORD"] = "Teacher@2026"
os.environ["E2E_STUDENT"] = "student"
os.environ["E2E_STUDENT_PASSWORD"] = "Student@12345"

target = os.path.join(os.path.dirname(os.path.abspath(__file__)), "e2e_learning_loop.py")
runpy.run_path(target, run_name="__main__")
