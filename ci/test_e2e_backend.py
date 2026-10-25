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
