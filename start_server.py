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


def lan_ipv4_addresses() -> list[str]:
    addresses: list[str] = []
    try:
        hostname = socket.gethostname()
        candidates = socket.getaddrinfo(hostname, None, socket.AF_INET, socket.SOCK_STREAM)
        for candidate in candidates:
            address = candidate[4][0]
            if address.startswith("127.") or address in addresses:
                continue
            addresses.append(address)
    except OSError:
        pass
    return addresses


def write_current_url(local_url: str, lan_urls: list[str], version: str) -> None:
    lines = [local_url]
    lines.extend(lan_urls)
    lines.append(f"version={version}")
    (ROOT / "current-url.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def wait_for_server(local_url: str, lan_urls: list[str]) -> None:
    last_error: Exception | None = None
    for _ in range(30):
        try:
            with urllib.request.urlopen(local_url + "api/health", timeout=1) as response:
                if response.status == 200:
                    health = json.loads(response.read().decode("utf-8"))
                    write_current_url(local_url, lan_urls, health.get("version", "unknown"))
                    return
        except Exception as exc:
            last_error = exc
            time.sleep(0.5)
    raise RuntimeError(f"Server did not become ready: {last_error}")


def main() -> int:
    port = find_free_port()
    local_url = f"http://127.0.0.1:{port}/"
    lan_urls = [f"http://{address}:{port}/" for address in lan_ipv4_addresses()]
    write_current_url(local_url, lan_urls, "starting")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    stdout_path = LOG_DIR / f"backend-{stamp}.log"
    stderr_path = LOG_DIR / f"backend-error-{stamp}.log"
    (LOG_DIR / "latest-log.txt").write_text(
        f"stdout={stdout_path}\nstderr={stderr_path}\nurl={local_url}\nlan_urls={', '.join(lan_urls)}\n",
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
            "0.0.0.0",
            "--port",
            str(port),
        ],
        cwd=ROOT,
        stdout=stdout,
        stderr=stderr,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )

    try:
        wait_for_server(local_url, lan_urls)
    except Exception as exc:
        process.terminate()
        print(str(exc))
        return 1

    webbrowser.open(local_url)
    print(f"Stardew CP Studio is running at {local_url}")
    if lan_urls:
        print("Tablet / LAN URLs:")
        for lan_url in lan_urls:
            print(f"  {lan_url}")
    else:
        print("No LAN IPv4 address was detected. Check Wi-Fi/network settings if a tablet needs access.")
    print("Backend version: ai-fields-v1")
    print("If Windows Firewall asks, allow access on private networks.")
    print("Keep this process running while using the tool.")
    process.wait()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
