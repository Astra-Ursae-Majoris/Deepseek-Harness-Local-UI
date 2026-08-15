"""
DeepSeek Harness 桌面版（Python 全量 UI）

纯 Python 主程序 + 自绘 HTML UI（pywebview 渲染）:
  - 服务管家：启动 / 停止 / 重启 / 状态
  - 完整聊天界面：会话列表 + 消息流 + 流式回复 + 输入框
  - 对话大纲导航栏：全部轮次摘要、点击定位、收起
  - 回退到这一步 / 重新生成

运行：python dsh_app.py
自编译：build_exe.bat（选择模式 3）
"""

import json
import os
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

try:
    import webview
except ImportError:
    print("缺少 pywebview，请先运行：pip install pywebview")
    sys.exit(1)

from dsh_api import ApiError, DshApi, DshSseClient

APP_NAME = "DeepSeek Harness 桌面版"
DEFAULT_PORT = 3080
HOST = "127.0.0.1"


def is_dsh_install_dir(d: Path) -> bool:
    try:
        manifest = json.loads((d / "package.json").read_text(encoding="utf-8"))
    except Exception:
        return False
    return manifest.get("name") == "@deepseek-ai/dsh-root" and (d / "apps" / "cli" / "src" / "bin.ts").exists()


def find_install_dir() -> Path | None:
    env_home = os.environ.get("DSH_HOME")
    candidates: list[Path] = []
    if env_home:
        candidates.append(Path(env_home))
    here = Path.cwd()
    candidates += [here / "harness", here / "deepseek-harness-master", here.parent / "harness"]
    candidates.append(Path("C:/harness"))
    for c in candidates:
        if is_dsh_install_dir(c):
            return c
    return None


def is_running(port: int) -> bool:
    try:
        with socket.create_connection((HOST, port), timeout=1.0):
            return True
    except OSError:
        return False


def find_port_pid(port: int) -> int | None:
    try:
        out = subprocess.run(["netstat", "-ano", "-p", "tcp"],
                             capture_output=True, text=True, timeout=10).stdout
        for line in out.splitlines():
            parts = line.split()
            if len(parts) >= 5 and parts[0] == "TCP" and parts[1] == f"{HOST}:{port}" and parts[3] == "LISTENING":
                return int(parts[4])
    except Exception:
        pass
    return None


class ServiceManager:
    """Start/stop/restart the local DSH web service."""

    def __init__(self, port: int = DEFAULT_PORT) -> None:
        self.port = port
        self.install_dir = find_install_dir()
        self.proc: subprocess.Popen | None = None

    def status(self) -> dict:
        return {
            "running": is_running(self.port),
            "port": self.port,
            "installDir": str(self.install_dir) if self.install_dir else None,
            "pid": find_port_pid(self.port),
        }

    def start(self) -> str:
        if is_running(self.port):
            return "服务已在运行"
        if self.install_dir is None or not is_dsh_install_dir(self.install_dir):
            return "未找到 DSH 目录（请设置 DSH_HOME 或把 harness/ 放到本目录同级）"
        bin_path = self.install_dir / "apps" / "cli" / "src" / "bin.ts"
        try:
            flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) | getattr(subprocess, "DETACHED_PROCESS", 0)
            self.proc = subprocess.Popen(
                ["node", "--import", "tsx/esm", str(bin_path), "web", "--host", HOST, "--port", str(self.port)],
                cwd=str(self.install_dir),
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                creationflags=flags, close_fds=True,
            )
            for _ in range(60):
                time.sleep(1)
                if is_running(self.port):
                    return f"服务已启动（PID {self.proc.pid}）"
            return "服务进程已启动，但端口未就绪（请检查 harness 是否已 pnpm install）"
        except Exception as e:
            return f"启动失败：{e}"

    def stop(self) -> str:
        pid = find_port_pid(self.port)
        if pid is None:
            return "服务未在运行"
        try:
            subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True, timeout=15)
            time.sleep(0.8)
            return "已停止" if not is_running(self.port) else "停止失败：端口仍被占用"
        except Exception as e:
            return f"停止失败：{e}"

    def restart(self) -> str:
        msgs = [self.stop()]
        time.sleep(1)
        msgs.append(self.start())
        return "；".join(msgs)


