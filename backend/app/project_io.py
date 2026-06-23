from __future__ import annotations

import json
import mimetypes
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from uuid import uuid4

from fastapi import UploadFile

from .models import AssetRecord, Project
from .rules import load_ruleset


PROJECT_FILE = "project.json"
RULESET_FILE = "ruleset.json"
ASSET_ROOT = PurePosixPath("assets")


def new_project() -> Project:
    project = Project()
    project.i18n = {
        "mod.name": project.manifest.Name,
        "mod.description": project.manifest.Description,
    }
    return project


def write_project_package(project: Project, path: str, asset_sources: dict[str, Path] | None = None) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    project.meta.updated_at = datetime.now(timezone.utc).isoformat()
    asset_sources = asset_sources or {}

    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(PROJECT_FILE, project.model_dump_json(indent=2, exclude_none=True))
        archive.writestr(RULESET_FILE, load_ruleset().model_dump_json(indent=2))
        archive.writestr("assets/blank.json", "{}\n")
        for asset in project.assets:
            source = asset_sources.get(asset.id)
            if source and source.exists():
                archive.write(source, asset.stored_path)


def open_project(path: str) -> Project:
    with zipfile.ZipFile(Path(path), "r") as archive:
        with archive.open(PROJECT_FILE) as file:
            data = json.loads(file.read().decode("utf-8"))
    return Project.model_validate(data)


def extract_assets(project_path: str, destination: Path) -> list[AssetRecord]:
    destination.mkdir(parents=True, exist_ok=True)
    project = open_project(project_path)
    with zipfile.ZipFile(Path(project_path), "r") as archive:
        for asset in project.assets:
            if asset.stored_path in archive.namelist():
                archive.extract(asset.stored_path, destination)
    return project.assets


async def import_asset(project: Project, upload: UploadFile, temp_root: Path, stored_path: str | None = None) -> tuple[Project, AssetRecord, Path]:
    original_name = upload.filename or "asset.bin"
    suffix = Path(original_name).suffix
    asset_id = str(uuid4())
    safe_name = _safe_asset_name(original_name)
    stored_path = _safe_stored_path(stored_path, asset_id, safe_name)
    temp_root.mkdir(parents=True, exist_ok=True)
    temp_path = temp_root / f"{asset_id}{suffix}"

    with temp_path.open("wb") as file:
        shutil.copyfileobj(upload.file, file)

    content_type = upload.content_type or mimetypes.guess_type(original_name)[0] or "application/octet-stream"
    asset = AssetRecord(
        id=asset_id,
        original_name=original_name,
        stored_path=stored_path,
        content_type=content_type,
        size=temp_path.stat().st_size,
    )
    project.assets.append(asset)
    return project, asset, temp_path


def restore_package_assets(project_path: str, temp_root: Path) -> dict[str, Path]:
    project = open_project(project_path)
    asset_sources: dict[str, Path] = {}
    temp_root.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(Path(project_path), "r") as archive:
        for asset in project.assets:
            if asset.stored_path not in archive.namelist():
                continue
            destination = temp_root / asset.id / Path(asset.original_name).name
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(asset.stored_path) as source, destination.open("wb") as target:
                shutil.copyfileobj(source, target)
            asset_sources[asset.id] = destination
    return asset_sources


def _safe_asset_name(name: str) -> str:
    cleaned = "".join(char if char.isalnum() or char in "._-" else "_" for char in name)
    return cleaned or "asset.bin"


def _safe_stored_path(requested: str | None, asset_id: str, safe_name: str) -> str:
    if not requested:
        return f"assets/{asset_id}/{safe_name}"
    normalized = requested.replace("\\", "/").strip("/")
    parts = [part for part in PurePosixPath(normalized).parts if part not in ("", ".", "..")]
    if not parts or parts[0] != "assets":
        parts = ["assets", *parts]
    return str(PurePosixPath(*parts))
