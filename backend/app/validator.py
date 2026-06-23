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
        if not patch.action:
            errors.append(_issue("error", f"{path}.action", "必须选择补丁动作。"))
        if patch.action != "Include" and not patch.target.strip():
            errors.append(_issue("error", f"{path}.target", "此动作必须填写 Target。"))
        if patch.action in {"Load", "EditImage", "EditMap", "Include"} and not patch.from_file:
            warnings.append(_issue("warning", f"{path}.from_file", "此动作通常需要 FromFile。"))
        if patch.action == "EditData" and not any(key in patch.fields or key in patch.advanced for key in ("Entries", "Fields", "MoveEntries", "TextOperations")):
            warnings.append(_issue("warning", path, "EditData 补丁没有 Entries、Fields、MoveEntries 或 TextOperations。"))

    for index, entry in enumerate(project.game_data):
        path = f"game_data[{index}]"
        if not entry.target.strip():
            errors.append(_issue("error", f"{path}.target", "游戏数据目标不能为空。"))
        if not entry.key.strip():
            errors.append(_issue("error", f"{path}.key", "游戏数据条目键不能为空。"))

    asset_paths = {asset.stored_path for asset in project.assets}
    for index, patch in enumerate(project.patches):
        if patch.from_file and patch.from_file.startswith("assets/") and patch.from_file not in asset_paths:
            warnings.append(_issue("warning", f"patches[{index}].from_file", "FromFile 指向的素材未嵌入当前工程。"))

    return ValidationResult(errors=errors, warnings=warnings, can_export=not errors)


def _issue(level: str, path: str, message: str) -> ValidationIssue:
    return ValidationIssue(level=level, path=path, message=message)
