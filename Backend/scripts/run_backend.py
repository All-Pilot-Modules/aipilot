"""Local backend startup, optionally mirroring console output to a latency log."""
import argparse
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime
import os
from pathlib import Path
import sys
import tempfile
import threading

LOG_DIR = Path(__file__).resolve().parents[1] / 'tmp'


class Tee:
    def __init__(self, console, logfile, lock):
        self.console = console
        self.logfile = logfile
        self.lock = lock

    def write(self, text):
        with self.lock:
            self.console.write(text)
            self.logfile.write(text)
            self.logfile.flush()
        return len(text)

    def flush(self):
        with self.lock:
            self.console.flush()
            self.logfile.flush()

    def isatty(self):
        return False

    @property
    def encoding(self):
        return self.console.encoding


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture-latency', action='store_true',
                        help='Enable timing and save console output to Backend/tmp/')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args(argv)
    if args.capture_latency:
        os.environ['LATENCY_ENABLED'] = '1'

    import uvicorn

    if not args.capture_latency:
        uvicorn.run('main:app', host=args.host, port=args.port)
        return

    stamp = datetime.now().astimezone().strftime('%Y%m%d-%H%M%S')
    LOG_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Unique files, created with owner-only read/write permissions.
    fd, path = tempfile.mkstemp(prefix=f'aipilot-latency-{stamp}-', suffix='.log', dir=LOG_DIR)
    lock = threading.RLock()
    with os.fdopen(fd, 'w', encoding='utf-8') as logfile:
        with redirect_stdout(Tee(sys.stdout, logfile, lock)), redirect_stderr(Tee(sys.stderr, logfile, lock)):
            print(f'Latency capture: {path}', flush=True)
            print(f'Report: python scripts/latency_report.py {path}', flush=True)
            try:
                uvicorn.run('main:app', host=args.host, port=args.port, use_colors=False)
            except BaseException:
                # Save startup failures before Python reports them to the console.
                import traceback
                traceback.print_exc(file=logfile)
                raise
