from __future__ import annotations

import os
import shlex
import shutil
import signal
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

from invoke import task

ROOT = Path(__file__).resolve().parent
E2E_DIR = ROOT / "e2e"

DEFAULT_API_URL = "http://127.0.0.1:3000"
DEFAULT_FRONTEND_URL = "http://127.0.0.1:3001"
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 3001
DEFAULT_NODE_VERSION = "24"
DEFAULT_E2E_EMAIL = "e2e@example.com"
DEFAULT_E2E_PASSWORD = "password123"
DEFAULT_E2E_USERNAME = "e2e-user"
DOCKER_COMPOSE_FILE = ROOT / "docker-compose.e2e.yml"
DECIDER_MATCH_SPEC = "tests/08-decider-matches.spec.ts"


def _zsh_script(command: str, cwd: Path, env: dict[str, str] | None = None, node_version: str | None = None) -> str:
    steps = []
    if node_version:
        steps.append(
            f'if [ -f "$HOME/.nvm/nvm.sh" ]; then source "$HOME/.nvm/nvm.sh" && nvm use {shlex.quote(node_version)} >/dev/null; fi'
        )
    steps.append(f"cd {shlex.quote(str(cwd))}")
    if env:
        exports = " ".join(f"{key}={shlex.quote(str(value))}" for key, value in env.items())
        steps.append(f"export {exports}")
    steps.append(command)
    return " && ".join(steps)


def _run_node(c, command: str, cwd: Path = ROOT, env: dict[str, str] | None = None, node_version: str = DEFAULT_NODE_VERSION):
    script = _zsh_script(command, cwd=cwd, env=env, node_version=node_version)
    c.run(f"/bin/zsh -lc {shlex.quote(script)}", pty=True)


def _wait_for_url(url: str, timeout: int = 120, acceptable_statuses: set[int] | None = None):
    acceptable = acceptable_statuses or set(range(200, 500))
    deadline = time.time() + timeout
    last_error = "no response"

    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if response.status in acceptable:
                    return
                last_error = f"HTTP {response.status}"
        except urllib.error.HTTPError as exc:
            if exc.code in acceptable:
                return
            last_error = f"HTTP {exc.code}"
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
        time.sleep(1)

    raise RuntimeError(f"{url} did not become ready within {timeout}s. Last error: {last_error}")


def _start_background_frontend(
    api_url: str,
    host: str,
    port: int,
    node_version: str,
) -> tuple[subprocess.Popen, str]:
    log_file = tempfile.NamedTemporaryFile(prefix="turniere-frontend-", suffix=".log", delete=False)
    custom_env = {
        "TURNIERE_API_URL": api_url,
        "HOST": host,
        "PORT": str(port),
    }
    script = _zsh_script("yarn dev", cwd=ROOT, env=custom_env, node_version=node_version)
    process = subprocess.Popen(  # noqa: S603
        ["/bin/zsh", "-lc", script],
        cwd=ROOT,
        env={**os.environ, **custom_env},
        stdout=log_file,
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid,
    )
    log_file.close()
    return process, log_file.name


def _stop_background_process(process: subprocess.Popen):
    if process.poll() is not None:
        return
    try:
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    except ProcessLookupError:
        return
    process.wait(timeout=10)


def _docker_compose_cmd() -> list[str]:
    if shutil.which("docker-compose"):
        return ["docker-compose"]

    docker_cmd = shutil.which("docker")
    if docker_cmd:
        result = subprocess.run([docker_cmd, "compose", "version"], capture_output=True, text=True, check=False)  # noqa: S603
        if result.returncode == 0:
            return [docker_cmd, "compose"]

    raise RuntimeError("Neither docker-compose nor docker compose is available.")


def _run_subprocess(command: list[str], env: dict[str, str] | None = None, check: bool = True):
    merged_env = {**os.environ, **(env or {})}
    print(" ".join(shlex.quote(part) for part in command))
    return subprocess.run(command, env=merged_env, check=check)  # noqa: S603


def _compose(command: list[str], env: dict[str, str] | None = None, check: bool = True):
    return _run_subprocess(_docker_compose_cmd() + ["-f", str(DOCKER_COMPOSE_FILE)] + command, env=env, check=check)


@task
def setup(c, node_version=DEFAULT_NODE_VERSION):
    """Install the frontend's Yarn dependencies."""
    _run_node(c, "yarn install", cwd=ROOT, node_version=node_version)


@task(name="check-backend")
def check_backend(c, api_url=DEFAULT_API_URL, timeout=120):
    """Wait for the backend health endpoint to become ready."""
    _wait_for_url(f"{api_url.rstrip('/')}/healthz", timeout=int(timeout))
    print(f"Backend ready: {api_url.rstrip('/')}/healthz")


@task
def start(c, api_url=DEFAULT_API_URL, host=DEFAULT_HOST, port=DEFAULT_PORT, install=True, node_version=DEFAULT_NODE_VERSION):
    """Install deps if needed, wait for the backend, and start the frontend dev server."""
    if install:
        setup(c, node_version=node_version)
    check_backend(c, api_url=api_url)
    _run_node(
        c,
        "yarn dev",
        cwd=ROOT,
        env={"TURNIERE_API_URL": api_url, "HOST": host, "PORT": str(port)},
        node_version=node_version,
    )


