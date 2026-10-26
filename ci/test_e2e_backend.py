import json
import unittest
from unittest.mock import patch
import tasks


class BackendSourceTests(unittest.TestCase):
    @patch('tasks._compose')
    @patch('tasks.subprocess.run')
    def test_default_builds_pinned_source_without_registry_pull(self, run, compose):
        tasks.e2e_docker.body(None)
        config = json.loads((tasks.ROOT / 'ci/e2e-images.yml').read_text())
        command = run.call_args.args[0]
        self.assertIn('--target', command)
        self.assertIn('production', command)
        self.assertEqual(command[-1], 'https://github.com/Malaber/turniere-backend.git#' + config['backend_commit'])
        self.assertFalse(any(call.args[0][0] == 'pull' for call in compose.call_args_list))

    @patch('tasks._compose')
    @patch('tasks.subprocess.run')
    def test_explicit_ghcr_version_pulls_without_build(self, run, compose):
        tasks.e2e_docker.body(None, backend_version='0.0.1')
        run.assert_not_called()
        pulls = [call for call in compose.call_args_list if call.args[0][0] == 'pull']
        self.assertEqual(len(pulls), 1)
        self.assertEqual(pulls[0].kwargs['env']['E2E_BACKEND_IMAGE'], 'ghcr.io/malaber/turniere-backend:0.0.1')

    @patch('tasks.e2e_local')
    @patch('tasks._find_available_port', return_value=43123)
    @patch('tasks._compose')
    @patch('tasks.subprocess.run')
    def test_host_browser_uses_isolated_backend_and_cleans_up(self, run, compose, port, local):
        tasks.e2e_docker.body(None, host_browser=True, spec='tests/20-player-score-proposals.spec.ts')
        local.assert_called_once_with(None, api_url='http://127.0.0.1:43123',
                                     install_frontend=False, install_e2e=False,
                                     spec='tests/20-player-score-proposals.spec.ts',
                                     backend_sync_url='http://127.0.0.1:3000')
        self.assertEqual(compose.call_args_list[-1].args[0], ['down', '-v', '--remove-orphans'])
        self.assertFalse(any(call.args[0][0] == 'run' for call in compose.call_args_list))

    @patch('tasks._reset_screenshots_dir')
    @patch('tasks._wait_for_url')
    @patch('tasks._run_node')
    def test_sync_url_reaches_browser_process(self, node, wait, reset):
        tasks.e2e_test.body(None, backend_url='http://127.0.0.1:43123',
                            backend_sync_url='http://127.0.0.1:3000')
        env = node.call_args.kwargs['env']
        self.assertEqual(env['TURNIERE_BACKEND_URL'], 'http://127.0.0.1:43123')
        self.assertEqual(env['TURNIERE_BACKEND_SYNC_URL'], 'http://127.0.0.1:3000')

    @patch('tasks._reset_screenshots_dir')
    @patch('tasks._wait_for_url')
    @patch('tasks._run_node')
    def test_sync_url_defaults_to_backend_url(self, node, wait, reset):
        tasks.e2e_test.body(None, backend_url='http://backend:3000')
        self.assertEqual(node.call_args.kwargs['env']['TURNIERE_BACKEND_SYNC_URL'],
                         'http://backend:3000')
