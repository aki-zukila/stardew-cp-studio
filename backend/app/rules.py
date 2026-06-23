from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from .models import Ruleset
from .rule_library_loader import merged_field_schemas


RULESET_PATH = Path(__file__).parent / "rulesets" / "cp-2.9.0.json"


@lru_cache(maxsize=1)
def load_ruleset() -> Ruleset:
    with RULESET_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)
    data["field_schemas"] = merged_field_schemas()
    return Ruleset.model_validate(data)
