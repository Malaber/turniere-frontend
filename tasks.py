import shlex
import shutil
import time
import urllib.error
import urllib.request
from pathlib import Path

from invoke import task


DEFAULT_API_URL = "http://127.0.0.1:3000"
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = "3001"
NODE_VERSION = "24"
NODE_MODULES_PATH = Path("node_modules")
NVM_PATH = Path.home() / ".nvm" / "nvm.sh"


def _package_manager():
    if shutil.which("yarn"):
        return "yarn"
    return "corepack yarn"


def _with_node(command):
    if NVM_PATH.exists():
        return f"source {shlex.quote(str(NVM_PATH))} && nvm use {NODE_VERSION} >/dev/null && {command}"
    return command


def _run(c, command):
    c.run(_with_node(command), pty=True, shell="/bin/zsh")


def _wait_for_backend(api_url, timeout=30):
    deadline = time.time() + timeout
    health_url = f"{api_url.rstrip('/')}/healthz"
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    last_error = None

    while time.time() < deadline:
        try:
            with opener.open(health_url) as response:
                if response.status == 200:
                    return
                last_error = f"unexpected status {response.status}"
        except urllib.error.HTTPError as error:
            last_error = f"http {error.code}"
        except Exception as error:
            last_error = repr(error)
        time.sleep(0.5)

    raise RuntimeError(f"backend did not become ready at {health_url}: {last_error}")


@task
def setup(c):
    """Install frontend dependencies locally."""
    _run(c, f"{_package_manager()} install")


@task(name="check-backend")
def check_backend(c, api_url=DEFAULT_API_URL, timeout=30):
    """Wait for the configured backend healthcheck to respond."""
    _wait_for_backend(api_url, timeout=int(timeout))
    print(f"Backend is ready at {api_url}")


@task
def start(c, api_url=DEFAULT_API_URL, host=DEFAULT_HOST, port=DEFAULT_PORT, install=True, wait_for_backend=True):
    """Start the frontend against a specific backend URL."""
    if install and not NODE_MODULES_PATH.exists():
        setup(c)

    if wait_for_backend:
        _wait_for_backend(api_url)

    _run(
        c,
        f"TURNIERE_API_URL={shlex.quote(api_url)} HOST={shlex.quote(host)} PORT={shlex.quote(str(port))} {_package_manager()} run dev",
    )
