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
    (target / "code").mkdir(exist_ok=True)

    dialogue_files = _write_dialogue_files(project, target)
    _write_json(target / "manifest.json", _manifest_json(project.manifest))
    include_files = _write_code_files(project, target, dialogue_files)
    _write_json(target / "content.json", _root_content_json(include_files))
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


def _root_content_json(include_files: list[str]) -> dict[str, Any]:
    return {
        "Format": "2.9.0",
        "Changes": [
            {
                "Action": "Include",
                "FromFile": include_file,
            }
            for include_file in include_files
        ],
    }


def _write_code_files(project: Project, target: Path, dialogue_files: list["DialogueFile"] | None = None) -> list[str]:
    groups = _code_change_groups(project, dialogue_files or [])
    include_files: list[str] = []
    for filename in [
        "patches.json",
        "characters.json",
        "items.json",
        "dialogue.json",
        "events.json",
        "mail.json",
        "shops.json",
        "custom.json",
    ]:
        changes = groups.get(filename, [])
        if not changes:
            continue
        relative = f"code/{filename}"
        _write_json(target / relative, {"Changes": changes})
        include_files.append(relative)
    return include_files


def _code_change_groups(project: Project, dialogue_files: list["DialogueFile"]) -> dict[str, list[dict[str, Any]]]:
    groups: dict[str, list[dict[str, Any]]] = {
        "patches.json": [],
        "characters.json": [],
        "items.json": [],
        "dialogue.json": [],
        "events.json": [],
        "mail.json": [],
        "shops.json": [],
        "custom.json": [],
    }

    for patch in project.patches:
        if patch.enabled:
            groups["patches.json"].append(_patch_json(patch))

    for patch in _dialogue_bootstrap_patches(project, dialogue_files):
        if not _has_equivalent_patch(groups["dialogue.json"], patch):
            groups["dialogue.json"].append(patch)

    for patch in _mail_background_load_patches(project):
        if not _has_equivalent_patch(groups["mail.json"], patch):
            groups["mail.json"].append(patch)

    for entry in project.game_data:
        if _dialogue_entry_info(entry):
            continue
        groups[_code_group_for_entry(entry)].append(_game_data_patch_json(entry))

    return groups


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


def _code_group_for_entry(entry: GameDataEntry) -> str:
    target = entry.target or ""
    if entry.kind == "npc" or target in {"Data/Characters", "Data/NPCGiftTastes", "Data/MoviesReactions"} or target.startswith("Characters/schedules/"):
        return "characters.json"
    if entry.kind == "item" or target.startswith("Data/Objects") or target.startswith("Data/BigCraftables"):
        return "items.json"
    if entry.kind == "event" or target.startswith("Data/Events/"):
        return "events.json"
    if entry.kind in {"mail", "trigger_action"} or target in {"Data/Mail", "Data/TriggerActions"}:
        return "mail.json"
    if entry.kind == "shop" or target.startswith("Data/Shops"):
        return "shops.json"
    if "Dialogue" in target or target.startswith("Data/Festivals/") or target == "Data/EngagementDialogue":
        return "dialogue.json"
    return "custom.json"


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

    value = _mail_entry_value(entry) if entry.kind == "mail" else entry.value
    patch: dict[str, Any] = {
        "Action": "EditData",
        "Target": entry.target,
        "Entries": {
            entry.key: value,
        },
    }
    if entry.when:
        patch["When"] = entry.when
    patch.update(_export_advanced(entry.advanced))
    return patch


