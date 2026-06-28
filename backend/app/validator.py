from __future__ import annotations

from .models import Project, ValidationIssue, ValidationResult


def validate_project(project: Project) -> ValidationResult:
    errors: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []

    if not project.manifest.Name.strip():
        errors.append(_issue("error", "manifest.Name", "必须填写模组名称。"))
    if not project.manifest.UniqueID.strip():
        errors.append(_issue("error", "manifest.UniqueID", "导出前必须填写 UniqueID。"))
    if not project.manifest.Author.strip():
        warnings.append(_issue("warning", "manifest.Author", "作者为空。"))
    if "." not in project.manifest.UniqueID and project.manifest.UniqueID:
        warnings.append(_issue("warning", "manifest.UniqueID", "UniqueID 通常使用带点的命名空间，例如 Author.ModName。"))

    for index, patch in enumerate(project.patches):
        path = f"patches[{index}]"
        label = _patch_label(index, patch)
        if not patch.action:
            errors.append(_issue("error", f"{path}.action", f"{label}：必须选择补丁动作。"))
        if patch.action != "Include" and not patch.target.strip():
            errors.append(_issue("error", f"{path}.target", f"{label}：此动作必须填写 Target。"))
        if _usually_needs_from_file(patch) and not patch.from_file:
            warnings.append(_issue("warning", f"{path}.from_file", f"{label}：此动作通常需要 FromFile。"))
        if patch.action == "EditData" and not any(key in patch.fields or key in patch.advanced for key in ("Entries", "Fields", "MoveEntries", "TextOperations")):
            warnings.append(_issue("warning", path, f"{label}：EditData 补丁没有 Entries、Fields、MoveEntries 或 TextOperations。"))

    for index, entry in enumerate(project.game_data):
        path = f"game_data[{index}]"
        if not entry.target.strip():
            errors.append(_issue("error", f"{path}.target", "游戏数据目标不能为空。"))
        if not entry.key.strip():
            errors.append(_issue("error", f"{path}.key", "游戏数据条目键不能为空。"))

    duplicate_dialogue_keys: dict[tuple[str, str], list[int]] = {}
    for index, entry in enumerate(project.game_data):
        if entry.kind != "dialogue":
            continue
        key = (entry.target.strip(), entry.key.strip())
        if not key[0] or not key[1]:
            continue
        duplicate_dialogue_keys.setdefault(key, []).append(index)
    for (target, key), indexes in duplicate_dialogue_keys.items():
        if len(indexes) > 1:
            warnings.append(_issue(
                "warning",
                f"game_data[{indexes[0]}].key",
                f"对话 Target={target} 的 Key={key} 出现 {len(indexes)} 次；导出时相同 Key 会互相覆盖，请确认是否需要改成不同 Key。",
            ))

    asset_paths = {asset.stored_path for asset in project.assets}
    for index, patch in enumerate(project.patches):
        if patch.from_file and patch.from_file.startswith("assets/") and patch.from_file not in asset_paths:
            warnings.append(_issue("warning", f"patches[{index}].from_file", f"{_patch_label(index, patch)}：FromFile 指向的素材未嵌入当前工程。"))

    return ValidationResult(errors=errors, warnings=warnings, can_export=not errors)


def _issue(level: str, path: str, message: str) -> ValidationIssue:
    return ValidationIssue(level=level, path=path, message=message)


def _patch_label(index: int, patch) -> str:
    name = patch.name.strip() or f"补丁 {index + 1}"
    target = patch.target.strip() or "未填写 Target"
    return f"{name}（第 {index + 1} 个补丁，Action={patch.action}, Target={target}）"


def _usually_needs_from_file(patch) -> bool:
    if patch.action in {"Load", "EditImage", "Include"}:
        return True
    if patch.action != "EditMap":
        return False
    inline_edit_map_fields = {
        "MapTiles",
        "MapProperties",
        "MapBuildings",
        "AddWarps",
        "RemoveWarps",
        "MapLayers",
        "TextOperations",
    }
    return not any(key in patch.fields or key in patch.advanced for key in inline_edit_map_fields)
