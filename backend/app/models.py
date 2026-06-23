from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


JsonDict = dict[str, Any]


class ManifestDependency(BaseModel):
    UniqueID: str = ""
    IsRequired: bool = True
    MinimumVersion: str | None = None


class ManifestDraft(BaseModel):
    Name: str = "新的 CP 内容包"
    Author: str = ""
    Version: str = "0.1.0"
    Description: str = ""
    UniqueID: str = ""
    MinimumApiVersion: str = "4.0.0"
    UpdateKeys: list[str] = Field(default_factory=list)
    Dependencies: list[ManifestDependency] = Field(default_factory=list)


class AssetRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    original_name: str
    stored_path: str
    content_type: str = "application/octet-stream"
    size: int = 0


PatchAction = Literal[
    "Load",
    "EditData",
    "EditImage",
    "EditMap",
    "Include",
]


class PatchEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = "新补丁"
    action: PatchAction = "EditData"
    enabled: bool = True
    target: str = ""
    from_file: str | None = None
    when: JsonDict = Field(default_factory=dict)
    fields: JsonDict = Field(default_factory=dict)
    advanced: JsonDict = Field(default_factory=dict)


GameDataKind = Literal["npc", "item", "dialogue", "shop", "event", "custom"]


class GameDataEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    kind: GameDataKind = "custom"
    name: str = "新游戏数据条目"
    target: str = "Data/Objects"
    key: str = ""
    value: Any = Field(default_factory=dict)
    when: JsonDict = Field(default_factory=dict)
    advanced: JsonDict = Field(default_factory=dict)


class ProjectMeta(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = "未命名星露谷 CP 工程"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    ruleset_version: str = "cp-2.9.0"


class Project(BaseModel):
    schema_version: int = 1
    meta: ProjectMeta = Field(default_factory=ProjectMeta)
    manifest: ManifestDraft = Field(default_factory=ManifestDraft)
    patches: list[PatchEntry] = Field(default_factory=list)
    game_data: list[GameDataEntry] = Field(default_factory=list)
    i18n: dict[str, str] = Field(default_factory=dict)
    assets: list[AssetRecord] = Field(default_factory=list)


class Ruleset(BaseModel):
    id: str
    content_patcher_format: str
    smapi_minimum_version: str
    patch_actions: list[JsonDict]
    game_data_kinds: list[JsonDict]
    condition_examples: list[str]
    token_examples: list[str]
    field_schemas: JsonDict = Field(default_factory=dict)


class ValidationIssue(BaseModel):
    level: Literal["error", "warning"]
    path: str
    message: str


class ValidationResult(BaseModel):
    errors: list[ValidationIssue] = Field(default_factory=list)
    warnings: list[ValidationIssue] = Field(default_factory=list)
    can_export: bool = True


class SaveProjectRequest(BaseModel):
    project: Project
    path: str


class OpenProjectRequest(BaseModel):
    path: str


class ExportRequest(BaseModel):
    project: Project
    output_dir: str
    folder_name: str | None = None


class ImportAssetResponse(BaseModel):
    project: Project
    asset: AssetRecord


class ItemCatalogEntry(BaseModel):
    id: str
    qualified_id: str
    name: str = ""
    display_name: str = ""
    description: str = ""
    category: int | None = None
    type: str = ""
    source: str = "vanilla"


class ItemCatalogResponse(BaseModel):
    items: list[ItemCatalogEntry] = Field(default_factory=list)
    source_path: str = ""
    warning: str = ""


AIProvider = Literal["openai", "deepseek", "custom"]
AISuggestionKind = Literal["when", "field", "game-data-patch"]


class AIConfigPublic(BaseModel):
    provider: AIProvider = "deepseek"
    model: str = "deepseek-chat"
    base_url: str = ""
    api_key_set: bool = False
    api_key_suffix: str = ""


class SaveAIConfigRequest(BaseModel):
    provider: AIProvider = "deepseek"
    model: str = "deepseek-chat"
    base_url: str = ""
    api_key: str | None = None
    clear_api_key: bool = False


class AISuggestRequest(BaseModel):
    kind: AISuggestionKind
    prompt: str
    project: Project | None = None
    patch: PatchEntry | None = None
    game_data_entry: GameDataEntry | None = None
    field_path: str | None = None


class AISuggestResponse(BaseModel):
    text: str
    json_value: Any | None = None
    warnings: list[str] = Field(default_factory=list)
