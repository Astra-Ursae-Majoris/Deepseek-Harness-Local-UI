"""
DSH backend API client (pure Python, stdlib only).

Talks to the local DeepSeek Harness web service over its fetch-carrier
HTTP protocol: POST /api/<method> with a client-request envelope, plus
the SSE stream at /api/events.mux for live session events.
"""

import json
import threading
import time
import urllib.error
import urllib.request
from typing import Any, Callable


class ApiError(Exception):
    """A business-level RPC error (ok=false) from the server."""

    def __init__(self, code: str, message: str, details: dict | None = None) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message
        self.details = details or {}


class DshApi:
    """Minimal RPC client for the DSH fetch carrier."""

    def __init__(self, host: str = "127.0.0.1", port: int = 3080, timeout: float = 30.0) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout
        self._rpc_counter = 0
        self._counter_lock = threading.Lock()

    @property
    def base_url(self) -> str:
        return f"http://{self.host}:{self.port}"

    def _next_rpc_id(self) -> str:
        with self._counter_lock:
            self._rpc_counter += 1
            return f"py-{int(time.time() * 1000)}-{self._rpc_counter}"

    def call(self, method: str, payload: dict | None = None, timeout: float | None = None) -> Any:
        """One unary RPC. Returns result.value on success, raises ApiError on business error."""
        body = json.dumps({
            "type": "client-request",
            "rpcId": self._next_rpc_id(),
            "method": method,
            "payload": payload or {},
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base_url}/api/{method}",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout or self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise ApiError("http", f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:200]}") from e
        except urllib.error.URLError as e:
            raise ApiError("connection", f"无法连接服务: {e.reason}") from e
        result = data.get("result") if isinstance(data, dict) else None
        if not isinstance(result, dict) or result.get("ok") is not True:
            err = result.get("error", {}) if isinstance(result, dict) else {}
            raise ApiError(err.get("code", "unknown"), err.get("message", "unknown error"), err.get("details"))
        return result.get("value")

    # ---- domain methods ----

    def list_sessions(self) -> list[dict]:
        return self.call("session.list", {}).get("items", [])

    def create_session(self, session_id: str | None = None, cwd: str | None = None) -> str:
        payload: dict = {}
        if session_id is not None:
            payload["sessionId"] = session_id
        if cwd is not None:
            payload["cwd"] = cwd
        return self.call("session.create", payload)["sessionId"]

    def history(self, session_id: str, before_seq: int | None = None, max_messages: int | None = None) -> dict:
        payload: dict = {"sessionId": session_id}
        if before_seq is not None:
            payload["beforeSeq"] = before_seq
        if max_messages is not None:
            payload["maxMessages"] = max_messages
        return self.call("session.history", payload)

    def outline(self, session_id: str) -> list[dict]:
        return self.call("session.outline", {"sessionId": session_id}).get("turns", [])

    def prompt(self, session_id: str, text: str, mode: str = "queue") -> None:
        self.call("session.prompt", {
            "sessionId": session_id,
            "mode": mode,
            "content": [{"type": "text", "text": text}],
        })

    def fork(self, session_id: str, at_seq: int | None = None) -> str:
        payload: dict = {"sessionId": session_id}
        if at_seq is not None:
            payload["atSeq"] = at_seq
        return self.call("session.fork", payload)["sessionId"]

    def rename(self, session_id: str, title: str) -> None:
        self.call("session.rename", {"sessionId": session_id, "title": title})

    def cancel(self, session_id: str) -> None:
        self.call("session.cancel", {"sessionId": session_id})

    def models(self, session_id: str) -> dict:
        return self.call("session.models", {"sessionId": session_id})

    def describe(self) -> dict:
        return self.call("host.describe", {})


class DshSseClient:
    """SSE stream reader for /api/events.mux (live session events)."""

    def __init__(self, host: str = "127.0.0.1", port: int = 3080) -> None:
        self.url = f"http://{host}:{port}/api/events.mux"
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def run(self, on_frame: Callable[[dict], None]) -> None:
        """Blocking loop: read SSE frames and dispatch each to on_frame."""
        import urllib.request
        while not self._stop.is_set():
            try:
                req = urllib.request.Request(self.url)
                with urllib.request.urlopen(req, timeout=120) as resp:
                    buffer = b""
                    while not self._stop.is_set():
                        chunk = resp.read(1)
                        if not chunk:
                            break
                        buffer += chunk
                        if buffer.endswith(b"\n\n"):
                            text = buffer.decode("utf-8", "replace")
                            buffer = b""
                            for line in text.splitlines():
                                if line.startswith("data: "):
                                    try:
                                        frame = json.loads(line[6:])
                                        on_frame(frame)
                                    except json.JSONDecodeError:
                                        pass
            except Exception:
                if self._stop.is_set():
                    return
                # Stream dropped (server restart etc.); reconnect after a pause.
                time.sleep(2)


def event_messages(events: list[dict]) -> list[dict]:
    """Flatten a history event list into display-ready message rows.

    history returns HistoryEntry objects ({event: {...}}); live SSE frames carry
    the bare event. Both shapes are accepted. Each row: {kind, turn, text, seq}.
    """
    rows: list[dict] = []
    for entry in events:
        event = entry.get("event") if isinstance(entry, dict) and "event" in entry else entry
        if not isinstance(event, dict):
            continue
        etype = event.get("type")
        data = event.get("data", {}) or {}
        seq = event.get("seq")
        if etype == "turn/start":
            rows.append({"kind": "boundary", "turn": data.get("turn"), "text": "", "seq": seq})
        elif etype == "user/message":
            rows.append({"kind": "user", "turn": data.get("turn"),
                         "text": blocks_text(data.get("content", [])), "seq": seq})
        elif etype == "assistant/message":
            message = data.get("message", {}) or {}
            rows.append({"kind": "assistant", "turn": data.get("turn"),
                         "text": blocks_text(message.get("content", [])), "seq": seq})
        elif etype == "tool/call":
            rows.append({"kind": "tool", "turn": data.get("turn"),
                         "text": "🔧 " + str(data.get("name", "tool")), "seq": seq})
        # assistant/chunk and tool/result are skipped: the assembled
        # assistant/message carries the final text.
    return rows


def blocks_text(content) -> str:
    """Extract plain text from a content block list."""
    if not isinstance(content, list):
        return ""
    return "".join(
        block.get("text", "") for block in content
        if isinstance(block, dict) and block.get("type") == "text"
    )


