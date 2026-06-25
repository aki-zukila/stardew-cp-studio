from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


LIBRARY_DIR = Path(__file__).parent / "rule_library"


@lru_cache(maxsize=1)
def load_rule_library() -> dict[str, Any]:
    return {
        "sources": _read_json("sources.json"),
        "content_patcher": _read_json("content_patcher.json"),
        "game_data": _read_json("game_data.json"),
        "reference_patterns": _read_json("reference_patterns.json"),
    }


def merged_field_schemas() -> dict[str, Any]:
    library = load_rule_library()
    game_data = library["game_data"]
    content_patcher = library["content_patcher"]
    schemas: dict[str, Any] = dict(game_data.get("enums", {}))
    schemas["when_conditions"] = content_patcher.get("when_conditions", [])
    dialogue = next((target for target in game_data.get("targets", []) if target.get("kind") == "dialogue"), None)
    if dialogue:
        schemas["dialogue_key_builder"] = dialogue.get("dialogue_key_builder", {})
    events = next((target for target in game_data.get("targets", []) if target.get("kind") == "event"), None)
    if events:
        schemas["event_builder"] = {
            "preconditions": events.get("preconditions", []),
            "event_commands": events.get("event_commands", []),
            "script_format": events.get("script_format", {}),
            "flow_builder": events.get("flow_builder", {}),
        }
    return schemas


def ai_rule_context() -> dict[str, Any]:
    library = load_rule_library()
    content_patcher = library["content_patcher"]
    game_data = library["game_data"]
    reference_patterns = library["reference_patterns"]
    return {
        "library_version": library["sources"].get("library_version"),
        "source_ids": [source.get("id") for source in library["sources"].get("sources", [])],
        "content_patcher": {
            "format": content_patcher.get("format"),
            "patch_actions": [
                {
                    "action": action.get("action"),
                    "required_fields": action.get("required_fields", []),
                    "optional_fields": action.get("optional_fields", []),
                }
                for action in content_patcher.get("patch_actions", [])
            ],
            "tokens": content_patcher.get("tokens", []),
            "when_conditions": content_patcher.get("when_conditions", []),
            "translations": content_patcher.get("translations", {}),
            "text_operations": content_patcher.get("text_operations", {}),
            "trigger_actions": content_patcher.get("trigger_actions", {}),
        },
        "game_data": {
            "targets": [
                {
                    "target": target.get("target"),
                    "kind": target.get("kind"),
                    "key_hint": target.get("key_hint", ""),
                    "fields": target.get("fields", []),
                    "key_patterns": target.get("key_patterns", []),
                    "dialogue_key_builder": target.get("dialogue_key_builder", {}),
                    "commands": target.get("commands", []),
                    "preconditions": target.get("preconditions", []),
                    "event_commands": target.get("event_commands", []),
                    "schedule_points": target.get("schedule_points", []),
                    "keys": target.get("keys", []),
                    "item_fields": target.get("item_fields", []),
                    "taste_groups": target.get("taste_groups", []),
                    "text_operation_templates": target.get("text_operation_templates", []),
                    "mail_markers": target.get("mail_markers", []),
                    "attachment_types": target.get("attachment_types", []),
                    "field_details": target.get("field_details", []),
                    "field_groups": target.get("field_groups", []),
                    "related_assets": target.get("related_assets", []),
                    "creation_checklist": target.get("creation_checklist", []),
                    "item_data_targets": target.get("item_data_targets", []),
                    "item_id_guidance": target.get("item_id_guidance", []),
                    "substructures": target.get("substructures", []),
                    "action_examples": target.get("action_examples", []),
                    "trigger_examples": target.get("trigger_examples", []),
                    "ai_examples": target.get("ai_examples", []),
                    "ai_guidance": target.get("ai_guidance", []),
                }
                for target in game_data.get("targets", [])
            ],
            "enums": game_data.get("enums", {}),
            "common_field_types": game_data.get("common_field_types", {}),
        },
        "reference_patterns": reference_patterns.get("references", []),
        "guidance": content_patcher.get("ai_guidance", []) + game_data.get("ai_guidance", []),
    }


def _read_json(name: str) -> dict[str, Any]:
    with (LIBRARY_DIR / name).open("r", encoding="utf-8") as file:
        return json.load(file)
