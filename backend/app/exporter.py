from __future__ import annotations

import json
import re
import shutil
import zipfile
from pathlib import Path
from typing import Any

from .models import GameDataEntry, ManifestDraft, PatchEntry, Project
from .validator import validate_project


def export_content_pack(
    project: Project,
    output_dir: str,
    folder_name: str | None = None,
    project_package: str | None = None,
    asset_sources: dict[str, Path] | None = None,
) -> Path:
    result = validate_project(project)
    if result.errors:
        messages = "; ".join(issue.message for issue in result.errors)
        raise ValueError(f"Cannot export project with errors: {messages}")

    base = Path(output_dir)
    pack_name = folder_name or _safe_folder_name(project.manifest.Name or project.meta.name)
    target = base / pack_name
    target.mkdir(parents=True, exist_ok=True)
    (target / "i18n").mkdir(exist_ok=True)
    (target / "assets").mkdir(exist_ok=True)

    dialogue_files = _write_dialogue_files(project, target)
    _write_json(target / "manifest.json", _manifest_json(project.manifest))
    _write_json(target / "content.json", _content_json(project, dialogue_files))
    _write_json(target / "i18n" / "default.json", project.i18n)
    _write_json(target / "assets" / "blank.json", {})
    _copy_assets(project, target, project_package, asset_sources or {})
    return target


def _manifest_json(manifest: ManifestDraft) -> dict[str, Any]:
    data: dict[str, Any] = {
        "Name": manifest.Name,
        "Author": manifest.Author,
        "Version": manifest.Version,
        "Description": manifest.Description,
        "UniqueID": manifest.UniqueID,
        "MinimumApiVersion": manifest.MinimumApiVersion,
        "ContentPackFor": {
            "UniqueID": "Pathoschild.ContentPatcher",
        },
    }
    if manifest.UpdateKeys:
        data["UpdateKeys"] = manifest.UpdateKeys
    if manifest.Dependencies:
        data["Dependencies"] = [
            dependency.model_dump(exclude_none=True)
            for dependency in manifest.Dependencies
            if dependency.UniqueID
        ]
    return data


def _content_json(project: Project, dialogue_files: list["DialogueFile"] | None = None) -> dict[str, Any]:
    changes = []
    for patch in project.patches:
        if patch.enabled:
            changes.append(_patch_json(patch))
    for patch in _dialogue_bootstrap_patches(project, dialogue_files or []):
        if not _has_equivalent_patch(changes, patch):
            changes.append(patch)
    for entry in project.game_data:
        if _dialogue_entry_info(entry):
            continue
        changes.append(_game_data_patch_json(entry))
    return {
        "Format": "2.9.0",
        "Changes": changes,
    }


def _patch_json(patch: PatchEntry) -> dict[str, Any]:
    data: dict[str, Any] = {
        "Action": patch.action,
    }
    if patch.target:
        data["Target"] = patch.target
    if patch.from_file:
        data["FromFile"] = patch.from_file
    if patch.when:
        data["When"] = patch.when
    data.update(patch.fields)
    data.update(_export_advanced(patch.advanced))
    return data


def _game_data_patch_json(entry: GameDataEntry) -> dict[str, Any]:
    patch: dict[str, Any] = {
        "Action": "EditData",
        "Target": entry.target,
        "Entries": {
            entry.key: entry.value,
        },
    }
    if entry.when:
        patch["When"] = entry.when
    patch.update(_export_advanced(entry.advanced))
    return patch


class DialogueFile(dict):
    npc: str
    kind: str
    target: str
    from_file: str


def _dialogue_entry_info(entry: GameDataEntry) -> dict[str, str] | None:
    if entry.kind != "dialogue":
        return None
    marriage = re.fullmatch(r"Characters/Dialogue/MarriageDialogue([^/]+)", entry.target or "")
    if marriage:
        return {
            "npc": marriage.group(1),
            "kind": "marriage",
            "target": entry.target,
            "from_file": f"assets/CharacterFiles/Dialogue/{marriage.group(1)}/MarriageDialogue.json",
        }
    normal = re.fullmatch(r"Characters/Dialogue/([^/]+)", entry.target or "")
    if normal:
        return {
            "npc": normal.group(1),
            "kind": "normal",
            "target": entry.target,
            "from_file": f"assets/CharacterFiles/Dialogue/{normal.group(1)}/dialogue.json",
        }
    return None


def _write_dialogue_files(project: Project, target: Path) -> list[DialogueFile]:
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    for entry in project.game_data:
        info = _dialogue_entry_info(entry)
        if not info:
            continue
        file_key = (info["npc"], info["kind"])
        bucket = grouped.setdefault(file_key, {"info": info, "changes": {}})
        export_advanced = _export_advanced(entry.advanced)
        change_key = (
            info["target"],
            _stable_json(entry.when),
            _stable_json(export_advanced),
        )
        change = bucket["changes"].setdefault(
            change_key,
            {
                "Action": "EditData",
                "Target": info["target"],
                "Entries": {},
                **({"When": entry.when} if entry.when else {}),
                **export_advanced,
            },
        )
        if entry.key:
            change["Entries"][entry.key] = entry.value

    dialogue_files: list[DialogueFile] = []
    for bucket in grouped.values():
        info = bucket["info"]
        changes = list(bucket["changes"].values())
        if not changes:
            continue
        relative = info["from_file"]
        _write_json(target / relative, {"Changes": changes})
        dialogue_files.append(info)
    return dialogue_files


def _dialogue_bootstrap_patches(project: Project, dialogue_files: list[DialogueFile]) -> list[dict[str, Any]]:
    patches: list[dict[str, Any]] = []
    targets: set[str] = set()
    for file_info in dialogue_files:
        if file_info["target"] not in targets:
            patches.append({
                "Action": "Load",
                "Target": file_info["target"],
                "FromFile": "assets/blank.json",
            })
            targets.add(file_info["target"])
        patches.append({
            "Action": "Include",
            "FromFile": file_info["from_file"],
        })
    return patches


def _has_equivalent_patch(changes: list[dict[str, Any]], patch: dict[str, Any]) -> bool:
    return any(
        existing.get("Action") == patch.get("Action")
        and existing.get("Target", "") == patch.get("Target", "")
        and existing.get("FromFile", "") == patch.get("FromFile", "")
        for existing in changes
    )


def _export_advanced(advanced: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in (advanced or {}).items()
        if not key.startswith("StardewCPStudio")
    }


def _stable_json(value: Any) -> str:
    return json.dumps(value or {}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _copy_assets(project: Project, target: Path, project_package: str | None, asset_sources: dict[str, Path]) -> None:
    copied: set[str] = set()
    for asset in project.assets:
        source = asset_sources.get(asset.id)
        if source and source.exists():
            destination = target / asset.stored_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
            copied.add(asset.id)

    if not project_package:
        return
    package_path = Path(project_package)
    if not package_path.exists():
        return
    with zipfile.ZipFile(package_path, "r") as archive:
        for asset in project.assets:
            if asset.id not in copied and asset.stored_path in archive.namelist():
                archive.extract(asset.stored_path, target)


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _safe_folder_name(name: str) -> str:
    cleaned = "".join(char if char.isalnum() or char in " ._-" else "_" for char in name).strip()
    return cleaned or "StardewCPContentPack"
