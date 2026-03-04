# Add this to your app.py so it closes cleanly when Electron (or taskkill) stops it.
# That way files are released and updates (e.g. git pull) can succeed.
#
# Usage: Copy the block below into your app.py, and call cleanup() from your shutdown handler.

import signal
import sys


def cleanup():
    """Close files, DB connections, servers, etc. so the process can exit without locking files."""
    # Example: if you have a Flask app or server, stop it
    # if app and hasattr(app, 'shutdown'): ...
    # If you have open files or DB: close them here
    sys.exit(0)


def shutdown(signum=None, frame=None):
    cleanup()


# Register so SIGTERM (from Electron or taskkill) and SIGINT (Ctrl+C) trigger cleanup
signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT, shutdown)
