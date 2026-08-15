"""
DeepSeek Harness 本地桌面启动器（纯 Python 版）

功能：
  - 一键启动 / 停止 / 重启本地 DSH Web 服务
  - 实时显示服务状态
  - 一键打开系统默认浏览器访问 GUI
  - 自动检测 DSH 安装目录（DSH_HOME 环境变量 / 同级 harness / 手动选择）
  - 图形界面（tkinter），全程无需命令行

运行：python dsh_launcher.py
自编译为 EXE：运行 build_exe.bat（需 PyInstaller）
"""

import json
import os
import socket
import subprocess
import sys
import threading
import time
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext
from pathlib import Path


APP_NAME = "DeepSeek Harness 桌面启动器"
DEFAULT_PORT = 3080
HOST = "127.0.0.1"
SETTINGS_FILE = Path.home() / ".dsh_launcher_settings.json"


def find_install_dir(anchor: Path | None = None) -> Path | None:
    """Locate a runnable DSH checkout."""
    candidates: list[Path] = []
    env_home = os.environ.get("DSH_HOME")
    if env_home:
        candidates.append(Path(env_home))
    if anchor is not None:
        candidates.append(anchor / "harness")
        candidates.append(anchor / "deepseek-harness-master")
        candidates.append(anchor)
    candidates.append(Path.cwd() / "harness")
    candidates.append(Path.cwd() / "deepseek-harness-master")
    candidates.append(Path("C:/harness"))
    for c in candidates:
        if is_dsh_install_dir(c):
            return c
    return None


def is_dsh_install_dir(d: Path) -> bool:
    """Whether a directory looks like a runnable DSH checkout."""
    try:
        manifest = json.loads((d / "package.json").read_text(encoding="utf-8"))
    except Exception:
        return False
    if manifest.get("name") != "@deepseek-ai/dsh-root":
        return False
    return (d / "apps" / "cli" / "src" / "bin.ts").exists()


def is_service_running(port: int = DEFAULT_PORT) -> bool:
    """Probe whether the DSH web service answers on the port."""
    try:
        with socket.create_connection((HOST, port), timeout=1.0):
            return True
    except OSError:
        return False


def find_port_pid(port: int = DEFAULT_PORT) -> int | None:
    """Find the PID listening on the port via netstat."""
    try:
        out = subprocess.run(
            ["netstat", "-ano", "-p", "tcp"],
            capture_output=True, text=True, timeout=10,
        ).stdout
        for line in out.splitlines():
            parts = line.split()
            if len(parts) >= 5 and parts[0] == "TCP" and parts[1] == f"{HOST}:{port}" and parts[3] == "LISTENING":
                return int(parts[4])
    except Exception:
        pass
    return None


def stop_service(port: int = DEFAULT_PORT) -> str:
    """Stop the service: kill the process tree owning the port."""
    pid = find_port_pid(port)
    if pid is None:
        return "服务未在运行"
    try:
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"],
                       capture_output=True, timeout=15)
        time.sleep(0.8)
        if is_service_running(port):
            return "停止失败：端口仍被占用"
        return f"已停止（PID {pid}）"
    except Exception as e:
        return f"停止失败：{e}"


def start_service(install_dir: Path, port: int = DEFAULT_PORT) -> str:
    """Start the DSH web service detached, then wait until it answers."""
    if is_service_running(port):
        return "服务已在运行"
    bin_path = install_dir / "apps" / "cli" / "src" / "bin.ts"
    if not bin_path.exists():
        return f"找不到 CLI 入口：{bin_path}"
    try:
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0) | getattr(subprocess, "DETACHED_PROCESS", 0)
        proc = subprocess.Popen(
            ["node", "--import", "tsx/esm", str(bin_path), "web", "--host", HOST, "--port", str(port)],
            cwd=str(install_dir),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creationflags,
            close_fds=True,
        )
        # 等待服务就绪（最多 60 秒）
        for _ in range(60):
            time.sleep(1)
            if is_service_running(port):
                return f"服务已启动（PID {proc.pid}）"
        return "服务进程已启动，但端口未就绪（可能缺少依赖，请检查 harness 是否已 pnpm install）"
    except Exception as e:
        return f"启动失败：{e}"


def open_gui(port: int = DEFAULT_PORT) -> None:
    """Open the DSH GUI in the system default browser."""
    import webbrowser
    webbrowser.open(f"http://{HOST}:{port}/")


class LauncherApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title(APP_NAME)
        self.root.geometry("720x560")
        self.root.minsize(560, 420)
        self.settings = self.load_settings()
        self.install_dir = self.resolve_install_dir()
        self.port = int(self.settings.get("port", DEFAULT_PORT))
        self.proc: subprocess.Popen | None = None
        self._build_ui()
        self.refresh_status()

    def load_settings(self) -> dict:
        try:
            return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def save_settings(self) -> None:
        try:
            SETTINGS_FILE.write_text(json.dumps(self.settings, ensure_ascii=False), encoding="utf-8")
        except Exception:
            pass

    def resolve_install_dir(self) -> Path | None:
        saved = self.settings.get("install_dir")
        if saved and is_dsh_install_dir(Path(saved)):
            return Path(saved)
        return find_install_dir(Path.cwd())

    def _build_ui(self) -> None:
        pad = {"padx": 12, "pady": 6}
        # 状态区
        status_frame = tk.Frame(self.root)
        status_frame.pack(fill="x", **pad)
        self.status_dot = tk.Label(status_frame, text="●", font=("Segoe UI", 16), fg="#888")
        self.status_dot.pack(side="left")
        self.status_label = tk.Label(status_frame, text="检测中…", font=("Segoe UI", 12))
        self.status_label.pack(side="left", padx=8)
        self.dir_label = tk.Label(status_frame, text="", font=("Segoe UI", 9), fg="#555", anchor="e")
        self.dir_label.pack(side="right", fill="x", expand=True)
        # 按钮区
        btn_frame = tk.Frame(self.root)
        btn_frame.pack(fill="x", **pad)
        self.btn_start = tk.Button(btn_frame, text="🚀 启动服务", command=self.on_start, width=14, bg="#e8f5e9")
        self.btn_start.pack(side="left", padx=4)
        self.btn_stop = tk.Button(btn_frame, text="⏹ 停止服务", command=self.on_stop, width=14, bg="#fdecea")
        self.btn_stop.pack(side="left", padx=4)
        self.btn_restart = tk.Button(btn_frame, text="🔄 重启服务", command=self.on_restart, width=14)
        self.btn_restart.pack(side="left", padx=4)
        self.btn_open = tk.Button(btn_frame, text="🌐 打开界面", command=self.on_open, width=14)
        self.btn_open.pack(side="left", padx=4)
        # 目录区
        dir_frame = tk.Frame(self.root)
        dir_frame.pack(fill="x", **pad)
        self.dir_entry = tk.Entry(dir_frame)
        self.dir_entry.pack(side="left", fill="x", expand=True)
        tk.Button(dir_frame, text="更改 DSH 目录…", command=self.on_pick_dir).pack(side="left", padx=6)
        # 日志区
        log_frame = tk.Frame(self.root)
        log_frame.pack(fill="both", expand=True, **pad)
        self.log = scrolledtext.ScrolledText(log_frame, height=12, state="disabled", font=("Consolas", 9))
        self.log.pack(fill="both", expand=True)
        self.log_text("就绪。点击「启动服务」开始使用。")
        self.update_dir_display()

    def log_text(self, msg: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", time.strftime("[%H:%M:%S] ") + msg + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def update_dir_display(self) -> None:
        if self.install_dir is not None:
            self.dir_entry.delete(0, "end")
            self.dir_entry.insert(0, str(self.install_dir))
            self.dir_label.config(text="DSH 目录已定位")
        else:
            self.dir_entry.delete(0, "end")
            self.dir_label.config(text="未找到 DSH 目录，请手动选择")

    def refresh_status(self) -> None:
        running = is_service_running(self.port)
        if running:
            self.status_dot.config(fg="#2e7d32")
            self.status_label.config(text=f"服务运行中（端口 {self.port}）")
        else:
            self.status_dot.config(fg="#888")
            self.status_label.config(text="服务已停止")
        self.root.after(3000, self.refresh_status)

    def _guard_install_dir(self) -> Path | None:
        if self.install_dir is not None and is_dsh_install_dir(self.install_dir):
            return self.install_dir
        messagebox.showwarning("未找到 DSH 目录", "请先点击「更改 DSH 目录…」选择 DeepSeek Harness 源码目录（harness/）。")
        return None

    def on_start(self) -> None:
        d = self._guard_install_dir()
        if d is None:
            return
        self.log_text("正在启动服务…")
        msg = start_service(d, self.port)
        self.log_text(msg)
        self.refresh_status()

    def on_stop(self) -> None:
        self.log_text("正在停止服务…")
        msg = stop_service(self.port)
        self.log_text(msg)
        self.refresh_status()

    def on_restart(self) -> None:
        d = self._guard_install_dir()
        if d is None:
            return
        self.log_text("正在重启服务…")
        msg = stop_service(self.port)
        self.log_text(msg)
        time.sleep(1)
        msg = start_service(d, self.port)
        self.log_text(msg)
        self.refresh_status()

    def on_open(self) -> None:
        if not is_service_running(self.port):
            messagebox.showinfo("服务未运行", "请先启动服务，再打开界面。")
            return
        open_gui(self.port)
        self.log_text("已在默认浏览器中打开界面。")

    def on_pick_dir(self) -> None:
        chosen = filedialog.askdirectory(title="选择 DSH 源码目录（harness/）")
        if not chosen:
            return
        p = Path(chosen)
        if not is_dsh_install_dir(p):
            self.log_text(f"选择的目录无效（需包含 apps/cli 与 package.json）：{p}")
            messagebox.showerror("目录无效", "该目录不是有效的 DSH 源码目录（需包含 apps/cli/src/bin.ts）。")
            return
        self.install_dir = p
        self.settings["install_dir"] = str(p)
        self.save_settings()
        self.update_dir_display()
        self.log_text(f"已设置 DSH 目录：{p}")


def main() -> None:
    root = tk.Tk()
    LauncherApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
