from __future__ import annotations

import socket
import subprocess
import sys
import time
import json
import urllib.request
import webbrowser
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parent
LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)


def find_free_port(start: int = 8877) -> int:
    port = start
    while port < start + 100:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.2)
            if sock.connect_ex(("127.0.0.1", port)) != 0:
                return port
        port += 1
    raise RuntimeError("No free local port found.")


def wait_for_server(url: str) -> None:
    last_error: Exception | None = None
    for _ in range(30):
        try:
            with urllib.request.urlopen(url + "api/health", timeout=1) as response:
                if response.status == 200:
                    health = json.loads(response.read().decode("utf-8"))
                    (ROOT / "current-url.txt").write_text(
                        url + "\n" + f"version={health.get('version', 'unknown')}\n",
                        encoding="utf-8",
                    )
                    return
        except Exception as exc:
            last_error = exc
            time.sleep(0.5)
    raise RuntimeError(f"Server did not become ready: {last_error}")


def main() -> int:
    port = find_free_port()
    url = f"http://127.0.0.1:{port}/"
    (ROOT / "current-url.txt").write_text(url + "\nversion=starting\n", encoding="utf-8")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    stdout_path = LOG_DIR / f"backend-{stamp}.log"
    stderr_path = LOG_DIR / f"backend-error-{stamp}.log"
    (LOG_DIR / "latest-log.txt").write_text(
        f"stdout={stdout_path}\nstderr={stderr_path}\nurl={url}\n",
        encoding="utf-8",
    )
    stdout = stdout_path.open("w", encoding="utf-8")
    stderr = stderr_path.open("w", encoding="utf-8")
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "backend.app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=ROOT,
        stdout=stdout,
        stderr=stderr,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )

    try:
        wait_for_server(url)
    except Exception as exc:
        process.terminate()
        print(str(exc))
        return 1

    webbrowser.open(url)
    print(f"Stardew CP Studio is running at {url}")
    print("Backend version: ai-fields-v1")
    print("Keep this process running while using the tool.")
    process.wait()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
