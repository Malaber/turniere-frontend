import unittest
from unittest.mock import patch

import tasks


class LocalE2EFrontendResolutionTest(unittest.TestCase):
    def test_default_local_e2e_uses_available_port_and_matching_url(self):
        with patch.object(tasks, "_find_available_port", return_value=41234):
            port, frontend_url = tasks._resolve_local_e2e_frontend(0, "")

        self.assertEqual(port, 41234)
        self.assertEqual(frontend_url, "http://127.0.0.1:41234")

    def test_explicit_port_keeps_default_url_shape(self):
        port, frontend_url = tasks._resolve_local_e2e_frontend(3101, "")

        self.assertEqual(port, 3101)
        self.assertEqual(frontend_url, "http://127.0.0.1:3101")

    def test_explicit_frontend_url_supplies_port(self):
        port, frontend_url = tasks._resolve_local_e2e_frontend(0, "http://127.0.0.1:3210/")

        self.assertEqual(port, 3210)
        self.assertEqual(frontend_url, "http://127.0.0.1:3210")


if __name__ == "__main__":
    unittest.main()
