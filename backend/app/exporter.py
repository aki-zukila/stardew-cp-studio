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

    export_i18n = dict(project.i18n)
    _normalize_secret_note_i18n(project, export_i18n)
    dialogue_files = _write_dialogue_files(project, target)
    schedule_files = _write_schedule_files(project, target, export_i18n)
    _write_json(target / "manifest.json", _manifest_json(project.manifest))
    include_files = _write_code_files(project, target, dialogue_files, schedule_files, export_i18n)
    _write_json(target / "content.json", _root_content_json(include_files))
    _write_json(target / "i18n" / "default.json", export_i18n)
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


def _write_code_files(project: Project, target: Path, dialogue_files: list["DialogueFile"] | None = None, schedule_files: list["ScheduleFile"] | None = None, export_i18n: dict[str, str] | None = None) -> list[str]:
    groups = _code_change_groups(project, dialogue_files or [], schedule_files or [], export_i18n if export_i18n is not None else dict(project.i18n))
    include_files: list[str] = []
    for filename in [
        "patches.json",
        "characters.json",
        "items.json",
        "dialogue.json",
        "events.json",
        "mail.json",
        "quests.json",
        "special_orders.json",
        "Other/SecretNotes.json",
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


def _code_change_groups(project: Project, dialogue_files: list["DialogueFile"], schedule_files: list["ScheduleFile"] | None = None, export_i18n: dict[str, str] | None = None) -> dict[str, list[dict[str, Any]]]:
    export_i18n = export_i18n if export_i18n is not None else {}
    groups: dict[str, list[dict[str, Any]]] = {
        "patches.json": [],
        "characters.json": [],
        "items.json": [],
        "dialogue.json": [],
        "events.json": [],
        "mail.json": [],
        "quests.json": [],
        "special_orders.json": [],
        "Other/SecretNotes.json": [],
        "shops.json": [],
        "custom.json": [],
    }

    for patch in project.patches:
        if patch.enabled:
            groups["patches.json"].append(_patch_json(patch))

    for patch in _dialogue_bootstrap_patches(project, dialogue_files):
        if not _has_equivalent_patch(groups["dialogue.json"], patch):
            groups["dialogue.json"].append(patch)

    for patch in _schedule_bootstrap_patches(schedule_files or []):
        if not _has_equivalent_patch(groups["characters.json"], patch):
            groups["characters.json"].append(patch)

    for patch in _mail_background_load_patches(project):
        if not _has_equivalent_patch(groups["mail.json"], patch):
            groups["mail.json"].append(patch)

    animation_string_buckets: dict[tuple[str, str], dict[str, str]] = {}
    for entry in project.game_data:
        if _dialogue_entry_info(entry):
            continue
        if _schedule_entry_info(entry) and not entry.when:
            continue
        groups[_code_group_for_entry(entry)].append(_game_data_patch_json(entry))
        _collect_animation_strings(entry, export_i18n, animation_string_buckets)
        special_order_strings = _special_order_strings_patch(entry)
        if special_order_strings:
            groups["special_orders.json"].append(special_order_strings)
    groups["characters.json"].extend(_affinity_string_patches(animation_string_buckets, "Strings/animation"))

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
    if entry.kind in {"npc", "schedule", "animation"} or target in {"Data/Characters", "Data/NPCGiftTastes", "Data/MoviesReactions", "Data/animationDescriptions"} or target.startswith("Characters/schedules/"):
        return "characters.json"
    if entry.kind == "item" or target.startswith("Data/Objects") or target.startswith("Data/BigCraftables"):
        return "items.json"
    if entry.kind == "event" or target.startswith("Data/Events/"):
        return "events.json"
    if entry.kind in {"mail", "trigger_action"} or target in {"Data/Mail", "Data/TriggerActions"}:
        return "mail.json"
    if entry.kind == "quest" or target == "Data/Quests":
        return "quests.json"
    if entry.kind == "special_order" or target == "Data/SpecialOrders" or target == "Strings/SpecialOrderStrings":
        return "special_orders.json"
    if entry.kind == "secret_note" or target == "Data/SecretNotes":
        return "Other/SecretNotes.json"
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

    value = _game_data_entry_value(entry)
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


def _game_data_entry_value(entry: GameDataEntry) -> Any:
    if entry.kind == "mail":
        return _mail_entry_value(entry)
    special_order = _special_order_entry_value(entry)
    if special_order is not None:
        return special_order
    return entry.value


AFFINITY_GROUPS: list[tuple[str, dict[str, str]]] = [
    ("0123", {"Hearts:{npc}": "0, 1, 2, 3"}),
    ("4567", {"Hearts:{npc}": "4, 5, 6, 7"}),
    ("8910", {"Hearts:{npc}": "8, 9, 10"}),
    ("married", {"Relationship:{npc}": "Married"}),
]


def _collect_animation_strings(entry: GameDataEntry, export_i18n: dict[str, str], buckets: dict[tuple[str, str], dict[str, str]]) -> None:
    if entry.kind != "animation" and entry.target != "Data/animationDescriptions":
        return
    studio = entry.advanced.get("StardewCPStudio") if isinstance(entry.advanced, dict) else None
    meta = studio.get("animation") if isinstance(studio, dict) else None
    if not isinstance(meta, dict):
        return
    npc = _normalize_internal_name(str(meta.get("npcName") or _npc_name_from_animation_key(entry.key) or "ExampleNPC"))
    animation_key = _normalize_animation_key(str(meta.get("customKey") or entry.key or "CustomAnimation"))
    variants = _affinity_variants(meta.get("messageVariants"), str(meta.get("messageText") or ""))
    for group_id, text in variants.items():
        if not text.strip():
            continue
        i18n_key = f"{npc}.Animation.{animation_key}.{group_id}"
        export_i18n[i18n_key] = text
        buckets.setdefault((npc, group_id), {})[animation_key] = f"{{{{i18n:{i18n_key}}}}}"


def _affinity_variants(value: Any, legacy_text: str = "") -> dict[str, str]:
    source = value if isinstance(value, dict) else {}
    return {
        "0123": str(source.get("0123") if isinstance(source, dict) and source.get("0123") is not None else legacy_text),
        "4567": str(source.get("4567") if isinstance(source, dict) and source.get("4567") is not None else ""),
        "8910": str(source.get("8910") if isinstance(source, dict) and source.get("8910") is not None else ""),
        "married": str(source.get("married") if isinstance(source, dict) and source.get("married") is not None else ""),
    }


def _affinity_when(npc: str, group_id: str) -> dict[str, str]:
    for candidate, template in AFFINITY_GROUPS:
        if candidate == group_id:
            return {key.format(npc=npc): value for key, value in template.items()}
    return {}


def _affinity_string_patches(buckets: dict[tuple[str, str], dict[str, str]], target_prefix: str) -> list[dict[str, Any]]:
    patches: list[dict[str, Any]] = []
    npcs = sorted({npc for npc, _group_id in buckets})
    for npc in npcs:
        for group_id, _template in AFFINITY_GROUPS:
            entries = buckets.get((npc, group_id))
            if not entries:
                continue
            patches.append({
                "Action": "EditData",
                "Target": f"{target_prefix}/{npc}",
                "Entries": entries,
                "When": _affinity_when(npc, group_id),
            })
    return patches


def _animation_strings_patch(entry: GameDataEntry, export_i18n: dict[str, str]) -> dict[str, Any] | None:
    buckets: dict[tuple[str, str], dict[str, str]] = {}
    _collect_animation_strings(entry, export_i18n, buckets)
    patches = _affinity_string_patches(buckets, "Strings/animation")
    return patches[0] if patches else None


def _special_order_entry_value(entry: GameDataEntry) -> Any | None:
    if entry.kind != "special_order" and entry.target != "Data/SpecialOrders":
        return None
    studio = entry.advanced.get("StardewCPStudio") if isinstance(entry.advanced, dict) else None
    meta = studio.get("specialOrder") if isinstance(studio, dict) else None
    if not isinstance(meta, dict):
        return entry.value
    order_id = str(meta.get("orderId") or entry.key or "ExampleOrder")
    value: dict[str, Any] = {
        "Name": f"[{_sanitize_string_key(order_id)}_Name]",
        "Requester": str(meta.get("requester") or "Lewis"),
        "Duration": str(meta.get("duration") or "TwoWeeks"),
        "Repeatable": str(bool(meta.get("repeatable"))),
        "RequiredTags": str(meta.get("requiredTags") or ""),
        "OrderType": str(meta.get("orderType") or ""),
        "SpecialRule": str(meta.get("specialRule") or ""),
        "Text": f"[{_sanitize_string_key(order_id)}_Text]",
        "ItemToRemoveOnEnd": meta.get("itemToRemoveOnEnd") or None,
        "MailToRemoveOnEnd": meta.get("mailToRemoveOnEnd") or None,
        "RandomizedElements": _special_order_randomized_elements(meta.get("randomizedElements")),
        "Objectives": _special_order_objectives(order_id, meta.get("objectives")),
        "Rewards": _special_order_rewards(meta.get("rewards")),
    }
    condition = str(meta.get("condition") or "").strip()
    if condition:
        value["Condition"] = condition
    custom_fields = meta.get("customFields")
    if isinstance(custom_fields, dict):
        value.update(custom_fields)
    return value


def _special_order_objectives(order_id: str, objectives: Any) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    if not isinstance(objectives, list):
        return result
    for index, objective in enumerate(objectives, start=1):
        if not isinstance(objective, dict):
            continue
        objective_type = str(objective.get("customType") or objective.get("type") or "Donate")
        data = objective.get("data") if isinstance(objective.get("data"), dict) else {}
        result.append({
            "Type": objective_type,
            "Text": f"[{_sanitize_string_key(order_id)}_Objective_{index}_Text]",
            "RequiredCount": str(objective.get("requiredCount") or "1"),
            "Data": data,
        })
    return result


def _special_order_rewards(rewards: Any) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    if not isinstance(rewards, list):
        return result
    for reward in rewards:
        if not isinstance(reward, dict):
            continue
        reward_type = str(reward.get("customType") or reward.get("type") or "Money")
        data = reward.get("data") if isinstance(reward.get("data"), dict) else {}
        result.append({"Type": reward_type, "Data": data})
    return result


def _special_order_randomized_elements(elements: Any) -> list[dict[str, Any]] | None:
    if not isinstance(elements, list) or not elements:
        return None
    result: list[dict[str, Any]] = []
    for element in elements:
        if not isinstance(element, dict):
            continue
        values = element.get("values")
        result.append({
            "Name": str(element.get("name") or ""),
            "Values": [
                {"RequiredTags": str(row.get("requiredTags") or ""), "Value": str(row.get("value") or "")}
                for row in values
                if isinstance(row, dict)
            ] if isinstance(values, list) else [],
        })
    return result or None


def _normalize_secret_note_i18n(project: Project, export_i18n: dict[str, str]) -> None:
    for entry in project.game_data:
        if entry.kind != "secret_note" and entry.target != "Data/SecretNotes":
            continue
        studio = entry.advanced.get("StardewCPStudio") if isinstance(entry.advanced, dict) else None
        note = studio.get("secretNote") if isinstance(studio, dict) else None
        key = ""
        if isinstance(note, dict):
            key = str(note.get("textKey") or "")
        if not key and isinstance(entry.value, str):
            match = re.match(r"^\{\{i18n:([^}]+)\}\}$", entry.value)
            key = match.group(1) if match else ""
        if key and key in export_i18n:
            export_i18n[key] = _mail_body_for_export(export_i18n[key])


def _special_order_strings_patch(entry: GameDataEntry) -> dict[str, Any] | None:
    if entry.kind != "special_order" and entry.target != "Data/SpecialOrders":
        return None
    studio = entry.advanced.get("StardewCPStudio") if isinstance(entry.advanced, dict) else None
    meta = studio.get("specialOrder") if isinstance(studio, dict) else None
    if not isinstance(meta, dict):
        return None
    order_id = str(meta.get("orderId") or entry.key or "ExampleOrder")
    entries: dict[str, str] = {}
    name_key = str(meta.get("nameKey") or "")
    text_key = str(meta.get("textKey") or "")
    if name_key:
        entries[f"{_sanitize_string_key(order_id)}_Name"] = f"{{{{i18n:{name_key}}}}}"
    if text_key:
        entries[f"{_sanitize_string_key(order_id)}_Text"] = f"{{{{i18n:{text_key}}}}}"
    objectives = meta.get("objectives")
    if isinstance(objectives, list):
        for index, objective in enumerate(objectives, start=1):
            if not isinstance(objective, dict):
                continue
            objective_key = str(objective.get("textKey") or "")
            if objective_key:
                entries[f"{_sanitize_string_key(order_id)}_Objective_{index}_Text"] = f"{{{{i18n:{objective_key}}}}}"
    if not entries:
        return None
    patch: dict[str, Any] = {
        "Action": "EditData",
        "Target": "Strings/SpecialOrderStrings",
        "Entries": entries,
    }
    return patch


def _sanitize_string_key(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", value or "Example")


def _normalize_internal_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_]+", "", value or "ExampleNPC")
    return cleaned or "ExampleNPC"


def _normalize_animation_key(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "", value or "CustomAnimation")
    return cleaned or "CustomAnimation"


def _npc_name_from_animation_key(key: str) -> str:
    sleep = re.fullmatch(r"(.+)_sleep", key or "", flags=re.IGNORECASE)
    if sleep:
        return _normalize_internal_name(sleep.group(1))
    custom = re.match(r"([A-Za-z0-9_]+?)[._-]", key or "")
    return _normalize_internal_name(custom.group(1)) if custom else ""


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
    actors = story.get("actors")
    story_actors = actors if isinstance(actors, list) else []
    if entry.key:
        nodes = story.get("nodes")
        entries[entry.key] = _story_main_script(entry.key, entry.value, nodes if isinstance(nodes, list) else [], story_actors)
    for branch in story.get("branches", []) or []:
        if not isinstance(branch, dict):
            continue
        key = branch.get("key")
        nodes = branch.get("nodes")
        if isinstance(key, str) and key:
            entries[key] = _story_branch_script(key, nodes if isinstance(nodes, list) else [], story_actors)
    return entries or None


def _story_main_script(entry_key: str, fallback: Any, nodes: list[Any], actors: list[Any] | None = None) -> Any:
    if not nodes:
        return fallback
    parts = str(fallback or "").split("/")
    start = parts[:3] if len(parts) >= 3 else ["continue", "-500 -500", "farmer -500 -500 2"]
    event_id = entry_key.split("/", 1)[0] if entry_key else ""
    commands = _story_node_commands(nodes, event_id, actors or [])
    return "/".join([*start, *commands])


def _story_branch_script(branch_key: str, nodes: list[Any], actors: list[Any] | None = None) -> str:
    return "/".join(_story_node_commands(nodes, branch_key, actors or []))


def _story_actor_positions(actors: list[Any]) -> dict[str, tuple[int, int]]:
    positions: dict[str, tuple[int, int]] = {}
    safe_actors = actors or [{"actor": "farmer", "x": -500, "y": -500, "direction": 2}]
    for actor in safe_actors:
        if not isinstance(actor, dict):
            continue
        name = str(actor.get("actor") or "farmer")
        positions[name] = (_int_value(actor.get("x"), 0), _int_value(actor.get("y"), 0))
    return positions


def _story_node_commands(nodes: list[Any], event_id: str, actors: list[Any]) -> list[str]:
    positions = _story_actor_positions(actors)
    commands: list[str] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        kind = node.get("kind")
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        actor = str(data.get("actor") or "farmer")
        if kind == "move":
            current = positions.get(actor)
            has_target = data.get("targetMode") is not False and data.get("targetX") is not None and data.get("targetY") is not None
            if has_target and current is not None:
                target_x = _int_value(data.get("targetX"), current[0])
                target_y = _int_value(data.get("targetY"), current[1])
                dx = target_x - current[0]
                dy = target_y - current[1]
                positions[actor] = (target_x, target_y)
            else:
                dx = _int_value(data.get("x"), 0)
                dy = _int_value(data.get("y"), 1)
                if current is not None:
                    positions[actor] = (current[0] + dx, current[1] + dy)
            suffix = " true" if data.get("continue") else ""
            commands.append(f"move {actor} {dx} {dy} {_int_value(data.get('direction'), 2)}{suffix}")
            continue
        command = _story_node_command(node, event_id)
        if command:
            commands.append(command)
        if kind == "positionOffset":
            current = positions.get(actor)
            if current is not None:
                positions[actor] = (current[0] + _int_value(data.get("x"), 0), current[1] + _int_value(data.get("y"), 0))
        elif kind == "warp":
            positions[actor] = (_int_value(data.get("x"), 0), _int_value(data.get("y"), 0))
    return commands


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


class ScheduleFile(dict):
    npc: str
    target: str
    from_file: str
    dialogue_file: str | None


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


def _schedule_entry_info(entry: GameDataEntry) -> dict[str, str] | None:
    if entry.kind != "schedule":
        return None
    match = re.fullmatch(r"Characters/[Ss]chedules/([^/]+)", entry.target or "")
    if not match:
        return None
    npc = match.group(1)
    return {
        "npc": npc,
        "target": entry.target,
        "from_file": f"assets/CharacterFiles/Schedules/{npc}/Schedule.json",
        "dialogue_file": f"assets/CharacterFiles/Schedules/{npc}/ScheduleDialogue.json",
    }


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


def _write_schedule_files(project: Project, target: Path, export_i18n: dict[str, str]) -> list[ScheduleFile]:
    grouped: dict[str, dict[str, Any]] = {}
    dialogue_buckets: dict[tuple[str, str], dict[str, str]] = {}
    for entry in project.game_data:
        info = _schedule_entry_info(entry)
        if not info or entry.when or not entry.key:
            continue
        bucket = grouped.setdefault(info["npc"], {"info": info, "entries": {}})
        bucket["entries"][entry.key] = entry.value
        _collect_schedule_strings(entry, export_i18n, dialogue_buckets)

    schedule_files: list[ScheduleFile] = []
    for npc, bucket in grouped.items():
        info = bucket["info"]
        entries = bucket["entries"]
        if not entries:
            continue
        _write_json(target / info["from_file"], entries)
        dialogue_file = None
        npc_dialogue_buckets = {
            (bucket_npc, group_id): bucket_entries
            for (bucket_npc, group_id), bucket_entries in dialogue_buckets.items()
            if bucket_npc == npc
        }
        dialogue_changes = _affinity_string_patches(npc_dialogue_buckets, "Strings/schedules")
        if dialogue_changes:
            dialogue_file = info["dialogue_file"]
            _write_json(target / dialogue_file, {
                "Changes": dialogue_changes
            })
        schedule_files.append({
            "npc": npc,
            "target": info["target"],
            "from_file": info["from_file"],
            "dialogue_file": dialogue_file,
        })
    return schedule_files


def _collect_schedule_strings(entry: GameDataEntry, export_i18n: dict[str, str], buckets: dict[tuple[str, str], dict[str, str]]) -> None:
    studio = entry.advanced.get("StardewCPStudio") if isinstance(entry.advanced, dict) else None
    if not isinstance(studio, dict):
        return
    schedule = studio.get("schedule")
    if not isinstance(schedule, dict):
        return
    info = _schedule_entry_info(entry)
    npc = str(schedule.get("npcName") or (info.get("npc") if info else "")).strip()
    if not npc:
        return
    rows = schedule.get("dialogueEntries")
    if isinstance(rows, list):
        for row in rows:
            if not isinstance(row, dict):
                continue
            key = str(row.get("key") or "").strip()
            i18n_key = str(row.get("i18nKey") or "").strip()
            if key and i18n_key:
                buckets.setdefault((npc, "0123"), {})[key] = f"{{{{i18n:{i18n_key}}}}}"
    points = schedule.get("points")
    if isinstance(points, list) and npc:
        for index, point in enumerate(points):
            if not isinstance(point, dict):
                continue
            key = str(point.get("dialogueKey") or f"{entry.key}.{index:03d}").strip()
            if not key:
                continue
            variants = _affinity_variants(point.get("dialogueVariants"), str(point.get("dialogueText") or ""))
            for group_id, text in variants.items():
                if not text.strip():
                    continue
                i18n_key = f"{npc}.Schedule.{key}.{group_id}"
                export_i18n[i18n_key] = text
                buckets.setdefault((npc, group_id), {})[key] = f"{{{{i18n:{i18n_key}}}}}"


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


def _schedule_bootstrap_patches(schedule_files: list[ScheduleFile]) -> list[dict[str, Any]]:
    patches: list[dict[str, Any]] = []
    for file_info in schedule_files:
        patches.append({
            "Action": "Load",
            "Priority": "Low",
            "Target": file_info["target"],
            "FromFile": file_info["from_file"],
        })
        if file_info.get("dialogue_file"):
            patches.append({
                "Action": "Include",
                "FromFile": file_info["dialogue_file"],
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
