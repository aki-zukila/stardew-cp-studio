from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from .models import ItemCatalogEntry, ItemCatalogResponse


KNOWN_OBJECT_PATHS = [
    Path(r"D:\Steam\steamapps\common\Stardew Valley\Content (unpacked)\Data\Objects.json"),
    Path(r"C:\Program Files (x86)\Steam\steamapps\common\Stardew Valley\Content (unpacked)\Data\Objects.json"),
]


@lru_cache(maxsize=1)
def load_item_catalog() -> ItemCatalogResponse:
    path = next((candidate for candidate in KNOWN_OBJECT_PATHS if candidate.exists()), None)
    if path is None:
        return ItemCatalogResponse(
            items=[],
            warning="未找到解包后的 Data/Objects.json；将只显示工程内新物品和内置类别。",
        )

    try:
        with path.open("r", encoding="utf-8-sig") as file:
            data = json.load(file)
    except Exception as exc:
        return ItemCatalogResponse(
            items=[],
            source_path=str(path),
            warning=f"读取 Data/Objects.json 失败：{exc}",
        )

    items: list[ItemCatalogEntry] = []
    if isinstance(data, dict):
        for raw_id, raw_value in data.items():
            if not isinstance(raw_value, dict):
                continue
            item_id = str(raw_id)
            items.append(ItemCatalogEntry(
                id=item_id,
                qualified_id=f"(O){item_id}",
                name=_string(raw_value.get("Name")),
                display_name=_string(raw_value.get("DisplayName")),
                category=_integer_or_none(raw_value.get("Category")),
                type=_string(raw_value.get("Type")),
                source="vanilla",
            ))

    return ItemCatalogResponse(items=items, source_path=str(path))


def _string(value: Any) -> str:
    return "" if value is None else str(value)


def _integer_or_none(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