def _mail_entry_value(entry: GameDataEntry) -> Any:
    if not isinstance(entry.value, dict):
        return entry.value
    body = _mail_body_for_export(str(entry.value.get("Body") or entry.value.get("Text") or entry.value.get("Message") or ""))
    title = str(entry.value.get("Title") or "")
    parts: list[str] = []
    background_asset = str(entry.value.get("BackgroundAssetTarget") or entry.value.get("BackgroundAsset") or "").strip()
    background_mode = entry.value.get("BackgroundMode")
    background_type = str(entry.value.get("BackgroundType") or ("custom" if background_asset else "vanilla")).strip()
    if background_asset:
        parts.append(f"[letterbg {background_asset} {_int_value(background_mode, 0)}]")
    elif background_type != "vanilla" and background_mode not in (None, ""):
        parts.append(f"[letterbg {background_mode}]")
    elif background_mode not in (None, "", "vanilla"):
        parts.append(f"[letterbg {background_mode}]")
    text_color = str(entry.value.get("TextColor") or "").strip()
    if text_color:
        parts.append(f"[textcolor {text_color}]")
    parts.append(body)
    for attachment in entry.value.get("Attachments") or []:
        if isinstance(attachment, dict):
            marker = _mail_attachment_marker(attachment)
            if marker:
                parts.append(marker)
    text = "".join(parts)
    if title:
        text = f"{text}[#]{title}"
    return text


def _mail_body_for_export(text: str) -> str:
    return text.replace("\r\n", "^").replace("\r", "^").replace("\n", "^")


def _mail_background_load_patches(project: Project) -> list[dict[str, Any]]:
    patches: list[dict[str, Any]] = []
    for entry in project.game_data:
        if entry.kind != "mail" or not isinstance(entry.value, dict):
            continue
        asset = str(entry.value.get("BackgroundAssetTarget") or entry.value.get("BackgroundAsset") or "").strip()
        source = str(entry.value.get("BackgroundFile") or "").strip()
        if asset and source:
            patches.append({
                "Action": "Load",
                "Target": asset,
                "FromFile": source,
            })
    return patches


def _mail_attachment_marker(attachment: dict[str, Any]) -> str:
    marker = str(attachment.get("marker") or attachment.get("Marker") or attachment.get("Text") or attachment.get("text") or "").strip()
    if marker:
        return marker
    kind = str(attachment.get("kind") or attachment.get("Type") or "action").strip()
    if kind == "action":
        action = str(attachment.get("action") or attachment.get("Action") or "AddMail ExampleMail").strip()
        return action if action.startswith("%action") else f"%action {action} %%"
    if kind == "item_id":
        item_id = str(attachment.get("itemId") or attachment.get("ItemId") or "(O)388").strip()
        count = _int_value(attachment.get("count") or attachment.get("Count"), 1)
        return f"%item id {item_id} {count} %%"
    if kind == "money":
        minimum = attachment.get("minAmount")
        maximum = attachment.get("maxAmount")
        amount = attachment.get("amount")
        if minimum is not None and maximum is not None and _int_value(maximum, 0) > _int_value(minimum, 0):
            return f"%item money {_int_value(minimum, 0)} {_int_value(maximum, 1)} %%"
        return f"%item money {_int_value(amount, 0)} %%"
    if kind == "conversationTopic":
        topic = str(attachment.get("topic") or attachment.get("Topic") or "ExampleTopic").strip()
        days = _int_value(attachment.get("days") or attachment.get("Days"), 1)
        return f"%item conversationTopic {topic} {days} %%"
    if kind == "cookingRecipe":
        recipe = str(attachment.get("recipeId") or attachment.get("RecipeId") or "").strip()
        return f"%item cookingRecipe {recipe} %%".rstrip()
    if kind == "craftingRecipe":
        recipe = str(attachment.get("recipeId") or attachment.get("RecipeId") or "ExampleRecipe").strip()
        return f"%item craftingRecipe {recipe} %%"
    if kind == "itemRecovery":
        recipe = str(attachment.get("recipeId") or attachment.get("RecipeId") or "ExampleQuestItem").strip()
        return f"%item itemRecovery {recipe} %%"
    if kind == "quest":
        quest_id = str(attachment.get("questId") or attachment.get("QuestId") or "0").strip()
        return f"%item quest {quest_id}{' true' if attachment.get('autoGrant') or attachment.get('AutoGrant') else ''} %%"
    if kind == "specialOrder":
        order_id = str(attachment.get("orderId") or attachment.get("OrderId") or "0").strip()
        return f"%item specialOrder {order_id}{' immediately' if attachment.get('immediate') or attachment.get('Immediately') else ''} %%"
    return ""


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
        nodes = story.get("nodes")
        entries[entry.key] = _story_main_script(entry.key, entry.value, nodes if isinstance(nodes, list) else [])
    for branch in story.get("branches", []) or []:
        if not isinstance(branch, dict):
            continue
        key = branch.get("key")
        nodes = branch.get("nodes")
        if isinstance(key, str) and key:
            entries[key] = _story_branch_script(key, nodes if isinstance(nodes, list) else [])
    return entries or None


