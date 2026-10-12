"""Access to runtime configuration that works both on Workers and locally."""

import os


def workers_env():
    """The Worker `env` (bindings, vars, secrets), or None when not running on Workers."""
    try:
        from workers import env  # available only inside the Python Workers runtime
    except ImportError:
        return None
    return env


def setting(name, default=None):
    """Read a setting from os.environ first, then from the Worker vars/secrets."""
    if name in os.environ:
        return os.environ[name]
    env = workers_env()
    if env is not None:
        value = getattr(env, name, None)
        if value is not None:
            return str(value)
    return default
