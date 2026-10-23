"""The Clerk-free UI runner must refuse anything but a dedicated loopback database."""

import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    'local_runner', Path(__file__).parents[1] / 'scripts' / 'run-local-dev.py'
)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


def test_defaults_to_the_dedicated_loopback_database():
    assert runner.validate_environment({}) == runner.DEFAULT_URL


@pytest.mark.parametrize(
    'env',
    [
        {'KNIGHTLY_DATABASE_URL': 'postgresql://hosted.example/knightly_local_dev'},
        {'KNIGHTLY_DATABASE_URL': 'postgresql://127.0.0.1:55439/knightly_foundation_dev'},
        {'KNIGHTLY_DATABASE_URL': 'postgresql://127.0.0.1:55439/knightly'},
        {'PGSERVICE': 'hosted'},
        {'PGHOSTADDR': '192.0.2.1'},
        {'CLERK_PUBLISHABLE_KEY': 'pk_test_example'},
    ],
)
def test_refuses_shared_hosted_or_clerk_configuration(env):
    with pytest.raises(ValueError):
        runner.validate_environment(env)
