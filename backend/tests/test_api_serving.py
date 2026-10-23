"""The backend process serves only API routes."""

from types import SimpleNamespace

from starlette.testclient import TestClient

from knightly import cli


def test_serve_exposes_only_the_api(db_url, monkeypatch):
    def inspect_server(app, **kwargs):
        with TestClient(app) as client:
            assert client.get("/").status_code == 404
            assert client.get("/review/1").status_code == 404
            assert client.get("/api/health").status_code == 200

    monkeypatch.setattr("uvicorn.run", inspect_server)
    cli.cmd_serve(None, SimpleNamespace(db=db_url, worker=False, host="127.0.0.1", port=8000))