class Bridge:
    """API surface exposed to the UI via pywebview js_api."""

    def __init__(self, port: int = DEFAULT_PORT) -> None:
        self.port = port
        self.api = DshApi(port=port)
        self.manager = ServiceManager(port)
        self.sse = DshSseClient(port=port)
        self._sse_thread: threading.Thread | None = None
        self._window = None

    def bind_window(self, window) -> None:
        self._window = window

    # ---- service ----

    def status(self) -> dict:
        s = self.manager.status()
        if s["running"]:
            try:
                desc = self.api.describe()
                s["version"] = desc.get("version", "")
            except ApiError:
                pass
        return s

    def start_service(self) -> str:
        msg = self.manager.start()
        self._start_sse()
        return msg

    def stop_service(self) -> str:
        return self.manager.stop()

    def restart_service(self) -> str:
        msg = self.manager.restart()
        self._start_sse()
        return msg

    # ---- sessions ----

    def list_sessions(self) -> list:
        try:
            return self.api.list_sessions()
        except ApiError:
            return []

    def create_session(self) -> str:
        return self.api.create_session()

    def get_history(self, session_id: str, before_seq=None) -> dict:
        try:
            return self.api.history(session_id, before_seq, 200)
        except ApiError as e:
            return {"error": str(e), "events": []}

    def get_outline(self, session_id: str) -> list:
        try:
            return self.api.outline(session_id)
        except ApiError:
            return []

    def send_prompt(self, session_id: str, text: str) -> dict:
        try:
            self.api.prompt(session_id, text, "queue")
            return {"ok": True}
        except ApiError as e:
            return {"ok": False, "error": str(e)}

    def fork_at(self, session_id: str, at_seq: int, text=None) -> dict:
        """回退到这一步（或重新生成）: fork 到 atSeq，可选自动重发 text。"""
        try:
            child = self.api.fork(session_id, at_seq)
            if text is not None:
                self.api.prompt(child, text, "queue")
            return {"ok": True, "sessionId": child}
        except ApiError as e:
            return {"ok": False, "error": str(e)}

    def cancel(self, session_id: str) -> dict:
        try:
            self.api.cancel(session_id)
            return {"ok": True}
        except ApiError as e:
            return {"ok": False, "error": str(e)}

    # ---- sse ----

    def _start_sse(self) -> None:
        if self._sse_thread is not None and self._sse_thread.is_alive():
            return
        self._sse_thread = threading.Thread(target=self._sse_loop, daemon=True)
        self._sse_thread.start()

    def _sse_loop(self) -> None:
        self.sse.run(self._on_frame)

    def _on_frame(self, frame: dict) -> None:
        """Forward live frames to the UI (session events only)."""
        method = frame.get("method")
        if method in ("session/event", "session/status", "session/title"):
            try:
                self._window.evaluate_js(f"window.__dshOnFrame({json.dumps(frame)})")
            except Exception:
                pass


def main() -> None:
    bridge = Bridge()
    if bridge.manager.install_dir is not None and not is_running(DEFAULT_PORT):
        print("检测到 DSH 目录，正在自动启动服务…")
        print(bridge.manager.start())
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).parent))
    ui_dir = base / "dsh_ui"
    index = ui_dir / "index.html"
    if not index.exists():
        print(f"缺少 UI 文件：{index}")
        sys.exit(1)
    window = webview.create_window(
        APP_NAME, str(index.resolve()),
        width=1360, height=860, min_size=(980, 640),
        js_api=bridge,
        background_color="#1a1d24",
    )
    bridge.bind_window(window)
    bridge._start_sse()
    webview.start()


if __name__ == "__main__":
    main()
