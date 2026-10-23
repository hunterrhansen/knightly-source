import pytest
from conftest import as_user
from fastapi.testclient import TestClient

from knightly.api import create_app


def test_foundation_contracts(db_url, clerk):
    client = TestClient(create_app(database_url=db_url))
    schema = client.get('/openapi.json').json()
    assert '/api/config' in schema['paths']
    for path in ['/api/config', '/api/me']:
        assert '$ref' in schema['paths'][path]['get']['responses']['200']['content']['application/json']['schema']
    assert client.get('/api/config').status_code == 200
    assert client.get('/api/me').status_code == 401
    me = client.get('/api/me', headers=as_user('foundation-user'))
    assert me.status_code == 200
    assert isinstance(me.json()['admin'], bool)
    assert set(me.json()['limits']) == {'history_months', 'max_analysed', 'max_accounts'}
    assert '401' in schema['paths']['/api/me']['get']['responses']


def test_local_public_config_remains_nullable(db_url):
    response = TestClient(create_app(database_url=db_url)).get('/api/config')
    assert response.json() == {'clerk_publishable_key': None, 'contact': None}


def test_cors_explicit_allowlist_and_native_auth(db_url, clerk, monkeypatch):
    origin = 'https://rebuild.knightly.example'
    monkeypatch.setenv('KNIGHTLY_CORS_ORIGINS', origin)
    monkeypatch.setenv('KNIGHTLY_ALLOWED_ORIGINS', origin)
    client = TestClient(create_app(database_url=db_url))
    preflight = client.options(
        '/api/me',
        headers={
            'Origin': origin,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'authorization',
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers['access-control-allow-origin'] == origin
    assert 'access-control-allow-credentials' not in preflight.headers
    assert (
        'access-control-allow-origin'
        not in client.get('/api/config', headers={'Origin': 'https://evil.example'}).headers
    )
    assert client.get('/api/me', headers=as_user('u', azp='https://evil.example')).status_code == 401
    assert client.get('/api/me', headers=as_user('u', omit_azp=True)).status_code == 401
    monkeypatch.setenv('KNIGHTLY_ALLOW_NATIVE_AUTH', '1')
    native = TestClient(create_app(database_url=db_url))
    assert native.get('/api/me', headers=as_user('u', omit_azp=True)).status_code == 200
    assert native.get('/api/me', headers=as_user('u', azp='https://evil.example')).status_code == 401


@pytest.mark.parametrize(
    'origin',
    [
        '*',
        'https://example.com/path',
        'https://u:p@example.com',
        'https://example.com?q=1',
        'http://example.com',
        'https://example.com#x',
    ],
)
def test_invalid_cors_config_fails_closed(db_url, monkeypatch, origin):
    monkeypatch.setenv('KNIGHTLY_CORS_ORIGINS', origin)
    with pytest.raises(ValueError, match='CORS'):
        create_app(database_url=db_url)