@task(name="e2e-install")
def e2e_install(c, node_version=DEFAULT_NODE_VERSION, browser="chromium"):
    """Install deterministic E2E dependencies and the requested Playwright browser."""
    _run_node(c, "npm ci", cwd=E2E_DIR, node_version=node_version)
    _run_node(c, f"npx playwright install {browser}", cwd=E2E_DIR, node_version=node_version)


@task(name="e2e-test")
def e2e_test(
    c,
    frontend_url=DEFAULT_FRONTEND_URL,
    backend_url=DEFAULT_API_URL,
    node_version=DEFAULT_NODE_VERSION,
    email=DEFAULT_E2E_EMAIL,
    password=DEFAULT_E2E_PASSWORD,
    username=DEFAULT_E2E_USERNAME,
    spec="",
):
    """Run Playwright against an already running frontend and backend."""
    _wait_for_url(f"{backend_url.rstrip('/')}/healthz")
    _wait_for_url(frontend_url.rstrip("/"))
    command = "npx playwright test"
    if spec:
        command = f"{command} {shlex.quote(spec)}"
    _run_node(
        c,
        command,
        cwd=E2E_DIR,
        node_version=node_version,
        env={
            "TURNIERE_FRONTEND_URL": frontend_url,
            "TURNIERE_BACKEND_URL": backend_url,
            "TURNIERE_E2E_EMAIL": email,
            "TURNIERE_E2E_PASSWORD": password,
            "TURNIERE_E2E_USERNAME": username,
        },
    )


@task(name="e2e-local")
def e2e_local(
    c,
    api_url=DEFAULT_API_URL,
    frontend_url=DEFAULT_FRONTEND_URL,
    host=DEFAULT_HOST,
    port=DEFAULT_PORT,
    install_frontend=True,
    install_e2e=True,
    node_version=DEFAULT_NODE_VERSION,
    browser="chromium",
    email=DEFAULT_E2E_EMAIL,
    password=DEFAULT_E2E_PASSWORD,
    username=DEFAULT_E2E_USERNAME,
    spec="",
):
    """
    Run the local frontend E2E flow end to end against an already running backend.

    This installs frontend + E2E deps when requested, starts the dev server in the
    background, waits for readiness, runs Playwright, and then stops the dev server.
    """
    if install_frontend:
        setup(c, node_version=node_version)

    check_backend(c, api_url=api_url)

    if install_e2e:
        e2e_install(c, node_version=node_version, browser=browser)

    process, log_path = _start_background_frontend(
        api_url=api_url,
        host=host,
        port=int(port),
        node_version=node_version,
    )

    try:
        _wait_for_url(frontend_url.rstrip("/"))
        e2e_test(
            c,
            frontend_url=frontend_url,
            backend_url=api_url,
            node_version=node_version,
            email=email,
            password=password,
            username=username,
            spec=spec,
        )
    finally:
        _stop_background_process(process)
        print(f"Frontend log: {log_path}")


@task(name="e2e-test-decider")
def e2e_test_decider(
    c,
    frontend_url=DEFAULT_FRONTEND_URL,
    backend_url=DEFAULT_API_URL,
    node_version=DEFAULT_NODE_VERSION,
    email=DEFAULT_E2E_EMAIL,
    password=DEFAULT_E2E_PASSWORD,
    username=DEFAULT_E2E_USERNAME,
):
    """Run only the decider-match Playwright coverage against running services."""
    e2e_test(
        c,
        frontend_url=frontend_url,
        backend_url=backend_url,
        node_version=node_version,
        email=email,
        password=password,
        username=username,
        spec=DECIDER_MATCH_SPEC,
    )


@task(name="e2e-local-decider")
def e2e_local_decider(
    c,
    api_url=DEFAULT_API_URL,
    frontend_url=DEFAULT_FRONTEND_URL,
    host=DEFAULT_HOST,
    port=DEFAULT_PORT,
    install_frontend=True,
    install_e2e=True,
    node_version=DEFAULT_NODE_VERSION,
    browser="chromium",
    email=DEFAULT_E2E_EMAIL,
    password=DEFAULT_E2E_PASSWORD,
    username=DEFAULT_E2E_USERNAME,
):
    """Run the local end-to-end decider-match flow, including screenshot capture."""
    e2e_local(
        c,
        api_url=api_url,
        frontend_url=frontend_url,
        host=host,
        port=port,
        install_frontend=install_frontend,
        install_e2e=install_e2e,
        node_version=node_version,
        browser=browser,
        email=email,
        password=password,
        username=username,
        spec=DECIDER_MATCH_SPEC,
    )


@task(name="e2e-docker")
def e2e_docker(c, backend_version="latest", keep_running=False):
    """
    Run Playwright against the same Dockerized backend image family the pipeline uses.

    This boots Postgres + the GitLab backend production image + the local frontend
    container build, then runs the E2E container on the same internal network.
    """
    env = {"BACKEND_VERSION": backend_version}
    exit_error = None

    try:
        _compose(["up", "-d", "postgres", "backend", "frontend"], env=env)
        _compose(["run", "--rm", "e2e"], env=env)
    except subprocess.CalledProcessError as error:
        exit_error = error
        _compose(["logs", "--no-color", "backend", "frontend", "e2e"], env=env, check=False)
    finally:
        if keep_running:
            print("Docker E2E stack kept running.")
        else:
            _compose(["down", "-v", "--remove-orphans"], env=env, check=False)

    if exit_error:
        raise exit_error
