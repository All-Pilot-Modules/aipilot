"""Launcher tests avoid importing the application or contacting providers."""
import contextlib
import io
import os
from pathlib import Path
import runpy
import sys
import tempfile
import threading
import types
import unittest
from unittest.mock import patch

BACKEND = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND))
from scripts import run_backend


class BackendLauncherTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ)
        self.env.start()
        os.environ.pop('LATENCY_ENABLED', None)
        self.addCleanup(self.env.stop)

    def test_normal_startup_does_not_enable_capture(self):
        with patch.dict(sys.modules, uvicorn=types.SimpleNamespace(run=lambda *a, **kw: None)):
            with patch('uvicorn.run') as run, patch.object(run_backend.tempfile, 'mkstemp') as create:
                run_backend.main([])
                run.assert_called_once_with('main:app', host='127.0.0.1', port=8000)
                create.assert_not_called()
                self.assertNotIn('LATENCY_ENABLED', os.environ)

    def test_capture_enables_timings_and_mirrors_both_streams(self):
        output, errors = io.StringIO(), io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            capture_dir = Path(directory) / 'tmp'
            def serve(*args, **kwargs):
                self.assertEqual(os.environ['LATENCY_ENABLED'], '1')
                self.assertEqual(kwargs['port'], 8123)
                print('stdout sample')
                print('stderr sample', file=sys.stderr)
                worker = threading.Thread(target=lambda: print('worker sample'))
                worker.start()
                worker.join()
            with patch.dict(sys.modules, uvicorn=types.SimpleNamespace(run=serve)):
                with patch.object(run_backend, 'LOG_DIR', capture_dir):
                    with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
                        run_backend.main(['--capture-latency', '--port', '8123'])
            log, = capture_dir.glob('aipilot-latency-*.log')
            content = log.read_text()
            for message in ['stdout sample', 'stderr sample', 'worker sample', 'Report: python scripts/latency_report.py']:
                self.assertIn(message, content)
            self.assertIn('stdout sample', output.getvalue())
            self.assertIn('stderr sample', errors.getvalue())
            self.assertEqual(log.stat().st_mode & 0o777, 0o600)

    def test_capture_saves_startup_failure_and_restores_streams(self):
        original = sys.stdout, sys.stderr
        with tempfile.TemporaryDirectory() as directory:
            fd, path = tempfile.mkstemp(dir=directory)
            def fail(*args, **kwargs):
                raise RuntimeError('startup failed')
            with patch.dict(sys.modules, uvicorn=types.SimpleNamespace(run=fail)):
                with patch.object(run_backend, 'LOG_DIR', Path(directory)), patch.object(run_backend.tempfile, 'mkstemp', return_value=(fd, path)):
                    with contextlib.redirect_stdout(io.StringIO()):
                        with self.assertRaisesRegex(RuntimeError, 'startup failed'):
                            run_backend.main(['--capture-latency'])
            self.assertIn('RuntimeError: startup failed', Path(path).read_text())
            self.assertEqual((sys.stdout, sys.stderr), original)

    def test_python_main_entrypoint_starts_server_without_double_import(self):
        with patch.object(run_backend, 'main') as start, patch.object(sys, 'argv', ['main.py']):
            with self.assertRaises(SystemExit) as stopped:
                runpy.run_path(str(BACKEND / 'main.py'), run_name='__main__')
            self.assertEqual(stopped.exception.code, 0)
            start.assert_called_once_with()


if __name__ == '__main__':
    unittest.main()
