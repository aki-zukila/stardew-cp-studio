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
    story_entries = _story_event_entries(entry)
    if story_entries:
        patch: dict[str, Any] = {
            "Action": "EditData",
            "Target": entry.target,
            "Entries": story_entries,
        }
        if entry.when:
            patch["When"] = entry.when
        patch.update(_export_advanced(entry.advanced))
        return patch

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


def _story_event_entries(entry: GameDataEntry) -> dict[str, Any] | None:
    if entry.kind != "event":
        return None
    studio = entry.advanced.get("StardewCPStudio") if isinstance(entry.advanced, dict) else None
    if not isinstance(studio, dict):
        return None
    story = studio.get("storyEvent")
    if not isinstance(story, dict):
        return None

    entries: dict[str, Any] = {}
    if entry.key:
        entries[entry.key] = entry.value
    for branch in story.get("branches", []) or []:
        if not isinstance(branch, dict):
            continue
        key = branch.get("key")
        nodes = branch.get("nodes")
        if isinstance(key, str) and key:
            entries[key] = _story_branch_script(key, nodes if isinstance(nodes, list) else [])
    return entries or None


def _story_branch_script(branch_key: str, nodes: list[Any]) -> str:
    commands = [
        command
        for node in nodes
        if isinstance(node, dict)
        for command in [_story_node_command(node, branch_key)]
        if command
    ]
    return "/".join(commands)


def _story_node_command(node: dict[str, Any], event_id: str) -> str:
    kind = node.get("kind")
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    i18n_key = data.get("i18nKey") if isinstance(data.get("i18nKey"), str) else ""
    text_ref = f"{{{{i18n:{i18n_key}}}}}" if i18n_key else ""
    if kind == "pause":
        return f"pause {_int_value(data.get('duration'), 500)}"
    if kind == "speak":
        return f"speak {data.get('actor') or 'ExampleNPC'} {_quote_event_arg(text_ref)}"
    if kind == "textAboveHead":
        return f"textAboveHead {data.get('actor') or 'ExampleNPC'} {_quote_event_arg(text_ref)}"
    if kind == "message":
        return f"message {_quote_event_arg(text_ref)}"
    if kind == "question":
        return f"question {data.get('forkId') or 'fork0'} {_quote_event_arg(text_ref)}"
    if kind == "fork":
        return f"fork {data.get('requirement') or 'fork0'} {data.get('eventId') or f'{event_id}_Branch'}"
    if kind == "move":
        suffix = " true" if data.get("continue") else ""
        return f"move {data.get('actor') or 'farmer'} {_int_value(data.get('x'), 0)} {_int_value(data.get('y'), 1)} {_int_value(data.get('direction'), 2)}{suffix}"
    if kind == "warp":
        return f"warp {data.get('actor') or 'farmer'} {_int_value(data.get('x'), 0)} {_int_value(data.get('y'), 0)}"
    if kind == "faceDirection":
        suffix = " true" if data.get("continue") else ""
        return f"faceDirection {data.get('actor') or 'ExampleNPC'} {_int_value(data.get('direction'), 2)}{suffix}"
    if kind == "emote":
        return f"emote {data.get('actor') or 'ExampleNPC'} {_int_value(data.get('emote'), 16)}"
    if kind == "animate":
        return f"animate {data.get('actor') or 'ExampleNPC'} {_bool_text(data.get('flip'), False)} {_bool_text(data.get('loop'), True)} {_int_value(data.get('frameDuration'), 120)} {data.get('frames') or '0 1 2'}"
    if kind == "showFrame":
        return f"showFrame {data.get('actor') or 'ExampleNPC'} {_int_value(data.get('frame'), 0)}"
    if kind == "stopAnimation":
        return f"stopAnimation {data.get('actor') or 'ExampleNPC'}"
    if kind == "playSound":
        return f"playSound {data.get('sound') or 'doorClose'}"
    if kind == "stopSound":
        suffix = " false" if data.get("immediate") is False else ""
        return f"stopSound {data.get('sound') or 'doorClose'}{suffix}"
    if kind == "playMusic":
        return f"playMusic {data.get('music') or 'continue'}"
    if kind == "stopMusic":
        return "stopMusic"
    if kind == "globalFade":
        parts = ["globalFade"]
        if data.get("speed"):
            parts.append(str(data.get("speed")))
        if data.get("continue"):
            parts.append("true")
        return " ".join(parts)
    if kind == "fade":
        return "fade unfade" if data.get("unfade") else "fade"
    if kind == "viewport":
        return f"viewport {_int_value(data.get('x'), -1000)} {_int_value(data.get('y'), -1000)}"
    if kind == "mail":
        return f"{data.get('command') or 'mailReceived'} {data.get('mailId') or 'ExampleMail'}"
    if kind == "addItem":
        return f"addItem {data.get('itemId') or '(O)388'} {_int_value(data.get('count'), 1)} {_int_value(data.get('quality'), 0)}"
    if kind == "friendship":
        return f"friendship {data.get('npc') or 'ExampleNPC'} {_int_value(data.get('amount'), 250)}"
    if kind == "end":
        mode = data.get("mode") or "end"
        if mode == "warpOut":
            return "end warpOut"
        if mode == "newDay":
            return "end newDay"
        if mode == "invisible":
            return f"end invisible {data.get('actor') or 'ExampleNPC'}"
        if mode == "dialogue":
            return f"end dialogue {data.get('actor') or 'ExampleNPC'} {_quote_event_arg(text_ref)}"
        if mode == "dialogueWarpOut":
            return f"end dialogueWarpOut {data.get('actor') or 'ExampleNPC'} {_quote_event_arg(text_ref)}"
        return "end"
    if kind == "custom":
        return str(data.get("raw") or "").strip()
    return ""


def _quote_event_arg(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _int_value(value: Any, fallback: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _bool_text(value: Any, fallback: bool) -> str:
    if isinstance(value, bool):
        return str(value).lower()
    return str(fallback).lower()


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
