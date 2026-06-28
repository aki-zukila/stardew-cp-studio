from __future__ import annotations

import asyncio
from copy import deepcopy
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
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
    MapResourceEntry,
    MapResourceResponse,
    OpenProjectRequest,
    Project,
    SaveAIConfigRequest,
    SaveProjectRequest,
    SessionState,
    SessionStateUpdate,
)
from .project_io import import_asset, new_project, open_project, restore_package_assets, write_project_package
from .rule_library_loader import ai_rule_context, load_rule_library
from .rules import load_ruleset
from .validator import validate_project


app = FastAPI(title="Stardew CP Studio API")
RUNTIME_DIR = Path(__file__).resolve().parents[2] / ".runtime"
ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"
MAP_RESOURCE_DIR = ROOT_DIR / "MapResource"
UPLOAD_DIR = RUNTIME_DIR / "uploads"
ASSET_SOURCES: dict[str, Path] = {}
DEFAULT_PROJECT_PATH = str(ROOT_DIR / "example.cpgen")
DEFAULT_EXPORT_PATH = str(ROOT_DIR / "exports")


class SharedSession:
    def __init__(self) -> None:
        self.project = new_project()
        self.project_path = DEFAULT_PROJECT_PATH
        self.export_path = DEFAULT_EXPORT_PATH
        self.revision = 0
        self.last_client_id = ""
        self.lock = asyncio.Lock()
        self.websockets: set[WebSocket] = set()

    def snapshot(self) -> SessionState:
        return SessionState(
            project=deepcopy(self.project),
            projectPath=self.project_path,
            exportPath=self.export_path,
            revision=self.revision,
            lastClientId=self.last_client_id,
        )

    async def update(self, update: SessionStateUpdate) -> SessionState:
        async with self.lock:
            self.project = update.project
            self.project_path = update.projectPath
            self.export_path = update.exportPath
            self.last_client_id = update.clientId
            self.revision += 1
            return self.snapshot()


SESSION = SharedSession()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def broadcast_session(snapshot: SessionState) -> None:
    stale: list[WebSocket] = []
    payload = snapshot.model_dump(mode="json")
    for websocket in list(SESSION.websockets):
        try:
            await websocket.send_json(payload)
        except Exception:
            stale.append(websocket)
    for websocket in stale:
        SESSION.websockets.discard(websocket)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": "ai-fields-v1", "ai": "ready"}


@app.get("/api/session")
def get_session() -> SessionState:
    return SESSION.snapshot()


@app.post("/api/session/state")
async def update_session(request: SessionStateUpdate) -> SessionState:
    snapshot = await SESSION.update(request)
    await broadcast_session(snapshot)
    return snapshot


@app.websocket("/api/session/ws")
async def session_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    SESSION.websockets.add(websocket)
    await websocket.send_json(SESSION.snapshot().model_dump(mode="json"))
    try:
        while True:
            data = await websocket.receive_json()
            update = SessionStateUpdate.model_validate(data)
            snapshot = await SESSION.update(update)
            await broadcast_session(snapshot)
    except WebSocketDisconnect:
        SESSION.websockets.discard(websocket)
    except Exception:
        SESSION.websockets.discard(websocket)
        await websocket.close()


@app.get("/api/ruleset")
def get_ruleset():
    return load_ruleset()


@app.get("/api/rules/library")
def get_rule_library():
    return load_rule_library()


@app.get("/api/items/catalog")
def get_item_catalog() -> ItemCatalogResponse:
    return load_item_catalog()


@app.get("/api/maps/resources")
def get_map_resources() -> MapResourceResponse:
    if not MAP_RESOURCE_DIR.exists():
        return MapResourceResponse(source_path=str(MAP_RESOURCE_DIR), warning="MapResource folder not found.")
    maps: list[MapResourceEntry] = []
    for path in sorted(MAP_RESOURCE_DIR.glob("*.png")):
        try:
            width, height = _png_size(path)
        except ValueError:
            continue
        maps.append(MapResourceEntry(
            key=path.stem,
            filename=path.name,
            width=width,
            height=height,
            tile_width=width // 16,
            tile_height=height // 16,
            url=f"/api/maps/resources/{path.name}",
        ))
    return MapResourceResponse(maps=maps, source_path=str(MAP_RESOURCE_DIR))


@app.get("/api/maps/resources/{filename}")
def get_map_resource_image(filename: str):
    path = (MAP_RESOURCE_DIR / filename).resolve()
    root = MAP_RESOURCE_DIR.resolve()
    if path.parent != root or path.suffix.lower() != ".png" or not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Map resource not found.")
    return FileResponse(path)


def _png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as file:
        header = file.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Not a PNG file.")
    return int.from_bytes(header[16:20], "big"), int.from_bytes(header[20:24], "big")


@app.get("/api/rules/ai-context")
def get_ai_rule_context():
    return ai_rule_context()


@app.get("/api/projects/new")
@app.post("/api/projects/new")
async def create_project() -> Project:
    project = new_project()
    snapshot = await SESSION.update(SessionStateUpdate(project=project, projectPath=SESSION.project_path, exportPath=SESSION.export_path, clientId="server"))
    await broadcast_session(snapshot)
    return project


@app.get("/favicon.ico")
def favicon():
    raise HTTPException(status_code=204)


@app.post("/api/projects/open")
async def open_project_endpoint(request: OpenProjectRequest) -> Project:
    try:
        project = open_project(request.path)
        ASSET_SOURCES.update(restore_package_assets(request.path, UPLOAD_DIR))
        snapshot = await SESSION.update(SessionStateUpdate(project=project, projectPath=request.path, exportPath=SESSION.export_path, clientId="server"))
        await broadcast_session(snapshot)
        return project
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/projects/open-upload")
async def open_uploaded_project_endpoint(file: UploadFile = File(...)) -> Project:
    try:
        safe_name = "".join(char if char.isalnum() or char in "._-" else "_" for char in (file.filename or "project.cpgen"))
        project_dir = UPLOAD_DIR / "projects"
        project_dir.mkdir(parents=True, exist_ok=True)
        project_path = project_dir / safe_name
        with project_path.open("wb") as target:
            while chunk := await file.read(1024 * 1024):
                target.write(chunk)
        project = open_project(str(project_path))
        ASSET_SOURCES.update(restore_package_assets(str(project_path), UPLOAD_DIR))
        return project
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/projects/save")
async def save_project_endpoint(request: SaveProjectRequest) -> dict[str, str]:
    try:
        write_project_package(request.project, request.path, ASSET_SOURCES)
        snapshot = await SESSION.update(SessionStateUpdate(project=request.project, projectPath=request.path, exportPath=SESSION.export_path, clientId="server"))
        await broadcast_session(snapshot)
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