def _story_main_script(entry_key: str, fallback: Any, nodes: list[Any]) -> Any:
    if not nodes:
        return fallback
    parts = str(fallback or "").split("/")
    start = parts[:3] if len(parts) >= 3 else ["continue", "-500 -500", "farmer -500 -500 2"]
    event_id = entry_key.split("/", 1)[0] if entry_key else ""
    commands = [
        command
        for node in nodes
        if isinstance(node, dict)
        for command in [_story_node_command(node, event_id)]
        if command
    ]
    return "/".join([*start, *commands])


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
    if kind == "splitSpeak":
        return f"splitSpeak {data.get('actor') or 'ExampleNPC'} {_quote_event_arg(text_ref)}"
    if kind == "textAboveHead":
        return f"textAboveHead {data.get('actor') or 'ExampleNPC'} {_quote_event_arg(text_ref)}"
    if kind == "message":
        return f"message {_quote_event_arg(text_ref)}"
    if kind == "question":
        return f"question {data.get('forkId') or 'fork0'} {_quote_event_arg(text_ref)}"
    if kind == "quickQuestion":
        return f"quickQuestion {_quote_event_arg(text_ref)}"
    if kind == "fork":
        if data.get("requirement"):
            return f"fork {data.get('requirement')} {data.get('eventId') or f'{event_id}_Branch'}"
        return f"fork {data.get('eventId') or f'{event_id}_Branch'}"
    if kind == "questionAnswered":
        suffix = " false" if data.get("answered") is False else ""
        return f"questionAnswered {data.get('answerId') or 'event_answer'}{suffix}"
    if kind == "move":
        suffix = " true" if data.get("continue") else ""
        return f"move {data.get('actor') or 'farmer'} {_int_value(data.get('x'), 0)} {_int_value(data.get('y'), 1)} {_int_value(data.get('direction'), 2)}{suffix}"
    if kind == "advancedMove":
        return f"advancedMove {data.get('actor') or 'ExampleNPC'} {_bool_text(data.get('loop'), False)} {data.get('path') or '0 3 2 0'}"
    if kind == "positionOffset":
        suffix = " true" if data.get("continue") else ""
        return f"positionOffset {data.get('actor') or 'ExampleNPC'} {_int_value(data.get('x'), 0)} {_int_value(data.get('y'), 0)}{suffix}"
    if kind == "warp":
        return f"warp {data.get('actor') or 'farmer'} {_int_value(data.get('x'), 0)} {_int_value(data.get('y'), 0)}"
    if kind == "warpFarmers":
        return f"warpFarmers {data.get('placements') or '64 15 2'} {_int_value(data.get('defaultOffset'), 0)} {_int_value(data.get('defaultX'), 64)} {_int_value(data.get('defaultY'), 15)} {_int_value(data.get('direction'), 2)}"
    if kind == "faceDirection":
        suffix = " true" if data.get("continue") else ""
        return f"faceDirection {data.get('actor') or 'ExampleNPC'} {_int_value(data.get('direction'), 2)}{suffix}"
    if kind == "emote":
        return f"emote {data.get('actor') or 'ExampleNPC'} {_int_value(data.get('emote'), 16)}"
    if kind == "animate":
        return f"animate {data.get('actor') or 'ExampleNPC'} {_bool_text(data.get('flip'), False)} {_bool_text(data.get('loop'), True)} {_int_value(data.get('frameDuration'), 120)} {data.get('frames') or '0 1 2'}"
    if kind == "showFrame":
        suffix = " true" if data.get("flip") else ""
        return f"showFrame {data.get('actor') or 'ExampleNPC'} {_int_value(data.get('frame'), 0)}{suffix}"
    if kind == "stopAnimation":
        return f"stopAnimation {data.get('actor') or 'ExampleNPC'}"
    if kind == "shake":
        return f"shake {data.get('actor') or 'ExampleNPC'} {_int_value(data.get('duration'), 1000)}"
    if kind == "jump":
        return f"jump {data.get('actor') or 'ExampleNPC'} {_int_value(data.get('intensity'), 8)}"
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
    if kind == "globalFadeToClear":
        parts = ["globalFadeToClear"]
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
    if kind == "eventSeen":
        suffix = " false" if data.get("seen") is False else ""
        return f"eventSeen {data.get('eventId') or event_id or 'ExampleEvent'}{suffix}"
    if kind == "addItem":
        return f"addItem {data.get('itemId') or '(O)388'} {_int_value(data.get('count'), 1)} {_int_value(data.get('quality'), 0)}"
    if kind == "removeItem":
        return f"removeItem {data.get('itemId') or '(O)388'} {_int_value(data.get('count'), 1)}"
    if kind == "addObject":
        suffix = f" {data.get('layerDepth')}" if data.get("layerDepth") else ""
        return f"addObject {_int_value(data.get('x'), 64)} {_int_value(data.get('y'), 15)} {data.get('itemId') or '(O)388'}{suffix}"
    if kind == "removeObject":
        return f"removeObject {_int_value(data.get('x'), 64)} {_int_value(data.get('y'), 15)}"
    if kind == "removeSprite":
        return f"removeSprite {_int_value(data.get('x'), 64)} {_int_value(data.get('y'), 15)}"
    if kind == "addTemporaryActor":
        parts = [
            "addTemporaryActor",
            _quote_event_arg(str(data.get("spriteAssetName") or "Ghost")),
            str(_int_value(data.get("spriteWidth"), 16)),
            str(_int_value(data.get("spriteHeight"), 32)),
            str(_int_value(data.get("x"), 64)),
            str(_int_value(data.get("y"), 15)),
            str(_int_value(data.get("direction"), 2)),
        ]
        if data.get("breather") not in (None, ""):
            parts.append(str(data.get("breather")))
        if data.get("actorType"):
            parts.append(str(data.get("actorType")))
        if data.get("overrideName"):
            parts.append(_quote_event_arg(str(data.get("overrideName"))))
        return " ".join(parts)
    if kind == "changeLocation":
        return f"changeLocation {data.get('location') or 'Farm'}"
    if kind == "changeMapTile":
        return f"changeMapTile {data.get('layer') or 'Buildings'} {_int_value(data.get('x'), 64)} {_int_value(data.get('y'), 15)} {_int_value(data.get('tileIndex'), 0)}"
    if kind == "changePortrait":
        suffix = f" {data.get('portrait')}" if data.get("portrait") else ""
        return f"changePortrait {data.get('npc') or 'ExampleNPC'}{suffix}"
    if kind == "changeSprite":
        suffix = f" {data.get('sprite')}" if data.get("sprite") else ""
        return f"changeSprite {data.get('actor') or 'ExampleNPC'}{suffix}"
    if kind == "farmerEat":
        return f"farmerEat {data.get('objectId') or '200'}"
    if kind == "farmerAnimation":
        return f"farmerAnimation {data.get('animation') or 'drink'}"
    if kind == "friendship":
        return f"friendship {data.get('npc') or 'ExampleNPC'} {_int_value(data.get('amount'), 250)}"
    if kind == "money":
        return f"money {_int_value(data.get('amount'), 100)}"
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
