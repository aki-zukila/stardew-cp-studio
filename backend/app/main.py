from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .ai_service import get_ai_config, save_ai_config, suggest_with_ai, test_ai_connection
from .exporter import export_content_pack
from .item_catalog import load_item_catalog
from .models import (
    AIConfigPublic,
    AISuggestRequest,
    AISuggestResponse,
    ExportRequest,
    ImportAssetResponse,
    ItemCatalogResponse,
    OpenProjectRequest,
    Project,
    SaveAIConfigRequest,
    SaveProjectRequest,
)
from .project_io import import_asset, new_project, open_project, restore_package_assets, write_project_package
from .rule_library_loader import ai_rule_context, load_rule_library
from .rules import load_ruleset
from .validator import validate_project


app = FastAPI(title="Stardew CP Studio API")
RUNTIME_DIR = Path(__file__).resolve().parents[2] / ".runtime"
ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"
UPLOAD_DIR = RUNTIME_DIR / "uploads"
ASSET_SOURCES: dict[str, Path] = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": "ai-fields-v1", "ai": "ready"}


@app.get("/api/ruleset")
def get_ruleset():
    return load_ruleset()


@app.get("/api/rules/library")
def get_rule_library():
    return load_rule_library()


@app.get("/api/items/catalog")
def get_item_catalog() -> ItemCatalogResponse:
    return load_item_catalog()


@app.get("/api/rules/ai-context")
def get_ai_rule_context():
    return ai_rule_context()


@app.get("/api/projects/new")
@app.post("/api/projects/new")
def create_project() -> Project:
    return new_project()


@app.get("/favicon.ico")
def favicon():
    raise HTTPException(status_code=204)


@app.post("/api/projects/open")
def open_project_endpoint(request: OpenProjectRequest) -> Project:
    try:
        project = open_project(request.path)
        ASSET_SOURCES.update(restore_package_assets(request.path, UPLOAD_DIR))
        return project
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/projects/save")
def save_project_endpoint(request: SaveProjectRequest) -> dict[str, str]:
    try:
        write_project_package(request.project, request.path, ASSET_SOURCES)
        return {"path": request.path}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/assets/import")
async def import_asset_endpoint(project_json: str = Form(...), file: UploadFile = File(...), stored_path: str | None = Form(None)) -> ImportAssetResponse:
    project = Project.model_validate_json(project_json)
    project, asset, temp_path = await import_asset(project, file, UPLOAD_DIR, stored_path)
    ASSET_SOURCES[asset.id] = temp_path
    return ImportAssetResponse(project=project, asset=asset)


@app.get("/api/assets/{asset_id}")
def get_project_asset(asset_id: str):
    source = ASSET_SOURCES.get(asset_id)
    if not source or not source.exists() or not source.is_file():
        raise HTTPException(status_code=404, detail="Asset not found.")
    return FileResponse(source)


@app.post("/api/validate")
def validate_project_endpoint(project: Project):
    return validate_project(project)


@app.post("/api/export/content-pack")
def export_content_pack_endpoint(request: ExportRequest):
    try:
        target = export_content_pack(request.project, request.output_dir, request.folder_name, asset_sources=ASSET_SOURCES)
        return {"path": str(target)}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/ai/config")
def get_ai_config_endpoint() -> AIConfigPublic:
    return get_ai_config(RUNTIME_DIR)


@app.post("/api/ai/config")
def save_ai_config_endpoint(request: SaveAIConfigRequest) -> AIConfigPublic:
    try:
        return save_ai_config(RUNTIME_DIR, request)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/ai/suggest")
def ai_suggest_endpoint(request: AISuggestRequest) -> AISuggestResponse:
    try:
        return suggest_with_ai(RUNTIME_DIR, request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/ai/test")
def ai_test_endpoint() -> AISuggestResponse:
    try:
        return test_ai_connection(RUNTIME_DIR)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/")
def frontend_index():
    index_path = FRONTEND_DIST / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="Frontend is not built. Run setup.ps1 or build the frontend first.")
    return FileResponse(index_path)


@app.get("/assets/{asset_path:path}")
def frontend_asset(asset_path: str):
    asset_root = (FRONTEND_DIST / "assets").resolve()
    file_path = (asset_root / asset_path).resolve()
    if asset_root not in file_path.parents or not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Asset not found.")
    return FileResponse(file_path)
