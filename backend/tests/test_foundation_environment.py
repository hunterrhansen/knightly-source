"""The dedicated real-auth runner must fail closed before app/database setup."""

import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    'foundation_runner', Path(__file__).parents[1] / 'scripts' / 'run-foundation-dev.py'
)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


def environment():
    import base64

    key = base64.b64encode(b'foundation-test.clerk.accounts.dev$').decode().rstrip('=')
    return {
        'CLERK_PUBLISHABLE_KEY': 'pk_test_' + key,
        'KNIGHTLY_AUTH': 'clerk',
        'KNIGHTLY_DATABASE_URL': 'postgresql://127.0.0.1:55439/knightly_foundation_dev',
        'KNIGHTLY_ALLOWED_ORIGINS': 'http://localhost:8095,http://127.0.0.1:8095',
        'KNIGHTLY_CORS_ORIGINS': 'http://localhost:8095,http://127.0.0.1:8095',
    }


def test_accepts_only_isolated_development_configuration():
    env = environment()
    assert runner.validate_environment(env) == env['KNIGHTLY_DATABASE_URL']


@pytest.mark.parametrize(
    'setting,value',
    [
        ('CLERK_PUBLISHABLE_KEY', ''),
        ('CLERK_PUBLISHABLE_KEY', 'pk_live_example'),
        ('CLERK_PUBLISHABLE_KEY', 'pk_test_example'),
        ('KNIGHTLY_AUTH', 'local'),
        ('KNIGHTLY_DATABASE_URL', 'postgresql://hosted.example/knightly'),
        ('KNIGHTLY_DATABASE_URL', 'postgresql://127.0.0.1:55439/knightly'),
        ('KNIGHTLY_CORS_ORIGINS', '*'),
        ('KNIGHTLY_ALLOWED_ORIGINS', 'http://localhost:8081'),
        ('PGSERVICE', 'hosted'),
        ('PGHOSTADDR', '192.0.2.1'),
    ],
)
def test_rejects_shared_or_non_development_configuration(setting, value):
    env = environment()
    env[setting] = value
    with pytest.raises((ValueError, SystemExit)):
        runner.validate_environment(env)
