"""
DeepSeek Harness 桌面版（Python 完整版）

Python 主程序 + 原生窗口（pywebview），窗口内加载修改版 DSH Web GUI：
  - UI 效果 = 完整 Web GUI（对话大纲导航、回退/重新生成、工具卡片、流式回复等全部功能）
  - Python 负责：服务管家（启动/停止/重启/状态）、系统托盘、自动启动
  - PyInstaller 自编译 EXE（无 SmartScreen 拦截）

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

APP_NAME = "DeepSeek Harness 桌面版"
DEFAULT_PORT = 3080
HOST = "127.0.0.1"
LOG_FILE = Path(__file__).parent / "dsh-service.log"


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
    """Start/stop/restart the local DSH web service (logs to dsh-service.log)."""

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


def _ensure_tsx(install_dir: Path) -> str | None:
    """Return an error message when the harness checkout lacks the tsx dependency."""
    node_modules_tsx = install_dir / "node_modules" / "tsx"
    if node_modules_tsx.exists():
        return None
    return (
        "harness 依赖未安装（缺少 tsx）。请先在命令行执行：\n"
        f"  cd {install_dir}\n"
        "  pnpm install\n"
        "然后重试。国内网络慢可先执行：pnpm config set registry https://registry.npmmirror.com"
    )


    def start(self) -> str:
        if is_running(self.port):
            return "服务已在运行"
        if self.install_dir is None or not is_dsh_install_dir(self.install_dir):
            return "未找到 DSH 目录（请设置 DSH_HOME 或把 harness/ 放到本目录同级）"
        missing = _ensure_tsx(self.install_dir)
        if missing is not None:
            return missing
        bin_path = self.install_dir / "apps" / "cli" / "src" / "bin.ts"
        try:
            log_file = open(LOG_FILE, "a", encoding="utf-8", errors="replace")
        except Exception:
            log_file = None
        try:
            flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) | getattr(subprocess, "DETACHED_PROCESS", 0)
            self.proc = subprocess.Popen(
                ["node", "--import", "tsx/esm", str(bin_path), "web", "--host", HOST, "--port", str(self.port)],
                cwd=str(self.install_dir),
                stdin=subprocess.DEVNULL,
                stdout=log_file,
                stderr=log_file,
                creationflags=flags, close_fds=True,
            )
            for _ in range(120):
                time.sleep(1)
                if is_running(self.port):
                    if log_file is not None:
                        log_file.close()
                    return f"服务已启动（PID {self.proc.pid}）"
                if self.proc.poll() is not None:
                    tail = self._log_tail(log_file)
                    return (
                        f"服务启动失败：进程已退出（代码 {self.proc.returncode}）。"
                        f"日志文件：{LOG_FILE}"
                        f"日志尾部：\n{tail or '(无输出，请检查 node 是否在 PATH 中)'}"
                    )
            if log_file is not None:
                log_file.close()
            return (
                "服务进程已启动，但 120 秒内端口未就绪。"
                f"请查看日志：{LOG_FILE}；常见原因：pnpm install 未完成、缺少 .env、端口被占用。"
            )
        except Exception as e:
            if log_file is not None:
                log_file.close()
            return f"启动失败：{e}"

    @staticmethod
    def _log_tail(log_file) -> str:
        if log_file is not None:
            log_file.flush()
        try:
            lines = LOG_FILE.read_text(encoding="utf-8", errors="replace").splitlines()
            return "\n".join(lines[-15:])
        except Exception:
            return ""

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


def make_tray_icon():
    """Generate a simple tray icon with Pillow (no external image assets needed)."""
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([6, 6, 58, 58], radius=12, fill=(79, 140, 255, 255))
    d.text((16, 18), "DSH", fill=(255, 255, 255, 255))
    return img


def run_tray(manager: ServiceManager, on_show, on_quit):
    """Tray loop (pystray) in its own thread."""
    try:
        import pystray
        from pystray import Menu, MenuItem
    except ImportError:
        return

    def start_svc(icon, item):
        icon.notify(manager.start(), APP_NAME)
        time.sleep(0.5)
        icon.update_menu()

    def stop_svc(icon, item):
        icon.notify(manager.stop(), APP_NAME)
        icon.update_menu()

    def show_win(icon, item):
        on_show()

    def quit_app(icon, item):
        on_quit()

    icon = pystray.Icon(
        "dsh-desktop",
        make_tray_icon(),
        APP_NAME,
        Menu(
            MenuItem("显示窗口", show_win, default=True),
            Menu.SEPARATOR,
            MenuItem("启动服务", start_svc),
            MenuItem("停止服务", stop_svc),
            Menu.SEPARATOR,
            MenuItem("退出", quit_app),
        ),
    )
    icon.run()


def main() -> None:
    manager = ServiceManager()

    # Auto-start the service when an install dir exists and nothing is running.
    if manager.install_dir is not None and not is_running(DEFAULT_PORT):
        print("检测到 DSH 目录，正在自动启动服务…")
        print(manager.start())

    if not is_running(DEFAULT_PORT):
        print("⚠️ DSH 服务未运行。请设置 DSH_HOME 环境变量指向 harness/ 目录后重新启动。")

    state = {"quitting": False}

    def show_window():
        try:
            for w in webview.windows:
                w.show()
                w.restore()
                w.focus()
        except Exception:
            pass

    def quit_app():
        state["quitting"] = True
        try:
            for w in webview.windows:
                w.destroy()
        except Exception:
            pass
        webview._quit()

    threading.Thread(target=run_tray, args=(manager, show_window, quit_app), daemon=True).start()

    url = f"http://{HOST}:{DEFAULT_PORT}/"
    window = webview.create_window(
        APP_NAME,
        url,
        width=1380, height=880, min_size=(1000, 660),
        background_color="#1a1d24",
    )

    def on_closing():
        if not state["quitting"]:
            try:
                window.hide()
                return False
            except Exception:
                return False
        return True

    window.events.closing += on_closing
    webview.start()


if __name__ == "__main__":
    main()
