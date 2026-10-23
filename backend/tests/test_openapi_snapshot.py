"""Export deterministically using an isolated fixture database, never hosted app creation."""

import json
import os
from pathlib import Path

import psycopg
import pytest

from knightly.api import create_app


def test_export_openapi(request):
    output = os.environ.get('KNIGHTLY_SCHEMA_OUTPUT')
    if not output:
        pytest.skip('Set KNIGHTLY_SCHEMA_OUTPUT to explicitly export the public contract')
    info = psycopg.conninfo.conninfo_to_dict(os.environ.get('KNIGHTLY_TEST_DATABASE_URL', 'postgresql:///postgres'))
    host = info.get('host', os.environ.get('PGHOST', ''))
    assert host in ('', 'localhost', '127.0.0.1', '::1') or host.startswith('/'), (
        'Schema export requires a local disposable database'
    )
    address = info.get('hostaddr', os.environ.get('PGHOSTADDR', ''))
    assert not address or address in ('127.0.0.1', '::1'), 'Schema export requires a local address'
    assert not info.get('service') and not os.environ.get('PGSERVICE'), 'Schema export cannot use a service alias'
    path = Path(output)
    assert path.is_absolute(), 'Schema output must be an explicit absolute path'
    db_url = request.getfixturevalue('db_url')
    schema = create_app(database_url=db_url).openapi()
    assert '/api/config' in schema['paths']
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(schema, indent=2, sort_keys=True) + '\n')


def test_export_rejects_remote_before_database_setup(monkeypatch, tmp_path):
    monkeypatch.setenv('KNIGHTLY_SCHEMA_OUTPUT', str(tmp_path / 'schema.json'))
    monkeypatch.setenv('KNIGHTLY_TEST_DATABASE_URL', 'postgresql://remote.example/postgres')

    class NoDatabase:
        def getfixturevalue(self, name):
            raise AssertionError('Database setup must not run')

    with pytest.raises(AssertionError, match='local disposable'):
        test_export_openapi(NoDatabase())
