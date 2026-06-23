from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .models import AIConfigPublic, AISuggestRequest, AISuggestResponse, SaveAIConfigRequest
from .rule_library_loader import ai_rule_context


CONFIG_FILE = "ai_config.json"


def get_ai_config(runtime_dir: Path) -> AIConfigPublic:
    data = _read_config(runtime_dir)
    api_key = data.get("api_key", "")
    return AIConfigPublic(
        provider=data.get("provider", "deepseek"),
        model=data.get("model", "deepseek-chat"),
        base_url=data.get("base_url", ""),
        api_key_set=bool(api_key),
        api_key_suffix=api_key[-4:] if api_key else "",
    )


def save_ai_config(runtime_dir: Path, request: SaveAIConfigRequest) -> AIConfigPublic:
    data = _read_config(runtime_dir)
    data["provider"] = request.provider
    data["model"] = request.model.strip() or _default_model(request.provider)
    data["base_url"] = request.base_url.strip()
    if request.clear_api_key:
        data["api_key"] = ""
    elif request.api_key is not None and request.api_key.strip():
        data["api_key"] = request.api_key.strip()
    _write_config(runtime_dir, data)
    return get_ai_config(runtime_dir)


def suggest_with_ai(runtime_dir: Path, request: AISuggestRequest) -> AISuggestResponse:
    config = _read_config(runtime_dir)
    api_key = config.get("api_key", "")
    if not api_key:
        raise ValueError("请先在 AI 设置中填写 API Key。")

    provider = config.get("provider", "deepseek")
    model = config.get("model") or _default_model(provider)
    base_url = config.get("base_url") or _default_base_url(provider)
    system_prompt = _system_prompt(request.kind)
    user_prompt = _user_prompt(request)

    if provider == "openai":
        text = _call_openai_responses(base_url, api_key, model, system_prompt, user_prompt)
    else:
        text = _call_chat_completions(base_url, api_key, model, system_prompt, user_prompt)

    json_value, warnings = _extract_json(text)
    return AISuggestResponse(text=text, json_value=json_value, warnings=warnings)


def test_ai_connection(runtime_dir: Path) -> AISuggestResponse:
    return suggest_with_ai(
        runtime_dir,
        AISuggestRequest(
            kind="when",
            prompt="返回一个最小 Content Patcher When JSON，用于测试连接。只输出 JSON，例如 {\"Season\": \"spring\"}。",
        ),
    )


def _read_config(runtime_dir: Path) -> dict[str, Any]:
    path = runtime_dir / CONFIG_FILE
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_config(runtime_dir: Path, data: dict[str, Any]) -> None:
    runtime_dir.mkdir(parents=True, exist_ok=True)
    (runtime_dir / CONFIG_FILE).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _default_model(provider: str) -> str:
    if provider == "openai":
        return "gpt-5.1"
    if provider == "deepseek":
        return "deepseek-chat"
    return ""


def _default_base_url(provider: str) -> str:
    if provider == "openai":
        return "https://api.openai.com/v1/responses"
    if provider == "deepseek":
        return "https://api.deepseek.com/chat/completions"
    return ""


def _system_prompt(kind: str) -> str:
    rules = json.dumps(ai_rule_context(), ensure_ascii=False, separators=(",", ":"))
    base = (
        "你是 Stardew Valley Content Patcher 模组制作助手。"
        "只帮助生成 Content Patcher JSON 片段，不编造不存在的游戏资源路径。"
        "优先输出可直接复制的 JSON；如有不确定处，用简短中文说明。"
        "必须优先遵守以下离线规则库："
        f"{rules}"
    )
    if kind == "when":
        return base + "本次任务只生成 When 条件对象。输出一个 JSON object。"
    if kind == "field":
        return base + "本次任务生成某个字段的 JSON 值。输出 JSON value，可以是 object、array、string、number 或 boolean。"
    return base + "本次任务生成完整 EditData 补丁。输出一个包含 Action、Target、Entries 等字段的 JSON object。"


def _user_prompt(request: AISuggestRequest) -> str:
    context: dict[str, Any] = {
        "kind": request.kind,
        "field_path": request.field_path,
        "user_request": request.prompt,
    }
    if request.patch:
        context["current_patch"] = request.patch.model_dump(exclude_none=True)
    if request.game_data_entry:
        context["current_game_data_entry"] = request.game_data_entry.model_dump(exclude_none=True)
    if request.project:
        context["project_manifest"] = request.project.manifest.model_dump(exclude_none=True)
        context["project_i18n_keys"] = sorted(request.project.i18n.keys())
        context["asset_paths"] = [asset.stored_path for asset in request.project.assets]
    return json.dumps(context, ensure_ascii=False, indent=2)


def _call_openai_responses(base_url: str, api_key: str, model: str, system_prompt: str, user_prompt: str) -> str:
    payload = {
        "model": model,
        "input": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    data = _post_json(base_url or _default_base_url("openai"), api_key, payload)
    if isinstance(data.get("output_text"), str):
        return data["output_text"]
    parts: list[str] = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            text = content.get("text")
            if isinstance(text, str):
                parts.append(text)
    return "\n".join(parts).strip()


def _call_chat_completions(base_url: str, api_key: str, model: str, system_prompt: str, user_prompt: str) -> str:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }
    data = _post_json(base_url or _default_base_url("deepseek"), api_key, payload)
    choices = data.get("choices", [])
    if choices:
        content = choices[0].get("message", {}).get("content", "")
        if isinstance(content, str):
            return content
    return ""


def _post_json(url: str, api_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ValueError(f"AI 服务返回错误 {exc.code}: {detail}") from exc
    except URLError as exc:
        raise ValueError(f"无法连接 AI 服务：{exc.reason}") from exc


def _extract_json(text: str) -> tuple[Any | None, list[str]]:
    candidates = [text.strip()]
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            cleaned = part.strip()
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            candidates.append(cleaned)
    for candidate in candidates:
        if not candidate:
            continue
        try:
            return json.loads(candidate), []
        except json.JSONDecodeError:
            continue
    return None, ["AI 返回内容不是纯 JSON，请在应用前人工检查。"]
