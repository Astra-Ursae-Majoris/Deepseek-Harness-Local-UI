"""
DeepSeek Harness 桌面窗口版（pywebview，可选）

与 dsh_launcher.py 相同的服务管理，但用 pywebview 把 Web GUI 装进
原生窗口（基于系统 WebView2），保留桌面壳体验。

安装依赖：pip install pywebview
运行：python dsh_webview.py
自编译为 EXE：运行 build_exe.bat（WebView 版需 --collect-all pywebview）
"""

import json
import os
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

try:
    import webview
except ImportError:
    print("缺少 pywebview，请先运行：pip install pywebview");
    sys.exit(1)

from dsh_launcher import (
    DEFAULT_PORT, HOST, find_install_dir, is_dsh_install_dir,
    is_service_running, start_service, stop_service, find_port_pid,
)


class Api:
    """Exposed to the WebView window via pywebview js_api."""

    def __init__(self) -> None:
        self.install_dir = find_install_dir(Path.cwd())
        self.port = DEFAULT_PORT
        self.log: list[str] = []

    def status(self) -> dict:
        return {
            "running": is_service_running(self.port),
            "port": self.port,
            "installDir": str(self.install_dir) if self.install_dir else None,
        }

    def start(self) -> str:
        if self.install_dir is None:
            return "未找到 DSH 目录（请设置 DSH_HOME 环境变量或把 harness/ 放在本目录同级）"
        msg = start_service(self.install_dir, self.port)
        self.log.append(msg)
        return msg

    def stop(self) -> str:
        msg = stop_service(self.port)
        self.log.append(msg)
        return msg

    def open_browser(self) -> str:
        webbrowser.open(f"http://{HOST}:{self.port}/")
        return "已在默认浏览器中打开"


def main() -> None:
    api = Api()
    if api.install_dir is not None and not is_service_running(api.port):
        print("检测到 DSH 目录，尝试自动启动服务…")
        print(api.start())
    window = webview.create_window(
        "DeepSeek Harness 桌面版",
        f"http://{HOST}:{api.port}/",
        width=1280,
        height=820,
        js_api=api,
    )
    webview.start()


if __name__ == "__main__":
    main()
