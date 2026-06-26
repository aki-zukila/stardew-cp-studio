import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type JsonDict = Record<string, unknown>;

type Manifest = {
  Name: string;
  Author: string;
  Version: string;
  Description: string;
  UniqueID: string;
  MinimumApiVersion: string;
  UpdateKeys: string[];
  Dependencies: { UniqueID: string; IsRequired: boolean; MinimumVersion?: string | null }[];
};

type Patch = {
  id: string;
  name: string;
  action: "Load" | "EditData" | "EditImage" | "EditMap" | "Include";
  enabled: boolean;
  target: string;
  from_file?: string | null;
  when: JsonDict;
  fields: JsonDict;
  advanced: JsonDict;
};

type GameDataEntry = {
  id: string;
  kind: "npc" | "item" | "dialogue" | "shop" | "event" | "mail" | "trigger_action" | "custom";
  name: string;
  target: string;
  key: string;
  value: unknown;
  when: JsonDict;
  advanced: JsonDict;
  editMode?: "form" | "code";
};
type MailAttachmentKind = "action" | "item_id" | "money" | "conversationTopic" | "cookingRecipe" | "craftingRecipe" | "itemRecovery" | "quest" | "specialOrder" | "custom";
type MailAttachmentRow = {
  kind: MailAttachmentKind;
  action: string;
  itemId: string;
  count: number;
  amount: number;
  minAmount: number;
  maxAmount: number;
  topic: string;
  days: number;
  recipeId: string;
  questId: string;
  autoGrant: boolean;
  orderId: string;
  immediate: boolean;
  marker: string;
};

type Asset = {
  id: string;
  original_name: string;
  stored_path: string;
  content_type: string;
  size: number;
};

type Project = {
  schema_version: number;
  meta: {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    ruleset_version: string;
  };
  manifest: Manifest;
  patches: Patch[];
  game_data: GameDataEntry[];
  i18n: Record<string, string>;
  assets: Asset[];
};

type ValidationIssue = { level: "error" | "warning"; path: string; message: string };
type ValidationResult = { errors: ValidationIssue[]; warnings: ValidationIssue[]; can_export: boolean };
type RulesetOption = { label: string; value: string | number | boolean };
type WhenConditionSchema = { key: string; label: string; valueType: string; options?: string; allowCustom?: boolean; parameterLabel?: string; parameterOptions?: string };
type TriggerActionCommandKind = "AddMail" | "RemoveMail" | "AddMoney" | "RunTriggerAction" | "custom";
type DialogueFormatField = { name: string; type: string; options?: string; min?: number; max?: number };
type DialogueFormat = { id: string; scope: "normal" | "marriage" | string; category: string; label: string; template: string; fields: DialogueFormatField[]; warning?: string };
type DialogueKeyBuilderCatalog = { formats?: DialogueFormat[]; field_options?: Record<string, RulesetOption[]> };
type EventNodeKind = "pause" | "speak" | "splitSpeak" | "textAboveHead" | "message" | "question" | "quickQuestion" | "fork" | "questionAnswered" | "move" | "advancedMove" | "positionOffset" | "warp" | "warpFarmers" | "faceDirection" | "emote" | "animate" | "showFrame" | "stopAnimation" | "playSound" | "stopSound" | "playMusic" | "stopMusic" | "globalFade" | "globalFadeToClear" | "fade" | "viewport" | "mail" | "eventSeen" | "addItem" | "removeItem" | "addObject" | "removeObject" | "removeSprite" | "addTemporaryActor" | "changeLocation" | "changeMapTile" | "changePortrait" | "changeSprite" | "farmerEat" | "farmerAnimation" | "friendship" | "money" | "shake" | "jump" | "end" | "custom";
type StoryQuestionAnswer = { id: string; text: string; branchKey: string };
type StoryEventNode = { id: string; kind: EventNodeKind; label: string; data: JsonDict; position?: { x: number; y: number } };
type StoryEventMeta = {
  location: string;
  eventId: string;
  music: string;
  viewportX: number;
  viewportY: number;
  actors: { actor: string; x: number; y: number; direction: number }[];
  preconditions: EventPrecondition[];
  nodes: StoryEventNode[];
  branches: StoryEventBranch[];
  i18nPrefix: string;
};
type StoryEventBranch = { id: string; key: string; label: string; nodes: StoryEventNode[] };
type EventPrecondition = { id: string; type: string; data: JsonDict; negated?: boolean };
type FieldSchemas = Record<string, unknown>;
type Ruleset = {
  id: string;
  content_patcher_format: string;
  patch_actions: { action: Patch["action"]; label: string; description: string }[];
  game_data_kinds: { kind: GameDataEntry["kind"]; label: string; defaultTarget: string; description: string }[];
  field_schemas: FieldSchemas;
};
type AIProvider = "openai" | "deepseek" | "custom";
type AIConfig = { provider: AIProvider; model: string; base_url: string; api_key_set: boolean; api_key_suffix: string };
type AISuggestionKind = "when" | "field" | "game-data-patch";
type AISuggestResponse = { text: string; json_value: unknown | null; warnings: string[] };
type HealthStatus = { status: string; version: string; ai: string };
type ImportAssetResponse = { project: Project; asset: Asset };
type ItemCatalogEntry = { id: string; qualified_id: string; name: string; display_name: string; description?: string; category?: number | null; type?: string; source: string };
type ItemCatalogResponse = { items: ItemCatalogEntry[]; source_path: string; warning: string };
type ItemOption = RulesetOption & { source?: string };
type TriggerActionRow = { kind: TriggerActionCommandKind; player: string; mailId: string; mailType: string; amount: number; targetAction: string; raw: string };
type FlowTodo = { id: string; label: string; description: string; action: FlowAction; done: boolean };
type FlowAction = "dialogue" | "giftTaste" | "schedule" | "mail" | "event" | "roommateItem" | "customMap" | "giftTasteForItem" | "shopForItem" | "mailForItem" | "mapLocation" | "mapWarpTodo" | "mapEventTodo";
type FlowKind = "character" | "item" | "map";
type DialogueKeyType = string;
type WorkflowResult = { entries: GameDataEntry[]; patches: Patch[]; i18n: Record<string, string> };
type DialogueEntryState = {
  npcName: string;
  isMarriage: boolean;
  keyType: DialogueKeyType;
  season: string;
  weekday: string;
  day: number;
  hearts: number;
  eventId: string;
  itemId: string;
  marriageScene: string;
  customKey: string;
  i18nPrefix: string;
  fields: Record<string, string | number>;
};
type SpecialDialogueKind = "engagement" | "rain" | "festival";
type MovieResponse = "love" | "like" | "dislike";
type WorkflowState = {
  active: boolean;
  completed: boolean;
  kind: FlowKind;
  npcName: string;
  displayName: string;
  gender: string;
  birthSeason: string;
  birthDay: number;
  homeRegion: string;
  defaultMap: string;
  relationMode: "friend" | "romance" | "roommate";
  needsCustomMap: boolean;
  itemId: string;
  itemName: string;
  itemCategory: number;
  itemPrice: number;
  locationId: string;
  locationName: string;
  mapPath: string;
  configuringAction: FlowAction | null;
  giftNpc: string;
  giftTasteGroup: string;
  shopId: string;
  shopPrice: number;
  mailQuantity: number;
  warpFrom: string;
  warpX: number;
  warpY: number;
  dialogueKey: string;
  dialogueText: string;
  dialogueKeyType: DialogueKeyType;
  dialogueSeason: string;
  dialogueWeekday: string;
  dialogueDay: number;
  dialogueHearts: number;
  dialogueEventId: string;
  dialogueItemId: string;
  dialogueMarriageScene: string;
  dialogueI18nPrefix: string;
  portraitAssetPath: string;
  spriteAssetPath: string;
  scheduleKey: string;
  scheduleMap: string;
  scheduleX: number;
  scheduleY: number;
  mailText: string;
  eventLocation: string;
  eventFriendship: number;
  roommateItemPrice: number;
  editingEntryId: string | null;
  todos: FlowTodo[];
  createdEntryIds: string[];
};
type RuleLibrary = {
  sources: { library_version: string; sources: { id: string; title: string; url: string; scope: string }[] };
  content_patcher: {
    patch_actions: { action: string; label: string; required_fields: string[]; optional_fields: string[] }[];
    tokens: { name: string; kind: string; description: string }[];
    text_operations?: { operations?: { operation: string; description: string }[] };
  };
  game_data: {
    targets: {
      id: string;
      target: string;
      label: string;
      kind: string;
      description: string;
      key_patterns?: { pattern: string; examples?: string[]; description: string }[];
      event_commands?: { command: string; example?: string }[];
      commands?: { token: string; description: string }[];
      schedule_points?: { field: string; description: string; example?: string }[];
      mail_markers?: { marker: string; description: string }[];
      attachment_types?: { type: string; description: string }[];
      action_examples?: { action: string; example?: string }[];
      taste_groups?: { name: string; label: string }[];
      field_groups?: { group: string; label?: string; fields: unknown[] }[];
      creation_checklist?: string[];
      related_assets?: { target: string; purpose: string }[];
      item_data_targets?: { target: string; kind: string }[];
      substructures?: { name: string; description: string }[];
    }[];
    enums: Record<string, RulesetOption[]>;
    common_field_types?: Record<string, { label: string; description: string }>;
  };
  reference_patterns?: {
    references?: {
      id: string;
      title: string;
      notes?: string[];
      observed_format?: string;
      observed_scale?: Record<string, number>;
      package_layout_patterns?: { pattern: string; description: string }[];
      common_include_groups?: string[];
      high_frequency_targets?: string[];
      high_frequency_when_keys?: string[];
      ai_guidance?: string[];
    }[];
  };
};

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string }> {
  state = { error: "" };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-shell">
          <section className="section">
            <h2>页面渲染出错</h2>
            <div className="inline-error">{this.state.error}</div>
            <p className="muted">请把这段错误发给我；页面没有丢失工程文件，只是当前表单渲染失败。</p>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

class SafeAppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string }> {
  state = { error: "" };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-shell">
          <section className="section">
            <h2>页面渲染出错</h2>
            <div className="inline-error">{this.state.error}</div>
            <p className="muted">请把这段错误发给我；页面没有丢失工程文件，只是当前表单渲染失败。</p>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [ruleset, setRuleset] = useState<Ruleset | null>(null);
  const [tab, setTab] = useState("overview");
  const [projectPath, setProjectPath] = useState("E:\\Codex\\stardew-cp-studio\\example.cpgen");
  const [openPath, setOpenPath] = useState("");
  const [exportPath, setExportPath] = useState("E:\\Codex\\stardew-cp-studio\\exports");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [status, setStatus] = useState("");
  const [loadError, setLoadError] = useState("");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [itemCatalog, setItemCatalog] = useState<ItemCatalogResponse>({ items: [], source_path: "", warning: "" });

  useEffect(() => {
    Promise.all([fetchJson<Ruleset>("/api/ruleset"), fetchJson<Project>("/api/projects/new"), fetchJson<HealthStatus>("/api/health"), fetchJson<ItemCatalogResponse>("/api/items/catalog")])
      .then(([nextRuleset, nextProject, nextHealth, nextCatalog]) => {
        setRuleset(nextRuleset);
        setProject(nextProject);
        setHealth(nextHealth);
        setItemCatalog(nextCatalog);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : String(error)));
  }, []);

  async function validate(current = project) {
    if (!current) return null;
    const result = await postJson<ValidationResult>("/api/validate", current);
    setValidation(result);
    return result;
  }

  async function saveProject() {
    if (!project) return;
    await postJson("/api/projects/save", { project, path: projectPath });
    setStatus(`已保存工程：${projectPath}`);
  }

  async function openProject() {
    const opened = await postJson<Project>("/api/projects/open", { path: openPath });
    setProject(opened);
    setProjectPath(openPath);
    setStatus(`已打开工程：${openPath}`);
    await validate(opened);
  }

  async function exportPack() {
    if (!project) return;
    const result = await validate(project);
    if (result && result.errors.length > 0) {
      setStatus("导出前请先修复阻止性错误。");
      return;
    }
    const response = await postJson<{ path: string }>("/api/export/content-pack", {
      project,
      output_dir: exportPath,
      folder_name: project.manifest.Name
    });
    setStatus(`已导出内容包：${response.path}`);
  }

  function updateProject(next: Project) {
    setProject(next);
    setValidation(null);
  }

  const issues = useMemo(() => {
    if (!validation) return [];
    return [...validation.errors, ...validation.warnings];
  }, [validation]);

  if (loadError) {
    return (
      <div className="loading error-screen">
        <h1>Stardew CP Studio 加载失败</h1>
        <p>{loadError}</p>
        <p>请重新双击 run_app.bat 启动，然后刷新此页面。</p>
      </div>
    );
  }

  if (!project || !ruleset || !project.meta || !project.manifest) {
    return <div className="loading">正在加载 Stardew CP Studio...</div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Icon name="pkg" />
          <div>
            <strong>Stardew CP Studio</strong>
            <span>Content Patcher 本地工作台</span>
          </div>
        </div>
        <nav>
          <TabButton icon={<Icon name="box" />} id="overview" label="工程总览" tab={tab} setTab={setTab} />
          <TabButton icon={<Icon name="settings" />} id="manifest" label="模组信息" tab={tab} setTab={setTab} />
          <TabButton icon={<Icon name="story" />} id="story" label="剧情模块" tab={tab} setTab={setTab} />
          <TabButton icon={<Icon name="json" />} id="patches" label="CP 补丁" tab={tab} setTab={setTab} />
          <TabButton icon={<Icon name="assets" />} id="assets" label="素材库" tab={tab} setTab={setTab} />
          <TabButton icon={<Icon name="data" />} id="data" label="游戏数据" tab={tab} setTab={setTab} />
          <TabButton icon={<Icon name="rules" />} id="rules" label="规则库" tab={tab} setTab={setTab} />
          <TabButton icon={<Icon name="ai" />} id="ai" label="AI 设置" tab={tab} setTab={setTab} />
          <TabButton icon={<Icon name="export" />} id="export" label="校验与导出" tab={tab} setTab={setTab} />
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <h1>{project.meta.name}</h1>
            <p>规则集 {ruleset.id}，CP 格式版本 {ruleset.content_patcher_format}，服务 {health?.version || "检查中"}</p>
          </div>
          <div className="actions">
            <button title="校验当前工程" onClick={() => validate()}><Icon name="check" />校验</button>
            <button title="保存工程文件" onClick={saveProject}><Icon name="save" />保存</button>
          </div>
        </header>

        {status && <div className="status">{status}</div>}

        {tab === "overview" && (
          <Section title="工程总览">
            <div className="grid two">
              <Field label="工程名称" value={project.meta.name} onChange={(value) => updateProject({ ...project, meta: { ...project.meta, name: value } })} />
              <Field label="保存到 .cpgen 路径" value={projectPath} onChange={setProjectPath} />
              <Field label="打开 .cpgen 路径" value={openPath} onChange={setOpenPath} />
              <div className="button-row align-end">
                <button onClick={openProject}><Icon name="open" />打开</button>
                <button onClick={saveProject}><Icon name="save" />保存</button>
              </div>
            </div>
            <Stats project={project} issues={issues} />
          </Section>
        )}

        {tab === "manifest" && <ManifestEditor project={project} setProject={updateProject} />}
        {tab === "story" && <StoryEventStudio project={project} ruleset={ruleset} setProject={updateProject} />}
        {tab === "patches" && <PatchEditor project={project} ruleset={ruleset} setProject={updateProject} />}
        {tab === "data" && <GameDataEditor project={project} ruleset={ruleset} itemCatalog={itemCatalog} setProject={updateProject} />}
        {tab === "assets" && <AssetManager project={project} setProject={updateProject} />}
        {tab === "rules" && <RuleLibraryView />}
        {tab === "ai" && <AISettings />}
        {tab === "export" && (
          <Section title="校验与导出">
            <div className="grid two">
              <Field label="导出目录" value={exportPath} onChange={setExportPath} />
              <div className="button-row align-end">
                <button onClick={() => validate()}><Icon name="check" />校验</button>
                <button onClick={exportPack}><Icon name="export" />导出内容包</button>
              </div>
            </div>
            <IssueList issues={issues} />
          </Section>
        )}
      </main>
    </div>
  );
}

function TabButton({ icon, id, label, tab, setTab }: { icon: React.ReactNode; id: string; label: string; tab: string; setTab: (id: string) => void }) {
  return <button className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{icon}{label}</button>;
}

function Icon({ name }: { name: string }) {
  const glyphs: Record<string, string> = {
    assets: "A",
    ai: "AI",
    box: "O",
    check: "V",
    data: "D",
    export: "E",
    flow: "F",
    json: "{}",
    open: "O",
    pkg: "S",
    plus: "+",
    rules: "R",
    save: "S",
    settings: "*",
    story: "EV",
    upload: "U",
    warn: "!"
  };
  return <span className="icon" aria-hidden="true">{glyphs[name] || "-"}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="section"><h2>{title}</h2>{children}</section>;
}

function Field({ label, value, onChange, textarea = false }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      {textarea ? <textarea value={value} onChange={(event) => onChange(event.target.value)} /> : <input value={value} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function ComboField({ label, value, options, onChange }: { label: string; value: unknown; options: RulesetOption[]; onChange: (value: string | number | boolean) => void }) {
  const textValue = stringField(value);
  const matched = options.some((option) => String(option.value) === textValue);
  const [custom, setCustom] = useState(!matched && textValue !== "");

  useEffect(() => {
    setCustom(!options.some((option) => String(option.value) === stringField(value)) && stringField(value) !== "");
  }, [value, options]);

  return (
    <label className="field">
      <span>{label}</span>
      <div className="combo-field">
        <select value={custom ? "__custom__" : textValue} onChange={(event) => {
          if (event.target.value === "__custom__") {
            setCustom(true);
            return;
          }
          setCustom(false);
          const option = options.find((item) => String(item.value) === event.target.value);
          onChange(option ? option.value : event.target.value);
        }}>
          {options.map((option) => <option key={`${label}-${String(option.value)}`} value={String(option.value)}>{option.label}</option>)}
          <option value="__custom__">自定义...</option>
        </select>
        {custom && <input value={textValue} onChange={(event) => onChange(event.target.value)} placeholder="输入自定义值或 token" />}
      </div>
    </label>
  );
}

function BoolField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="segmented field-segmented">
        <button type="button" className={value ? "active" : ""} onClick={() => onChange(true)}>是 true</button>
        <button type="button" className={!value ? "active" : ""} onClick={() => onChange(false)}>否 false</button>
      </div>
    </label>
  );
}

function OptionalBoolField({ label, value, onChange }: { label: string; value: unknown; onChange: (value: boolean | null) => void }) {
  const mode = value === true ? "true" : value === false ? "false" : "unset";
  return (
    <label className="field">
      <span>{label}</span>
      <select value={mode} onChange={(event) => {
        if (event.target.value === "true") onChange(true);
        else if (event.target.value === "false") onChange(false);
        else onChange(null);
      }}>
        <option value="unset">留空 / 使用默认</option>
        <option value="true">是 true</option>
        <option value="false">否 false</option>
      </select>
    </label>
  );
}

function ConditionField({ label, value, onChange, placeholder = "TRUE" }: { label: string; value: unknown; onChange: (value: string | boolean | null) => void; placeholder?: string }) {
  const isUnset = value === undefined || value === null || value === "";
  const mode = isUnset ? "unset" : value === true ? "true" : value === false ? "false" : "condition";
  const textValue = mode === "condition" ? stringField(value) : "";
  return (
    <label className="field condition-field">
      <span>{label}</span>
      <select value={mode} onChange={(event) => {
        const next = event.target.value;
        if (next === "unset") onChange(null);
        else if (next === "true") onChange(true);
        else if (next === "false") onChange(false);
        else onChange(textValue || placeholder);
      }}>
        <option value="unset">留空 / 使用游戏默认</option>
        <option value="true">总是 true</option>
        <option value="false">永不 false</option>
        <option value="condition">条件表达式</option>
      </select>
      {mode === "condition" && <textarea value={textValue} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function SeasonDayField({ season, day, seasons, onChange }: { season: string; day: number; seasons: RulesetOption[]; onChange: (season: string, day: number) => void }) {
  return (
    <div className="field">
      <span>生日 BirthSeason / BirthDay</span>
      <div className="date-pair">
        <ComboField label="季节" value={season} options={seasons} onChange={(next) => onChange(String(next), day)} />
        <label className="field">
          <span>日期</span>
          <input type="number" min={1} max={28} value={Number.isFinite(day) ? day : 1} onChange={(event) => onChange(season, clampDay(event.target.value))} />
        </label>
      </div>
    </div>
  );
}

function ManifestEditor({ project, setProject }: { project: Project; setProject: (project: Project) => void }) {
  const manifest = project.manifest;
  const update = (key: keyof Manifest, value: unknown) => setProject({ ...project, manifest: { ...manifest, [key]: value } });
  return (
    <Section title="模组信息">
      <div className="grid two">
        <Field label="模组名称 Name" value={manifest.Name} onChange={(value) => update("Name", value)} />
        <Field label="作者 Author" value={manifest.Author} onChange={(value) => update("Author", value)} />
        <Field label="唯一 ID UniqueID" value={manifest.UniqueID} onChange={(value) => update("UniqueID", value)} />
        <Field label="版本 Version" value={manifest.Version} onChange={(value) => update("Version", value)} />
        <Field label="最低 SMAPI 版本 MinimumApiVersion" value={manifest.MinimumApiVersion} onChange={(value) => update("MinimumApiVersion", value)} />
        <Field label="更新键 UpdateKeys，用逗号分隔" value={manifest.UpdateKeys.join(", ")} onChange={(value) => update("UpdateKeys", splitComma(value))} />
        <Field label="简介 Description" value={manifest.Description} textarea onChange={(value) => update("Description", value)} />
      </div>
    </Section>
  );
}

function FlowMode({ project, ruleset, setProject }: { project: Project; ruleset: Ruleset; setProject: (project: Project) => void }) {
  const [flow, setFlow] = useState<WorkflowState>(() => initialFlow("character"));
  const options = (key: string) => rulesetOptions(ruleset, key);
  const createdEntries = project.game_data.filter((entry) => flow.createdEntryIds.includes(entry.id));
  const editingEntry = project.game_data.find((entry) => entry.id === flow.editingEntryId) || null;

  function updateFlow(patch: Partial<WorkflowState>) {
    const next = { ...flow, ...patch };
    setFlow({ ...next, todos: mergeTodoState(buildTodos(next), flow.todos) });
  }

  function startFlow(kind: FlowKind) {
    const next = { ...initialFlow(kind), active: true };
    setFlow({ ...next, todos: buildTodos(next) });
  }

  function createCharacterEntry() {
    const npcName = normalizeInternalName(flow.npcName || flow.displayName || "ExampleNPC");
    const displayName = flow.displayName || npcName;
    const displayNameKey = `Name.${npcName}`;
    const spriteTextureName = characterAssetGamePath(project, flow.spriteAssetPath, `CharacterFiles/OverworldSprites/${npcName}/${stripExtension(npcName)}`);
    const portraitTextureName = characterAssetGamePath(project, flow.portraitAssetPath, `CharacterFiles/Portraits/${npcName}/${stripExtension(npcName)}`);
    const npcEntry = createWorkflowEntry("npc", `${displayName} 角色`, "Data/Characters", npcName, {
      DisplayName: i18nRef(displayNameKey),
      BirthSeason: flow.birthSeason,
      BirthDay: flow.birthDay,
      HomeRegion: flow.homeRegion,
      Gender: flow.gender,
      CanBeRomanced: flow.relationMode === "romance",
      CanReceiveGifts: true,
      DefaultMap: flow.defaultMap || "Town",
      TextureName: spriteTextureName,
      CustomFields: {
        "StardewCPStudio.PortraitAsset": portraitTextureName
      }
    });
    const nextFlow = {
      ...flow,
      active: true,
      npcName,
      displayName,
      needsCustomMap: flow.homeRegion === "Custom" || flow.defaultMap === "Custom",
      createdEntryIds: uniqueIds([...flow.createdEntryIds, npcEntry.id])
    };
    const existingIndex = project.game_data.findIndex((entry) => flow.createdEntryIds.includes(entry.id) && entry.kind === "npc");
    const nextGameData = existingIndex >= 0 ? replaceAt(project.game_data, existingIndex, { ...npcEntry, id: project.game_data[existingIndex].id }) : [...project.game_data, npcEntry];
    const nextCreatedIds = existingIndex >= 0 ? flow.createdEntryIds : uniqueIds([...flow.createdEntryIds, npcEntry.id]);
    const assetPatches = createCharacterAssetLoadPatches(project, npcName, flow);
    setProject({
      ...project,
      patches: mergeWorkflowPatches(project.patches, assetPatches),
      game_data: nextGameData,
      i18n: { ...project.i18n, [displayNameKey]: displayName }
    });
    setFlow({ ...nextFlow, createdEntryIds: nextCreatedIds, todos: mergeTodoState(buildTodos(nextFlow), flow.todos) });
  }

  function createPrimaryFlowEntry() {
    if (flow.kind === "character") {
      createCharacterEntry();
      return;
    }
    const entry = flow.kind === "item" ? createPrimaryItemEntry(flow) : createPrimaryMapEntry(flow);
    const existingIndex = project.game_data.findIndex((item) => flow.createdEntryIds.includes(item.id) && item.target === entry.target && item.key === entry.key);
    const nextGameData = existingIndex >= 0 ? replaceAt(project.game_data, existingIndex, { ...entry, id: project.game_data[existingIndex].id }) : [...project.game_data, entry];
    const nextCreatedIds = existingIndex >= 0 ? flow.createdEntryIds : uniqueIds([...flow.createdEntryIds, entry.id]);
    const nextFlow = { ...flow, active: true, createdEntryIds: nextCreatedIds };
    setProject({ ...project, game_data: nextGameData });
    setFlow({ ...nextFlow, todos: mergeTodoState(buildTodos(nextFlow), flow.todos) });
  }

  function runTodo(todo: FlowTodo) {
    setFlow({ ...flow, configuringAction: todo.action });
  }

  function confirmTodo(action: FlowAction) {
    const result = createWorkflowResultForAction(action, flow);
    if (!result.entries.length && !result.patches.length && !Object.keys(result.i18n).length) return;
    const mergedGameData = mergeWorkflowEntries(project.game_data, result.entries);
    const mergedPatches = mergeWorkflowPatches(project.patches, result.patches);
    const nextFlow = {
      ...flow,
      configuringAction: null,
      createdEntryIds: uniqueIds([...flow.createdEntryIds, ...result.entries.map((entry) => entry.id)]),
      todos: flow.todos.map((item) => item.action === action ? { ...item, done: true } : item)
    };
    setProject({ ...project, patches: mergedPatches, game_data: mergedGameData, i18n: { ...project.i18n, ...result.i18n } });
    setFlow(nextFlow);
  }

  function finishFlow() {
    setFlow({ ...flow, active: false, completed: true });
  }

  function interruptFlow() {
    setFlow(initialFlow("character"));
  }

  function updateCreatedEntry(nextEntry: GameDataEntry) {
    const index = project.game_data.findIndex((entry) => entry.id === nextEntry.id);
    if (index < 0) return;
    setProject({ ...project, game_data: replaceAt(project.game_data, index, nextEntry) });
  }

  function removeCreatedEntry(entryId: string) {
    setProject({ ...project, game_data: project.game_data.filter((entry) => entry.id !== entryId) });
    setFlow({
      ...flow,
      editingEntryId: flow.editingEntryId === entryId ? null : flow.editingEntryId,
      createdEntryIds: flow.createdEntryIds.filter((id) => id !== entryId)
    });
  }

  return (
    <Section title="流程模式">
      <div className="notice">
        从一个创作起点开始，流程会根据你的选择生成下一步建议。未选择的部分会留在待办里，你可以随时完成或中断流程。
      </div>
      {!flow.active && !flow.completed && (
        <div className="flow-start">
          <button onClick={() => startFlow("character")}><Icon name="plus" />从角色开始创建</button>
          <button onClick={() => startFlow("item")}><Icon name="plus" />从物品开始创建</button>
          <button onClick={() => startFlow("map")}><Icon name="plus" />从地图开始创建</button>
        </div>
      )}
      {flow.completed && (
        <div className="flow-start">
          <button onClick={() => startFlow("character")}><Icon name="plus" />继续：新角色流程</button>
          <button onClick={() => startFlow("item")}><Icon name="plus" />继续：新物品流程</button>
          <button onClick={() => startFlow("map")}><Icon name="plus" />继续：新地图流程</button>
        </div>
      )}
      {(flow.active || flow.completed) && (
        <div className="flow-layout">
          <article className="flow-panel">
            <h3>{flow.kind === "character" ? "角色起点" : flow.kind === "item" ? "物品起点" : "地图起点"}</h3>
            {flow.kind === "character" && (
              <div className="grid two">
                <Field label="内部名称 NPC name" value={flow.npcName} onChange={(npcName) => updateFlow({ npcName })} />
                <Field label="显示名称 DisplayName" value={flow.displayName} onChange={(displayName) => updateFlow({ displayName })} />
                <ComboField label="性别 Gender" value={flow.gender} options={options("genders")} onChange={(gender) => updateFlow({ gender: String(gender) })} />
                <SeasonDayField season={flow.birthSeason} day={flow.birthDay} seasons={options("seasons")} onChange={(birthSeason, birthDay) => updateFlow({ birthSeason, birthDay })} />
                <ComboField label="居住地区 HomeRegion" value={flow.homeRegion} options={[...options("home_regions"), { label: "自定义地图 Custom", value: "Custom" }]} onChange={(homeRegion) => updateFlow({ homeRegion: String(homeRegion), needsCustomMap: String(homeRegion) === "Custom" })} />
                <ComboField label="默认地图 DefaultMap" value={flow.defaultMap} options={[...options("common_maps"), { label: "自定义地图 Custom", value: "Custom" }]} onChange={(defaultMap) => updateFlow({ defaultMap: String(defaultMap), needsCustomMap: String(defaultMap) === "Custom" })} />
                <label className="field">
                  <span>关系路线</span>
                  <select value={flow.relationMode} onChange={(event) => updateFlow({ relationMode: event.target.value as WorkflowState["relationMode"] })}>
                    <option value="friend">普通 NPC</option>
                    <option value="romance">可结婚对象</option>
                    <option value="roommate">室友对象</option>
                  </select>
                </label>
                <CharacterAssetImport
                  label="角色头像 Portrait"
                  project={project}
                  npcName={flow.npcName || flow.displayName}
                  assetKind="portrait"
                  currentPath={flow.portraitAssetPath}
                  onImported={(nextProject, portraitAssetPath) => {
                    setProject(nextProject);
                    updateFlow({ portraitAssetPath });
                  }}
                />
                <CharacterAssetImport
                  label="行走图 Sprite"
                  project={project}
                  npcName={flow.npcName || flow.displayName}
                  assetKind="sprite"
                  currentPath={flow.spriteAssetPath}
                  onImported={(nextProject, spriteAssetPath) => {
                    setProject(nextProject);
                    updateFlow({ spriteAssetPath });
                  }}
                />
              </div>
            )}
            {flow.kind === "item" && (
              <div className="grid two">
                <Field label="物品 ID ItemId" value={flow.itemId} onChange={(itemId) => updateFlow({ itemId })} />
                <Field label="显示名称 DisplayName" value={flow.itemName} onChange={(itemName) => updateFlow({ itemName })} />
                <ComboField label="分类 Category" value={flow.itemCategory} options={options("object_categories")} onChange={(itemCategory) => updateFlow({ itemCategory: Number(itemCategory) })} />
                <Field label="价格 Price" value={String(flow.itemPrice)} onChange={(itemPrice) => updateFlow({ itemPrice: Number(numberOrText(itemPrice)) || 0 })} />
              </div>
            )}
            {flow.kind === "map" && (
              <div className="grid two">
                <Field label="地点 ID LocationId" value={flow.locationId} onChange={(locationId) => updateFlow({ locationId, mapPath: `Maps/${normalizeInternalName(locationId)}` })} />
                <Field label="显示名称 DisplayName" value={flow.locationName} onChange={(locationName) => updateFlow({ locationName })} />
                <Field label="地图资源 MapPath" value={flow.mapPath} onChange={(mapPath) => updateFlow({ mapPath })} />
              </div>
            )}
            <div className="button-row flow-actions">
              <button onClick={() => flow.completed ? setFlow({ ...flow, active: true, completed: false }) : createPrimaryFlowEntry()}><Icon name="plus" />{flow.completed ? "重新打开此流程" : "创建/更新起点条目"}</button>
              <button className="secondary" onClick={finishFlow}>完成流程</button>
              <button className="secondary" onClick={interruptFlow}>中断流程</button>
              <button className="secondary" onClick={() => setFlow(initialFlow("character"))}>开启新流程</button>
            </div>
          </article>
          <article className="flow-panel">
            <h3>下一步建议</h3>
            <div className="flow-todos">
              {flow.todos.map((todo) => (
                <div className={`flow-todo ${todo.done ? "done" : ""}`} key={todo.id}>
                  <div>
                    <strong>{todo.label}</strong>
                    <span>{todo.description}</span>
                  </div>
                  <button className={todo.done ? "secondary" : ""} onClick={() => runTodo(todo)}>{todo.done ? "再创建" : "创建"}</button>
                </div>
              ))}
            </div>
            {flow.configuringAction && (
              <FlowTodoConfigurator
                flow={flow}
                ruleset={ruleset}
                onChange={updateFlow}
                onConfirm={() => flow.configuringAction && confirmTodo(flow.configuringAction)}
                onCancel={() => setFlow({ ...flow, configuringAction: null })}
              />
            )}
          </article>
          <article className="flow-panel flow-created">
            <h3>本流程已添加</h3>
            {createdEntries.length ? createdEntries.map((entry) => (
              <div className="flow-created-row" key={entry.id}>
                <div>
                  <strong>{entry.name}</strong>
                  <code>{entry.target}</code>
                  <span>{entry.key}</span>
                </div>
                <div className="button-row">
                  <button className="secondary" onClick={() => setFlow({ ...flow, editingEntryId: entry.id })}>编辑</button>
                  <button className="secondary" onClick={() => removeCreatedEntry(entry.id)}>删除</button>
                </div>
              </div>
            )) : <div className="empty">还没有添加条目。</div>}
            {editingEntry && (
              <div className="flow-inline-editor">
                <div className="flow-inline-head">
                  <div>
                    <strong>编辑：{editingEntry.name}</strong>
                    <span>{editingEntry.target} / {editingEntry.key}</span>
                  </div>
                  <div className="button-row">
                    <button className="secondary" onClick={() => updateCreatedEntry({ ...editingEntry, editMode: "form" })}>表单</button>
                    <button className="secondary" onClick={() => updateCreatedEntry({ ...editingEntry, editMode: "code" })}>代码</button>
                    <button className="secondary" onClick={() => setFlow({ ...flow, editingEntryId: null })}>关闭</button>
                  </div>
                </div>
                <Field label="条目名称" value={editingEntry.name} onChange={(name) => updateCreatedEntry({ ...editingEntry, name })} />
                {(editingEntry.editMode || "form") === "form" ? (
                  <GameDataForm
                    project={project}
                    entry={editingEntry}
                    ruleset={ruleset}
                    itemCatalog={{ items: [], source_path: "", warning: "" }}
                    i18n={project.i18n}
                    onI18nChange={(i18n) => setProject({ ...project, i18n })}
                    onChange={updateCreatedEntry}
                    setProject={setProject}
                  />
                ) : (
                  <div className="grid two">
                  <JsonField label="当前导出的 EditData 补丁" value={gameDataPatchPreview(editingEntry)} onChange={(value) => updateCreatedEntry(gameDataFromPatchPreview(editingEntry, value))} />
                    <JsonField label="高级 JSON（仅公开字段）" value={publicAdvanced(editingEntry.advanced)} onChange={(advanced) => updateCreatedEntry({ ...editingEntry, advanced: mergePublicAdvanced(editingEntry.advanced, advanced as JsonDict) })} />
                  </div>
                )}
              </div>
            )}
          </article>
        </div>
      )}
    </Section>
  );
}

function FlowTodoConfigurator({ flow, ruleset, onChange, onConfirm, onCancel }: { flow: WorkflowState; ruleset: Ruleset; onChange: (patch: Partial<WorkflowState>) => void; onConfirm: () => void; onCancel: () => void }) {
  const action = flow.configuringAction;
  const options = (key: string) => rulesetOptions(ruleset, key);
  const title = flow.todos.find((todo) => todo.action === action)?.label || "配置下一步";

  return (
    <div className="flow-config">
      <h3>{title}</h3>
      {action === "dialogue" && (
        <DialogueKeyBuilder flow={flow} ruleset={ruleset} onChange={onChange} />
      )}
      {action === "giftTaste" && (
        <div className="grid two">
          <ComboField label="默认喜好分组" value={flow.giftTasteGroup} options={options("gift_taste_groups")} onChange={(giftTasteGroup) => onChange({ giftTasteGroup: String(giftTasteGroup) })} />
          <Field label="初始物品 ID（可留空）" value={flow.itemId} onChange={(itemId) => onChange({ itemId })} />
        </div>
      )}
      {action === "schedule" && (
        <div className="grid two">
          <Field label="日程键 Schedule Key" value={flow.scheduleKey} onChange={(scheduleKey) => onChange({ scheduleKey })} />
          <ComboField label="地图 Map" value={flow.scheduleMap} options={rulesetOptions(ruleset, "common_maps")} onChange={(scheduleMap) => onChange({ scheduleMap: String(scheduleMap) })} />
          <Field label="X 坐标" value={String(flow.scheduleX)} onChange={(scheduleX) => onChange({ scheduleX: Number(numberOrText(scheduleX)) || 0 })} />
          <Field label="Y 坐标" value={String(flow.scheduleY)} onChange={(scheduleY) => onChange({ scheduleY: Number(numberOrText(scheduleY)) || 0 })} />
        </div>
      )}
      {action === "mail" && (
        <div className="grid two">
          <Field label="邮件正文" value={flow.mailText} textarea onChange={(mailText) => onChange({ mailText })} />
        </div>
      )}
      {action === "event" && (
        <div className="grid two">
          <ComboField label="事件地点" value={flow.eventLocation} options={rulesetOptions(ruleset, "common_maps")} onChange={(eventLocation) => onChange({ eventLocation: String(eventLocation) })} />
          <Field label="好感点数 Friendship" value={String(flow.eventFriendship)} onChange={(eventFriendship) => onChange({ eventFriendship: Number(numberOrText(eventFriendship)) || 0 })} />
        </div>
      )}
      {action === "roommateItem" && (
        <div className="grid two">
          <Field label="提案物品 ID" value={`${normalizeInternalName(flow.npcName || flow.displayName)}RoommateProposal`} onChange={() => undefined} />
          <Field label="价格 Price" value={String(flow.roommateItemPrice)} onChange={(roommateItemPrice) => onChange({ roommateItemPrice: Number(numberOrText(roommateItemPrice)) || 0 })} />
          <div className="notice compact-note">将自动写入 context tag：<code>{roommateContextTag(flow.npcName || flow.displayName)}</code></div>
        </div>
      )}
      {action === "giftTasteForItem" && (
        <div className="grid two">
          <Field label="目标 NPC 或 Universal_* key" value={flow.giftNpc} onChange={(giftNpc) => onChange({ giftNpc })} />
          <ComboField label="喜好分组" value={flow.giftTasteGroup} options={options("gift_taste_groups")} onChange={(giftTasteGroup) => onChange({ giftTasteGroup: String(giftTasteGroup) })} />
        </div>
      )}
      {action === "shopForItem" && (
        <div className="grid two">
          <ComboField label="目标商店 Shop ID" value={flow.shopId} options={options("vanilla_shops")} onChange={(shopId) => onChange({ shopId: String(shopId) })} />
          <Field label="出售价格 Price" value={String(flow.shopPrice)} onChange={(shopPrice) => onChange({ shopPrice: Number(numberOrText(shopPrice)) || 0 })} />
        </div>
      )}
      {action === "mailForItem" && (
        <div className="grid two">
          <Field label="附件数量 Quantity" value={String(flow.mailQuantity)} onChange={(mailQuantity) => onChange({ mailQuantity: Number(numberOrText(mailQuantity)) || 1 })} />
          <Field label="邮件 ID 后缀" value={`${normalizeInternalName(flow.itemId || flow.itemName)}.RewardMail`} onChange={() => undefined} />
        </div>
      )}
      {action === "mapWarpTodo" && (
        <div className="grid two">
          <ComboField label="入口来源地图" value={flow.warpFrom} options={rulesetOptions(ruleset, "common_maps")} onChange={(warpFrom) => onChange({ warpFrom: String(warpFrom) })} />
          <Field label="入口 X" value={String(flow.warpX)} onChange={(warpX) => onChange({ warpX: Number(numberOrText(warpX)) || 0 })} />
          <Field label="入口 Y" value={String(flow.warpY)} onChange={(warpY) => onChange({ warpY: Number(numberOrText(warpY)) || 0 })} />
        </div>
      )}
      {action === "mapEventTodo" && (
        <div className="notice compact-note">
          将在 <code>Data/Events/{normalizeInternalName(flow.locationId || flow.locationName)}</code> 下创建一个地点介绍事件占位。
        </div>
      )}
      {!["giftTasteForItem", "shopForItem", "mailForItem", "mapWarpTodo", "mapEventTodo"].includes(String(action)) && (
        <div className="notice compact-note">这个待办会按当前流程信息生成基础模板，之后可在游戏数据页面继续编辑。</div>
      )}
      <div className="button-row">
        <button onClick={onConfirm}><Icon name="plus" />确认创建</button>
        <button className="secondary" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

function DialogueKeyBuilder({ flow, ruleset, onChange }: { flow: WorkflowState; ruleset: Ruleset; onChange: (patch: Partial<WorkflowState>) => void }) {
  const npcName = normalizeInternalName(flow.npcName || flow.displayName || "ExampleNPC");
  const format = dialogueFormatById(flow.dialogueKeyType, ruleset);
  const key = buildDialogueKey(flow, npcName, ruleset);
  const target = dialogueTargetForFlow(flow, npcName, ruleset);
  const i18nKey = dialogueI18nKey(flow, npcName, ruleset);
  const scope = format.scope === "marriage" ? "marriage" : "normal";

  function setFormat(formatId: string) {
    const nextFormat = dialogueFormatById(formatId, ruleset);
    const fields = defaultDialogueFields(nextFormat, npcName);
    onChange({
      dialogueKeyType: formatId,
      dialogueSeason: String(fields.season || flow.dialogueSeason || "spring"),
      dialogueWeekday: String(fields.weekday || flow.dialogueWeekday || "Mon"),
      dialogueDay: Number(fields.day || flow.dialogueDay || 1),
      dialogueHearts: Number(fields.hearts || flow.dialogueHearts || 4),
      dialogueEventId: String(fields.eventId || flow.dialogueEventId || "100"),
      dialogueItemId: String(fields.itemId || flow.dialogueItemId || "(O)388"),
      dialogueMarriageScene: String(fields.scene || fields.family || flow.dialogueMarriageScene || "Indoor_Day"),
      dialogueKey: String(fields.customKey || flow.dialogueKey || "CustomDialogue")
    });
  }

  function updateField(field: DialogueFormatField, value: string | number) {
    onChange(workflowDialogueFieldPatch(format, field.name, value));
  }

  return (
    <div className="dialogue-builder">
      <div className="grid two">
        <label className="field">
          <span>对话目标</span>
          <select value={scope} onChange={(event) => setFormat(dialogueFormatsByScope(ruleset, event.target.value as "normal" | "marriage")[0]?.id || "weekday")}>
            <option value="normal">普通对话 Characters/Dialogue/NPC</option>
            <option value="marriage">婚后/室友对话 MarriageDialogueNPC</option>
          </select>
        </label>
        <label className="field">
          <span>Key 格式</span>
          <select value={format.id} onChange={(event) => setFormat(event.target.value)}>
            {Object.entries(groupedDialogueFormats(ruleset, scope)).map(([group, formats]) => (
              <optgroup label={group} key={group}>{formats.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>
            ))}
          </select>
        </label>
        <Field label="i18n 前缀覆盖（可留空）" value={flow.dialogueI18nPrefix} onChange={(dialogueI18nPrefix) => onChange({ dialogueI18nPrefix })} />
        {format.fields.map((field) => (
          <DialogueFormatInput
            key={field.name}
            field={field}
            ruleset={ruleset}
            npcName={npcName}
            value={workflowDialogueFieldValue(flow, field.name, format, npcName)}
            onChange={(value) => updateField(field, value)}
          />
        ))}
        <Field label="台词正文（写入 i18n/default.json）" value={flow.dialogueText} textarea onChange={(dialogueText) => onChange({ dialogueText })} />
      </div>
      {format.warning && <div className="notice compact-note">{format.warning}</div>}
      <div className="notice compact-note">
        当前导出：<code>{target}</code> / Key <code>{key}</code> = <code>{i18nRef(i18nKey)}</code>
      </div>
    </div>
  );
}

function DialogueFormatInput({ field, ruleset, npcName, value, onChange }: { field: DialogueFormatField; ruleset?: Ruleset; npcName: string; value: string | number; onChange: (value: string | number) => void }) {
  const label = dialogueFieldLabel(field);
  if (field.type === "marriage_key") {
    return <ComboField label={label} value={value} options={marriageKeyOptions(npcName)} onChange={(next) => onChange(next as string | number)} />;
  }
  if (field.type === "select") {
    return <ComboField label={label} value={value} options={dialogueFieldOptions(ruleset, field.options)} onChange={(next) => onChange(next as string | number)} />;
  }
  if (field.type === "day") {
    return <Field label={label} value={String(value || 1)} onChange={(next) => onChange(clampDay(next))} />;
  }
  if (field.type === "integer") {
    return <Field label={label} value={String(value ?? 0)} onChange={(next) => onChange(integerInRange(numberOrText(next), field.min ?? 0, field.max ?? 999, field.min ?? 0))} />;
  }
  if (field.type === "npc") {
    return <Field label={label} value={String(value || npcName)} onChange={(next) => onChange(normalizeInternalName(next))} />;
  }
  return <Field label={label} value={String(value || "")} onChange={onChange} />;
}

function dialogueFieldLabel(field: DialogueFormatField) {
  const labels: Record<string, string> = {
    day: "日期 1-28",
    weekday: "星期",
    hearts: "好感心数",
    year: "年份条件",
    season: "季节",
    npc: "NPC 内部名",
    itemId: "物品 ID",
    reaction: "礼物反应",
    specialKey: "特殊 Key",
    resortKey: "姜岛度假村 Key",
    greenRainKey: "绿雨 Key",
    eventId: "事件 ID",
    memoryKey: "记忆 Key",
    duration: "持续时间",
    location: "地点",
    x: "X 坐标",
    y: "Y 坐标",
    scene: "婚后场景",
    family: "孩子场景",
    index: "序号 n",
    key: "婚后/室友 Key",
    customKey: "自定义 Key"
  };
  return labels[field.name] || field.name;
}

function PatchEditor({ project, ruleset, setProject }: { project: Project; ruleset: Ruleset; setProject: (project: Project) => void }) {
  function addPatch(action: Patch["action"] = "EditData") {
    const patch: Patch = {
      id: makeId(),
      name: `${action} 补丁`,
      action,
      enabled: true,
      target: action === "Include" ? "" : "Data/Objects",
      from_file: action === "EditData" ? null : "assets/example.json",
      when: {},
      fields: action === "EditData" ? { Entries: {} } : {},
      advanced: {}
    };
    setProject({ ...project, patches: [...project.patches, patch] });
  }

  return (
    <Section title="Content Patcher 补丁">
      <div className="toolbar">
        {ruleset.patch_actions.map((action) => <button key={action.action} onClick={() => addPatch(action.action)}><Icon name="plus" />{actionLabel(action.action)}</button>)}
      </div>
      <div className="stack">
        {project.patches.map((patch, index) => (
          <PatchCard
            key={patch.id}
            patch={patch}
            ruleset={ruleset}
            onChange={(next) => setProject({ ...project, patches: replaceAt(project.patches, index, next) })}
            onRemove={() => setProject({ ...project, patches: project.patches.filter((item) => item.id !== patch.id) })}
          />
        ))}
      </div>
    </Section>
  );
}

function PatchCard({ patch, ruleset, onChange, onRemove }: { patch: Patch; ruleset: Ruleset; onChange: (patch: Patch) => void; onRemove: () => void }) {
  return (
    <article className="card">
      <div className="card-head">
        <input value={patch.name} onChange={(event) => onChange({ ...patch, name: event.target.value })} />
        <select value={patch.action} onChange={(event) => onChange({ ...patch, action: event.target.value as Patch["action"] })}>
          {ruleset.patch_actions.map((action) => <option key={action.action} value={action.action}>{actionLabel(action.action)}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={patch.enabled} onChange={(event) => onChange({ ...patch, enabled: event.target.checked })} />启用</label>
        <button onClick={onRemove}>删除</button>
      </div>
      <div className="grid two">
        <Field label="目标 Target" value={patch.target} onChange={(value) => onChange({ ...patch, target: value })} />
        <Field label="来源文件 FromFile" value={patch.from_file || ""} onChange={(value) => onChange({ ...patch, from_file: value || null })} />
        <JsonField label="动作字段 Entries / Fields / ToArea 等" value={patch.fields} onChange={(value) => onChange({ ...patch, fields: value as JsonDict })} />
        <JsonField label="高级 JSON" value={patch.advanced} onChange={(value) => onChange({ ...patch, advanced: value as JsonDict })} />
      </div>
      <WhenBuilder ruleset={ruleset} value={patch.when} onChange={(when) => onChange({ ...patch, when })} />
      <PatchAIAssistantPanel patch={patch} onApply={(kind, value) => onChange(applyAISuggestionToPatch(patch, kind, value))} />
    </article>
  );
}

function GameDataEditor({ project, ruleset, itemCatalog, setProject }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; setProject: (project: Project) => void }) {
  const visibleEntries = project.game_data
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !isNpcManagedEntry(entry));

  function addEntry(kind: GameDataEntry["kind"]) {
    const rule = ruleset.game_data_kinds.find((item) => item.kind === kind);
    const template = gameDataTemplate(kind);
    const entry: GameDataEntry = {
      id: makeId(),
      kind,
      name: `${gameDataLabel(kind, rule?.label)}条目`,
      target: template.target || rule?.defaultTarget || "Data/Objects",
      key: template.key,
      value: template.value,
      when: {},
      advanced: {},
      editMode: "form"
    };
    setProject({ ...project, game_data: [...project.game_data, entry] });
  }

  return (
    <Section title="游戏数据向导">
      <div className="toolbar">
        {ruleset.game_data_kinds.map((kind) => <button key={kind.kind} onClick={() => addEntry(kind.kind)}><Icon name="plus" />{gameDataLabel(kind.kind, kind.label)}</button>)}
      </div>
      <div className="stack">
        {visibleEntries.map(({ entry, index }) => (
          <article className="card" key={entry.id}>
            <div className="card-head">
              <input value={entry.name} onChange={(event) => setProject({ ...project, game_data: replaceAt(project.game_data, index, { ...entry, name: event.target.value }) })} />
              <div className="segmented">
                <button className={(entry.editMode || "form") === "form" ? "active" : ""} onClick={() => setProject({ ...project, game_data: replaceAt(project.game_data, index, { ...entry, editMode: "form" }) })}>表单</button>
                <button className={entry.editMode === "code" ? "active" : ""} onClick={() => setProject({ ...project, game_data: replaceAt(project.game_data, index, { ...entry, editMode: "code" }) })}>代码</button>
              </div>
              <button onClick={() => setProject({ ...project, game_data: project.game_data.filter((item) => item.id !== entry.id) })}>删除</button>
            </div>
            {(entry.editMode || "form") === "form" ? (
              <GameDataForm
                project={project}
                entry={entry}
                ruleset={ruleset}
                itemCatalog={itemCatalog}
                i18n={project.i18n}
                onI18nChange={(i18n) => setProject({ ...project, i18n })}
                onChange={(next) => setProject({ ...project, game_data: replaceAt(project.game_data, index, next) })}
                setProject={setProject}
              />
            ) : (
              <div className="code-layout">
                <div className="grid two">
                  <JsonField label="当前导出的 EditData 补丁" value={gameDataPatchPreview(entry)} onChange={(value) => setProject({ ...project, game_data: replaceAt(project.game_data, index, gameDataFromPatchPreview(entry, value)) })} />
                  <JsonField label="高级 JSON（仅公开字段）" value={publicAdvanced(entry.advanced)} onChange={(value) => setProject({ ...project, game_data: replaceAt(project.game_data, index, { ...entry, advanced: mergePublicAdvanced(entry.advanced, value as JsonDict) }) })} />
                </div>
                <AIAssistantPanel
                  project={project}
                  entry={entry}
                  onApply={(kind, value) => {
                    const nextEntry = applyAISuggestionToGameData(entry, kind, value);
                    setProject({ ...project, game_data: replaceAt(project.game_data, index, nextEntry) });
                  }}
                />
              </div>
            )}
          </article>
        ))}
      </div>
    </Section>
  );
}

function GameDataForm({ project, entry, ruleset, itemCatalog, i18n = {}, onI18nChange, onChange, setProject }: { project: Project; entry: GameDataEntry; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; i18n?: Record<string, string>; onI18nChange?: (i18n: Record<string, string>) => void; onChange: (entry: GameDataEntry) => void; setProject: (project: Project) => void }) {
  const value = isObject(entry.value) ? entry.value : {};
  const setValueField = (key: string, nextValue: unknown) => onChange({ ...entry, value: { ...value, [key]: nextValue } });
  const options = (key: string) => rulesetOptions(ruleset, key);

  return (
    <div className="grid two">
      {entry.kind !== "dialogue" && entry.kind !== "mail" && entry.kind !== "trigger_action" && (
        <>
          <Field label="数据目标 Target" value={entry.target} onChange={(target) => onChange({ ...entry, target })} />
          <Field label="条目键 Key" value={entry.key} onChange={(key) => onChange({ ...entry, key })} />
        </>
      )}

      {entry.kind === "npc" && (
        <NpcEntryForm project={project} entry={entry} ruleset={ruleset} itemCatalog={itemCatalog} onChange={onChange} setProject={setProject} />
      )}

      {entry.kind === "item" && (
        <>
          <Field label="显示名称 DisplayName" value={stringField(value.DisplayName)} onChange={(next) => setValueField("DisplayName", next)} />
          <Field label="描述 Description" value={stringField(value.Description)} onChange={(next) => setValueField("Description", next)} />
          <Field label="价格 Price" value={stringField(value.Price)} onChange={(next) => setValueField("Price", numberOrText(next))} />
          <ComboField label="分类 Category" value={value.Category} options={options("object_categories")} onChange={(next) => setValueField("Category", numberOrText(String(next)))} />
          <ComboField label="可食用值 Edibility" value={value.Edibility} options={options("edibility")} onChange={(next) => setValueField("Edibility", numberOrText(String(next)))} />
        </>
      )}

      {entry.kind === "dialogue" && (
        <DialogueEntryFormClean project={project} entry={entry} ruleset={ruleset} i18n={i18n} onI18nChange={onI18nChange} onChange={onChange} />
      )}

      {entry.kind === "mail" && (
        <MailEntryForm project={project} entry={entry} ruleset={ruleset} itemCatalog={itemCatalog} onChange={onChange} setProject={setProject} />
      )}

      {entry.kind === "trigger_action" && (
        <TriggerActionForm entry={entry} ruleset={ruleset} onChange={onChange} />
      )}

      {entry.kind === "shop" && (
        <>
          <Field label="商店名称 DisplayName" value={stringField(value.DisplayName)} onChange={(next) => setValueField("DisplayName", next)} />
          <ComboField label="货币 Currency" value={value.Currency || "money"} options={options("shop_currencies")} onChange={(next) => setValueField("Currency", next)} />
          <Field label="打开音效 OpenSound" value={stringField(value.OpenSound)} onChange={(next) => setValueField("OpenSound", next)} />
          <Field label="购买音效 PurchaseSound" value={stringField(value.PurchaseSound)} onChange={(next) => setValueField("PurchaseSound", next)} />
          <JsonField label="出售物品 Items" value={value.Items || []} onChange={(next) => setValueField("Items", next)} />
        </>
      )}

      {entry.kind === "event" && (
        <StoryEventForm project={project} entry={entry} ruleset={ruleset} i18n={i18n} onI18nChange={onI18nChange} onChange={onChange} />
      )}

      {entry.kind === "custom" && (
        <JsonField label="条目内容 Value" value={entry.value} onChange={(next) => onChange({ ...entry, value: next })} />
      )}

      <WhenBuilder ruleset={ruleset} value={entry.when} onChange={(when) => onChange({ ...entry, when })} />
      {entry.kind !== "dialogue" && (
        <JsonField label="高级 JSON（仅公开字段）" value={publicAdvanced(entry.advanced)} onChange={(advanced) => onChange({ ...entry, advanced: mergePublicAdvanced(entry.advanced, advanced as JsonDict) })} />
      )}
    </div>
  );
}

function MailEntryForm({ project, entry, ruleset, itemCatalog, onChange, setProject }: { project: Project; entry: GameDataEntry; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; onChange: (entry: GameDataEntry) => void; setProject: (project: Project) => void }) {
  const value = isObject(entry.value) ? entry.value : {};
  const normalized = normalizeMailValue(value);
  const body = mailBodyFromValue(normalized);
  const backgroundSource = stringField(normalized.BackgroundType || "vanilla");
  const backgroundIndex = stringField(normalized.BackgroundIndex || normalized.BackgroundMode || 0);
  const customBackgroundTarget = stringField(normalized.BackgroundAsset || normalized.BackgroundAssetTarget || "");
  const customBackgroundFile = stringField(normalized.BackgroundFile || "");
  const attachments = Array.isArray(normalized.Attachments) ? normalized.Attachments.map((attachment) => normalizeMailAttachment(attachment)) : [];
  const mailKey = stringField(entry.key || normalized.MailId || "ExampleMail");
  const mailBackgroundTarget = customBackgroundTarget || `Mods/${project.manifest.UniqueID || "Author.Mod"}/MailBackgrounds/${sanitizeI18nPart(mailKey)}/background`;

  function updateMail(patch: JsonDict) {
    onChange({ ...entry, value: { ...normalized, ...patch } });
  }

  return (
    <div className="subsection highlight mail-module">
      <h3>信件模块</h3>
      <div className="grid two">
        <Field label="邮件 ID" value={mailKey} onChange={(key) => onChange({ ...entry, key })} />
        <ComboField label="背景来源" value={backgroundSource} options={MAIL_BACKGROUND_SOURCE_OPTIONS} onChange={(BackgroundType) => updateMail({ BackgroundType, BackgroundMode: BackgroundType === "vanilla" ? backgroundIndex : normalized.BackgroundMode })} />
        {backgroundSource === "vanilla" ? (
          <ComboField label="背景样式" value={backgroundIndex} options={MAIL_BACKGROUND_OPTIONS} onChange={(BackgroundIndex) => updateMail({ BackgroundIndex, BackgroundMode: BackgroundIndex })} />
        ) : (
          <>
            <Field label="背景索引" value={backgroundIndex} onChange={(BackgroundIndex) => updateMail({ BackgroundIndex, BackgroundMode: BackgroundIndex })} />
            <TargetedAssetImport
              label="导入自定义信纸图片"
              project={project}
              accept="image/png,image/jpeg,image/webp"
              storedPath={customBackgroundFile || `assets/MailBackgrounds/${sanitizeI18nPart(mailKey)}/background.png`}
              onImported={(nextProject, storedPath, asset) => {
                const target = `Mods/${nextProject.manifest.UniqueID || "Author.Mod"}/MailBackgrounds/${sanitizeI18nPart(mailKey)}/background`;
                updateMail({ BackgroundAsset: target, BackgroundAssetTarget: target, BackgroundFile: storedPath });
                setProject(nextProject);
              }}
            />
            <div className="field">
              <span>信纸目标</span>
              <code>{mailBackgroundTarget}</code>
            </div>
          </>
        )}
        <ComboField label="文字颜色" value={stringField(normalized.TextColor || '')} options={MAIL_TEXT_COLOR_OPTIONS} onChange={(TextColor) => updateMail({ TextColor })} />
        <Field label="标题" value={stringField(normalized.Title || '')} onChange={(Title) => updateMail({ Title })} />
        <DialogueTextTools label="信件正文" project={project} npcName={stringField(normalized.NpcName || 'ExampleNPC')} value={body} onChange={(next) => updateMail({ Body: next })} />
      </div>
      <div className="mail-subsection">
        <h4>附件</h4>
        <MailAttachmentEditor value={attachments} itemOptions={itemSelectionOptions(project, ruleset, itemCatalog, "qualified")} onChange={(next) => updateMail({ Attachments: next })} />
        <div className="notice compact-note">信件只导出 <code>Data/Mail</code> 正文。发送信件请另建 <code>Data/TriggerActions</code>，例如 <code>AddMail Current {mailKey}</code>，再用 When 限制触发条件。</div>
      </div>
    </div>
  );
}

function TriggerActionForm({ entry, ruleset, onChange }: { entry: GameDataEntry; ruleset: Ruleset; onChange: (entry: GameDataEntry) => void }) {
  const value = isObject(entry.value) ? entry.value : {};
  const actions = Array.isArray(value.Actions) ? value.Actions.map(normalizeTriggerActionRow) : [];
  const key = entry.key || stringField(value.Id || "ExampleTriggerAction");

  function updateValue(patch: JsonDict) {
    onChange({
      ...entry,
      target: "Data/TriggerActions",
      key,
      value: { ...value, ...patch }
    });
  }

  return (
    <div className="subsection highlight mail-module">
      <h3>触发动作模块</h3>
      <div className="grid two">
        <Field label="Entries Key" value={entry.key || key} onChange={(nextKey) => onChange({ ...entry, target: "Data/TriggerActions", key: nextKey, value: { ...value, Id: stringField(value.Id || nextKey) } })} />
        <Field label="Id" value={stringField(value.Id || key)} onChange={(Id) => updateValue({ Id })} />
        <ComboField label="Trigger" value={stringField(value.Trigger || "DayStarted")} options={triggerEventOptions(ruleset)} onChange={(Trigger) => updateValue({ Trigger })} />
        <BoolField label="仅主机 HostOnly" value={Boolean(value.HostOnly)} onChange={(HostOnly) => updateValue({ HostOnly })} />
      </div>
      <TriggerActionCommandEditor value={actions} onChange={(next) => updateValue({ Actions: next })} />
      <div className="notice compact-note">Trigger Action 是独立的 <code>Data/TriggerActions</code> 条目，不会写进信件正文。常用发送信件：<code>AddMail Current LetterId now/tomorrow/received</code>。</div>
    </div>
  );
}

function normalizeMailValue(value: JsonDict) {
  return {
    ...value,
    BackgroundType: stringField(value.BackgroundType || (value.BackgroundAsset || value.BackgroundAssetTarget ? "custom" : "vanilla")),
    BackgroundIndex: numberOrText(stringField(value.BackgroundIndex ?? value.BackgroundMode ?? 0)),
    BackgroundAsset: stringField(value.BackgroundAsset || value.BackgroundAssetTarget || ""),
    BackgroundAssetTarget: stringField(value.BackgroundAssetTarget || value.BackgroundAsset || ""),
    BackgroundFile: stringField(value.BackgroundFile || ""),
    TextColor: stringField(value.TextColor || ""),
    Title: stringField(value.Title || ""),
    Body: mailBodyFromValue(value),
    Attachments: Array.isArray(value.Attachments) ? value.Attachments : [],
    Actions: Array.isArray(value.Actions) ? value.Actions : [],
    MailId: stringField(value.MailId || "")
  };
}

function normalizeMailValueForPatch(value: JsonDict) {
  return {
    ...normalizeMailValue(value),
    BackgroundMode: stringField(value.BackgroundMode || value.BackgroundIndex || 0)
  };
}

function mailBodyFromValue(value: JsonDict) {
  const body = stringField(value.Body || value.Text || value.Message || '');
  return body;
}

function mailBodyForExport(text: string) {
  return text.replace(/\r\n|\r|\n/g, "^");
}

function normalizeMailAttachment(value: unknown): MailAttachmentRow {
  const source = isObject(value) ? value : {};
  return {
    kind: stringField(source.kind || source.Type || "action") as MailAttachmentKind,
    action: stringField(source.action || source.Action || source.Marker || source.marker || ""),
    itemId: stringField(source.itemId || source.ItemId || ""),
    count: integerInRange(source.count ?? source.Count, 1, 9999, 1),
    amount: integerInRange(source.amount ?? source.Amount, -9999999, 9999999, 0),
    minAmount: integerInRange(source.minAmount ?? source.MinAmount, -9999999, 9999999, 0),
    maxAmount: integerInRange(source.maxAmount ?? source.MaxAmount, -9999999, 9999999, 0),
    topic: stringField(source.topic || source.Topic || ""),
    days: integerInRange(source.days ?? source.Days, 0, 999, 1),
    recipeId: stringField(source.recipeId || source.RecipeId || source.key || ""),
    questId: stringField(source.questId || source.QuestId || ""),
    autoGrant: Boolean(source.autoGrant ?? source.AutoGrant),
    orderId: stringField(source.orderId || source.OrderId || ""),
    immediate: Boolean(source.immediate ?? source.Immediately),
    marker: stringField(source.marker || source.Marker || source.text || source.Text || "")
  };
}

function mailAttachmentMarker(attachment: MailAttachmentRow) {
  if (attachment.marker.trim()) return attachment.marker.trim();
  switch (attachment.kind) {
    case "action":
      return `%action ${attachment.action.trim() || "AddMail ExampleMail"} %%`;
    case "item_id":
      return `%item id ${attachment.itemId.trim() || "(O)388"} ${Math.max(1, attachment.count || 1)} %%`;
    case "money":
      return attachment.maxAmount > attachment.minAmount
        ? `%item money ${attachment.minAmount || 0} ${attachment.maxAmount || 1} %%`
        : `%item money ${attachment.amount || 0} %%`;
    case "conversationTopic":
      return `%item conversationTopic ${attachment.topic.trim() || "ExampleTopic"} ${Math.max(0, attachment.days || 1)} %%`;
    case "cookingRecipe":
      return attachment.recipeId.trim() ? `%item cookingRecipe ${attachment.recipeId.trim()} %%` : `%item cookingRecipe %%`;
    case "craftingRecipe":
      return `%item craftingRecipe ${attachment.recipeId.trim() || "ExampleRecipe"} %%`;
    case "itemRecovery":
      return `%item itemRecovery ${attachment.recipeId.trim() || "ExampleQuestItem"} %%`;
    case "quest":
      return `%item quest ${attachment.questId.trim() || "0"}${attachment.autoGrant ? " true" : ""} %%`;
    case "specialOrder":
      return `%item specialOrder ${attachment.orderId.trim() || "0"}${attachment.immediate ? " immediately" : ""} %%`;
    default:
      return attachment.marker.trim();
  }
}

function mailAttachmentLabel(attachment: MailAttachmentRow) {
  switch (attachment.kind) {
    case "action":
      return "动作";
    case "item_id":
      return "物品";
    case "money":
      return "金钱";
    case "conversationTopic":
      return "对话话题";
    case "cookingRecipe":
      return "烹饪配方";
    case "craftingRecipe":
      return "制作配方";
    case "itemRecovery":
      return "失物找回";
    case "quest":
      return "任务";
    case "specialOrder":
      return "特殊订单";
    default:
      return "自定义";
  }
}

function MailAttachmentEditor({ value, itemOptions, onChange }: { value: MailAttachmentRow[]; itemOptions: ItemOption[]; onChange: (value: MailAttachmentRow[]) => void }) {
  const rows = value;

  function updateRow(index: number, patch: Partial<MailAttachmentRow>) {
    const next = [...rows];
    next[index] = normalizeMailAttachment({ ...next[index], ...patch });
    onChange(next);
  }

  function addRow() {
    onChange([...rows, normalizeMailAttachment({ kind: "action" })]);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="structured-editor">
      <div className="structured-editor-head">
        <div>
          <strong>附件</strong>
          <span>每条附件会写成一段 Mail marker；支持多条，导出时按顺序拼进正文。</span>
        </div>
        <button type="button" className="secondary" onClick={addRow}><Icon name="plus" />添加附件</button>
      </div>
      {rows.map((row, index) => (
        <div className="mail-attachment-row" key={`mail-attachment-${index}`}>
          <div className="grid two">
            <ComboField label="类型" value={row.kind} options={MAIL_ATTACHMENT_KIND_OPTIONS} onChange={(kind) => updateRow(index, { kind: kind as MailAttachmentKind })} />
            <Field label="自定义 marker" value={row.marker} onChange={(marker) => updateRow(index, { marker })} />
            {row.kind === "action" && <Field label="动作文本" value={row.action} onChange={(action) => updateRow(index, { action })} />}
            {row.kind === "item_id" && <>
              <ComboField label="物品 ID" value={row.itemId} options={itemOptions} onChange={(itemId) => updateRow(index, { itemId: String(itemId) })} />
              <Field label="自定义物品 ID" value={row.itemId} onChange={(itemId) => updateRow(index, { itemId })} />
              <Field label="数量 Count" value={stringField(row.count)} onChange={(count) => updateRow(index, { count: integerInRange(count, 1, 9999, 1) })} />
            </>}
            {row.kind === "money" && <>
              <Field label="金额 Amount" value={stringField(row.amount)} onChange={(amount) => updateRow(index, { amount: integerInRange(amount, 0, 9999999, 0), minAmount: integerInRange(amount, 0, 9999999, 0), maxAmount: integerInRange(amount, 0, 9999999, 0) })} />
              <Field label="最小值 Min" value={stringField(row.minAmount)} onChange={(minAmount) => updateRow(index, { minAmount: integerInRange(minAmount, 0, 9999999, 0) })} />
              <Field label="最大值 Max" value={stringField(row.maxAmount)} onChange={(maxAmount) => updateRow(index, { maxAmount: integerInRange(maxAmount, 0, 9999999, 0) })} />
            </>}
            {row.kind === "conversationTopic" && <>
              <Field label="话题 ID" value={row.topic} onChange={(topic) => updateRow(index, { topic })} />
              <Field label="持续天数 Days" value={stringField(row.days)} onChange={(days) => updateRow(index, { days: integerInRange(days, 0, 999, 1) })} />
            </>}
            {row.kind === "cookingRecipe" && <Field label="配方 ID" value={row.recipeId} onChange={(recipeId) => updateRow(index, { recipeId })} />}
            {row.kind === "craftingRecipe" && <Field label="配方 ID" value={row.recipeId} onChange={(recipeId) => updateRow(index, { recipeId })} />}
            {row.kind === "itemRecovery" && <Field label="失物 ID" value={row.recipeId} onChange={(recipeId) => updateRow(index, { recipeId })} />}
            {row.kind === "quest" && <>
              <Field label="任务 ID" value={row.questId} onChange={(questId) => updateRow(index, { questId })} />
              <BoolField label="自动接取" value={row.autoGrant} onChange={(autoGrant) => updateRow(index, { autoGrant })} />
            </>}
            {row.kind === "specialOrder" && <>
              <Field label="订单 ID" value={row.orderId} onChange={(orderId) => updateRow(index, { orderId })} />
              <BoolField label="立即附加" value={row.immediate} onChange={(immediate) => updateRow(index, { immediate })} />
            </>}
            <div className="field">
              <span>导出结果</span>
              <code>{mailAttachmentMarker(row)}</code>
            </div>
          </div>
          <div className="button-row">
            <button type="button" className="secondary" onClick={() => removeRow(index)}>删除附件</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function normalizeTriggerActionRow(value: unknown): TriggerActionRow {
  if (typeof value === "string") return parseTriggerActionString(value);
  const source = isObject(value) ? value : {};
  return {
    kind: triggerActionKind(source.kind || source.Kind || "AddMail"),
    player: stringField(source.player || source.Player || "Current"),
    mailId: stringField(source.mailId || source.MailId || "ExampleMail"),
    mailType: stringField(source.mailType || source.Type || "tomorrow"),
    amount: integerInRange(source.amount || source.Amount, -9999999, 9999999, 500),
    targetAction: stringField(source.targetAction || source.TargetAction || "ExampleTriggerAction"),
    raw: stringField(source.raw || source.Raw || "")
  };
}

function parseTriggerActionString(value: string): TriggerActionRow {
  const parts = value.trim().split(/\s+/);
  const kind = triggerActionKind(parts[0] || "custom");
  if (kind === "AddMail" || kind === "RemoveMail") {
    return normalizeTriggerActionRow({ kind, player: parts[1] || "Current", mailId: parts[2] || "ExampleMail", mailType: parts[3] || (kind === "AddMail" ? "tomorrow" : "all") });
  }
  if (kind === "AddMoney") return normalizeTriggerActionRow({ kind, amount: Number(parts[1] || 500) });
  if (kind === "RunTriggerAction") return normalizeTriggerActionRow({ kind, targetAction: parts[1] || "ExampleTriggerAction" });
  return normalizeTriggerActionRow({ kind: "custom", raw: value });
}

function triggerActionKind(value: unknown): TriggerActionCommandKind {
  return value === "AddMail" || value === "RemoveMail" || value === "AddMoney" || value === "RunTriggerAction" ? value : "custom";
}

function triggerActionString(row: TriggerActionRow) {
  if (row.kind === "AddMail" || row.kind === "RemoveMail") {
    const defaultType = row.kind === "AddMail" ? "tomorrow" : "all";
    const type = row.mailType && row.mailType !== defaultType ? ` ${row.mailType}` : "";
    return `${row.kind} ${row.player || "Current"} ${row.mailId || "ExampleMail"}${type}`;
  }
  if (row.kind === "AddMoney") return `AddMoney ${integerInRange(row.amount, -9999999, 9999999, 500)}`;
  if (row.kind === "RunTriggerAction") return `RunTriggerAction ${row.targetAction || "ExampleTriggerAction"}`;
  return row.raw.trim();
}

function TriggerActionCommandEditor({ value, onChange }: { value: TriggerActionRow[]; onChange: (value: string[]) => void }) {
  const rows = value;

  function updateRows(nextRows: TriggerActionRow[]) {
    onChange(nextRows.map(triggerActionString).filter(Boolean));
  }

  function updateRow(index: number, patch: Partial<TriggerActionRow>) {
    const next = [...rows];
    next[index] = normalizeTriggerActionRow({ ...next[index], ...patch });
    updateRows(next);
  }

  function addRow(kind: TriggerActionCommandKind = "AddMail") {
    updateRows([...rows, normalizeTriggerActionRow({ kind })]);
  }

  function removeRow(index: number) {
    updateRows(rows.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="structured-editor">
      <div className="structured-editor-head">
        <div>
          <strong>动作列表 Actions</strong>
          <span>每行导出为 Trigger Action 字符串。</span>
        </div>
        <button type="button" className="secondary" onClick={() => addRow("AddMail")}><Icon name="plus" />添加 AddMail</button>
      </div>
      {rows.length ? rows.map((row, index) => (
        <div className="mail-attachment-row" key={`trigger-action-${index}`}>
          <div className="grid two">
            <ComboField label="动作类型" value={row.kind} options={TRIGGER_ACTION_KIND_OPTIONS} onChange={(kind) => updateRow(index, { kind: kind as TriggerActionCommandKind })} />
            {(row.kind === "AddMail" || row.kind === "RemoveMail") && <>
              <ComboField label="玩家" value={row.player} options={TRIGGER_PLAYER_OPTIONS} onChange={(player) => updateRow(index, { player: String(player) })} />
              <Field label="邮件 ID" value={row.mailId} onChange={(mailId) => updateRow(index, { mailId })} />
              <ComboField label="类型 type" value={row.mailType || (row.kind === "AddMail" ? "tomorrow" : "all")} options={TRIGGER_MAIL_TYPE_OPTIONS} onChange={(mailType) => updateRow(index, { mailType: String(mailType) })} />
            </>}
            {row.kind === "AddMoney" && <Field label="金额" value={stringField(row.amount)} onChange={(amount) => updateRow(index, { amount: integerInRange(amount, -9999999, 9999999, 500) })} />}
            {row.kind === "RunTriggerAction" && <Field label="目标 TriggerAction ID" value={row.targetAction} onChange={(targetAction) => updateRow(index, { targetAction })} />}
            {row.kind === "custom" && <Field label="原始动作" value={row.raw} onChange={(raw) => updateRow(index, { raw })} />}
            <div className="field">
              <span>导出结果</span>
              <code>{triggerActionString(row)}</code>
            </div>
          </div>
          <div className="button-row">
            <button type="button" className="secondary" onClick={() => removeRow(index)}>删除动作</button>
          </div>
        </div>
      )) : <div className="empty compact-empty">暂无动作。</div>}
    </div>
  );
}

function mailStringFromEntry(entry: GameDataEntry) {
  const value = normalizeMailValueForPatch(isObject(entry.value) ? entry.value : {});
  const parts: string[] = [];
  const backgroundAsset = stringField(value.BackgroundAsset || value.BackgroundAssetTarget || "").trim();
  const backgroundType = stringField(value.BackgroundType || "vanilla").trim();
  const backgroundIndex = stringField(value.BackgroundIndex || value.BackgroundMode || "").trim();
  if (backgroundAsset) {
    parts.push(`[letterbg ${backgroundAsset} ${backgroundIndex || 0}]`);
  } else if (backgroundType !== "vanilla" && backgroundIndex) {
    parts.push(`[letterbg ${backgroundIndex}]`);
  } else if (backgroundIndex && backgroundIndex !== "0") {
    parts.push(`[letterbg ${backgroundIndex}]`);
  }
  const textColor = stringField(value.TextColor || "").trim();
  if (textColor) parts.push(`[textcolor ${textColor}]`);
  const body = mailBodyFromValue(value);
  if (body) parts.push(mailBodyForExport(body));
  const attachments = Array.isArray(value.Attachments) ? value.Attachments.map((attachment) => normalizeMailAttachment(attachment)).map(mailAttachmentMarker).filter(Boolean) : [];
  if (attachments.length) parts.push(attachments.join(""));
  const title = stringField(value.Title || "").trim();
  if (title) parts.push(`[#]${title}`);
  return parts.join("");
}

const MAIL_BACKGROUND_OPTIONS: RulesetOption[] = [
  { label: "默认 0", value: 0 },
  { label: "Sandy 线纸 1", value: 1 },
  { label: "Wizard 风格 2", value: 2 },
  { label: "Krobus 风格 3", value: 3 },
  { label: "JojaMart 风格 4", value: 4 }
];

const MAIL_BACKGROUND_SOURCE_OPTIONS: RulesetOption[] = [
  { label: "原版信纸", value: "vanilla" },
  { label: "自定义信纸", value: "custom" }
];

const MAIL_ATTACHMENT_KIND_OPTIONS: RulesetOption[] = [
  { label: "信件附件动作 %action（打开信时执行）", value: "action" },
  { label: "物品 %item id", value: "item_id" },
  { label: "金钱 %item money", value: "money" },
  { label: "对话话题 conversationTopic", value: "conversationTopic" },
  { label: "烹饪配方 cookingRecipe", value: "cookingRecipe" },
  { label: "制作配方 craftingRecipe", value: "craftingRecipe" },
  { label: "失物找回 itemRecovery", value: "itemRecovery" },
  { label: "任务 quest", value: "quest" },
  { label: "特殊订单 specialOrder", value: "specialOrder" },
  { label: "自定义 marker", value: "custom" }
];

const TRIGGER_ACTION_KIND_OPTIONS: RulesetOption[] = [
  { label: "AddMail 添加邮件", value: "AddMail" },
  { label: "RemoveMail 移除邮件", value: "RemoveMail" },
  { label: "AddMoney 添加金钱", value: "AddMoney" },
  { label: "RunTriggerAction 调用触发动作", value: "RunTriggerAction" },
  { label: "自定义", value: "custom" }
];

const FALLBACK_TRIGGER_EVENT_OPTIONS: RulesetOption[] = [
  { label: "每天开始 DayStarted", value: "DayStarted" },
  { label: "一天结束 DayEnding", value: "DayEnding" },
  { label: "地点进入 LocationEntered", value: "LocationEntered" },
  { label: "按钮按下 ButtonPressed", value: "ButtonPressed" },
  { label: "事件命令 EventCommand", value: "EventCommand" },
  { label: "邮件收到 MailReceived", value: "MailReceived" },
  { label: "手动 Manual", value: "Manual" }
];

const TRIGGER_PLAYER_OPTIONS: RulesetOption[] = [
  { label: "当前玩家 Current", value: "Current" },
  { label: "所有玩家 All", value: "All" },
  { label: "主机 Host", value: "Host" }
];

const TRIGGER_MAIL_TYPE_OPTIONS: RulesetOption[] = [
  { label: "now 现在进邮箱", value: "now" },
  { label: "tomorrow 明天进邮箱", value: "tomorrow" },
  { label: "received 标为已收", value: "received" },
  { label: "all 全部位置", value: "all" }
];

const MAIL_TEXT_COLOR_OPTIONS: RulesetOption[] = [
  { label: "黑色 black", value: "black" },
  { label: "蓝色 blue", value: "blue" },
  { label: "青色 cyan", value: "cyan" },
  { label: "灰色 gray", value: "gray" },
  { label: "绿色 green", value: "green" },
  { label: "橙色 orange", value: "orange" },
  { label: "紫色 purple", value: "purple" },
  { label: "红色 red", value: "red" },
  { label: "白色 white", value: "white" }
];

function heartsToFriendshipPoints(hearts: number) {
  return Math.max(0, Math.round((Number.isFinite(hearts) ? hearts : 0) * 250));
}

function friendshipPointsToHearts(points: number) {
  return Math.max(0, Math.round((Number.isFinite(points) ? points : 0) / 250));
}

function secondsToTimeValue(seconds: number) {
  return Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * 10));
}

function CharacterAssetImport({ label, project, npcName, assetKind, currentPath, onImported }: { label: string; project: Project; npcName: string; assetKind: "portrait" | "sprite" | "roommateItem"; currentPath: string; onImported: (project: Project, storedPath: string) => void }) {
  const [status, setStatus] = useState("");
  const normalizedNpc = normalizeInternalName(npcName || "ExampleNPC");
  const folder = assetKind === "portrait" ? "Portraits" : assetKind === "sprite" ? "OverworldSprites" : "RoommateItems";

  return (
    <label className="field character-asset-field">
      <span>{label}</span>
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const storedPath = `assets/CharacterFiles/${folder}/${normalizedNpc}/${file.name}`;
        try {
          const nextProject = await importProjectAsset(project, file, storedPath);
          onImported(nextProject, storedPath);
          setStatus(`已导入：${storedPath}`);
        } catch (error) {
          setStatus(`导入失败：${readError(error)}`);
        }
      }} />
      <code>{currentPath || `assets/CharacterFiles/${folder}/${normalizedNpc}/...`}</code>
      {status && <small>{status}</small>}
    </label>
  );
}

function TargetedAssetImport({ label, project, storedPath, accept, onImported }: { label: string; project: Project; storedPath: string; accept: string; onImported: (project: Project, storedPath: string, asset: Asset) => void }) {
  const [status, setStatus] = useState("");
  return (
    <label className="field character-asset-field">
      <span>{label}</span>
      <input type="file" accept={accept} onChange={async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          const response = await importProjectAssetWithRecord(project, file, storedPath);
          onImported(response.project, storedPath, response.asset);
          setStatus(`已导入：${storedPath}`);
        } catch (error) {
          setStatus(`导入失败：${readError(error)}`);
        }
      }} />
      <code>{storedPath}</code>
      {status && <small>{status}</small>}
    </label>
  );
}

function dictArray(value: unknown): JsonDict[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function pointField(value: unknown, key: "X" | "Y", fallback = 0) {
  return isObject(value) && value[key] !== undefined ? value[key] : fallback;
}

function rectField(value: unknown, key: "X" | "Y" | "Width" | "Height", fallback = 0) {
  return isObject(value) && value[key] !== undefined ? value[key] : fallback;
}

function setNullableText(value: string) {
  return value.trim() === "" ? null : value;
}

function NpcHomeEditor({ value, project, npcName, ruleset, onChange }: { value: unknown; project: Project; npcName: string; ruleset: Ruleset; onChange: (value: JsonDict[]) => void }) {
  const homes = dictArray(value);
  const home = homes[0] || {};
  const tile = isObject(home.Tile) ? home.Tile : {};
  const directionOptions = rulesetOptions(ruleset, "facing_directions");
  const locationOptions = mapLocationOptions(project);
  const defaultHomeId = `${npcName}Home`;

  function updateHome(patch: JsonDict) {
    const nextHome = { ...home, ...patch };
    onChange([nextHome, ...homes.slice(1)]);
  }

  function updateTile(axis: "X" | "Y", next: string) {
    updateHome({ Tile: { ...tile, [axis]: numberOrText(next) } });
  }

  return (
    <div className="structured-editor">
      <div className="structured-editor-head">
        <div>
          <strong>住处 Home</strong>
          <span>角色回家、生成或被传送回家时使用的位置。默认编辑第一条，更多住处可在高级 JSON 中继续维护。</span>
        </div>
        {!homes.length && <button type="button" className="secondary" onClick={() => onChange([{ Id: defaultHomeId, Condition: null, Location: "Town", Tile: { X: 0, Y: 0 }, Direction: "down" }])}><Icon name="plus" />添加住处</button>}
      </div>
      {homes.length > 0 && (
        <div className="grid two">
          <Field label="住处 ID Id" value={stringField(home.Id || defaultHomeId)} onChange={(next) => updateHome({ Id: next })} />
          <ComboField label="地点 Location" value={home.Location || "Town"} options={locationOptions} onChange={(next) => updateHome({ Location: next })} />
          <Field label="瓦片 X Tile.X" value={stringField(pointField(tile, "X", 0))} onChange={(next) => updateTile("X", next)} />
          <Field label="瓦片 Y Tile.Y" value={stringField(pointField(tile, "Y", 0))} onChange={(next) => updateTile("Y", next)} />
          <ComboField label="朝向 Direction" value={home.Direction || "down"} options={directionOptions} onChange={(next) => updateHome({ Direction: next })} />
          <Field label="条件 Condition" value={stringField(home.Condition ?? "")} onChange={(next) => updateHome({ Condition: setNullableText(next) })} />
        </div>
      )}
      <JsonField label="Home 高级 JSON" value={homes} onChange={(next) => onChange(dictArray(next))} />
    </div>
  );
}

function NpcAppearanceEditor({ value, project, ruleset, npcName, onChange, onImportAsset }: { value: unknown; project: Project; ruleset: Ruleset; npcName: string; onChange: (value: JsonDict[]) => void; onImportAsset: (nextProject: Project, nextAppearance: JsonDict[], patch: Patch) => void }) {
  const appearances = dictArray(value);
  const [index, setIndex] = useState(0);
  const selectedIndex = Math.min(index, Math.max(appearances.length - 1, 0));
  const appearance = appearances[selectedIndex] || {};
  const seasonOptions = [{ label: "不限定季节", value: "" }, ...rulesetOptions(ruleset, "seasons")];

  useEffect(() => {
    if (index > 0 && index >= appearances.length) setIndex(Math.max(appearances.length - 1, 0));
  }, [appearances.length, index]);

  function updateAppearance(patch: JsonDict) {
    const next = [...appearances];
    next[selectedIndex] = { ...appearance, ...patch };
    onChange(next);
  }

  function addAppearance() {
    const next = [
      ...appearances,
      {
        Id: `Appearance${appearances.length + 1}`,
        Season: "",
        Indoors: true,
        Outdoors: true,
        Portrait: `Portraits/${npcName}`,
        Sprite: `Characters/${npcName}`,
        IsIslandAttire: false,
        Precedence: 0,
        Weight: 0
      }
    ];
    onChange(next);
    setIndex(next.length - 1);
  }

  function importAppearanceAsset(kind: "portrait" | "sprite", nextProject: Project, storedPath: string) {
    const gamePath = kind === "portrait"
      ? `Portraits/${npcName}_${stringField(appearance.Id || `Appearance${selectedIndex + 1}`)}`
      : `Characters/${npcName}_${stringField(appearance.Id || `Appearance${selectedIndex + 1}`)}`;
    const patch: Patch = {
      id: makeId(),
      name: kind === "portrait" ? `加载 ${npcName} 外观头像` : `加载 ${npcName} 外观行走图`,
      action: "Load",
      enabled: true,
      target: gamePath,
      from_file: storedPath,
      when: {},
      fields: {},
      advanced: {}
    };
    const next = [...appearances];
    next[selectedIndex] = { ...appearance, [kind === "portrait" ? "Portrait" : "Sprite"]: gamePath };
    onImportAsset(nextProject, next, patch);
  }

  return (
    <div className="structured-editor">
      <div className="structured-editor-head">
        <div>
          <strong>外观切换 Appearance</strong>
          <span>用于季节服装、室内外服装或姜岛服装。它不会替代基础头像/行走图，只是在条件满足时切换。</span>
        </div>
        <button type="button" className="secondary" onClick={addAppearance}><Icon name="plus" />添加外观</button>
      </div>
      {appearances.length > 0 && (
        <>
          <label className="field">
            <span>当前外观规则</span>
            <select value={selectedIndex} onChange={(event) => setIndex(Number(event.target.value))}>
              {appearances.map((item, itemIndex) => <option key={`appearance-${itemIndex}`} value={itemIndex}>{stringField(item.Id || `外观 ${itemIndex + 1}`)}</option>)}
            </select>
          </label>
          <div className="grid two">
            <Field label="规则 ID Id" value={stringField(appearance.Id || `Appearance${selectedIndex + 1}`)} onChange={(next) => updateAppearance({ Id: next })} />
            <ComboField label="季节 Season" value={appearance.Season ?? ""} options={seasonOptions} onChange={(next) => updateAppearance({ Season: next })} />
            <BoolField label="室内生效 Indoors" value={appearance.Indoors !== false} onChange={(next) => updateAppearance({ Indoors: next })} />
            <BoolField label="室外生效 Outdoors" value={appearance.Outdoors !== false} onChange={(next) => updateAppearance({ Outdoors: next })} />
            <Field label="头像资源 Portrait" value={stringField(appearance.Portrait || `Portraits/${npcName}`)} onChange={(next) => updateAppearance({ Portrait: next })} />
            <Field label="行走图资源 Sprite" value={stringField(appearance.Sprite || `Characters/${npcName}`)} onChange={(next) => updateAppearance({ Sprite: next })} />
            <TargetedAssetImport label="导入该外观头像 PNG" project={project} accept="image/png" storedPath={`assets/CharacterFiles/Portraits/${npcName}/${stringField(appearance.Id || `Appearance${selectedIndex + 1}`)}.png`} onImported={(nextProject, storedPath) => importAppearanceAsset("portrait", nextProject, storedPath)} />
            <TargetedAssetImport label="导入该外观行走图 PNG" project={project} accept="image/png" storedPath={`assets/CharacterFiles/OverworldSprites/${npcName}/${stringField(appearance.Id || `Appearance${selectedIndex + 1}`)}.png`} onImported={(nextProject, storedPath) => importAppearanceAsset("sprite", nextProject, storedPath)} />
            <BoolField label="姜岛服装 IsIslandAttire" value={Boolean(appearance.IsIslandAttire)} onChange={(next) => updateAppearance({ IsIslandAttire: next })} />
            <Field label="优先级 Precedence" value={stringField(appearance.Precedence ?? 0)} onChange={(next) => updateAppearance({ Precedence: numberOrText(next) })} />
            <Field label="权重 Weight" value={stringField(appearance.Weight ?? 0)} onChange={(next) => updateAppearance({ Weight: numberOrText(next) })} />
          </div>
        </>
      )}
      <JsonField label="Appearance 高级 JSON" value={appearances} onChange={(next) => onChange(dictArray(next))} />
    </div>
  );
}

function NpcSpouseRoomEditor({ value, project, npcName, onChange, onImportMap }: { value: unknown; project: Project; npcName: string; onChange: (value: JsonDict) => void; onImportMap: (nextProject: Project, nextRoom: JsonDict, patch?: Patch) => void }) {
  const room = isObject(value) ? value : {};
  const rect = isObject(room.MapSourceRect) ? room.MapSourceRect : {};
  const hasRoom = Object.keys(room).length > 0;
  const defaultMapKey = `Custom_${npcName}SpouseRoom`;
  const mapKey = stringField(room.MapAsset || spouseRoomTarget(project, npcName));

  function updateRoom(patch: JsonDict) {
    onChange({ ...room, ...patch });
  }

  function updateRect(key: "X" | "Y" | "Width" | "Height", next: string) {
    updateRoom({ MapSourceRect: { ...rect, [key]: numberOrText(next) } });
  }

  function importSpouseRoomTexture(nextProject: Project, storedPath: string) {
    const target = spouseRoomTarget(nextProject, npcName);
    const patch: Patch = {
      id: makeId(),
      name: `加载 ${npcName} 配偶房贴图`,
      action: "Load",
      enabled: true,
      target,
      from_file: storedPath,
      when: {},
      fields: {},
      advanced: {}
    };
    onImportMap(nextProject, { ...room, MapAsset: target }, patch);
  }

  return (
    <div className="structured-editor">
      <div className="structured-editor-head">
        <div>
          <strong>配偶房 SpouseRoom</strong>
          <span>可结婚或室友路线常用。参考 Cale：MapAsset 加 MapSourceRect。</span>
        </div>
        {!hasRoom && <button type="button" className="secondary" onClick={() => onChange({ MapAsset: spouseRoomTarget(project, npcName), MapSourceRect: { X: 0, Y: 0, Width: 6, Height: 9 } })}><Icon name="plus" />添加配偶房</button>}
      </div>
      {hasRoom && (
        <div className="grid two">
          <Field label="地图资源 MapAsset" value={mapKey} onChange={(next) => updateRoom({ MapAsset: next })} />
          <Field label="矩形 X" value={stringField(rectField(rect, "X", 0))} onChange={(next) => updateRect("X", next)} />
          <Field label="矩形 Y" value={stringField(rectField(rect, "Y", 0))} onChange={(next) => updateRect("Y", next)} />
          <Field label="宽度 Width" value={stringField(rectField(rect, "Width", 6))} onChange={(next) => updateRect("Width", next)} />
          <Field label="高度 Height" value={stringField(rectField(rect, "Height", 9))} onChange={(next) => updateRect("Height", next)} />
          <TargetedAssetImport label="导入配偶房贴图图片" project={project} accept="image/png,image/jpeg,image/webp" storedPath={`assets/Maps/${defaultMapKey}/${defaultMapKey}.png`} onImported={(nextProject, storedPath) => importSpouseRoomTexture(nextProject, storedPath)} />
        </div>
      )}
      <JsonField label="SpouseRoom 高级 JSON" value={room} onChange={(next) => onChange(isObject(next) ? next : {})} />
    </div>
  );
}

function NpcSpousePatioEditor({ value, onChange }: { value: unknown; onChange: (value: JsonDict) => void }) {
  const patio = isObject(value) ? value : {};

  return (
    <div className="structured-editor">
      <div className="structured-editor-head">
        <div>
          <strong>配偶庭院 SpousePatio</strong>
          <span>庭院动作先暂不表单化；这里保留原始 JSON，之后再按事件、地图和动作一起细化。</span>
        </div>
      </div>
      <JsonField label="SpousePatio 高级 JSON" value={patio} onChange={(next) => onChange(isObject(next) ? next : {})} />
    </div>
  );
}

type GiftTasteGroupId = "Love" | "Like" | "Dislike" | "Hate" | "Neutral";
type GiftTasteState = Record<GiftTasteGroupId, { text: string; items: string[] }>;

const GIFT_TASTE_GROUPS: { id: GiftTasteGroupId; label: string }[] = [
  { id: "Love", label: "最爱 Love" },
  { id: "Like", label: "喜欢 Like" },
  { id: "Dislike", label: "不喜欢 Dislike" },
  { id: "Hate", label: "讨厌 Hate" },
  { id: "Neutral", label: "一般 Neutral" }
];

function GiftTasteEditor({ project, ruleset, itemCatalog, entry, npcName, displayName, onChange }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; entry: GameDataEntry; npcName: string; displayName: string; onChange: (entry: GameDataEntry) => void }) {
  const state = giftTasteFromValue(entry.value, displayName);
  const options = itemSelectionOptions(project, ruleset, itemCatalog, "gift");

  function updateGroup(group: GiftTasteGroupId, patch: Partial<{ text: string; items: string[] }>) {
    const nextState: GiftTasteState = {
      ...state,
      [group]: { ...state[group], ...patch }
    };
    onChange(withGiftTasteMetadata({
      ...entry,
      kind: "custom",
      target: "Data/NPCGiftTastes",
      key: npcName,
      value: giftTasteToString(nextState)
    }, nextState));
  }

  return (
    <div className="gift-taste-editor">
      {itemCatalog.warning && <div className="notice compact-note">{itemCatalog.warning}</div>}
      {GIFT_TASTE_GROUPS.map((group) => (
        <details className="gift-taste-group" key={group.id} open={group.id === "Love" || group.id === "Like"}>
          <summary>{group.label}<span>{state[group.id].items.length} 个物品/类别</span></summary>
          <div className="grid two">
            <DialogueTextTools
              label={`${group.label} 反应台词`}
              project={project}
              npcName={npcName}
              value={state[group.id].text}
              onChange={(text) => updateGroup(group.id, { text })}
            />
            <ItemMultiSelect
              label={`${group.label} 物品与类别`}
              options={options}
              value={state[group.id].items}
              onChange={(items) => updateGroup(group.id, { items })}
              placeholder="选择原版物品、项目新物品、类别，或输入自定义 ID"
            />
          </div>
        </details>
      ))}
      <div className="notice compact-note">当前导出值：<code>{giftTasteToString(state)}</code></div>
    </div>
  );
}

function DialogueTextTools({ label, project, npcName, value, onChange }: { label: string; project: Project; npcName: string; value: string; onChange: (value: string) => void }) {
  const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);

  function insertToken(token: string) {
    const element = textAreaRef.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="dialogue-text-tools">
      <label className="field">
        <span>{label}</span>
        <textarea ref={textAreaRef} value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
      <div className="button-row">
        <button type="button" className="secondary" onClick={() => insertToken("#$b#")}>停顿 #$b#</button>
        <button type="button" className="secondary" onClick={() => insertToken("#$e#")}>中断 #$e#</button>
      </div>
      <details className="portrait-tools" open>
        <summary>头像编号按钮</summary>
        <PortraitTokenPicker project={project} npcName={npcName} onInsert={insertToken} />
      </details>
    </div>
  );
}

function ItemMultiSelect({ label, options, value, onChange, placeholder }: { label: string; options: ItemOption[]; value: string[]; onChange: (value: string[]) => void; placeholder?: string }) {
  const [custom, setCustom] = useState("");
  const selected = value.map(String).filter(Boolean);
  const selectedSet = new Set(selected);
  const grouped = groupedItemOptions(options.filter((option) => !selectedSet.has(String(option.value))));

  function addItem(nextValue: unknown) {
    const text = String(nextValue).trim();
    if (!text || selectedSet.has(text)) return;
    onChange([...selected, text]);
  }

  function removeItem(nextValue: string) {
    onChange(selected.filter((item) => item !== nextValue));
  }

  function addCustom() {
    addItem(custom);
    setCustom("");
  }

  return (
    <div className="item-multi-select">
      <label className="field">
        <span>{label}</span>
        <select value="" onChange={(event) => addItem(event.target.value)}>
          <option value="">选择一个项目...</option>
          {grouped.map((group) => (
            <optgroup label={group.label} key={group.key}>
              {group.options.map((option) => <option key={`${option.source || "option"}-${option.value}`} value={String(option.value)}>{option.label}</option>)}
            </optgroup>
          ))}
        </select>
        {placeholder && <small>{placeholder}</small>}
      </label>
      <div className="custom-item-row">
        <input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="自定义 ID / context tag / 其他模组物品" />
        <button type="button" className="secondary" onClick={addCustom}><Icon name="plus" />添加</button>
      </div>
      <div className="item-chip-list">
        {selected.map((item) => (
          <button type="button" className="chip" key={item} onClick={() => removeItem(item)} title="点击移除">
            {itemLabel(item, options)} ×
          </button>
        ))}
        {!selected.length && <small>暂无选择。</small>}
      </div>
    </div>
  );
}

function WinterStarGiftsEditor({ value, project, ruleset, itemCatalog, onChange }: { value: unknown; project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; onChange: (value: unknown) => void }) {
  const rows = Array.isArray(value) ? value.filter(isObject).map(normalizeWinterStarGift) : [];
  const options = itemSelectionOptions(project, ruleset, itemCatalog, "qualified");

  function updateRow(index: number, patch: JsonDict) {
    const nextRows = [...rows];
    nextRows[index] = normalizeWinterStarGift({ ...nextRows[index], ...patch });
    onChange(nextRows);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, itemIndex) => itemIndex !== index));
  }

  function addRow() {
    onChange([...rows, createWinterStarGift(`WinterStarGift${rows.length + 1}`, "(O)388")]);
  }

  return (
    <div className="structured-editor wide-editor">
      <div className="structured-editor-head">
        <div>
          <strong>冬星礼物 WinterStarGifts</strong>
          <span>物品字段使用同一份物品目录；复杂字段可在下方高级 JSON 继续补。</span>
        </div>
        <button type="button" className="secondary" onClick={addRow}><Icon name="plus" />添加礼物</button>
      </div>
      {rows.map((row, index) => (
        <div className="winter-gift-row" key={`winter-gift-${index}`}>
          <div className="grid two">
            <Field label="规则 ID Id" value={stringField(row.Id || `WinterStarGift${index + 1}`)} onChange={(next) => updateRow(index, { Id: next })} />
            <Field label="条件 Condition" value={stringField(row.Condition || "")} onChange={(next) => updateRow(index, { Condition: setNullableText(next) })} />
            <ItemMultiSelect label="固定物品 ItemId" options={options} value={row.ItemId ? [stringField(row.ItemId)] : []} onChange={(items) => updateRow(index, { ItemId: items[items.length - 1] || undefined })} />
            <ItemMultiSelect label="随机候选 RandomItemId" options={options} value={arrayOfStrings(row.RandomItemId)} onChange={(items) => updateRow(index, { RandomItemId: items })} />
            <Field label="最少数量 MinStack" value={stringField(row.MinStack ?? 1)} onChange={(next) => updateRow(index, { MinStack: numberOrText(next) })} />
            <Field label="最多数量 MaxStack" value={stringField(row.MaxStack ?? 1)} onChange={(next) => updateRow(index, { MaxStack: numberOrText(next) })} />
            <Field label="品质 Quality" value={stringField(row.Quality ?? -1)} onChange={(next) => updateRow(index, { Quality: numberOrText(next) })} />
            <BoolField label="是否配方 IsRecipe" value={Boolean(row.IsRecipe)} onChange={(next) => updateRow(index, { IsRecipe: next })} />
          </div>
          <div className="button-row">
            <button type="button" className="secondary" onClick={() => removeRow(index)}>删除该礼物</button>
          </div>
        </div>
      ))}
      {!rows.length && <div className="empty compact-empty">暂无冬星礼物规则。</div>}
      <JsonField label="WinterStarGifts 高级 JSON" value={rows} onChange={onChange} />
    </div>
  );
}

function MovieReactionEditor({ project, entry, npcName, displayName, onChange }: { project: Project; entry: GameDataEntry; npcName: string; displayName: string; onChange: (entry: GameDataEntry) => void }) {
  const value = movieReactionValue(entry.value, npcName);
  const reactions = movieReactionRows(value.Reactions, npcName);

  function updateValue(nextValue: JsonDict) {
    onChange(withMovieReactionMetadata({
      ...entry,
      kind: "custom",
      target: "Data/MoviesReactions",
      key: npcName,
      value: {
        ...nextValue,
        NPCName: npcName
      }
    }, npcName));
  }

  function updateReaction(index: number, patch: JsonDict) {
    const nextReactions = [...reactions];
    nextReactions[index] = normalizeMovieReaction({ ...nextReactions[index], ...patch }, npcName, index);
    updateValue({ ...value, Reactions: nextReactions });
  }

  function updateSpecialResponse(index: number, point: string, patch: JsonDict) {
    const reaction = reactions[index] || normalizeMovieReaction({}, npcName, index);
    const specialResponses = movieSpecialResponses(reaction.SpecialResponses);
    updateReaction(index, {
      SpecialResponses: {
        ...specialResponses,
        [point]: {
          ...movieResponsePoint(specialResponses[point]),
          ...patch
        }
      }
    });
  }

  function addReaction() {
    const next = [...reactions, normalizeMovieReaction({}, npcName, reactions.length)];
    updateValue({ ...value, Reactions: next });
  }

  function removeReaction(index: number) {
    updateValue({ ...value, Reactions: reactions.filter((_, itemIndex) => itemIndex !== index) });
  }

  return (
    <div className="movie-reaction-editor">
      <div className="structured-editor-head">
        <div>
          <strong>电影观感 MoviesReactions</strong>
          <span>为 {displayName || npcName} 设置每部电影的喜欢程度和观影前/中/后特殊台词。</span>
        </div>
        <button type="button" className="secondary" onClick={addReaction}><Icon name="plus" />添加电影反应</button>
      </div>
      {!reactions.length && <div className="empty compact-empty">尚未添加电影反应。</div>}
      {reactions.map((reaction, index) => {
        const specialResponses = movieSpecialResponses(reaction.SpecialResponses);
        return (
          <details className="movie-reaction-row" key={`${reaction.ID}-${index}`} open={index === reactions.length - 1}>
            <summary>
              <strong>{stringField(reaction.Tag || "movie_tag")}</strong>
              <span>{stringField(reaction.Response || "like")} / {stringField(reaction.ID || `reaction_${index}`)}</span>
            </summary>
            <div className="grid two">
              <Field label="反应 ID" value={stringField(reaction.ID)} onChange={(next) => updateReaction(index, { ID: next })} />
              <ComboField label="电影 Tag" value={reaction.Tag || "spring_movie_0"} options={MOVIE_TAG_OPTIONS} onChange={(next) => updateReaction(index, { Tag: next })} />
              <ComboField label="观感 Response" value={reaction.Response || "like"} options={MOVIE_RESPONSE_OPTIONS} onChange={(next) => updateReaction(index, { Response: next })} />
              <ItemMultiSelect label="Whitelist 白名单物品/条件标记" options={[]} value={arrayOfStrings(reaction.Whitelist)} onChange={(items) => updateReaction(index, { Whitelist: items })} placeholder="可留空；需要特殊白名单时用自定义值添加。" />
            </div>
            {MOVIE_RESPONSE_POINTS.map((point) => {
              const responsePoint = movieResponsePoint(specialResponses[point.key]);
              return (
                <details className="movie-response-point" key={point.key}>
                  <summary>{point.label}</summary>
                  <div className="grid two">
                    <Field label="ResponsePoint" value={stringField(responsePoint.ResponsePoint ?? "")} onChange={(next) => updateSpecialResponse(index, point.key, { ResponsePoint: setNullableText(next) })} />
                    <Field label="Script" value={stringField(responsePoint.Script)} onChange={(next) => updateSpecialResponse(index, point.key, { Script: next })} />
                    <DialogueTextTools label="Text" project={project} npcName={npcName} value={stringField(responsePoint.Text)} onChange={(next) => updateSpecialResponse(index, point.key, { Text: next })} />
                  </div>
                </details>
              );
            })}
            <div className="button-row">
              <button type="button" className="secondary" onClick={() => removeReaction(index)}>删除该电影反应</button>
            </div>
          </details>
        );
      })}
      <JsonField label="MoviesReactions 高级 JSON" value={value} onChange={(next) => isObject(next) && updateValue(next)} />
    </div>
  );
}

function NpcEntryForm({ project, entry, ruleset, itemCatalog, onChange, setProject }: { project: Project; entry: GameDataEntry; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; onChange: (entry: GameDataEntry) => void; setProject: (project: Project) => void }) {
  const [expandedNpcEntryId, setExpandedNpcEntryId] = useState("");
  const value = isObject(entry.value) ? entry.value : {};
  const npcName = normalizeInternalName(entry.key || "ExampleNPC");
  const advanced = entry.advanced || {};
  const studio = isObject(advanced.StardewCPStudio) ? advanced.StardewCPStudio as JsonDict : {};
  const npcMeta = isObject(studio.npc) ? studio.npc as JsonDict : {};
  const route = stringField(npcMeta.relationshipRoute || (value.CanBeRomanced ? "romance" : "friend"));
  const roommate = isObject(npcMeta.roommateItem) ? npcMeta.roommateItem as JsonDict : {};
  const portraitAssetPath = stringField(npcMeta.portraitAssetPath);
  const spriteAssetPath = stringField(npcMeta.spriteAssetPath);
  const options = (key: string) => rulesetOptions(ruleset, key);

  function updateValue(patch: JsonDict) {
    onChange({ ...entry, value: compactObject({ ...value, ...patch }) });
  }

  function updateMeta(patch: JsonDict) {
    onChange({
      ...entry,
      advanced: {
        ...advanced,
        StardewCPStudio: {
          ...studio,
          npc: {
            ...npcMeta,
            ...patch
          }
        }
      }
    });
  }

  function setRoute(nextRoute: string) {
    onChange({
      ...entry,
      value: {
        ...value,
        CanBeRomanced: nextRoute === "romance",
        SpouseAdopts: nextRoute === "romance" ? Boolean(value.SpouseAdopts) : false,
        SpouseWantsChildren: nextRoute === "romance" ? Boolean(value.SpouseWantsChildren) : false
      },
      advanced: {
        ...advanced,
        StardewCPStudio: {
          ...studio,
          npc: {
            ...npcMeta,
            relationshipRoute: nextRoute
          }
        }
      }
    });
  }

  function setRoommateField(key: string, nextValue: unknown) {
    updateMeta({ roommateItem: { ...roommate, [key]: nextValue } });
  }

  function importRoommateItemTexture(nextProject: Project, storedPath: string) {
    const textureTarget = stringField(roommate.textureTarget || roommateItemTextureTarget(nextProject, npcName));
    const itemId = stringField(roommate.itemId || `${nextProject.manifest.UniqueID || "Author.Mod"}.InvitationLetter`);
    const nextRoommate = { ...roommate, textureTarget, fromFile: storedPath };
    const texturePatch: Patch = {
      id: makeId(),
      name: `${npcName} 室友提案物品贴图`,
      action: "Load",
      enabled: true,
      target: textureTarget,
      from_file: storedPath,
      when: {},
      fields: {},
      advanced: {}
    };
    const nextGameData = nextProject.game_data.map((item) => {
      if (item.id === entry.id) {
        return {
          ...entry,
          advanced: {
            ...advanced,
            StardewCPStudio: {
              ...studio,
              npc: {
                ...npcMeta,
                roommateItem: nextRoommate
              }
            }
          }
        };
      }
      if (item.target === "Data/Objects" && item.key === itemId && isObject(item.value)) {
        return { ...item, value: { ...item.value, Texture: textureTarget } };
      }
      return item;
    });
    setProject({
      ...nextProject,
      patches: mergeWorkflowPatches(nextProject.patches, [texturePatch]),
      game_data: nextGameData
    });
  }

  function upsertRoommateItem() {
    const itemId = stringField(roommate.itemId || `${project.manifest.UniqueID || "Author.Mod"}.InvitationLetter`);
    const textureTarget = stringField(roommate.textureTarget || roommateItemTextureTarget(project, npcName));
    const fromFile = stringField(roommate.fromFile || `assets/CharacterFiles/RoommateItems/${npcName}/invitationletter.png`);
    const displayName = stringField(roommate.displayName || "邀请信");
    const description = stringField(roommate.description || `把这封信交给 ${stringField(value.DisplayName) || npcName}，邀请他/她成为室友。`);
    const price = Number(roommate.price || 5000);
    const itemEntry = createWorkflowEntry("item", `${npcName} 室友提案物品`, "Data/Objects", itemId, {
      Name: stringField(roommate.name || "A special invitation letter"),
      DisplayName: displayName,
      Description: description,
      Type: "Basic",
      Category: 0,
      Price: Number.isFinite(price) ? price : 5000,
      Texture: textureTarget,
      SpriteIndex: Number(roommate.spriteIndex || 0),
      Edibility: -300,
      IsDrink: false,
      ExcludeFromFishingCollection: true,
      ExcludeFromShippingCollection: true,
      ExcludeFromRandomSale: true,
      ContextTags: [roommateContextTag(npcName)]
    });
    const texturePatch: Patch = {
      id: makeId(),
      name: `${npcName} 室友提案物品贴图`,
      action: "Load",
      enabled: true,
      target: textureTarget,
      from_file: fromFile,
      when: {},
      fields: {},
      advanced: {}
    };
    setProject({
      ...project,
      game_data: mergeWorkflowEntries(project.game_data, [itemEntry]),
      patches: mergeWorkflowPatches(project.patches, [texturePatch])
    });
  }

  function syncAssetMeta(kind: "portrait" | "sprite", nextProject: Project, storedPath: string) {
    const key = kind === "portrait" ? "portraitAssetPath" : "spriteAssetPath";
    const gamePath = kind === "portrait" ? `Portraits/${npcName}` : characterAssetGamePath(nextProject, storedPath, `CharacterFiles/OverworldSprites/${npcName}/${npcName}`);
    const patch: Patch = {
      id: makeId(),
      name: kind === "portrait" ? `加载 ${npcName} 头像` : `加载 ${npcName} 行走图`,
      action: "Load",
      enabled: true,
      target: kind === "portrait" ? `Portraits/${npcName}` : gamePath,
      from_file: storedPath,
      when: {},
      fields: {},
      advanced: {}
    };
    const nextValue = kind === "sprite" ? { ...value, TextureName: gamePath } : value;
    setProject({
      ...nextProject,
      patches: mergeWorkflowPatches(nextProject.patches, [patch]),
      game_data: project.game_data.map((item) => item.id === entry.id ? {
        ...entry,
        value: nextValue,
        advanced: {
          ...advanced,
          StardewCPStudio: {
            ...studio,
            npc: {
              ...npcMeta,
              [key]: storedPath
            }
          }
        }
      } : item)
    });
  }

  function upsertNpcEntries(entries: GameDataEntry[], nextI18n: Record<string, string> = {}) {
    setProject({
      ...project,
      game_data: mergeWorkflowEntries(project.game_data, entries),
      i18n: { ...project.i18n, ...nextI18n }
    });
  }

  function npcModuleMetadata(entry: GameDataEntry, module: string): GameDataEntry {
    return {
      ...entry,
      advanced: {
        ...entry.advanced,
        StardewCPStudio: {
          ...(isObject(entry.advanced.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {}),
          npcModule: {
            npcName,
            module
          }
        }
      }
    };
  }

  function createNpcDialoguePlaceholder(isMarriage: boolean) {
    const displayName = stringField(value.DisplayName || npcName);
    const formatId = isMarriage ? "marriage_key" : "weekday";
    const format = dialogueFormatById(formatId, ruleset);
    const target = isMarriage ? `Characters/Dialogue/MarriageDialogue${npcName}` : `Characters/Dialogue/${npcName}`;
    const nextKey = isMarriage
      ? nextDialogueKey(project, target, marriageKeyOptions(npcName).map((item) => String(item.value)))
      : "Mon";
    const fields = normalizeDialogueFields(format, {
      weekday: nextKey,
      key: nextKey,
      scene: "Indoor_Day",
      index: 0,
      npc: npcName
    }, npcName);
    const state: DialogueEntryState = {
      npcName,
      isMarriage,
      keyType: format.id,
      season: String(fields.season || "spring"),
      weekday: String(fields.weekday || "Mon"),
      day: Number(fields.day || 1),
      hearts: Number(fields.hearts || 4),
      eventId: String(fields.eventId || "100"),
      itemId: String(fields.itemId || "(O)388"),
      marriageScene: String(fields.scene || "Indoor_Day"),
      customKey: String(fields.customKey || (isMarriage ? "CustomMarriageDialogue" : "CustomDialogue")),
      i18nPrefix: "",
      fields
    };
    const key = buildDialogueKeyFromParts(state, npcName, ruleset);
    const i18nKey = dialogueI18nKeyFromParts(npcName, isMarriage, "", key);
    const entryName = dialogueEntryTitle(displayName, isMarriage ? "婚后/室友对话" : "普通对话", key);
    const dialogueEntry = withDialogueMetadata(
      createWorkflowEntry("dialogue", entryName, target, key, i18nRef(i18nKey)),
      state,
      format,
      i18nKey
    );
    setExpandedNpcEntryId(mergedEntryId(project, dialogueEntry));
    upsertNpcEntries([dialogueEntry], {
      [i18nKey]: project.i18n[i18nKey] || defaultDialogueText(format.id)
    });
  }

  function createSpecialDialogue(kind: SpecialDialogueKind) {
    const displayName = stringField(value.DisplayName || npcName);
    const entry = createSpecialDialogueEntry(npcName, displayName, kind, project.game_data);
    setExpandedNpcEntryId(mergedEntryId(project, entry));
    upsertNpcEntries([entry], {
      [extractI18nKey(entry.value)]: defaultSpecialDialogueText(kind)
    });
  }

  function createNpcGiftTastePlaceholder() {
    const displayName = stringField(value.DisplayName || npcName);
    upsertNpcEntries([
      npcModuleMetadata(createWorkflowEntry("custom", `${displayName} 礼物喜好`, "Data/NPCGiftTastes", npcName, giftTasteToString(defaultGiftTasteState(displayName))), "giftTaste")
    ]);
  }

  function createMovieReactionPlaceholder() {
    const displayName = stringField(value.DisplayName || npcName);
    upsertNpcEntries([
      npcModuleMetadata(withMovieReactionMetadata(createWorkflowEntry("custom", `${displayName} 电影观感`, "Data/MoviesReactions", npcName, defaultMovieReactionValue(npcName)), npcName), "movieReaction")
    ]);
  }

  function createNpcSchedulePlaceholder() {
    const displayName = stringField(value.DisplayName || npcName);
    const map = stringField(value.DefaultMap || (dictArray(value.Home)[0]?.Location) || "Town");
    const home = dictArray(value.Home)[0] || {};
    const tile = isObject(home.Tile) ? home.Tile : {};
    const x = Number(tile.X ?? 0);
    const y = Number(tile.Y ?? 0);
    upsertNpcEntries([
      npcModuleMetadata(createWorkflowEntry("custom", `${displayName} 基础日程`, `Characters/schedules/${npcName}`, "spring", `900 ${map} ${Number.isFinite(x) ? x : 0} ${Number.isFinite(y) ? y : 0} 2/2200 ${map} ${Number.isFinite(x) ? x : 0} ${Number.isFinite(y) ? y : 0} 2`), "schedule")
    ]);
  }

  function createNpcMailPlaceholder() {
    const displayName = stringField(value.DisplayName || npcName);
    upsertNpcEntries([
      npcModuleMetadata(createWorkflowEntry("custom", `${displayName} 欢迎邮件`, "Data/Mail", `${npcName}.Welcome`, `你好，@！^^${displayName} 已经来到星露谷了。[#]来自 ${displayName} 的信`), "mail")
    ]);
  }

  function createNpcEventPlaceholder() {
    const displayName = stringField(value.DisplayName || npcName);
    upsertNpcEntries([
      npcModuleMetadata(createWorkflowEntry("event", `${displayName} 好感事件`, "Data/Events/Town", `${workflowEventId(npcName)}/f ${npcName} 2500`, `pause 500/speak ${npcName} "谢谢你来看我，@。"/end`), "event")
    ]);
  }

  function hasEntry(target: string, key: string) {
    return project.game_data.some((item) => item.target === target && item.key === key);
  }

  function updateDialogueEntry(nextEntry: GameDataEntry) {
    const index = project.game_data.findIndex((item) => item.id === nextEntry.id);
    if (index < 0) return;
    setProject({ ...project, game_data: replaceAt(project.game_data, index, nextEntry) });
  }

  function updateNpcModuleEntry(nextEntry: GameDataEntry) {
    const index = project.game_data.findIndex((item) => item.id === nextEntry.id);
    if (index < 0) return;
    setProject({ ...project, game_data: replaceAt(project.game_data, index, nextEntry) });
  }

  function removeDialogueEntry(entryId: string) {
    setProject({ ...project, game_data: project.game_data.filter((item) => item.id !== entryId) });
  }

  const hasNormalDialogue = hasEntry(`Characters/Dialogue/${npcName}`, "Mon");
  const hasMarriageDialogue = hasEntry(`Characters/Dialogue/MarriageDialogue${npcName}`, "Indoor_Day_0");
  const normalDialogueEntries = project.game_data.filter((item) => item.kind === "dialogue" && item.target === `Characters/Dialogue/${npcName}`);
  const marriageDialogueEntries = project.game_data.filter((item) => item.kind === "dialogue" && item.target === `Characters/Dialogue/MarriageDialogue${npcName}`);
  const specialDialogueEntries = project.game_data.filter((item) => isSpecialDialogueEntry(item, npcName));
  const giftTasteEntry = project.game_data.find((item) => item.target === "Data/NPCGiftTastes" && item.key === npcName);
  const movieReactionEntry = project.game_data.find((item) => item.target === "Data/MoviesReactions" && item.key === npcName);
  const hasGiftTaste = hasEntry("Data/NPCGiftTastes", npcName);
  const hasMovieReaction = hasEntry("Data/MoviesReactions", npcName);
  const hasSchedule = hasEntry(`Characters/schedules/${npcName}`, "spring");
  const hasMail = hasEntry("Data/Mail", `${npcName}.Welcome`);
  const hasEvent = project.game_data.some((item) => item.target === "Data/Events/Town" && item.key.startsWith(`${workflowEventId(npcName)}/`));
  const canVisitIsland = value.CanVisitIsland ?? value.CanVisitIslandCondition;
  const hasExpandedSpecialDialogue = specialDialogueEntries.some((item) => item.id === expandedNpcEntryId);
  const hasExpandedMarriageDialogue = marriageDialogueEntries.some((item) => item.id === expandedNpcEntryId);

  return (
    <div className="npc-group">
      <div className="npc-group-head">
        <div>
          <strong>{npcName}</strong>
          <span>角色组块：基础信息、素材、婚前/婚后对话、室友物品和后续内容框架都会以这个内部名为默认值。</span>
        </div>
      </div>

      <div className="subsection">
        <h3>基础信息</h3>
        <div className="grid two">
          <Field label="显示名称 DisplayName" value={stringField(value.DisplayName)} onChange={(next) => updateValue({ DisplayName: next })} />
          <ComboField label="语言 Language" value={value.Language || "Default"} options={[{ label: "默认 Default", value: "Default" }, { label: "矮人语 Dwarvish", value: "Dwarvish" }]} onChange={(next) => updateValue({ Language: next })} />
          <SeasonDayField season={stringField(value.BirthSeason || "spring")} day={Number(value.BirthDay || 1)} seasons={options("seasons")} onChange={(season, day) => updateValue({ BirthSeason: season, BirthDay: day })} />
          <ComboField label="居住地区 HomeRegion" value={value.HomeRegion || "Town"} options={options("home_regions")} onChange={(next) => updateValue({ HomeRegion: next })} />
          <ComboField label="性别 Gender" value={value.Gender || "Undefined"} options={options("genders")} onChange={(next) => updateValue({ Gender: next })} />
          <ComboField label="年龄 Age" value={value.Age || "Adult"} options={options("npc_ages")} onChange={(next) => updateValue({ Age: next })} />
          <ComboField label="礼貌 Manner" value={value.Manner || "Neutral"} options={options("npc_manners")} onChange={(next) => updateValue({ Manner: next })} />
          <ComboField label="社交焦虑 SocialAnxiety" value={value.SocialAnxiety || "Neutral"} options={options("npc_social_anxiety")} onChange={(next) => updateValue({ SocialAnxiety: next })} />
          <ComboField label="乐观程度 Optimism" value={value.Optimism || "Neutral"} options={options("npc_optimism")} onChange={(next) => updateValue({ Optimism: next })} />
          <Field label="默认地图 DefaultMap" value={stringField(value.DefaultMap || "Town")} onChange={(next) => updateValue({ DefaultMap: next })} />
        </div>
      </div>

      <div className="subsection">
        <h3>社交与关系</h3>
        <div className="grid two">
          <label className="field">
            <span>关系路线</span>
            <select value={route} onChange={(event) => setRoute(event.target.value)}>
              <option value="friend">普通 NPC</option>
              <option value="romance">可结婚对象</option>
              <option value="roommate">室友对象</option>
            </select>
          </label>
          <ConditionField label="可社交 CanSocialize" value={value.CanSocialize ?? true} onChange={(next) => updateValue({ CanSocialize: next })} placeholder="TRUE" />
          <BoolField label="可收礼 CanReceiveGifts" value={value.CanReceiveGifts !== false} onChange={(next) => updateValue({ CanReceiveGifts: next })} />
          <BoolField label="可问候附近角色 CanGreetNearbyCharacters" value={Boolean(value.CanGreetNearbyCharacters)} onChange={(next) => updateValue({ CanGreetNearbyCharacters: next })} />
          <BoolField label="会评论购买物 CanCommentOnPurchasedShopItems" value={Boolean(value.CanCommentOnPurchasedShopItems)} onChange={(next) => updateValue({ CanCommentOnPurchasedShopItems: next })} />
          <ComboField label="日历显示 Calendar" value={value.Calendar || "HiddenUntilMet"} options={options("calendar_visibility")} onChange={(next) => updateValue({ Calendar: next })} />
          <ComboField label="社交页显示 SocialTab" value={value.SocialTab || "HiddenUntilMet"} options={options("social_tab_visibility")} onChange={(next) => updateValue({ SocialTab: next })} />
          <Field label="恋爱对象 LoveInterest" value={stringField(value.LoveInterest || "")} onChange={(next) => updateValue({ LoveInterest: next })} />
          <ConditionField label="可去姜岛 CanVisitIsland" value={canVisitIsland} onChange={(next) => updateValue({ CanVisitIsland: next, CanVisitIslandCondition: undefined })} placeholder="PLAYER_HAS_FLAG Current Island_UpgradeHouse" />
          <ConditionField label="解锁条件 UnlockConditions" value={value.UnlockConditions} onChange={(next) => updateValue({ UnlockConditions: next })} placeholder="PLAYER_HAS_SEEN_EVENT Current 100" />
          <BoolField label="排除介绍任务 ExcludeFromIntroductionsQuest" value={Boolean(value.ExcludeFromIntroductionsQuest)} onChange={(next) => updateValue({ ExcludeFromIntroductionsQuest: next })} />
          <BoolField label="排除完美度 ExcludeFromPerfectionScore" value={Boolean(value.ExcludeFromPerfectionScore)} onChange={(next) => updateValue({ ExcludeFromPerfectionScore: next })} />
        </div>
      </div>

      {route === "roommate" && (
        <div className="subsection highlight">
          <h3>室友提案物品</h3>
          <div className="notice compact-note">
            参考 Cale.json 的 <code>LCF.InvitationLetter</code>：物品必须包含 <code>{roommateContextTag(npcName)}</code>，送给 NPC 后触发室友提案。
          </div>
          <div className="grid two">
            <Field label="物品 ID" value={stringField(roommate.itemId || `${project.manifest.UniqueID || "Author.Mod"}.InvitationLetter`)} onChange={(next) => setRoommateField("itemId", next)} />
            <Field label="物品内部名 Name" value={stringField(roommate.name || "A special invitation letter")} onChange={(next) => setRoommateField("name", next)} />
            <Field label="显示名称 DisplayName" value={stringField(roommate.displayName || "邀请信")} onChange={(next) => setRoommateField("displayName", next)} />
            <Field label="描述 Description" value={stringField(roommate.description || `把这封信交给 ${stringField(value.DisplayName) || npcName}，邀请他/她成为室友。`)} onChange={(next) => setRoommateField("description", next)} />
            <Field label="价格 Price" value={String(roommate.price || 5000)} onChange={(next) => setRoommateField("price", numberOrText(next))} />
            <Field label="贴图目标 Texture" value={stringField(roommate.textureTarget || roommateItemTextureTarget(project, npcName))} onChange={(next) => setRoommateField("textureTarget", next)} />
            <Field label="贴图文件 FromFile" value={stringField(roommate.fromFile || `assets/CharacterFiles/RoommateItems/${npcName}/invitationletter.png`)} onChange={(next) => setRoommateField("fromFile", next)} />
            <Field label="SpriteIndex" value={String(roommate.spriteIndex || 0)} onChange={(next) => setRoommateField("spriteIndex", numberOrText(next))} />
            <CharacterAssetImport label="导入室友物品贴图" project={project} npcName={npcName} assetKind="roommateItem" currentPath={stringField(roommate.fromFile)} onImported={(nextProject, storedPath) => importRoommateItemTexture(nextProject, storedPath)} />
          </div>
          <div className="button-row">
            <button type="button" onClick={upsertRoommateItem}><Icon name="plus" />生成/更新室友提案物品</button>
          </div>
        </div>
      )}

      <div className="subsection">
        <h3>素材与外观</h3>
        <div className="grid two">
          <Field label="行走图 TextureName" value={stringField(value.TextureName || `Characters/${npcName}`)} onChange={(next) => updateValue({ TextureName: next })} />
          <BoolField label="深色皮肤 IsDarkSkinned" value={Boolean(value.IsDarkSkinned)} onChange={(next) => updateValue({ IsDarkSkinned: next })} />
          <CharacterAssetImport label="角色头像 Portrait Load" project={project} npcName={npcName} assetKind="portrait" currentPath={portraitAssetPath} onImported={(nextProject, storedPath) => syncAssetMeta("portrait", nextProject, storedPath)} />
          <CharacterAssetImport label="行走图 Sprite Load" project={project} npcName={npcName} assetKind="sprite" currentPath={spriteAssetPath} onImported={(nextProject, storedPath) => syncAssetMeta("sprite", nextProject, storedPath)} />
          <NpcAppearanceEditor
            value={value.Appearance || []}
            project={project}
            ruleset={ruleset}
            npcName={npcName}
            onChange={(next) => updateValue({ Appearance: next })}
            onImportAsset={(nextProject, nextAppearance, patch) => setProject({
              ...nextProject,
              patches: mergeWorkflowPatches(nextProject.patches, [patch]),
              game_data: project.game_data.map((item) => item.id === entry.id ? { ...entry, value: { ...value, Appearance: nextAppearance } } : item)
            })}
          />
          <NpcHomeEditor value={value.Home || []} project={project} npcName={npcName} ruleset={ruleset} onChange={(next) => updateValue({ Home: next })} />
        </div>
      </div>

      <div className="subsection">
        <h3>节日与高级字段</h3>
        <div className="grid two">
          <OptionalBoolField label="花舞节可跳舞 FlowerDanceCanDance" value={value.FlowerDanceCanDance} onChange={(next) => updateValue({ FlowerDanceCanDance: next })} />
          <ConditionField label="冬星盛宴参与 WinterStarParticipant" value={value.WinterStarParticipant ?? true} onChange={(next) => updateValue({ WinterStarParticipant: next })} placeholder="TRUE" />
          <BoolField label="生成缺失 NPC SpawnIfMissing" value={value.SpawnIfMissing !== false} onChange={(next) => updateValue({ SpawnIfMissing: next })} />
          <BoolField label="配偶收养孩子 SpouseAdopts" value={Boolean(value.SpouseAdopts)} onChange={(next) => updateValue({ SpouseAdopts: next })} />
          <BoolField label="配偶想要孩子 SpouseWantsChildren" value={Boolean(value.SpouseWantsChildren)} onChange={(next) => updateValue({ SpouseWantsChildren: next })} />
          <ComboField label="结局幻灯片 EndSlideShow" value={value.EndSlideShow || "MainGroup"} options={options("end_slideshow_groups")} onChange={(next) => updateValue({ EndSlideShow: next })} />
          <Field label="翻垃圾友谊影响 DumpsterDiveFriendshipEffect" value={String(value.DumpsterDiveFriendshipEffect ?? 0)} onChange={(next) => updateValue({ DumpsterDiveFriendshipEffect: numberOrText(next) })} />
          <JsonField label="朋友与家人 FriendsAndFamily" value={value.FriendsAndFamily || {}} onChange={(next) => updateValue({ FriendsAndFamily: next as JsonDict })} />
          <WinterStarGiftsEditor value={value.WinterStarGifts || []} project={project} ruleset={ruleset} itemCatalog={itemCatalog} onChange={(next) => updateValue({ WinterStarGifts: next })} />
          <NpcSpouseRoomEditor
            value={value.SpouseRoom || {}}
            project={project}
            npcName={npcName}
            onChange={(next) => updateValue({ SpouseRoom: next })}
            onImportMap={(nextProject, nextRoom, patch) => setProject({
              ...nextProject,
              patches: patch ? mergeWorkflowPatches(nextProject.patches, [patch]) : nextProject.patches,
              game_data: project.game_data.map((item) => item.id === entry.id ? { ...entry, value: { ...value, SpouseRoom: nextRoom } } : item)
            })}
          />
          <NpcSpousePatioEditor value={value.SpousePatio || {}} onChange={(next) => updateValue({ SpousePatio: next })} />
          <JsonField label="自定义字段 CustomFields" value={value.CustomFields || {}} onChange={(next) => updateValue({ CustomFields: next as JsonDict })} />
        </div>
      </div>

      <div className="subsection">
        <h3>对话条目</h3>
        <div className="button-row">
          <button type="button" className="secondary" onClick={() => createNpcDialoguePlaceholder(false)}><Icon name="plus" />添加普通对话</button>
          <button type="button" className="secondary" onClick={() => createSpecialDialogue("engagement")}><Icon name="plus" />添加邀请后对话</button>
          <button type="button" className="secondary" onClick={() => createSpecialDialogue("rain")}><Icon name="plus" />添加特殊雨天对话</button>
          <button type="button" className="secondary" onClick={() => createSpecialDialogue("festival")}><Icon name="plus" />添加节日对话</button>
          <button type="button" className="secondary" disabled={route === "friend"} onClick={() => createNpcDialoguePlaceholder(true)}><Icon name="plus" />添加婚后/室友对话</button>
        </div>
        <details className="dialogue-section" open>
          <summary>普通对话 <span>{normalDialogueEntries.length} 条</span></summary>
          <NpcDialogueList entries={normalDialogueEntries} expandedEntryId={expandedNpcEntryId} project={project} ruleset={ruleset} i18n={project.i18n} onI18nChange={(i18n) => setProject({ ...project, i18n })} onChange={updateDialogueEntry} onRemove={removeDialogueEntry} />
        </details>
        <details className="dialogue-section" open={hasExpandedSpecialDialogue || undefined}>
          <summary>特殊对话 <span>{specialDialogueEntries.length} 条</span></summary>
          <SpecialDialogueList entries={specialDialogueEntries} expandedEntryId={expandedNpcEntryId} project={project} i18n={project.i18n} onI18nChange={(i18n) => setProject({ ...project, i18n })} onChange={updateNpcModuleEntry} onRemove={removeDialogueEntry} />
        </details>
        <details className="dialogue-section" open={hasExpandedMarriageDialogue || undefined}>
          <summary>婚后/室友对话 <span>{marriageDialogueEntries.length} 条</span></summary>
          <NpcDialogueList entries={marriageDialogueEntries} expandedEntryId={expandedNpcEntryId} project={project} ruleset={ruleset} i18n={project.i18n} onI18nChange={(i18n) => setProject({ ...project, i18n })} onChange={updateDialogueEntry} onRemove={removeDialogueEntry} />
        </details>
      </div>

      <div className="subsection">
        <h3>礼物喜好</h3>
        <div className="button-row">
          <button type="button" className="secondary" onClick={createNpcGiftTastePlaceholder}><Icon name="plus" />{hasGiftTaste ? "重置/更新草稿" : "创建礼物喜好"}</button>
        </div>
        {giftTasteEntry ? (
          <GiftTasteEditor project={project} ruleset={ruleset} itemCatalog={itemCatalog} entry={giftTasteEntry} npcName={npcName} displayName={stringField(value.DisplayName || npcName)} onChange={updateNpcModuleEntry} />
        ) : (
          <div className="empty compact-empty">尚未创建礼物喜好条目。</div>
        )}
      </div>

      <div className="subsection">
        <h3>电影观感</h3>
        <div className="button-row">
          <button type="button" className="secondary" onClick={createMovieReactionPlaceholder}><Icon name="plus" />{hasMovieReaction ? "重置/更新草稿" : "创建电影观感"}</button>
        </div>
        {movieReactionEntry ? (
          <MovieReactionEditor project={project} entry={movieReactionEntry} npcName={npcName} displayName={stringField(value.DisplayName || npcName)} onChange={updateNpcModuleEntry} />
        ) : (
          <div className="empty compact-empty">尚未创建电影观感条目。</div>
        )}
      </div>

      <div className="subsection">
        <h3>后续模块框架</h3>
        <div className="module-grid">
          <div>
            <strong>普通对话</strong>
            <span>默认目标：Characters/Dialogue/{npcName}，生成 Mon 占位并写入 i18n。</span>
            <button type="button" className="secondary" onClick={() => createNpcDialoguePlaceholder(false)}><Icon name="plus" />{hasNormalDialogue ? "更新" : "创建"}</button>
          </div>
          <div>
            <strong>婚后/室友对话</strong>
            <span>默认目标：Characters/Dialogue/MarriageDialogue{npcName}，适合可结婚或室友路线。</span>
            <button type="button" className="secondary" disabled={route === "friend"} onClick={() => createNpcDialoguePlaceholder(true)}><Icon name="plus" />{hasMarriageDialogue ? "更新" : "创建"}</button>
          </div>
          <div>
            <strong>礼物喜好</strong>
            <span>创建 Data/NPCGiftTastes 草稿，后续会单独细化成喜好编辑器。</span>
            <button type="button" className="secondary" onClick={createNpcGiftTastePlaceholder}><Icon name="plus" />{hasGiftTaste ? "更新" : "创建"}</button>
          </div>
          <div>
            <strong>基础日程</strong>
            <span>创建 Characters/schedules/{npcName} 的 spring 草稿，默认带入住处坐标。</span>
            <button type="button" className="secondary" onClick={createNpcSchedulePlaceholder}><Icon name="plus" />{hasSchedule ? "更新" : "创建"}</button>
          </div>
          <div>
            <strong>欢迎信件</strong>
            <span>创建 Data/Mail 条目，key 默认使用 {npcName}.Welcome。</span>
            <button type="button" className="secondary" onClick={createNpcMailPlaceholder}><Icon name="plus" />{hasMail ? "更新" : "创建"}</button>
          </div>
          <div>
            <strong>好感事件</strong>
            <span>创建 Data/Events/Town 草稿，事件 ID 按内部名生成。</span>
            <button type="button" className="secondary" onClick={createNpcEventPlaceholder}><Icon name="plus" />{hasEvent ? "更新" : "创建"}</button>
          </div>
          <div>
            <strong>任务</strong>
            <span>任务模块暂不生成条目；之后会和信件、触发动作一起设计。</span>
            <button type="button" className="secondary" disabled><Icon name="plus" />待设计</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NpcDialogueList({ entries, expandedEntryId, project, ruleset, i18n, onI18nChange, onChange, onRemove }: { entries: GameDataEntry[]; expandedEntryId: string; project: Project; ruleset: Ruleset; i18n: Record<string, string>; onI18nChange: (i18n: Record<string, string>) => void; onChange: (entry: GameDataEntry) => void; onRemove: (entryId: string) => void }) {
  return (
    <div className="npc-dialogue-list">
      {!entries.length && <div className="empty compact-empty">暂无条目。</div>}
      {entries.map((entry) => (
        <details className="npc-dialogue-item" key={`${entry.id}-${entry.id === expandedEntryId ? "expanded" : "normal"}`} open={entry.id === expandedEntryId || undefined}>
          <summary className="npc-dialogue-head">
            <strong>{entry.key}</strong>
            <button type="button" className="secondary" onClick={() => onRemove(entry.id)}>删除</button>
          </summary>
          <DialogueEntryFormClean project={project} entry={entry} ruleset={ruleset} i18n={i18n} onI18nChange={onI18nChange} onChange={onChange} />
        </details>
      ))}
    </div>
  );
}

function SpecialDialogueList({ entries, expandedEntryId, project, i18n, onI18nChange, onChange, onRemove }: { entries: GameDataEntry[]; expandedEntryId: string; project: Project; i18n: Record<string, string>; onI18nChange: (i18n: Record<string, string>) => void; onChange: (entry: GameDataEntry) => void; onRemove: (entryId: string) => void }) {
  return (
    <div className="npc-dialogue-list">
      {!entries.length && <div className="empty compact-empty">暂无条目。</div>}
      {entries.map((entry) => (
        <details className="npc-dialogue-item" key={`${entry.id}-${entry.id === expandedEntryId ? "expanded" : "normal"}`} open={entry.id === expandedEntryId || undefined}>
          <summary className="npc-dialogue-head">
            <strong>{specialDialogueTitle(entry)}</strong>
            <button type="button" className="secondary" onClick={() => onRemove(entry.id)}>删除</button>
          </summary>
          <SpecialDialogueEditor project={project} entry={entry} i18n={i18n} onI18nChange={onI18nChange} onChange={onChange} />
        </details>
      ))}
    </div>
  );
}

function SpecialDialogueEditor({ project, entry, i18n, onI18nChange, onChange }: { project: Project; entry: GameDataEntry; i18n: Record<string, string>; onI18nChange: (i18n: Record<string, string>) => void; onChange: (entry: GameDataEntry) => void }) {
  const meta = specialDialogueMetadata(entry);
  const kind = meta.kind;
  const npcName = meta.npcName;
  const text = textFromSpecialDialogue(entry, i18n);
  const engagementIndex = engagementIndexFromKey(entry.key, npcName);

  function updateText(nextText: string) {
    const i18nKey = specialDialogueI18nKey(npcName, kind, entry.target, entry.key);
    onI18nChange({ ...i18n, [i18nKey]: nextText });
    if (entry.value !== i18nRef(i18nKey)) {
      onChange(withSpecialDialogueMetadata({ ...entry, value: i18nRef(i18nKey) }, kind, npcName));
    }
  }

  function updateFestival(target: string) {
    const i18nKey = specialDialogueI18nKey(npcName, "festival", target, npcName);
    onChange(withSpecialDialogueMetadata({ ...entry, target, key: npcName, value: i18nRef(i18nKey), name: specialDialogueName(npcName, "festival", target, npcName) }, "festival", npcName));
    if (text) onI18nChange({ ...i18n, [i18nKey]: text });
  }

  function updateEngagementIndex(index: number) {
    const key = `${npcName}${index}`;
    const i18nKey = specialDialogueI18nKey(npcName, "engagement", entry.target, key);
    onChange(withSpecialDialogueMetadata({ ...entry, key, value: i18nRef(i18nKey), name: specialDialogueName(npcName, "engagement", entry.target, key) }, "engagement", npcName));
    if (text) onI18nChange({ ...i18n, [i18nKey]: text });
  }

  return (
    <div className="dialogue-builder">
      <Field label="NPC 内部名" value={npcName} onChange={() => undefined} />
      {kind === "engagement" && (
        <label className="field">
          <span>邀请后条目</span>
          <select value={engagementIndex} onChange={(event) => updateEngagementIndex(Number(event.target.value))}>
            <option value={0}>{npcName}0</option>
            <option value={1}>{npcName}1</option>
          </select>
        </label>
      )}
      {kind === "festival" && (
        <label className="field">
          <span>节日 Target</span>
          <select value={entry.target} onChange={(event) => updateFestival(event.target.value)}>
            {FESTIVAL_DIALOGUE_TARGETS.map((target) => <option value={target.value} key={target.value}>{target.label}</option>)}
          </select>
        </label>
      )}
      <DialogueTextTools label="台词正文（写入 i18n/default.json）" project={project} npcName={npcName} value={text} onChange={updateText} />
      <div className="notice compact-note">
        当前导出：<code>{entry.target}</code> / Key <code>{entry.key}</code> = <code>{stringField(entry.value)}</code>
      </div>
    </div>
  );
}

function DialogueEntryForm({ entry, ruleset, i18n, onI18nChange, onChange }: { entry: GameDataEntry; ruleset: Ruleset; i18n: Record<string, string>; onI18nChange?: (i18n: Record<string, string>) => void; onChange: (entry: GameDataEntry) => void }) {
  const [state, setState] = useState(() => dialogueFormStateFromEntry(entry));
  const format = dialogueFormatById(state.keyType, ruleset);
  const key = buildDialogueKeyFromParts(state, state.npcName, ruleset);
  const target = state.isMarriage ? `Characters/Dialogue/MarriageDialogue${state.npcName}` : `Characters/Dialogue/${state.npcName}`;
  const i18nKey = extractI18nKey(entry.value) || dialogueI18nKeyFromParts(state.npcName, state.isMarriage, state.i18nPrefix, key);
  const text = i18n[i18nKey] || (typeof entry.value === "string" && !entry.value.startsWith("{{i18n:") ? entry.value : "");
  const scope = state.isMarriage ? "marriage" : "normal";

  function applyState(next: DialogueEntryState, nextText = text) {
    const nextFormat = dialogueFormatById(next.keyType, ruleset);
    const nextKey = buildDialogueKeyFromParts(next, next.npcName, ruleset);
    const nextTarget = next.isMarriage ? `Characters/Dialogue/MarriageDialogue${next.npcName}` : `Characters/Dialogue/${next.npcName}`;
    const nextI18nKey = dialogueI18nKeyFromParts(next.npcName, next.isMarriage, next.i18nPrefix, nextKey);
    setState(next);
    onChange(withDialogueMetadata({ ...entry, target: nextTarget, key: nextKey, value: i18nRef(nextI18nKey) }, next, nextFormat, nextI18nKey));
    if (onI18nChange && nextText) onI18nChange({ ...i18n, [nextI18nKey]: nextText });
  }

  function updateState(patch: Partial<DialogueEntryState>) {
    applyState({ ...state, ...patch });
  }

  function setFormat(formatId: string) {
    const nextFormat = dialogueFormatById(formatId, ruleset);
    const isMarriage = nextFormat.scope === "marriage";
    applyState({
      ...state,
      isMarriage,
      keyType: nextFormat.id,
      fields: normalizeDialogueFields(nextFormat, {}, state.npcName)
    });
  }

  function updateField(field: DialogueFormatField, value: string | number) {
    const nextFields = { ...normalizeDialogueFields(format, state.fields, state.npcName), [field.name]: value };
    updateState({ fields: nextFields });
  }

  function updateText(nextText: string) {
    onI18nChange?.({ ...i18n, [i18nKey]: nextText });
    if (entry.target !== target || entry.key !== key || entry.value !== i18nRef(i18nKey)) {
      onChange(withDialogueMetadata({ ...entry, target, key, value: i18nRef(i18nKey) }, state, format, i18nKey));
    }
  }

  return (
    <div className="dialogue-builder">
      <Field label="NPC 内部名称" value={state.npcName} onChange={(npcName) => {
        const normalized = normalizeInternalName(npcName);
        const nextFormat = dialogueFormatById(state.keyType, ruleset);
        updateState({ npcName: normalized, fields: normalizeDialogueFields(nextFormat, { ...state.fields, npc: normalized }, normalized) });
      }} />
      <label className="field">
        <span>对话目标</span>
        <select value={scope} onChange={(event) => setFormat(dialogueFormatsByScope(ruleset, event.target.value as "normal" | "marriage")[0]?.id || "weekday")}>
          <option value="normal">普通对话 Characters/Dialogue/NPC</option>
          <option value="marriage">婚后/室友对话 MarriageDialogueNPC</option>
        </select>
      </label>
      <label className="field">
        <span>Key Format</span>
        <select value={format.id} onChange={(event) => setFormat(event.target.value)}>
          {Object.entries(groupedDialogueFormats(ruleset, scope)).map(([group, formats]) => (
            <optgroup label={group} key={group}>{formats.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>
          ))}
        </select>
      </label>
      <Field label="i18n 前缀覆盖（可留空）" value={state.i18nPrefix} onChange={(i18nPrefix) => updateState({ i18nPrefix })} />
      {format.fields.map((field) => (
        <DialogueFormatInput
          key={field.name}
          field={field}
          ruleset={ruleset}
          npcName={state.npcName}
          value={normalizeDialogueFields(format, state.fields, state.npcName)[field.name] ?? ""}
          onChange={(value) => updateField(field, value)}
        />
      ))}
      {format.warning && <div className="notice compact-note">{format.warning}</div>}
      <Field label="台词正文（写入 i18n/default.json）" value={text} textarea onChange={updateText} />
      <div className="notice compact-note">
        当前导出：<code>{target}</code> / <code>{key}</code> = <code>{i18nRef(i18nKey)}</code>
      </div>
    </div>
  );
}

function withDialogueMetadata(entry: GameDataEntry, state: DialogueEntryState, format: DialogueFormat, i18nKey: string): GameDataEntry {
  const existingStudio = isObject(entry.advanced.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  return {
    ...entry,
    advanced: {
      ...entry.advanced,
      StardewCPStudio: {
        ...existingStudio,
        dialogue: {
          category: format.category,
          formatId: format.id,
          scope: state.isMarriage ? "marriage" : "normal",
          npcName: state.npcName,
          isMarriage: state.isMarriage,
          fields: normalizeDialogueFields(format, state.fields, state.npcName),
          i18nKey,
          i18nPrefix: state.i18nPrefix
        }
      }
    }
  };
}

function DialogueEntryFormClean({ project, entry, ruleset, i18n, onI18nChange, onChange }: { project: Project; entry: GameDataEntry; ruleset: Ruleset; i18n: Record<string, string>; onI18nChange?: (i18n: Record<string, string>) => void; onChange: (entry: GameDataEntry) => void }) {
  const [state, setState] = useState(() => dialogueFormStateFromEntry(entry));
  const format = dialogueFormatById(state.keyType, ruleset);
  const normalizedFields = normalizeDialogueFields(format, state.fields, state.npcName);
  const key = buildDialogueKeyFromParts(state, state.npcName, ruleset);
  const target = state.isMarriage ? `Characters/Dialogue/MarriageDialogue${state.npcName}` : `Characters/Dialogue/${state.npcName}`;
  const i18nKey = extractI18nKey(entry.value) || dialogueI18nKeyFromParts(state.npcName, state.isMarriage, state.i18nPrefix, key);
  const text = i18n[i18nKey] || (typeof entry.value === "string" && !entry.value.startsWith("{{i18n:") ? entry.value : "");
  const scope = state.isMarriage ? "marriage" : "normal";
  const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);

  function applyState(next: DialogueEntryState, nextText = text) {
    const nextFormat = dialogueFormatById(next.keyType, ruleset);
    const nextKey = buildDialogueKeyFromParts(next, next.npcName, ruleset);
    const nextTarget = next.isMarriage ? `Characters/Dialogue/MarriageDialogue${next.npcName}` : `Characters/Dialogue/${next.npcName}`;
    const nextI18nKey = dialogueI18nKeyFromParts(next.npcName, next.isMarriage, next.i18nPrefix, nextKey);
    const displayName = entry.name.split("：")[0]?.replace(/ 普通对话$| 婚后\/室友对话$/, "") || next.npcName;
    const nextName = dialogueEntryTitle(displayName, next.isMarriage ? "婚后/室友对话" : "普通对话", nextKey);
    setState(next);
    onChange(withDialogueMetadata({ ...entry, name: nextName, target: nextTarget, key: nextKey, value: i18nRef(nextI18nKey) }, next, nextFormat, nextI18nKey));
    if (onI18nChange && nextText) onI18nChange({ ...i18n, [nextI18nKey]: nextText });
  }

  function updateState(patch: Partial<DialogueEntryState>) {
    applyState({ ...state, ...patch });
  }

  function setFormat(formatId: string) {
    const nextFormat = dialogueFormatById(formatId, ruleset);
    const isMarriage = nextFormat.scope === "marriage";
    applyState({
      ...state,
      isMarriage,
      keyType: nextFormat.id,
      fields: normalizeDialogueFields(nextFormat, {}, state.npcName)
    });
  }

  function updateField(field: DialogueFormatField, value: string | number) {
    updateState({ fields: { ...normalizedFields, [field.name]: value } });
  }

  function updateText(nextText: string) {
    onI18nChange?.({ ...i18n, [i18nKey]: nextText });
    if (entry.target !== target || entry.key !== key || entry.value !== i18nRef(i18nKey)) {
      const displayName = entry.name.split("：")[0]?.replace(/ 普通对话$| 婚后\/室友对话$/, "") || state.npcName;
      onChange(withDialogueMetadata({ ...entry, name: dialogueEntryTitle(displayName, state.isMarriage ? "婚后/室友对话" : "普通对话", key), target, key, value: i18nRef(i18nKey) }, state, format, i18nKey));
    }
  }

  function insertToken(token: string) {
    const element = textAreaRef.current;
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${token}${text.slice(end)}`;
    updateText(next);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="dialogue-builder">
      <Field label="NPC 内部名" value={state.npcName} onChange={(npcName) => {
        const normalized = normalizeInternalName(npcName);
        const nextFormat = dialogueFormatById(state.keyType, ruleset);
        updateState({ npcName: normalized, fields: normalizeDialogueFields(nextFormat, { ...state.fields, npc: normalized }, normalized) });
      }} />
      <label className="field">
        <span>对话目标</span>
        <select value={scope} onChange={(event) => setFormat(dialogueFormatsByScope(ruleset, event.target.value as "normal" | "marriage")[0]?.id || "weekday")}>
          <option value="normal">普通对话 Characters/Dialogue/NPC</option>
          <option value="marriage">婚后/室友对话 MarriageDialogueNPC</option>
        </select>
      </label>
      <label className="field">
        <span>Key 格式</span>
        <select value={format.id} onChange={(event) => setFormat(event.target.value)}>
          {Object.entries(groupedDialogueFormats(ruleset, scope)).map(([group, formats]) => (
            <optgroup label={group} key={group}>{formats.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>
          ))}
        </select>
      </label>
      <Field label="i18n 前缀覆盖（可留空）" value={state.i18nPrefix} onChange={(i18nPrefix) => updateState({ i18nPrefix })} />
      {format.fields.map((field) => (
        <DialogueFormatInput
          key={field.name}
          field={field}
          ruleset={ruleset}
          npcName={state.npcName}
          value={normalizedFields[field.name] ?? ""}
          onChange={(value) => updateField(field, value)}
        />
      ))}
      {format.warning && <div className="notice compact-note">{format.warning}</div>}
      <div className="dialogue-text-tools">
        <label className="field">
          <span>台词正文（写入 i18n/default.json）</span>
          <textarea ref={textAreaRef} value={text} onChange={(event) => updateText(event.target.value)} />
        </label>
        <div className="button-row">
          <button type="button" className="secondary" onClick={() => insertToken("#$b#")}>停顿 #$b#</button>
          <button type="button" className="secondary" onClick={() => insertToken("#$e#")}>中断 #$e#</button>
        </div>
      </div>
      <PortraitTokenPicker project={project} npcName={state.npcName} onInsert={insertToken} />
      <div className="notice compact-note">
        当前导出：<code>{target}</code> / Key <code>{key}</code> = <code>{i18nRef(i18nKey)}</code>
      </div>
    </div>
  );
}

function PortraitTokenPicker({ project, npcName, onInsert }: { project: Project; npcName: string; onInsert: (token: string) => void }) {
  const [tiles, setTiles] = useState<string[]>([]);
  const portraitAsset = findNpcPortraitAsset(project, npcName);

  useEffect(() => {
    let cancelled = false;
    setTiles([]);
    if (!portraitAsset) return;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const columns = Math.floor(image.width / 64);
      const rows = Math.floor(image.height / 64);
      const nextTiles: string[] = [];
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext("2d");
      if (!context) return;
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          context.clearRect(0, 0, 64, 64);
          context.drawImage(image, x * 64, y * 64, 64, 64, 0, 0, 64, 64);
          nextTiles.push(canvas.toDataURL("image/png"));
        }
      }
      setTiles(nextTiles);
    };
    image.src = `/api/assets/${portraitAsset.id}`;
    return () => {
      cancelled = true;
    };
  }, [portraitAsset?.id]);

  if (!portraitAsset) {
    return <div className="notice compact-note">导入该 NPC 的头像 PNG 后，这里会显示 64x64 头像编号按钮。</div>;
  }

  return (
    <div className="portrait-token-picker">
      <div className="structured-editor-head">
        <div>
          <strong>头像编号</strong>
          <span>{portraitAsset.stored_path}</span>
        </div>
      </div>
      <div className="portrait-grid">
        {tiles.map((tile, index) => (
          <button type="button" className="portrait-token" key={`${portraitAsset.id}-${index}`} onClick={() => onInsert(`$${index}`)} title={`插入 $${index}`}>
            <img src={tile} alt={`$${index}`} />
            <span>${index}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AssetManager({ project, setProject }: { project: Project; setProject: (project: Project) => void }) {
  return (
    <Section title="素材库">
      <div className="toolbar">
        <label className="file-button"><Icon name="upload" />导入素材<input type="file" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setProject(await importProjectAsset(project, file));
        }} /></label>
      </div>
      <div className="asset-list">
        {project.assets.map((asset) => (
          <div className="asset-row" key={asset.id}>
            <strong>{asset.original_name}</strong>
            <code>{asset.stored_path}</code>
            <span>{Math.round(asset.size / 1024)} KB</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function I18nEditor({ project, setProject }: { project: Project; setProject: (project: Project) => void }) {
  const entries = Object.entries(project.i18n);
  function setEntry(index: number, key: string, value: string) {
    const next = Object.fromEntries(entries.map(([entryKey, entryValue], itemIndex) => itemIndex === index ? [key, value] : [entryKey, entryValue]));
    setProject({ ...project, i18n: next });
  }
  return (
    <Section title="本地化文本 i18n">
      <div className="toolbar"><button onClick={() => setProject({ ...project, i18n: { ...project.i18n, "new.key": "" } })}><Icon name="plus" />新增文本</button></div>
      <div className="stack">
        {entries.map(([key, value], index) => (
          <div className="i18n-row" key={`${key}-${index}`}>
            <input value={key} onChange={(event) => setEntry(index, event.target.value, value)} />
            <input value={value} onChange={(event) => setEntry(index, key, event.target.value)} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function StoryEventStudio({ project, ruleset, setProject }: { project: Project; ruleset: Ruleset; setProject: (project: Project) => void }) {
  const entries = project.game_data
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.kind === "event");

  function updateProject(nextProject: Project) {
    setProject(nextProject);
  }

  function addStoryEvent() {
    const meta = defaultStoryEventMeta(project);
    const entry = storyEntryFromMeta(createWorkflowEntry("event", "新剧情事件", `Data/Events/${meta.location}`, "", ""), meta);
    updateProject({ ...project, game_data: [...project.game_data, entry], i18n: { ...project.i18n, ...storyI18nDefaults(meta) } });
  }

  function updateStoryEntry(index: number, nextEntry: GameDataEntry, i18nPatch?: Record<string, string>) {
    updateProject({
      ...project,
      game_data: replaceAt(project.game_data, index, nextEntry),
      i18n: i18nPatch ? { ...project.i18n, ...i18nPatch } : project.i18n
    });
  }

  return (
    <Section title="剧情模块">
      <div className="notice">
        事件写入 <code>Data/Events/&lt;LocationName&gt;</code>。当前版本用节点列表表示流程：顺序就是执行顺序，底部会实时生成可导出的事件 Key 与脚本。
      </div>
      <div className="toolbar">
        <button type="button" onClick={addStoryEvent}><Icon name="plus" />新增剧情</button>
      </div>
      <div className="stack">
        {entries.map(({ entry, index }) => (
          <article className="card" key={entry.id}>
            <div className="card-head">
              <input value={entry.name} onChange={(event) => setProject({ ...project, game_data: replaceAt(project.game_data, index, { ...entry, name: event.target.value }) })} />
              <button type="button" onClick={() => setProject({ ...project, game_data: project.game_data.filter((item) => item.id !== entry.id) })}>删除</button>
            </div>
            <StoryEventForm
              project={project}
              entry={entry}
              ruleset={ruleset}
              i18n={project.i18n}
              onChange={(next, i18nPatch) => updateStoryEntry(index, next, i18nPatch)}
            />
          </article>
        ))}
        {!entries.length && <div className="empty">暂无剧情。点击“新增剧情”创建第一个事件。</div>}
      </div>
    </Section>
  );
}

function StoryEventForm({ project, entry, ruleset, i18n = {}, onChange }: { project: Project; entry: GameDataEntry; ruleset: Ruleset; i18n?: Record<string, string>; onChange: (entry: GameDataEntry, i18nPatch?: Record<string, string>) => void }) {
  const meta = storyMetaFromEntry(project, entry);
  const [nodeKind, setNodeKind] = useState<EventNodeKind>("speak");
  const [selectedNodeId, setSelectedNodeId] = useState(meta.nodes[0]?.id || "");
  const scriptPreview = buildStoryEventScript(meta);
  const keyPreview = buildStoryEventKey(meta);
  const branchPreviews = meta.branches.map((branch) => ({ key: branch.key, script: buildStoryBranchScript(branch) }));
  const selectedNodeIndex = meta.nodes.findIndex((node) => node.id === selectedNodeId);
  const selectedNode = selectedNodeIndex >= 0 ? meta.nodes[selectedNodeIndex] : meta.nodes[meta.nodes.length - 1];

  useEffect(() => {
    if (!meta.nodes.length) {
      if (selectedNodeId) setSelectedNodeId("");
      return;
    }
    if (!meta.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(meta.nodes[meta.nodes.length - 1].id);
    }
  }, [meta.nodes, selectedNodeId]);

  function commitMeta(nextMeta: StoryEventMeta, i18nPatch?: Record<string, string>) {
    onChange(storyEntryFromMeta(entry, nextMeta), i18nPatch);
  }

  function updateMeta(nextMeta: StoryEventMeta) {
    commitMeta(nextMeta);
  }

  function updateNode(nodeIndex: number, node: StoryEventNode, textPatch?: { key: string; text: string }) {
    const nodes = replaceAt(meta.nodes, nodeIndex, node);
    commitMeta({ ...meta, nodes }, textPatch ? { [textPatch.key]: textPatch.text } : undefined);
  }

  function addNode(kind: EventNodeKind) {
    const node = defaultStoryNode(kind, meta, makeId(), meta.nodes.length);
    commitMeta({ ...meta, nodes: [...meta.nodes, node] }, storyI18nDefaults({ ...meta, nodes: [node] }));
    setSelectedNodeId(node.id);
  }

  function addBranch() {
    const branch = defaultStoryBranch(meta);
    const nextMeta = { ...meta, branches: [...meta.branches, branch] };
    commitMeta(nextMeta, storyI18nDefaults({ ...meta, nodes: branch.nodes }));
  }

  function addQuestionAnswer(nodeIndex: number, questionNode: StoryEventNode) {
    const answers = storyQuestionAnswers(questionNode);
    const answerIndex = answers.length;
    const answerId = `fork${answerIndex}`;
    const branch = defaultStoryBranch(meta, `${meta.eventId || "ExampleEvent"}_Answer${answerIndex + 1}`, `回答 ${answerIndex + 1}`);
    const answer: StoryQuestionAnswer = { id: answerId, text: `选项 ${answerIndex + 1}`, branchKey: branch.key };
    const nextAnswers = [...answers, answer];
    const questionText = buildStoryQuestionText(storyQuestionPrompt(stringField(i18n[stringField(questionNode.data.i18nKey)] ?? questionNode.data.text ?? "")), nextAnswers);
    const nextQuestion = {
      ...questionNode,
      data: {
        ...questionNode.data,
        forkId: "fork0",
        answers: nextAnswers,
        text: questionText
      }
    };
    const forkNode = defaultStoryNode("fork", meta, makeId(), meta.nodes.length + 1);
    forkNode.label = `回答 ${answerIndex + 1} 跳转`;
    forkNode.data = { requirement: answerId, eventId: branch.key };
    const nodes = replaceAt(meta.nodes, nodeIndex, nextQuestion);
    let insertIndex = nodeIndex + 1;
    while (nodes[insertIndex]?.kind === "fork") insertIndex += 1;
    nodes.splice(insertIndex, 0, forkNode);
    const nextMeta = { ...meta, nodes, branches: [...meta.branches, branch] };
    commitMeta(nextMeta, {
      [textKeyForStoryNode(meta, nextQuestion)]: questionText,
      ...storyI18nDefaults({ ...meta, nodes: [nextQuestion, ...branch.nodes] })
    });
    setSelectedNodeId(forkNode.id);
  }

  function moveNode(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= meta.nodes.length) return;
    const nodes = [...meta.nodes];
    [nodes[index], nodes[target]] = [nodes[target], nodes[index]];
    commitMeta({ ...meta, nodes });
    setSelectedNodeId(nodes[target].id);
  }

  return (
    <div className="story-event-editor">
      <div className="grid two">
        <ComboField label="事件地点 Location" value={meta.location} options={mapLocationOptions(project)} onChange={(location) => commitMeta({ ...meta, location: String(location) })} />
        <Field label="事件 ID" value={meta.eventId} onChange={(eventId) => commitMeta({ ...meta, eventId })} />
        <Field label="开场音乐" value={meta.music} onChange={(music) => commitMeta({ ...meta, music })} />
        <div className="grid two tight-grid">
          <Field label="开场视角 X" value={stringField(meta.viewportX)} onChange={(value) => commitMeta({ ...meta, viewportX: integerInRange(value, -10000, 10000, 0) })} />
          <Field label="开场视角 Y" value={stringField(meta.viewportY)} onChange={(value) => commitMeta({ ...meta, viewportY: integerInRange(value, -10000, 10000, 0) })} />
        </div>
        <Field label="i18n 前缀" value={meta.i18nPrefix} onChange={(i18nPrefix) => commitMeta({ ...meta, i18nPrefix })} />
      </div>

      <details className="story-panel" open>
        <summary>初始角色位置 <span>{meta.actors.length} 个角色</span></summary>
        <div className="story-list">
          {meta.actors.map((actor, index) => (
            <div className="story-row" key={`${actor.actor}-${index}`}>
              <Field label="角色" value={actor.actor} onChange={(value) => commitMeta({ ...meta, actors: replaceAt(meta.actors, index, { ...actor, actor: value }) })} />
              <Field label="X" value={stringField(actor.x)} onChange={(value) => commitMeta({ ...meta, actors: replaceAt(meta.actors, index, { ...actor, x: integerInRange(value, -10000, 10000, actor.x) }) })} />
              <Field label="Y" value={stringField(actor.y)} onChange={(value) => commitMeta({ ...meta, actors: replaceAt(meta.actors, index, { ...actor, y: integerInRange(value, -10000, 10000, actor.y) }) })} />
              <ComboField label="方向" value={actor.direction} options={STORY_DIRECTION_OPTIONS} onChange={(value) => commitMeta({ ...meta, actors: replaceAt(meta.actors, index, { ...actor, direction: Number(value) }) })} />
              <button type="button" className="secondary" onClick={() => commitMeta({ ...meta, actors: meta.actors.filter((_, itemIndex) => itemIndex !== index) })}>删除</button>
            </div>
          ))}
          <button type="button" className="secondary" onClick={() => commitMeta({ ...meta, actors: [...meta.actors, { actor: "ExampleNPC", x: 0, y: 0, direction: 2 }] })}>添加角色位置</button>
        </div>
      </details>

      <details className="story-panel" open>
        <summary>触发条件 Key Preconditions <span>{meta.preconditions.length} 条</span></summary>
        <div className="story-list">
          {meta.preconditions.map((condition, index) => (
            <StoryPreconditionEditor
              key={condition.id}
              condition={condition}
              ruleset={ruleset}
              onChange={(next) => commitMeta({ ...meta, preconditions: replaceAt(meta.preconditions, index, next) })}
              onRemove={() => commitMeta({ ...meta, preconditions: meta.preconditions.filter((item) => item.id !== condition.id) })}
            />
          ))}
          <button type="button" className="secondary" onClick={() => commitMeta({ ...meta, preconditions: [...meta.preconditions, defaultStoryPrecondition("Friendship")] })}>添加条件</button>
        </div>
      </details>

      <details className="story-panel" open>
        <summary>流程节点 <span>{meta.nodes.length} 个节点</span></summary>
        <div className="toolbar">
          <select value={nodeKind} onChange={(event) => setNodeKind(event.target.value as EventNodeKind)}>
            {STORY_NODE_OPTIONS.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
          </select>
          <button type="button" onClick={() => addNode(nodeKind)}><Icon name="plus" />添加节点</button>
        </div>
        <div className="story-flow-map" aria-label="剧情流程图预览">
          <div className="story-flow-chip fixed">音乐 / 视角 / 初始角色</div>
          {meta.nodes.map((node, index) => (
            <React.Fragment key={`map-${node.id}`}>
              <span className="story-flow-arrow">→</span>
              <button type="button" className={`story-flow-chip ${selectedNode?.id === node.id ? "active" : ""}`} onClick={() => setSelectedNodeId(node.id)}>{index + 1}. {node.label || storyNodeLabel(node.kind)}</button>
            </React.Fragment>
          ))}
        </div>
        <StoryFlowCanvas
          title="主线流程图"
          startLabel="音乐 / 视角 / 初始角色"
          nodes={meta.nodes}
          branches={meta.branches}
          selectedNodeId={selectedNode?.id || ""}
          onNodeSelect={setSelectedNodeId}
          onNodePositionCommit={(nodeId, position) => commitMeta({ ...meta, nodes: updateStoryNodePosition(meta.nodes, nodeId, position) })}
        />
        <div className="story-flow">
          {selectedNode ? (
            <StoryNodeEditor
              key={selectedNode.id}
              node={selectedNode}
              index={selectedNodeIndex}
              meta={meta}
              branches={meta.branches}
              i18n={i18n}
              onChange={(next, textPatch) => updateNode(selectedNodeIndex, next, textPatch)}
              onCreateBranch={(currentNode) => {
                const branch = defaultStoryBranch(meta);
                const nextNode = { ...currentNode, data: { ...currentNode.data, eventId: branch.key } };
                const nextMeta = { ...meta, nodes: replaceAt(meta.nodes, selectedNodeIndex, nextNode), branches: [...meta.branches, branch] };
                commitMeta(nextMeta, storyI18nDefaults({ ...meta, nodes: branch.nodes }));
              }}
              onAddQuestionAnswer={(currentNode) => addQuestionAnswer(selectedNodeIndex, currentNode)}
              onRemove={() => {
                const remaining = meta.nodes.filter((item) => item.id !== selectedNode.id);
                commitMeta({ ...meta, nodes: remaining });
                setSelectedNodeId(remaining[Math.max(0, selectedNodeIndex - 1)]?.id || "");
              }}
              onMove={moveNode}
            />
          ) : <div className="empty">还没有流程节点。请选择类型后点击“添加节点”。</div>}
        </div>
      </details>

      <details className="story-panel" open>
        <summary>分支 Entries <span>{meta.branches.length} 个分支</span></summary>
        <div className="notice compact-note">用于 question/fork 后跳转的脚本，例如 SVE 示例里的 <code>746153081_PurchasedAuroraVineyard</code>。分支脚本不会重复音乐、视角、初始角色三段。</div>
        <div className="toolbar">
          <button type="button" onClick={addBranch}><Icon name="plus" />添加分支 Entry</button>
        </div>
        <div className="story-list">
          {meta.branches.map((branch, branchIndex) => (
            <StoryBranchEditor
              key={branch.id}
              branch={branch}
              meta={meta}
              i18n={i18n}
              onChange={(nextBranch, i18nPatch) => commitMeta({ ...meta, branches: replaceAt(meta.branches, branchIndex, nextBranch) }, i18nPatch)}
              onRemove={() => commitMeta({ ...meta, branches: meta.branches.filter((item) => item.id !== branch.id) })}
            />
          ))}
        </div>
      </details>

      <div className="story-preview">
        <div>
          <strong>最终事件 Key</strong>
          <code>{keyPreview}</code>
        </div>
        <div>
          <strong>最终事件脚本</strong>
          <textarea value={scriptPreview} readOnly />
        </div>
        {branchPreviews.map((branch) => (
          <div key={branch.key}>
            <strong>分支 Entry：{branch.key}</strong>
            <textarea value={branch.script} readOnly />
          </div>
        ))}
      </div>

      <div className="grid two">
        <WhenBuilder ruleset={ruleset} value={entry.when} onChange={(when) => onChange({ ...entry, when })} />
        <JsonField label="高级 JSON（仅公开字段）" value={publicAdvanced(entry.advanced)} onChange={(advanced) => onChange({ ...entry, advanced: mergePublicAdvanced(entry.advanced, advanced as JsonDict) })} />
      </div>
    </div>
  );
}

function StoryPreconditionEditor({ condition, ruleset, onChange, onRemove }: { condition: EventPrecondition; ruleset: Ruleset; onChange: (condition: EventPrecondition) => void; onRemove: () => void }) {
  const data = condition.data || {};
  return (
    <div className="story-row">
      <ComboField label="条件类型" value={condition.type} options={STORY_PRECONDITION_OPTIONS} onChange={(type) => onChange({ ...defaultStoryPrecondition(String(type)), id: condition.id, negated: condition.negated })} />
      <BoolField label="取反 !" value={Boolean(condition.negated)} onChange={(negated) => onChange({ ...condition, negated })} />
      {condition.type === "Friendship" && (
        <>
          <Field label="NPC" value={stringField(data.npc)} onChange={(npc) => onChange({ ...condition, data: { ...data, npc } })} />
          <ComboField label="心数" value={friendshipPointsToHearts(Number(data.points || 2500))} options={[
            { label: "1 心", value: 1 },
            { label: "2 心", value: 2 },
            { label: "3 心", value: 3 },
            { label: "4 心", value: 4 },
            { label: "5 心", value: 5 },
            { label: "6 心", value: 6 },
            { label: "7 心", value: 7 },
            { label: "8 心", value: 8 },
            { label: "9 心", value: 9 },
            { label: "10 心", value: 10 },
            { label: "11 心", value: 11 },
            { label: "12 心", value: 12 },
            { label: "13 心", value: 13 },
            { label: "14 心", value: 14 }
          ]} onChange={(hearts) => onChange({ ...condition, data: { ...data, points: heartsToFriendshipPoints(Number(hearts)) } })} />
        </>
      )}
      {condition.type === "Time" && (
        <>
          <Field label="开始秒数" value={stringField(Math.round(Number(data.min || 600) / 10))} onChange={(minSeconds) => onChange({ ...condition, data: { ...data, min: secondsToTimeValue(Number(minSeconds)) } })} />
          <Field label="结束秒数" value={stringField(Math.round(Number(data.max || 1100) / 10))} onChange={(maxSeconds) => onChange({ ...condition, data: { ...data, max: secondsToTimeValue(Number(maxSeconds)) } })} />
        </>
      )}
      {condition.type === "Season" && <ComboField label="季节" value={data.season || "Spring"} options={rulesetOptions(ruleset, "seasons")} onChange={(season) => onChange({ ...condition, data: { ...data, season } })} />}
      {condition.type === "DayOfWeek" && <ComboField label="星期" value={data.day || "Tue"} options={WEEKDAY_OPTIONS} onChange={(day) => onChange({ ...condition, data: { ...data, day } })} />}
      {condition.type === "DayOfMonth" && <Field label="日期" value={stringField(data.day)} onChange={(day) => onChange({ ...condition, data: { ...data, day: clampDay(day) } })} />}
      {condition.type === "Weather" && <ComboField label="天气" value={data.weather || "sunny"} options={STORY_WEATHER_OPTIONS} onChange={(weather) => onChange({ ...condition, data: { ...data, weather } })} />}
      {condition.type === "SawEvent" && <Field label="已看事件 ID" value={stringField(data.eventId)} onChange={(eventId) => onChange({ ...condition, data: { ...data, eventId } })} />}
      {condition.type === "LocalMail" && <Field label="邮件 ID" value={stringField(data.mailId)} onChange={(mailId) => onChange({ ...condition, data: { ...data, mailId } })} />}
      {condition.type === "HostMail" && <Field label="主机邮件 ID" value={stringField(data.mailId)} onChange={(mailId) => onChange({ ...condition, data: { ...data, mailId } })} />}
      {condition.type === "DaysPlayed" && <Field label="游玩天数" value={stringField(data.days)} onChange={(days) => onChange({ ...condition, data: { ...data, days: integerInRange(days, 1, 99999, 1) } })} />}
      {condition.type === "IsHost" && <div className="notice compact-note">无参数。多人联机中要求当前玩家是主机。</div>}
      {condition.type === "GameStateQuery" && <Field label="Game State Query" value={stringField(data.query)} onChange={(query) => onChange({ ...condition, data: { ...data, query } })} />}
      {condition.type === "Raw" && <Field label="原始条件片段" value={stringField(data.raw)} onChange={(raw) => onChange({ ...condition, data: { ...data, raw } })} />}
      <button type="button" className="secondary" onClick={onRemove}>删除</button>
    </div>
  );
}

function StoryBranchEditor({ branch, meta, i18n, onChange, onRemove }: { branch: StoryEventBranch; meta: StoryEventMeta; i18n: Record<string, string>; onChange: (branch: StoryEventBranch, i18nPatch?: Record<string, string>) => void; onRemove: () => void }) {
  const [nodeKind, setNodeKind] = useState<EventNodeKind>("message");
  const [selectedNodeId, setSelectedNodeId] = useState(branch.nodes[0]?.id || "");
  const selectedNodeIndex = Math.max(0, branch.nodes.findIndex((node) => node.id === selectedNodeId));
  const selectedNode = branch.nodes[selectedNodeIndex] || branch.nodes[0];

  function updateNode(nodeIndex: number, node: StoryEventNode, textPatch?: { key: string; text: string }) {
    onChange({ ...branch, nodes: replaceAt(branch.nodes, nodeIndex, node) }, textPatch ? { [textPatch.key]: textPatch.text } : undefined);
  }

  function addNode(kind: EventNodeKind) {
    const node = defaultStoryNode(kind, { eventId: branch.key, i18nPrefix: `${meta.i18nPrefix}.${sanitizeI18nPart(branch.key)}` }, makeId(), branch.nodes.length);
    onChange({ ...branch, nodes: [...branch.nodes, node] }, storyI18nDefaults({ ...meta, nodes: [node] }));
    setSelectedNodeId(node.id);
  }

  function moveNode(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= branch.nodes.length) return;
    const nodes = [...branch.nodes];
    [nodes[index], nodes[target]] = [nodes[target], nodes[index]];
    onChange({ ...branch, nodes });
    setSelectedNodeId(nodes[target].id);
  }

  return (
    <div className="story-branch">
      <div className="story-node-head">
        <strong>{branch.label || "分支 Entry"}</strong>
        <code>{branch.key}</code>
        <button type="button" className="secondary" onClick={onRemove}>删除分支</button>
      </div>
      <div className="grid two">
        <Field label="分支标题" value={branch.label} onChange={(label) => onChange({ ...branch, label })} />
        <Field label="Entry Key" value={branch.key} onChange={(key) => onChange({ ...branch, key })} />
      </div>
      <div className="toolbar">
        <select value={nodeKind} onChange={(event) => setNodeKind(event.target.value as EventNodeKind)}>
          {STORY_NODE_OPTIONS.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
        </select>
        <button type="button" onClick={() => addNode(nodeKind)}><Icon name="plus" />添加分支节点</button>
      </div>
      <div className="story-flow-map" aria-label="分支流程图预览">
        <div className="story-flow-chip fixed">{branch.key}</div>
        {branch.nodes.map((node, index) => (
          <React.Fragment key={`branch-map-${node.id}`}>
            <span className="story-flow-arrow">→</span>
            <button type="button" className={`story-flow-chip ${selectedNode?.id === node.id ? "active" : ""}`} onClick={() => setSelectedNodeId(node.id)}>{index + 1}. {node.label || storyNodeLabel(node.kind)}</button>
          </React.Fragment>
        ))}
      </div>
      <StoryFlowCanvas
        title="分支流程图"
        startLabel={branch.key}
        nodes={branch.nodes}
        branches={meta.branches}
        selectedNodeId={selectedNode?.id || ""}
        onNodeSelect={setSelectedNodeId}
        onNodePositionCommit={(nodeId, position) => onChange({ ...branch, nodes: updateStoryNodePosition(branch.nodes, nodeId, position) })}
      />
      <div className="story-flow">
        {selectedNode ? (
          <StoryNodeEditor
            key={selectedNode.id}
            node={selectedNode}
              index={selectedNodeIndex}
              meta={{ ...meta, eventId: branch.key, i18nPrefix: `${meta.i18nPrefix}.${sanitizeI18nPart(branch.key)}` }}
              branches={meta.branches}
              i18n={i18n}
              onChange={(next, textPatch) => updateNode(selectedNodeIndex, next, textPatch)}
              onRemove={() => {
                const remaining = branch.nodes.filter((item) => item.id !== selectedNode.id);
                onChange({ ...branch, nodes: remaining });
                setSelectedNodeId(remaining[Math.max(0, selectedNodeIndex - 1)]?.id || "");
              }}
            onMove={moveNode}
          />
        ) : <div className="empty">这个分支还没有节点。</div>}
      </div>
    </div>
  );
}

function StoryFlowCanvas({ title, startLabel, nodes, branches = [], selectedNodeId = "", onNodeSelect, onNodePositionCommit }: { title: string; startLabel: string; nodes: StoryEventNode[]; branches?: StoryEventBranch[]; selectedNodeId?: string; onNodeSelect?: (nodeId: string) => void; onNodePositionCommit: (nodeId: string, position: { x: number; y: number }) => void }) {
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number; position: { x: number; y: number } } | null>(null);
  const [draftPositions, setDraftPositions] = useState<Record<string, { x: number; y: number }>>({});
  const canvasWidth = Math.max(760, 210 + nodes.length * 170);
  const canvasHeight = Math.max(260, 160 + Math.ceil(nodes.length / 5) * 70);
  const start = { x: 24, y: 92 };

  function nodePosition(node: StoryEventNode, index: number) {
    return draftPositions[node.id] || node.position || { x: 210 + index * 150, y: 92 + (index % 2) * 70 };
  }

  function branchPosition(branchKey: string) {
    const branchIndex = Math.max(0, branches.findIndex((branch) => branch.key === branchKey));
    return { x: Math.max(240, canvasWidth - 180), y: 24 + branchIndex * 58 };
  }

  function pointerPosition(event: React.PointerEvent<HTMLDivElement>) {
    const canvas = event.currentTarget.classList.contains("story-canvas")
      ? event.currentTarget
      : event.currentTarget.closest(".story-canvas");
    const rect = (canvas || event.currentTarget).getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  return (
    <div className="story-canvas-wrap">
      <div className="story-canvas-head">
        <strong>{title}</strong>
        <span>拖动节点可保存画布位置；执行顺序仍按下方节点列表。</span>
      </div>
      <div
        className="story-canvas"
        style={{ width: canvasWidth, height: canvasHeight }}
        onPointerMove={(event) => {
          if (!dragging) return;
          const point = pointerPosition(event);
          const position = {
            x: Math.max(140, Math.min(canvasWidth - 150, Math.round(point.x - dragging.offsetX))),
            y: Math.max(18, Math.min(canvasHeight - 70, Math.round(point.y - dragging.offsetY)))
          };
          setDragging({ ...dragging, position });
          setDraftPositions((positions) => ({ ...positions, [dragging.id]: position }));
        }}
        onPointerUp={() => {
          if (dragging) {
            onNodePositionCommit(dragging.id, dragging.position);
          }
          setDragging(null);
        }}
        onPointerCancel={() => setDragging(null)}
      >
        <svg className="story-canvas-lines" width={canvasWidth} height={canvasHeight} aria-hidden="true">
          {nodes.map((node, index) => {
            const from = index === 0 ? start : nodePosition(nodes[index - 1], index - 1);
            const to = nodePosition(node, index);
            const fromX = from.x + 130;
            const fromY = from.y + 24;
            const toX = to.x;
            const toY = to.y + 24;
            return <line key={`line-${node.id}`} x1={fromX} y1={fromY} x2={toX} y2={toY} />;
          })}
          {nodes.filter((node) => node.kind === "fork" && typeof node.data.eventId === "string").map((node, index) => {
            const from = nodePosition(node, nodes.findIndex((item) => item.id === node.id));
            const to = branchPosition(String(node.data.eventId));
            return <line className="fork-line" key={`fork-line-${node.id}-${index}`} x1={from.x + 130} y1={from.y + 24} x2={to.x} y2={to.y + 22} />;
          })}
        </svg>
        <div className="story-canvas-node start" style={{ left: start.x, top: start.y }}>{startLabel}</div>
        {branches.map((branch) => {
          const position = branchPosition(branch.key);
          return <div className="story-canvas-node branch-target" key={`branch-target-${branch.id}`} style={{ left: position.x, top: position.y }} title={branch.key}>{branch.label || "分支"}<code>{branch.key}</code></div>;
        })}
        {nodes.map((node, index) => {
          const position = nodePosition(node, index);
          return (
            <div
              className={`story-canvas-node ${selectedNodeId === node.id ? "active" : ""} ${dragging?.id === node.id ? "dragging" : ""}`}
              key={node.id}
              style={{ left: position.x, top: position.y }}
              onPointerDown={(event) => {
                const point = pointerPosition(event);
                onNodeSelect?.(node.id);
                setDragging({ id: node.id, offsetX: point.x - position.x, offsetY: point.y - position.y, position });
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onClick={() => onNodeSelect?.(node.id)}
            >
              <span>{index + 1}. {node.label || storyNodeLabel(node.kind)}</span>
              <code>{node.kind}</code>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StoryNodeEditor({ node, index, meta, branches = [], i18n, onChange, onCreateBranch, onAddQuestionAnswer, onRemove, onMove }: { node: StoryEventNode; index: number; meta: StoryEventMeta; branches?: StoryEventBranch[]; i18n: Record<string, string>; onChange: (node: StoryEventNode, textPatch?: { key: string; text: string }) => void; onCreateBranch?: (node: StoryEventNode) => void; onAddQuestionAnswer?: (node: StoryEventNode) => void; onRemove: () => void; onMove: (index: number, direction: -1 | 1) => void }) {
  const data = node.data || {};
  const textKey = stringField(data.i18nKey) || storyNodeI18nKey(meta, node);
  const textValue = stringField(i18n[textKey] ?? data.text ?? "");
  const patchData = (patch: JsonDict) => onChange({ ...node, data: { ...data, ...patch } });
  const patchText = (text: string) => onChange({ ...node, data: { ...data, i18nKey: textKey } }, { key: textKey, text });
  const questionAnswers = storyQuestionAnswers(node);
  const patchQuestion = (prompt: string, answers: StoryQuestionAnswer[]) => {
    const text = buildStoryQuestionText(prompt, answers);
    onChange({ ...node, data: { ...data, i18nKey: textKey, answers, text } }, { key: textKey, text });
  };

  return (
    <div className="story-node">
      <div className="story-node-head">
        <strong>{index + 1}. {node.label || storyNodeLabel(node.kind)}</strong>
        <code>{buildStoryCommand(node, meta)}</code>
        <div className="button-row">
          <button type="button" className="secondary" onClick={() => onMove(index, -1)}>上移</button>
          <button type="button" className="secondary" onClick={() => onMove(index, 1)}>下移</button>
          <button type="button" className="secondary" onClick={onRemove}>删除</button>
        </div>
      </div>
      <div className="grid two">
        <ComboField label="节点类型" value={node.kind} options={STORY_NODE_OPTIONS} onChange={(kind) => {
          const next = defaultStoryNode(String(kind) as EventNodeKind, meta, node.id);
          next.position = node.position;
          const key = typeof next.data.i18nKey === "string" ? next.data.i18nKey : "";
          const text = typeof next.data.text === "string" ? next.data.text : "";
          onChange(next, key && text ? { key, text } : undefined);
        }} />
        <Field label="节点标题" value={node.label} onChange={(label) => onChange({ ...node, label })} />
        {node.kind === "pause" && <Field label="等待秒数" value={stringField(Math.round(Number(data.duration || 500) / 10))} onChange={(duration) => patchData({ duration: secondsToTimeValue(Number(duration)) })} />}
        {node.kind === "speak" && (
          <>
            <Field label="说话角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <Field label="i18n Key" value={textKey} onChange={(i18nKey) => patchData({ i18nKey })} />
            <Field label="台词文本" value={textValue} textarea onChange={patchText} />
          </>
        )}
        {node.kind === "splitSpeak" && (
          <>
            <Field label="说话角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <Field label="i18n Key" value={textKey} onChange={(i18nKey) => patchData({ i18nKey })} />
            <Field label="分段台词文本" value={textValue} textarea onChange={patchText} />
          </>
        )}
        {node.kind === "textAboveHead" && (
          <>
            <Field label="气泡角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <Field label="i18n Key" value={textKey} onChange={(i18nKey) => patchData({ i18nKey })} />
            <Field label="气泡文本" value={textValue} textarea onChange={patchText} />
            <div className="notice compact-note">Wiki: textAboveHead 不会把 @ 替换为玩家名；需要玩家名时用 Content Patcher token：{"{{PlayerName}}"}</div>
          </>
        )}
        {node.kind === "message" && (
          <>
            <Field label="i18n Key" value={textKey} onChange={(i18nKey) => patchData({ i18nKey })} />
            <Field label="消息文本" value={textValue} textarea onChange={patchText} />
          </>
        )}
        {node.kind === "question" && (
          <>
            <Field label="fork 标记" value={stringField(data.forkId)} onChange={(forkId) => patchData({ forkId })} />
            <Field label="i18n Key" value={textKey} onChange={(i18nKey) => onChange({ ...node, data: { ...data, i18nKey } }, { key: i18nKey, text: textValue })} />
            <Field label="问题正文" value={storyQuestionPrompt(textValue)} textarea onChange={(prompt) => patchQuestion(prompt, questionAnswers)} />
            <div className="story-inline-editor">
              <strong>回答选项</strong>
              {questionAnswers.map((answer, answerIndex) => (
                <div className="story-row" key={`${answer.id}-${answerIndex}`}>
                  <Field label="回答 ID" value={answer.id} onChange={(id) => {
                    const answers = replaceAt(questionAnswers, answerIndex, { ...answer, id });
                    patchQuestion(storyQuestionPrompt(textValue), answers);
                  }} />
                  <Field label="选项文本" value={answer.text} onChange={(text) => {
                    const answers = replaceAt(questionAnswers, answerIndex, { ...answer, text });
                    patchQuestion(storyQuestionPrompt(textValue), answers);
                  }} />
                  <ComboField label="分支 Entry" value={answer.branchKey} options={storyBranchOptions(branches)} onChange={(branchKey) => {
                    const answers = replaceAt(questionAnswers, answerIndex, { ...answer, branchKey: String(branchKey) });
                    patchQuestion(storyQuestionPrompt(textValue), answers);
                  }} />
                  <button type="button" className="secondary" onClick={() => {
                    const answers = questionAnswers.filter((_, itemIndex) => itemIndex !== answerIndex);
                    patchQuestion(storyQuestionPrompt(textValue), answers);
                  }}>删除选项</button>
                </div>
              ))}
              {onAddQuestionAnswer && <button type="button" className="secondary" onClick={() => onAddQuestionAnswer(node)}>添加回答并创建分支</button>}
              <div className="notice compact-note">最终问题文本会按 Wiki 的 <code>question forkN "问题#回答0#回答1"</code> 形式写入；每个回答建议对应一个后续 fork 节点和分支 Entry。</div>
            </div>
          </>
        )}
        {node.kind === "quickQuestion" && (
          <>
            <Field label="i18n Key" value={textKey} onChange={(i18nKey) => patchData({ i18nKey })} />
            <Field label="问题与回答脚本" value={textValue} textarea onChange={patchText} />
            <div className="notice compact-note">格式：问题#选项1#选项2(break)选项1脚本(break)选项2脚本。Wiki 提醒：事件开头直接用 quickQuestion 可能循环，建议前面加 pause 1。</div>
          </>
        )}
        {node.kind === "fork" && (
          <>
            <Field label="条件/回答 ID" value={stringField(data.requirement)} onChange={(requirement) => patchData({ requirement })} />
            <ComboField label="跳转分支 Entry" value={data.eventId || ""} options={storyBranchOptions(branches)} onChange={(eventId) => patchData({ eventId })} />
            {onCreateBranch && <button type="button" className="secondary" onClick={() => onCreateBranch(node)}>创建并关联分支</button>}
          </>
        )}
        {node.kind === "questionAnswered" && (
          <>
            <Field label="回答 ID" value={stringField(data.answerId)} onChange={(answerId) => patchData({ answerId })} />
            <BoolField label="设为已回答" value={data.answered !== false} onChange={(answered) => patchData({ answered })} />
          </>
        )}
        {node.kind === "move" && (
          <>
            <Field label="角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <Field label="X 偏移" value={stringField(data.x)} onChange={(x) => patchData({ x: integerInRange(x, -999, 999, 0) })} />
            <Field label="Y 偏移" value={stringField(data.y)} onChange={(y) => patchData({ y: integerInRange(y, -999, 999, 0) })} />
            <ComboField label="结束朝向" value={data.direction ?? 2} options={STORY_DIRECTION_OPTIONS} onChange={(direction) => patchData({ direction: Number(direction) })} />
            <BoolField label="异步 continue" value={Boolean(data.continue)} onChange={(value) => patchData({ continue: value })} />
          </>
        )}
        {node.kind === "advancedMove" && (
          <>
            <Field label="角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <BoolField label="循环 loop" value={Boolean(data.loop)} onChange={(loop) => patchData({ loop })} />
            <Field label="路径片段" value={stringField(data.path)} textarea onChange={(path) => patchData({ path })} />
            <div className="notice compact-note">按 Wiki 原始参数填写路径片段，例如 <code>0 3 2 0 0 2 -2 0 0 -2 2 0</code>。暂停片段可用方向 1/2/3/4 + 毫秒。</div>
          </>
        )}
        {node.kind === "positionOffset" && (
          <>
            <Field label="角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <Field label="X 偏移" value={stringField(data.x)} onChange={(x) => patchData({ x: integerInRange(x, -999, 999, 0) })} />
            <Field label="Y 偏移" value={stringField(data.y)} onChange={(y) => patchData({ y: integerInRange(y, -999, 999, 0) })} />
            <BoolField label="异步 continue" value={Boolean(data.continue)} onChange={(value) => patchData({ continue: value })} />
          </>
        )}
        {node.kind === "warp" && (
          <>
            <Field label="角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <Field label="目标 X" value={stringField(data.x)} onChange={(x) => patchData({ x: integerInRange(x, -10000, 10000, 0) })} />
            <Field label="目标 Y" value={stringField(data.y)} onChange={(y) => patchData({ y: integerInRange(y, -10000, 10000, 0) })} />
          </>
        )}
        {node.kind === "warpFarmers" && (
          <>
            <Field label="玩家位置列表" value={stringField(data.placements)} textarea onChange={(placements) => patchData({ placements })} />
            <Field label="默认偏移 default offset" value={stringField(data.defaultOffset)} onChange={(defaultOffset) => patchData({ defaultOffset: integerInRange(defaultOffset, -999, 999, 0) })} />
            <Field label="默认 X" value={stringField(data.defaultX)} onChange={(defaultX) => patchData({ defaultX: integerInRange(defaultX, -10000, 10000, 64) })} />
            <Field label="默认 Y" value={stringField(data.defaultY)} onChange={(defaultY) => patchData({ defaultY: integerInRange(defaultY, -10000, 10000, 15) })} />
            <ComboField label="默认朝向" value={data.direction ?? 2} options={STORY_DIRECTION_OPTIONS} onChange={(direction) => patchData({ direction: Number(direction) })} />
          </>
        )}
        {node.kind === "faceDirection" && (
          <>
            <Field label="角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <ComboField label="朝向" value={data.direction ?? 2} options={STORY_DIRECTION_OPTIONS} onChange={(direction) => patchData({ direction: Number(direction) })} />
            <BoolField label="异步 continue" value={Boolean(data.continue)} onChange={(value) => patchData({ continue: value })} />
          </>
        )}
        {node.kind === "emote" && (
          <>
            <Field label="角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <ComboField label="表情 ID" value={data.emote ?? 16} options={STORY_EMOTE_OPTIONS} onChange={(emote) => patchData({ emote: Number(emote) })} />
          </>
        )}
        {node.kind === "animate" && (
          <>
            <Field label="角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <BoolField label="水平翻转 flip" value={Boolean(data.flip)} onChange={(flip) => patchData({ flip })} />
            <BoolField label="循环 loop" value={data.loop !== false} onChange={(loop) => patchData({ loop })} />
            <Field label="每帧毫秒" value={stringField(data.frameDuration)} onChange={(frameDuration) => patchData({ frameDuration: integerInRange(frameDuration, 1, 600000, 120) })} />
            <Field label="帧列表" value={stringField(data.frames)} onChange={(frames) => patchData({ frames })} />
          </>
        )}
        {node.kind === "showFrame" && (
          <>
            <Field label="角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <Field label="帧编号" value={stringField(data.frame)} onChange={(frame) => patchData({ frame: integerInRange(frame, 0, 9999, 0) })} />
            <BoolField label="水平翻转 flip" value={Boolean(data.flip)} onChange={(flip) => patchData({ flip })} />
          </>
        )}
        {node.kind === "stopAnimation" && <Field label="角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />}
        {node.kind === "shake" && (
          <>
            <Field label="角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <Field label="持续毫秒" value={stringField(data.duration)} onChange={(duration) => patchData({ duration: integerInRange(duration, 0, 600000, 1000) })} />
          </>
        )}
        {node.kind === "jump" && (
          <>
            <Field label="角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <Field label="强度 intensity" value={stringField(data.intensity)} onChange={(intensity) => patchData({ intensity: integerInRange(intensity, 0, 9999, 8) })} />
          </>
        )}
        {node.kind === "playSound" && <Field label="音效 ID" value={stringField(data.sound)} onChange={(sound) => patchData({ sound })} />}
        {node.kind === "stopSound" && (
          <>
            <Field label="音效 ID" value={stringField(data.sound)} onChange={(sound) => patchData({ sound })} />
            <BoolField label="立即停止 immediate" value={data.immediate !== false} onChange={(immediate) => patchData({ immediate })} />
          </>
        )}
        {node.kind === "playMusic" && <Field label="音乐 ID" value={stringField(data.music)} onChange={(music) => patchData({ music })} />}
        {node.kind === "stopMusic" && <div className="notice compact-note">无参数。停止当前音乐。</div>}
        {node.kind === "fade" && <BoolField label="unfade" value={Boolean(data.unfade)} onChange={(unfade) => patchData({ unfade })} />}
        {node.kind === "globalFade" && (
          <>
            <Field label="速度 speed" value={stringField(data.speed)} onChange={(speed) => patchData({ speed })} />
            <BoolField label="continue" value={Boolean(data.continue)} onChange={(value) => patchData({ continue: value })} />
          </>
        )}
        {node.kind === "globalFadeToClear" && (
          <>
            <Field label="速度 speed" value={stringField(data.speed)} onChange={(speed) => patchData({ speed })} />
            <BoolField label="continue" value={Boolean(data.continue)} onChange={(value) => patchData({ continue: value })} />
          </>
        )}
        {node.kind === "viewport" && (
          <>
            <Field label="X" value={stringField(data.x)} onChange={(x) => patchData({ x: integerInRange(x, -10000, 10000, -1000) })} />
            <Field label="Y" value={stringField(data.y)} onChange={(y) => patchData({ y: integerInRange(y, -10000, 10000, -1000) })} />
          </>
        )}
        {node.kind === "mail" && (
          <>
            <ComboField label="邮件命令" value={data.command || "mailReceived"} options={STORY_MAIL_COMMAND_OPTIONS} onChange={(command) => patchData({ command })} />
            <Field label="邮件 ID" value={stringField(data.mailId)} onChange={(mailId) => patchData({ mailId })} />
          </>
        )}
        {node.kind === "eventSeen" && (
          <>
            <Field label="事件 ID" value={stringField(data.eventId)} onChange={(eventId) => patchData({ eventId })} />
            <BoolField label="设为已看" value={data.seen !== false} onChange={(seen) => patchData({ seen })} />
          </>
        )}
        {node.kind === "addItem" && (
          <>
            <Field label="物品 ID" value={stringField(data.itemId)} onChange={(itemId) => patchData({ itemId })} />
            <Field label="数量 count" value={stringField(data.count)} onChange={(count) => patchData({ count: integerInRange(count, 1, 999, 1) })} />
            <Field label="品质 quality" value={stringField(data.quality)} onChange={(quality) => patchData({ quality: integerInRange(quality, 0, 4, 0) })} />
          </>
        )}
        {node.kind === "removeItem" && (
          <>
            <Field label="物品 ID" value={stringField(data.itemId)} onChange={(itemId) => patchData({ itemId })} />
            <Field label="数量 count" value={stringField(data.count)} onChange={(count) => patchData({ count: integerInRange(count, 1, 999, 1) })} />
          </>
        )}
        {node.kind === "addObject" && (
          <>
            <Field label="X" value={stringField(data.x)} onChange={(x) => patchData({ x: integerInRange(x, -10000, 10000, 64) })} />
            <Field label="Y" value={stringField(data.y)} onChange={(y) => patchData({ y: integerInRange(y, -10000, 10000, 15) })} />
            <Field label="物品 ID" value={stringField(data.itemId)} onChange={(itemId) => patchData({ itemId })} />
            <Field label="layer depth（可空）" value={stringField(data.layerDepth)} onChange={(layerDepth) => patchData({ layerDepth })} />
          </>
        )}
        {node.kind === "removeObject" && (
          <>
            <Field label="X" value={stringField(data.x)} onChange={(x) => patchData({ x: integerInRange(x, -10000, 10000, 64) })} />
            <Field label="Y" value={stringField(data.y)} onChange={(y) => patchData({ y: integerInRange(y, -10000, 10000, 15) })} />
          </>
        )}
        {node.kind === "removeSprite" && (
          <>
            <Field label="X" value={stringField(data.x)} onChange={(x) => patchData({ x: integerInRange(x, -10000, 10000, 64) })} />
            <Field label="Y" value={stringField(data.y)} onChange={(y) => patchData({ y: integerInRange(y, -10000, 10000, 15) })} />
          </>
        )}
        {node.kind === "addTemporaryActor" && (
          <>
            <Field label="spriteAssetName" value={stringField(data.spriteAssetName)} onChange={(spriteAssetName) => patchData({ spriteAssetName })} />
            <Field label="sprite width" value={stringField(data.spriteWidth)} onChange={(spriteWidth) => patchData({ spriteWidth: integerInRange(spriteWidth, 1, 9999, 16) })} />
            <Field label="sprite height" value={stringField(data.spriteHeight)} onChange={(spriteHeight) => patchData({ spriteHeight: integerInRange(spriteHeight, 1, 9999, 32) })} />
            <Field label="tile X" value={stringField(data.x)} onChange={(x) => patchData({ x: integerInRange(x, -10000, 10000, 64) })} />
            <Field label="tile Y" value={stringField(data.y)} onChange={(y) => patchData({ y: integerInRange(y, -10000, 10000, 15) })} />
            <ComboField label="朝向" value={data.direction ?? 2} options={STORY_DIRECTION_OPTIONS} onChange={(direction) => patchData({ direction: Number(direction) })} />
            <Field label="breather（可空）" value={stringField(data.breather)} onChange={(breather) => patchData({ breather })} />
            <ComboField label="类型（可空）" value={data.actorType || ""} options={STORY_TEMP_ACTOR_TYPE_OPTIONS} onChange={(actorType) => patchData({ actorType })} />
            <Field label="override name（可空）" value={stringField(data.overrideName)} onChange={(overrideName) => patchData({ overrideName })} />
          </>
        )}
        {node.kind === "changeLocation" && <Field label="地点" value={stringField(data.location)} onChange={(location) => patchData({ location })} />}
        {node.kind === "changeMapTile" && (
          <>
            <ComboField label="图层" value={data.layer || "Buildings"} options={STORY_MAP_LAYER_OPTIONS} onChange={(layer) => patchData({ layer })} />
            <Field label="X" value={stringField(data.x)} onChange={(x) => patchData({ x: integerInRange(x, -10000, 10000, 64) })} />
            <Field label="Y" value={stringField(data.y)} onChange={(y) => patchData({ y: integerInRange(y, -10000, 10000, 15) })} />
            <Field label="tile index" value={stringField(data.tileIndex)} onChange={(tileIndex) => patchData({ tileIndex: integerInRange(tileIndex, -1, 999999, 0) })} />
          </>
        )}
        {node.kind === "changePortrait" && (
          <>
            <Field label="NPC" value={stringField(data.npc)} onChange={(npc) => patchData({ npc })} />
            <Field label="portrait 后缀（可空）" value={stringField(data.portrait)} onChange={(portrait) => patchData({ portrait })} />
          </>
        )}
        {node.kind === "changeSprite" && (
          <>
            <Field label="角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <Field label="sprite 后缀（可空）" value={stringField(data.sprite)} onChange={(sprite) => patchData({ sprite })} />
          </>
        )}
        {node.kind === "farmerEat" && <Field label="物品 ID" value={stringField(data.objectId)} onChange={(objectId) => patchData({ objectId })} />}
        {node.kind === "farmerAnimation" && <Field label="动画 ID" value={stringField(data.animation)} onChange={(animation) => patchData({ animation })} />}
        {node.kind === "friendship" && (
          <>
            <Field label="NPC" value={stringField(data.npc)} onChange={(npc) => patchData({ npc })} />
            <Field label="增减值" value={stringField(data.amount)} onChange={(amount) => patchData({ amount: integerInRange(amount, -5000, 5000, 250) })} />
          </>
        )}
        {node.kind === "money" && <Field label="金额" value={stringField(data.amount)} onChange={(amount) => patchData({ amount: integerInRange(amount, -9999999, 9999999, 100) })} />}
        {node.kind === "end" && (
          <>
            <ComboField label="结束模式" value={data.mode || "end"} options={STORY_END_OPTIONS} onChange={(mode) => patchData({ mode })} />
            {(data.mode === "dialogue" || data.mode === "dialogueWarpOut") && (
              <>
                <Field label="对话 NPC" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
                <Field label="结束后对话 i18n Key" value={textKey} onChange={(i18nKey) => patchData({ i18nKey })} />
                <Field label="结束后对话文本" value={textValue} textarea onChange={patchText} />
              </>
            )}
          </>
        )}
        {node.kind === "custom" && <Field label="原始事件命令" value={stringField(data.raw)} textarea onChange={(raw) => patchData({ raw })} />}
      </div>
    </div>
  );
}

function RuleLibraryView() {
  const [library, setLibrary] = useState<RuleLibrary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJson<RuleLibrary>("/api/rules/library")
      .then(setLibrary)
      .catch((requestError) => setError(readError(requestError)));
  }, []);

  if (error) return <Section title="规则库"><div className="inline-error">{error}</div></Section>;
  if (!library) return <Section title="规则库"><div className="empty">正在加载规则库...</div></Section>;

  const enumEntries = Object.entries(library.game_data.enums || {});
  const fieldTypes = Object.entries(library.game_data.common_field_types || {});
  const textOperations = library.content_patcher.text_operations?.operations || [];
  const referencePatterns = library.reference_patterns?.references || [];
  return (
    <Section title="规则库">
      <div className="notice">
        当前规则库版本 {library.sources.library_version}。规则来自 Stardew Valley Wiki 的 Modding 索引与 Content Patcher 文档离线整理快照。
      </div>
      <div className="rule-grid">
        <div className="rule-panel">
          <h3>来源</h3>
          {library.sources.sources.map((source) => (
            <div className="rule-row" key={source.id}>
              <strong>{source.title}</strong>
              <a href={source.url} target="_blank" rel="noreferrer">{source.url}</a>
              <span>{source.scope}</span>
            </div>
          ))}
        </div>
        <div className="rule-panel">
          <h3>Content Patcher 动作</h3>
          {library.content_patcher.patch_actions.map((action) => (
            <div className="rule-row" key={action.action}>
              <strong>{action.label || action.action}</strong>
              <span>必填：{action.required_fields.join(", ") || "无"}</span>
              <span>可选：{action.optional_fields.join(", ") || "无"}</span>
            </div>
          ))}
        </div>
        <div className="rule-panel">
          <h3>游戏数据目标</h3>
          {library.game_data.targets.map((target) => (
            <div className="rule-row" key={target.id}>
              <strong>{target.label}</strong>
              <code>{target.target}</code>
              <span>{target.description}</span>
              {Boolean(target.key_patterns?.length) && <span>键格式：{target.key_patterns?.map((pattern) => pattern.pattern).join(", ")}</span>}
              {Boolean(target.commands?.length) && <span>命令/标记：{target.commands?.map((command) => command.token).join(", ")}</span>}
              {Boolean(target.event_commands?.length) && <span>事件命令：{target.event_commands?.map((command) => command.command).join(", ")}</span>}
              {Boolean(target.schedule_points?.length) && <span>日程字段：{target.schedule_points?.map((point) => point.field).join(", ")}</span>}
              {Boolean(target.taste_groups?.length) && <span>喜好分组：{target.taste_groups?.map((group) => group.name).join(", ")}</span>}
              {Boolean(target.mail_markers?.length) && <span>邮件标记：{target.mail_markers?.map((marker) => marker.marker).join(", ")}</span>}
              {Boolean(target.attachment_types?.length) && <span>附件类型：{target.attachment_types?.map((item) => item.type).join(", ")}</span>}
              {Boolean(target.action_examples?.length) && <span>动作示例：{target.action_examples?.map((action) => action.action).join(", ")}</span>}
              {Boolean(target.field_groups?.length) && <span>字段分组：{target.field_groups?.map((group) => group.label || group.group).join(", ")}</span>}
              {Boolean(target.related_assets?.length) && <span>相关资源：{target.related_assets?.map((asset) => asset.target).join(", ")}</span>}
              {Boolean(target.item_data_targets?.length) && <span>物品目标：{target.item_data_targets?.map((item) => item.target).join(", ")}</span>}
              {Boolean(target.substructures?.length) && <span>子结构：{target.substructures?.map((item) => item.name).join(", ")}</span>}
            </div>
          ))}
        </div>
        <div className="rule-panel">
          <h3>枚举与固定写法</h3>
          {enumEntries.map(([key, options]) => (
            <div className="rule-row" key={key}>
              <strong>{key}</strong>
              <span>{options.length} 个选项</span>
            </div>
          ))}
        </div>
        <div className="rule-panel">
          <h3>通用字段类型</h3>
          {fieldTypes.map(([key, field]) => (
            <div className="rule-row" key={key}>
              <strong>{field.label}</strong>
              <code>{key}</code>
              <span>{field.description}</span>
            </div>
          ))}
        </div>
        <div className="rule-panel">
          <h3>TextOperations</h3>
          {textOperations.map((operation) => (
            <div className="rule-row" key={operation.operation}>
              <strong>{operation.operation}</strong>
              <span>{operation.description}</span>
            </div>
          ))}
        </div>
        <div className="rule-panel">
          <h3>参考样本模式</h3>
          {referencePatterns.map((reference) => (
            <div className="rule-row" key={reference.id}>
              <strong>{reference.title}</strong>
              {reference.observed_format && <span>观察到的 CP Format：{reference.observed_format}</span>}
              {reference.observed_scale && <span>规模：{Object.entries(reference.observed_scale).map(([key, value]) => `${key}=${value}`).join(", ")}</span>}
              {Boolean(reference.common_include_groups?.length) && <span>常见 Include 分组：{reference.common_include_groups?.join(", ")}</span>}
              {Boolean(reference.high_frequency_targets?.length) && <span>高频目标：{reference.high_frequency_targets?.slice(0, 16).join(", ")}</span>}
              {Boolean(reference.high_frequency_when_keys?.length) && <span>高频 When：{reference.high_frequency_when_keys?.slice(0, 16).join(", ")}</span>}
              {Boolean(reference.package_layout_patterns?.length) && <span>结构模式：{reference.package_layout_patterns?.map((pattern) => pattern.pattern).join(", ")}</span>}
              {Boolean(reference.notes?.length) && <span>{reference.notes?.[0]}</span>}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function AISettings() {
  const [config, setConfig] = useState<AIConfig>({ provider: "deepseek", model: "deepseek-chat", base_url: "", api_key_set: false, api_key_suffix: "" });
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<AISuggestResponse | null>(null);

  useEffect(() => {
    refreshConfig();
  }, []);

  async function refreshConfig() {
    const current = await fetchJson<AIConfig>("/api/ai/config");
    setConfig(current);
    return current;
  }

  async function save(clearApiKey = false) {
    setBusy(true);
    setStatus("");
    setTestResult(null);
    try {
      await postJson<AIConfig>("/api/ai/config", {
        provider: config.provider,
        model: config.model,
        base_url: config.base_url,
        api_key: apiKey || null,
        clear_api_key: clearApiKey
      });
      const saved = await refreshConfig();
      setApiKey("");
      setStatus(clearApiKey ? "已清除本地 API Key。" : `AI 设置已保存到本机。${saved.api_key_set ? `当前 Key：****${saved.api_key_suffix}` : "当前未保存 Key。"}`);
    } catch (error) {
      setStatus(`保存失败：${readError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setBusy(true);
    setStatus("");
    setTestResult(null);
    try {
      const response = await postJson<AISuggestResponse>("/api/ai/test", {});
      setTestResult(response);
      setStatus("测试连接成功，AI 已返回 JSON 建议。");
    } catch (error) {
      setStatus(`测试连接失败：${readError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="AI 设置">
      <div className="notice">
        API Key 只保存在本机的运行配置里，不会写入 .cpgen 工程文件。AI 生成结果不会自动应用，需要你手动确认。
      </div>
      <div className="grid two">
        <label className="field">
          <span>服务商 Provider</span>
          <select value={config.provider} onChange={(event) => {
            const provider = event.target.value as AIProvider;
            setConfig({ ...config, provider, model: defaultAIModel(provider), base_url: "" });
          }}>
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
            <option value="custom">兼容 OpenAI 的自定义服务</option>
          </select>
        </label>
        <Field label="模型 Model" value={config.model} onChange={(model) => setConfig({ ...config, model })} />
        <Field label="接口地址 Base URL（留空使用默认）" value={config.base_url} onChange={(base_url) => setConfig({ ...config, base_url })} />
        <Field label={config.api_key_set ? "API Key（已保存，留空则不变）" : "API Key"} value={apiKey} onChange={setApiKey} />
      </div>
      <div className="button-row ai-actions">
        <button onClick={() => save(false)} disabled={busy}><Icon name="save" />保存 AI 设置</button>
        <button className="secondary" onClick={() => save(true)} disabled={busy}>清除 Key</button>
        <button className="secondary" onClick={testConnection} disabled={busy || !config.api_key_set}>测试连接</button>
        <span>{config.api_key_set ? `当前已保存 API Key：****${config.api_key_suffix}` : "当前未保存 API Key"}</span>
      </div>
      {status && <div className="status compact">{status}</div>}
      {testResult && <JsonField label="测试返回 JSON" value={testResult.json_value ?? {}} onChange={() => undefined} />}
    </Section>
  );
}

function AIAssistantPanel({ project, entry, onApply }: { project: Project; entry: GameDataEntry; onApply: (kind: AISuggestionKind, value: unknown) => void }) {
  const [kind, setKind] = useState<AISuggestionKind>("when");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<AISuggestResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const promptText = prompt || defaultAIPrompt(kind, entry);

  async function generate() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await postJson<AISuggestResponse>("/api/ai/suggest", {
        kind,
        prompt: promptText,
        project,
        game_data_entry: entry,
        field_path: kind === "when" ? "When" : kind === "field" ? "Entries.<Key>" : "EditData"
      });
      setResult(response);
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setBusy(false);
    }
  }

  const canApply = result && result.json_value !== null;

  return (
    <div className="ai-panel">
      <div className="ai-panel-head">
        <div>
          <strong>AI 助手</strong>
          <span>生成条件、字段或完整补丁，确认后再应用。</span>
        </div>
        <select value={kind} onChange={(event) => {
          const nextKind = event.target.value as AISuggestionKind;
          setKind(nextKind);
          setPrompt("");
          setResult(null);
          setError("");
        }}>
          <option value="when">When 条件</option>
          <option value="field">字段内容</option>
          <option value="game-data-patch">完整 EditData 补丁</option>
        </select>
      </div>
      <Field label="给 AI 的说明" value={promptText} textarea onChange={setPrompt} />
      <div className="button-row">
        <button onClick={generate} disabled={busy}><Icon name="ai" />{busy ? "生成中..." : "生成建议"}</button>
        <button className="secondary" disabled={!canApply} onClick={() => result?.json_value !== null && onApply(kind, result?.json_value)}>应用建议</button>
      </div>
      {error && <div className="inline-error">{error}</div>}
      {result && (
        <div className="ai-result">
          {result.warnings.map((warning, index) => <div className="inline-warning" key={index}>{warning}</div>)}
          <JsonField label="AI 解析出的 JSON" value={result.json_value ?? {}} onChange={(value) => setResult({ ...result, json_value: value })} />
          <label className="field">
            <span>AI 原文</span>
            <textarea value={result.text} readOnly />
          </label>
        </div>
      )}
    </div>
  );
}

function PatchAIAssistantPanel({ patch, onApply }: { patch: Patch; onApply: (kind: AISuggestionKind, value: unknown) => void }) {
  const [kind, setKind] = useState<AISuggestionKind>("when");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<AISuggestResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const promptText = prompt || defaultPatchAIPrompt(kind, patch);

  async function generate() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await postJson<AISuggestResponse>("/api/ai/suggest", {
        kind,
        prompt: promptText,
        patch,
        field_path: kind === "when" ? "When" : "patch.fields"
      });
      setResult(response);
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setBusy(false);
    }
  }

  const canApply = result && result.json_value !== null;

  return (
    <details className="ai-panel compact-panel">
      <summary>AI 助手</summary>
      <div className="ai-panel-body">
        <div className="ai-panel-head">
          <div>
            <strong>{patch.name}</strong>
            <span>为当前 CP 补丁生成 When 或动作字段。</span>
          </div>
          <select value={kind} onChange={(event) => {
            const nextKind = event.target.value as AISuggestionKind;
            setKind(nextKind);
            setPrompt("");
            setResult(null);
            setError("");
          }}>
            <option value="when">When 条件</option>
            <option value="field">动作字段</option>
            <option value="game-data-patch">完整 EditData 补丁</option>
          </select>
        </div>
        <Field label="给 AI 的说明" value={promptText} textarea onChange={setPrompt} />
        <div className="button-row">
          <button onClick={generate} disabled={busy}><Icon name="ai" />{busy ? "生成中..." : "生成建议"}</button>
          <button className="secondary" disabled={!canApply} onClick={() => result?.json_value !== null && onApply(kind, result?.json_value)}>应用建议</button>
        </div>
        {error && <div className="inline-error">{error}</div>}
        {result && (
          <div className="ai-result">
            {result.warnings.map((warning, index) => <div className="inline-warning" key={index}>{warning}</div>)}
            <JsonField label="AI 解析出的 JSON" value={result.json_value ?? {}} onChange={(value) => setResult({ ...result, json_value: value })} />
            <label className="field">
              <span>AI 原文</span>
              <textarea value={result.text} readOnly />
            </label>
          </div>
        )}
      </div>
    </details>
  );
}

function JsonField({ label, value, onChange }: { label: string; value: unknown; onChange: (value: unknown) => void }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState("");
  useEffect(() => setText(JSON.stringify(value, null, 2)), [value]);
  return (
    <label className="field json-field">
      <span>{label}</span>
      <textarea value={text} onChange={(event) => {
        const next = event.target.value;
        setText(next);
        try {
          const parsed = JSON.parse(next || "{}");
          setError("");
          onChange(parsed);
        } catch {
          setError("JSON 格式无效");
        }
      }} />
      {error && <small>{error}</small>}
    </label>
  );
}

function WhenBuilder({ ruleset, value, onChange }: { ruleset: Ruleset; value: JsonDict; onChange: (value: JsonDict) => void }) {
  const conditions = whenConditionSchemas(ruleset);
  const [selectedKey, setSelectedKey] = useState(conditions[0]?.key || "Season");
  const selected = conditions.find((condition) => condition.key === selectedKey) || conditions[0];
  const [parameterValue, setParameterValue] = useState("");
  const activeParameterValue = selected ? (parameterValue || defaultWhenParameterValue(ruleset, selected)) : "";
  const effectiveKey = selected ? whenEffectiveKey(selected, activeParameterValue) : "";
  const currentValue = value[effectiveKey] ?? defaultWhenValue(ruleset, selected);

  function setConditionValue(nextValue: unknown) {
    if (!selected) return;
    onChange({ ...value, [whenEffectiveKey(selected, activeParameterValue)]: nextValue });
  }

  function removeCondition(key: string) {
    onChange(Object.fromEntries(Object.entries(value).filter(([entryKey]) => entryKey !== key)));
  }

  return (
    <div className="field when-builder">
      <span>条件 When</span>
      <div className="when-add-row">
        <select value={selectedKey} onChange={(event) => {
          setSelectedKey(event.target.value);
          setParameterValue("");
        }}>
          {conditions.map((condition) => <option key={condition.key} value={condition.key}>{condition.label}</option>)}
        </select>
        {selected?.parameterLabel && (
          <WhenParameterInput ruleset={ruleset} schema={selected} value={activeParameterValue} onChange={setParameterValue} />
        )}
        {selected && <WhenValueInput ruleset={ruleset} schema={selected} value={currentValue} onChange={setConditionValue} />}
      </div>
      <div className="when-chips">
        {Object.entries(value).map(([key, itemValue]) => (
          <button type="button" className="chip" key={key} onClick={() => removeCondition(key)}>
            {key}: {stringField(itemValue)} ×
          </button>
        ))}
        {!Object.keys(value).length && <small>暂无条件；可以用上方控件添加，或在 JSON 中直接编辑。</small>}
      </div>
      <JsonField label="When JSON 高级编辑" value={value} onChange={(next) => isObject(next) && onChange(next)} />
    </div>
  );
}

function whenEffectiveKey(schema: WhenConditionSchema, parameterValue: string) {
  const parameter = schema.parameterLabel ? (parameterValue.trim() || "Abigail") : "";
  return parameter ? `${schema.key}:${parameter}` : schema.key;
}

function defaultWhenParameterValue(ruleset: Ruleset, schema: WhenConditionSchema) {
  if (!schema.parameterLabel) return "";
  if (schema.parameterOptions) return String(rulesetOptions(ruleset, schema.parameterOptions)[0]?.value ?? "Abigail");
  if (schema.key === "SkillLevel") return "Combat";
  return "Abigail";
}

function WhenParameterInput({ ruleset, schema, value, onChange }: { ruleset: Ruleset; schema: WhenConditionSchema; value: string; onChange: (value: string) => void }) {
  if (schema.parameterOptions) {
    return <ComboField label={schema.parameterLabel || "参数"} value={value} options={rulesetOptions(ruleset, schema.parameterOptions)} onChange={(next) => onChange(String(next))} />;
  }
  return <Field label={schema.parameterLabel || "参数"} value={value} onChange={onChange} />;
}

function WhenValueInput({ ruleset, schema, value, onChange }: { ruleset: Ruleset; schema: WhenConditionSchema; value: unknown; onChange: (value: unknown) => void }) {
  if (schema.valueType === "select" && schema.options) {
    return <ComboField label="值" value={value} options={rulesetOptions(ruleset, schema.options)} onChange={onChange} />;
  }
  if (schema.valueType === "number") {
    return (
      <label className="field compact-field">
        <span>值</span>
        <input type="number" value={stringField(value)} onChange={(event) => onChange(numberOrText(event.target.value))} />
      </label>
    );
  }
  if (schema.valueType === "relationship") {
    return (
      <label className="field compact-field">
        <span>值</span>
        <input value={stringField(value)} onChange={(event) => onChange(event.target.value)} placeholder="Abigail | Hearts: 4" />
      </label>
    );
  }
  return <Field label="值" value={stringField(value)} onChange={onChange} />;
}

function Stats({ project, issues }: { project: Project; issues: ValidationIssue[] }) {
  return (
    <div className="stats">
      <div><strong>{project.patches.length}</strong><span>CP 补丁</span></div>
      <div><strong>{project.game_data.length}</strong><span>游戏数据条目</span></div>
      <div><strong>{project.assets.length}</strong><span>素材</span></div>
      <div><strong>{issues.length}</strong><span>校验问题</span></div>
    </div>
  );
}

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  if (!issues.length) return <div className="empty"><Icon name="check" />暂无校验问题。</div>;
  return (
    <div className="issues">
      {issues.map((issue, index) => (
        <div className={`issue ${issue.level}`} key={`${issue.path}-${index}`}>
          <Icon name="warn" />
          <div><strong>{issue.path}</strong><span>{issue.message}</span></div>
        </div>
      ))}
    </div>
  );
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function importProjectAsset(project: Project, file: File, storedPath?: string): Promise<Project> {
  return (await importProjectAssetWithRecord(project, file, storedPath)).project;
}

async function importProjectAssetWithRecord(project: Project, file: File, storedPath?: string): Promise<ImportAssetResponse> {
  const form = new FormData();
  form.append("project_json", JSON.stringify(project));
  form.append("file", file);
  if (storedPath) form.append("stored_path", storedPath);
  const response = await fetch("/api/assets/import", { method: "POST", body: form });
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as ImportAssetResponse;
}

function splitComma(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function actionLabel(action: Patch["action"]) {
  const labels: Record<Patch["action"], string> = {
    Load: "Load 加载素材",
    EditData: "EditData 编辑数据",
    EditImage: "EditImage 编辑图片",
    EditMap: "EditMap 编辑地图",
    Include: "Include 引入补丁"
  };
  return labels[action] || action;
}

const WEEKDAY_OPTIONS: RulesetOption[] = [
  { label: "周一 Mon", value: "Mon" },
  { label: "周二 Tue", value: "Tue" },
  { label: "周三 Wed", value: "Wed" },
  { label: "周四 Thu", value: "Thu" },
  { label: "周五 Fri", value: "Fri" },
  { label: "周六 Sat", value: "Sat" },
  { label: "周日 Sun", value: "Sun" }
];

const FALLBACK_DIALOGUE_FORMATS: DialogueFormat[] = [
  { id: "day_of_month_first_year", scope: "normal", category: "Generic dialogue", label: "<dayOfMonth>", template: "<dayOfMonth>", fields: [{ name: "day", type: "day" }], warning: "Wiki: 这个 key 只在第一年生效，通常更推荐 <dayOfMonth>_*。" },
  { id: "day_of_month_year", scope: "normal", category: "Generic dialogue", label: "<dayOfMonth>_<firstOrLaterYear>", template: "<dayOfMonth>_<year>", fields: [{ name: "day", type: "day" }, { name: "year", type: "select", options: "first_or_later_year" }] },
  { id: "day_of_month_any_year", scope: "normal", category: "Generic dialogue", label: "<dayOfMonth>_*", template: "<dayOfMonth>_*", fields: [{ name: "day", type: "day" }] },
  { id: "weekday_hearts_year", scope: "normal", category: "Generic dialogue", label: "<dayOfWeek><hearts>_<firstOrLaterYear>", template: "<dayOfWeek><hearts>_<year>", fields: [{ name: "weekday", type: "select", options: "days_of_week" }, { name: "hearts", type: "select", options: "generic_hearts" }, { name: "year", type: "select", options: "first_or_later_year" }] },
  { id: "weekday_hearts", scope: "normal", category: "Generic dialogue", label: "<dayOfWeek><hearts>", template: "<dayOfWeek><hearts>", fields: [{ name: "weekday", type: "select", options: "days_of_week" }, { name: "hearts", type: "select", options: "generic_hearts" }] },
  { id: "weekday_year", scope: "normal", category: "Generic dialogue", label: "<dayOfWeek>_<firstOrLaterYear>", template: "<dayOfWeek>_<year>", fields: [{ name: "weekday", type: "select", options: "days_of_week" }, { name: "year", type: "select", options: "first_or_later_year" }] },
  { id: "weekday", scope: "normal", category: "Generic dialogue", label: "<dayOfWeek>", template: "<dayOfWeek>", fields: [{ name: "weekday", type: "select", options: "days_of_week" }] },
  { id: "season_day", scope: "normal", category: "Generic dialogue", label: "<season>_<dayOfMonth>", template: "<season>_<dayOfMonth>", fields: [{ name: "season", type: "select", options: "seasons" }, { name: "day", type: "day" }] },
  { id: "season_weekday", scope: "normal", category: "Generic dialogue", label: "<season>_<dayOfWeek>", template: "<season>_<dayOfWeek>", fields: [{ name: "season", type: "select", options: "seasons" }, { name: "weekday", type: "select", options: "days_of_week" }] },
  { id: "season_weekday_hearts", scope: "normal", category: "Generic dialogue", label: "<season>_<dayOfWeek><hearts>", template: "<season>_<dayOfWeek><hearts>", fields: [{ name: "season", type: "select", options: "seasons" }, { name: "weekday", type: "select", options: "days_of_week" }, { name: "hearts", type: "select", options: "generic_hearts" }] },
  { id: "introduction", scope: "normal", category: "Special dialogue", label: "Introduction", template: "Introduction", fields: [] },
  { id: "divorced", scope: "normal", category: "Relationship special", label: "divorced", template: "divorced", fields: [] },
  { id: "breakup", scope: "normal", category: "Relationship special", label: "breakUp", template: "breakUp", fields: [] },
  { id: "dating_npc", scope: "normal", category: "Relationship special", label: "dating_<NPC>", template: "dating_<npc>", fields: [{ name: "npc", type: "npc" }] },
  { id: "married_npc", scope: "normal", category: "Relationship special", label: "married_<NPC>", template: "married_<npc>", fields: [{ name: "npc", type: "npc" }] },
  { id: "divorced_npc", scope: "normal", category: "Relationship special", label: "divorced_<NPC>", template: "divorced_<npc>", fields: [{ name: "npc", type: "npc" }] },
  { id: "gift_refusal", scope: "normal", category: "Gift / proposal", label: "送礼/求婚/拒绝 key", template: "<specialKey>", fields: [{ name: "specialKey", type: "select", options: "gift_refusals" }] },
  { id: "accept_gift_item", scope: "normal", category: "Gift / proposal", label: "AcceptGift_<itemId>", template: "AcceptGift_<itemId>", fields: [{ name: "itemId", type: "item" }] },
  { id: "accept_birthday_gift", scope: "normal", category: "Gift / proposal", label: "AcceptBirthdayGift_<reaction>", template: "AcceptBirthdayGift_<reaction>", fields: [{ name: "reaction", type: "select", options: "birthday_gift_reactions" }] },
  { id: "resort", scope: "normal", category: "Resort", label: "Resort variants", template: "<resortKey>", fields: [{ name: "resortKey", type: "select", options: "resort_keys" }] },
  { id: "green_rain", scope: "normal", category: "Green rain", label: "GreenRain variants", template: "<greenRainKey>", fields: [{ name: "greenRainKey", type: "select", options: "green_rain_keys" }] },
  { id: "event_seen", scope: "normal", category: "Event / memory", label: "eventSeen_<eventId>", template: "eventSeen_<eventId>", fields: [{ name: "eventId", type: "text" }] },
  { id: "memory", scope: "normal", category: "Event / memory", label: "<memoryKey>_memory_<duration>", template: "<memoryKey>_memory_<duration>", fields: [{ name: "memoryKey", type: "text" }, { name: "duration", type: "text" }] },
  { id: "location_tile", scope: "normal", category: "Location tile", label: "<location>_<x>_<y>", template: "<location>_<x>_<y>", fields: [{ name: "location", type: "text" }, { name: "x", type: "integer" }, { name: "y", type: "integer" }] },
  { id: "normal_custom", scope: "normal", category: "Custom", label: "自定义 Key", template: "<customKey>", fields: [{ name: "customKey", type: "text" }] },
  { id: "marriage_npc_suffix", scope: "marriage", category: "Spouse spaces / schedule", label: "patio/spouseRoom/funLeave/funReturn_<NPC>", template: "<scene>_<npc>", fields: [{ name: "scene", type: "select", options: "marriage_npc_suffix_keys" }, { name: "npc", type: "npc" }] },
  { id: "marriage_key", scope: "marriage", category: "Wiki marriage dialogue", label: "Wiki 婚后/室友真实 Key", template: "<key>", fields: [{ name: "key", type: "marriage_key" }] },
  { id: "marriage_season_npc", scope: "marriage", category: "Seasonal spouse dialogue", label: "<season>_<NPC>", template: "<season>_<npc>", fields: [{ name: "season", type: "select", options: "seasons" }, { name: "npc", type: "npc" }] },
  { id: "marriage_season_day", scope: "marriage", category: "Seasonal spouse dialogue", label: "<season>_<dayOfMonth>", template: "<season>_<dayOfMonth>", fields: [{ name: "season", type: "select", options: "seasons" }, { name: "day", type: "day" }] },
  { id: "marriage_custom", scope: "marriage", category: "Custom", label: "自定义婚后/室友 Key", template: "<customKey>", fields: [{ name: "customKey", type: "text" }] }
];

const FALLBACK_DIALOGUE_FIELD_OPTIONS: Record<string, RulesetOption[]> = {
  days_of_week: WEEKDAY_OPTIONS,
  seasons: [
    { label: "春 spring", value: "spring" },
    { label: "夏 summer", value: "summer" },
    { label: "秋 fall", value: "fall" },
    { label: "冬 winter", value: "winter" }
  ],
  first_or_later_year: [
    { label: "第一年 FirstYear", value: "1" },
    { label: "第二年及以后 LaterYear", value: "2" }
  ],
  generic_hearts: [
    { label: "1 心", value: 1 },
    { label: "2 心", value: 2 },
    { label: "3 心", value: 3 },
    { label: "4 心", value: 4 },
    { label: "5 心", value: 5 },
    { label: "6 心", value: 6 },
    { label: "7 心", value: 7 },
    { label: "8 心", value: 8 },
    { label: "9 心", value: 9 },
    { label: "10 心", value: 10 },
    { label: "11 心", value: 11 },
    { label: "12 心", value: 12 },
    { label: "13 心", value: 13 },
    { label: "14 心", value: 14 }
  ],
  birthday_gift_reactions: [
    { label: "正面 Positive", value: "Positive" },
    { label: "负面 Negative", value: "Negative" },
    { label: "中性 Neutral", value: "Neutral" }
  ],
  gift_refusals: [
    { label: "送花 A give_flowersA", value: "give_flowersA" },
    { label: "送花 B give_flowersB", value: "give_flowersB" },
    { label: "送美人鱼吊坠 give_pendant", value: "give_pendant" },
    { label: "拒绝 NPC A rejectNPCA", value: "rejectNPCA" },
    { label: "拒绝 NPC B rejectNPCB", value: "rejectNPCB" }
  ],
  resort_keys: [
    { label: "默认 Resort", value: "Resort" },
    { label: "进入 Resort_Entering", value: "Resort_Entering" },
    { label: "离开 Resort_Leaving", value: "Resort_Leaving" },
    { label: "海岸 Resort_Shore", value: "Resort_Shore" },
    { label: "椅子 Resort_Chair", value: "Resort_Chair" },
    { label: "酒吧 Resort_Bar", value: "Resort_Bar" }
  ],
  green_rain_keys: [
    { label: "绿雨 GreenRain", value: "GreenRain" },
    { label: "绿雨结束 GreenRainFinished", value: "GreenRainFinished" },
    { label: "第二年绿雨 GreenRain_2", value: "GreenRain_2" }
  ],
  marriage_npc_suffix_keys: [
    { label: "庭院 patio_<NPC>", value: "patio" },
    { label: "配偶房 spouseRoom_<NPC>", value: "spouseRoom" },
    { label: "出门 funLeave_<NPC>", value: "funLeave" },
    { label: "回家 funReturn_<NPC>", value: "funReturn" }
  ]
};

const FESTIVAL_DIALOGUE_TARGETS: RulesetOption[] = [
  { label: "春 13 复活节 spring13", value: "Data/Festivals/spring13" },
  { label: "春 24 花舞节 spring24", value: "Data/Festivals/spring24" },
  { label: "夏 11 夏威夷宴会 summer11", value: "Data/Festivals/summer11" },
  { label: "夏 28 月光水母 summer28", value: "Data/Festivals/summer28" },
  { label: "秋 16 星露谷展览会 fall16", value: "Data/Festivals/fall16" },
  { label: "秋 27 万灵节 fall27", value: "Data/Festivals/fall27" },
  { label: "冬 8 冰雪节 winter8", value: "Data/Festivals/winter8" },
  { label: "冬 25 冬星盛宴 winter25", value: "Data/Festivals/winter25" }
];

const MOVIE_RESPONSE_OPTIONS: RulesetOption[] = [
  { label: "最爱 love", value: "love" },
  { label: "喜欢 like", value: "like" },
  { label: "不喜欢 dislike", value: "dislike" }
];

const MOVIE_TAG_OPTIONS: RulesetOption[] = [
  { label: "全部电影 *", value: "*" },
  { label: "任意最爱电影 love", value: "love" },
  { label: "任意喜欢电影 like", value: "like" },
  { label: "任意不喜欢电影 dislike", value: "dislike" },
  { label: "春季电影 0 spring_movie_0", value: "spring_movie_0" },
  { label: "夏季电影 0 summer_movie_0", value: "summer_movie_0" },
  { label: "秋季电影 0 fall_movie_0", value: "fall_movie_0" },
  { label: "冬季电影 0 winter_movie_0", value: "winter_movie_0" },
  { label: "春季电影 1 spring_movie_1", value: "spring_movie_1" },
  { label: "夏季电影 1 summer_movie_1", value: "summer_movie_1" },
  { label: "秋季电影 1 fall_movie_1", value: "fall_movie_1" },
  { label: "冬季电影 1 winter_movie_1", value: "winter_movie_1" }
];

const MOVIE_RESPONSE_POINTS = [
  { key: "BeforeMovie", label: "观影前 BeforeMovie" },
  { key: "DuringMovie", label: "观影中 DuringMovie" },
  { key: "AfterMovie", label: "观影后 AfterMovie" }
];

const STORY_NODE_OPTIONS: RulesetOption[] = [
  { label: "角色说话 speak", value: "speak" },
  { label: "分段说话 splitSpeak", value: "splitSpeak" },
  { label: "角色气泡 textAboveHead", value: "textAboveHead" },
  { label: "等待 pause", value: "pause" },
  { label: "消息 message", value: "message" },
  { label: "提问 question", value: "question" },
  { label: "快速提问 quickQuestion", value: "quickQuestion" },
  { label: "分支 fork", value: "fork" },
  { label: "回答状态 questionAnswered", value: "questionAnswered" },
  { label: "移动 move", value: "move" },
  { label: "高级移动 advancedMove", value: "advancedMove" },
  { label: "位置偏移 positionOffset", value: "positionOffset" },
  { label: "传送 warp", value: "warp" },
  { label: "传送所有农夫 warpFarmers", value: "warpFarmers" },
  { label: "转向 faceDirection", value: "faceDirection" },
  { label: "表情 emote", value: "emote" },
  { label: "动画 animate", value: "animate" },
  { label: "显示帧 showFrame", value: "showFrame" },
  { label: "停止动画 stopAnimation", value: "stopAnimation" },
  { label: "震动 shake", value: "shake" },
  { label: "跳跃 jump", value: "jump" },
  { label: "播放音效 playSound", value: "playSound" },
  { label: "停止音效 stopSound", value: "stopSound" },
  { label: "播放音乐 playMusic", value: "playMusic" },
  { label: "停止音乐 stopMusic", value: "stopMusic" },
  { label: "全局淡出 globalFade", value: "globalFade" },
  { label: "全局淡入 globalFadeToClear", value: "globalFadeToClear" },
  { label: "淡入淡出 fade", value: "fade" },
  { label: "视角 viewport", value: "viewport" },
  { label: "邮件 mailReceived / mailToday", value: "mailReceived" },
  { label: "事件已看 eventSeen", value: "eventSeen" },
  { label: "获得物品 addItem", value: "addItem" },
  { label: "移除物品 removeItem", value: "removeItem" },
  { label: "放置物体 addObject", value: "addObject" },
  { label: "移除物体 removeObject", value: "removeObject" },
  { label: "移除临时图 removeSprite", value: "removeSprite" },
  { label: "临时演员 addTemporaryActor", value: "addTemporaryActor" },
  { label: "切换地点 changeLocation", value: "changeLocation" },
  { label: "改地图图块 changeMapTile", value: "changeMapTile" },
  { label: "切换头像 changePortrait", value: "changePortrait" },
  { label: "切换行走图 changeSprite", value: "changeSprite" },
  { label: "农夫吃东西 farmerEat", value: "farmerEat" },
  { label: "农夫动画 farmerAnimation", value: "farmerAnimation" },
  { label: "友情增减 friendship", value: "friendship" },
  { label: "金钱 money", value: "money" },
  { label: "结束 end", value: "end" },
  { label: "自定义命令", value: "custom" }
];

const STORY_PRECONDITION_OPTIONS: RulesetOption[] = [
  { label: "友情 Friendship", value: "Friendship" },
  { label: "时间 Time", value: "Time" },
  { label: "季节 Season", value: "Season" },
  { label: "星期 DayOfWeek", value: "DayOfWeek" },
  { label: "日期 DayOfMonth", value: "DayOfMonth" },
  { label: "天气 Weather", value: "Weather" },
  { label: "已看事件 SawEvent", value: "SawEvent" },
  { label: "本地邮件 LocalMail", value: "LocalMail" },
  { label: "主机邮件 HostMail", value: "HostMail" },
  { label: "游玩天数 DaysPlayed", value: "DaysPlayed" },
  { label: "主机玩家 IsHost", value: "IsHost" },
  { label: "GameStateQuery", value: "GameStateQuery" },
  { label: "原始片段 Raw", value: "Raw" }
];

const STORY_DIRECTION_OPTIONS: RulesetOption[] = [
  { label: "上 0", value: 0 },
  { label: "右 1", value: 1 },
  { label: "下 2", value: 2 },
  { label: "左 3", value: 3 }
];

const STORY_WEATHER_OPTIONS: RulesetOption[] = [
  { label: "晴天 sunny", value: "sunny" },
  { label: "雨天 rainy", value: "rainy" },
  { label: "绿雨 greenrain", value: "greenrain" },
  { label: "婚礼 wedding", value: "wedding" }
];

const STORY_EMOTE_OPTIONS: RulesetOption[] = [
  { label: "感叹 16", value: 16 },
  { label: "心 20", value: 20 },
  { label: "问号 8", value: 8 },
  { label: "生气 12", value: 12 },
  { label: "惊讶 28", value: 28 },
  { label: "音乐 32", value: 32 },
  { label: "睡觉 24", value: 24 }
];

const STORY_MAIL_COMMAND_OPTIONS: RulesetOption[] = [
  { label: "mailReceived（已收到）", value: "mailReceived" },
  { label: "mail（明天邮件）", value: "mail" },
  { label: "mailToday（今天邮件）", value: "mailToday" },
  { label: "addMailReceived（旧别名）", value: "addMailReceived" }
];

const STORY_END_OPTIONS: RulesetOption[] = [
  { label: "end", value: "end" },
  { label: "end warpOut", value: "warpOut" },
  { label: "end dialogue", value: "dialogue" },
  { label: "end dialogueWarpOut", value: "dialogueWarpOut" },
  { label: "end invisible", value: "invisible" },
  { label: "end newDay", value: "newDay" }
];

const STORY_TEMP_ACTOR_TYPE_OPTIONS: RulesetOption[] = [
  { label: "不指定", value: "" },
  { label: "Character", value: "Character" },
  { label: "Animal", value: "Animal" },
  { label: "Monster", value: "Monster" }
];

const STORY_MAP_LAYER_OPTIONS: RulesetOption[] = [
  { label: "Back", value: "Back" },
  { label: "Buildings", value: "Buildings" },
  { label: "Front", value: "Front" },
  { label: "AlwaysFront", value: "AlwaysFront" },
  { label: "Paths", value: "Paths" }
];

function marriageKeyOptions(npcName: string): RulesetOption[] {
  const npc = normalizeInternalName(npcName || "ExampleNPC");
  const options: RulesetOption[] = [];
  const addRange = (prefix: string, max: number) => {
    for (let index = 0; index <= max; index += 1) options.push({ label: `${prefix}_${index}`, value: `${prefix}_${index}` });
  };
  addRange("Rainy_Day", 4);
  addRange("Indoor_Day", 4);
  addRange("Rainy_Night", 5);
  options.push({ label: `Rainy_Night_${npc}`, value: `Rainy_Night_${npc}` });
  addRange("Indoor_Night", 4);
  options.push({ label: `Indoor_Night_${npc}`, value: `Indoor_Night_${npc}` });
  addRange("Outdoor", 4);
  options.push({ label: `Outdoor_${npc}`, value: `Outdoor_${npc}` });
  addRange("OneKid", 4);
  addRange("TwoKids", 4);
  addRange("NoBed", 3);
  addRange("Good", 9);
  addRange("Neutral", 9);
  addRange("Bad", 9);
  return options;
}

function gameDataLabel(kind: GameDataEntry["kind"], fallback = "") {
  const labels: Record<GameDataEntry["kind"], string> = {
    npc: "NPC / 角色",
    item: "物品 / 对象",
    dialogue: "对话",
    shop: "商店",
    event: "事件",
    mail: "信件",
    trigger_action: "触发动作",
    custom: "自定义"
  };
  return labels[kind] || fallback || kind;
}

function initialFlow(kind: FlowKind): WorkflowState {
  const flow: WorkflowState = {
    active: false,
    completed: false,
    kind,
    npcName: "ExampleNPC",
    displayName: "示例角色",
    gender: "Undefined",
    birthSeason: "spring",
    birthDay: 1,
    homeRegion: "Town",
    defaultMap: "Town",
    relationMode: "friend",
    needsCustomMap: false,
    itemId: "ExampleObject",
    itemName: "示例物品",
    itemCategory: -2,
    itemPrice: 100,
    locationId: "ExampleLocation",
    locationName: "示例地点",
    mapPath: "Maps/ExampleLocation",
    configuringAction: null,
    giftNpc: "Universal_Like",
    giftTasteGroup: "Like",
    shopId: "SeedShop",
    shopPrice: 100,
    mailQuantity: 1,
    warpFrom: "Town",
    warpX: 64,
    warpY: 15,
    dialogueKey: "Mon",
    dialogueText: "你好，@。#$b#今天也见到你真好。$h",
    dialogueKeyType: "weekday",
    dialogueSeason: "spring",
    dialogueWeekday: "Mon",
    dialogueDay: 1,
    dialogueHearts: 4,
    dialogueEventId: "100",
    dialogueItemId: "(O)388",
    dialogueMarriageScene: "Indoor_Day",
    dialogueI18nPrefix: "",
    portraitAssetPath: "",
    spriteAssetPath: "",
    scheduleKey: "spring",
    scheduleMap: "Town",
    scheduleX: 64,
    scheduleY: 15,
    mailText: "你好，@！^^我已经搬到山谷附近了。[#]欢迎信",
    eventLocation: "Town",
    eventFriendship: 2500,
    roommateItemPrice: 5000,
    editingEntryId: null,
    todos: [],
    createdEntryIds: []
  };
  return { ...flow, todos: buildTodos(flow) };
}

function buildTodos(flow: WorkflowState): FlowTodo[] {
  if (flow.kind === "item") {
    return [
      {
        id: "giftTasteForItem",
        label: "下一步：加入礼物喜好",
        description: "为这个物品创建 Data/NPCGiftTastes 追加待办，方便选择哪些 NPC 喜欢它。",
        action: "giftTasteForItem",
        done: false
      },
      {
        id: "shopForItem",
        label: "下一步：加入商店",
        description: "生成 Data/Shops 占位，把该物品作为出售项。",
        action: "shopForItem",
        done: false
      },
      {
        id: "mailForItem",
        label: "下一步：创建带附件邮件",
        description: "生成 Data/Mail，附带这个物品作为奖励。",
        action: "mailForItem",
        done: false
      }
    ];
  }
  if (flow.kind === "map") {
    return [
      {
        id: "mapLocation",
        label: "下一步：补充地点数据",
        description: "生成更完整的 Data/Locations 占位，后续可补鱼、采集物、音乐等。",
        action: "mapLocation",
        done: false
      },
      {
        id: "mapWarpTodo",
        label: "下一步：添加地图连接待办",
        description: "生成一个 EditData 占位记录需要补 warp、入口坐标和地图文件。",
        action: "mapWarpTodo",
        done: false
      },
      {
        id: "mapEventTodo",
        label: "下一步：创建地点事件",
        description: "生成 Data/Events/<Location> 的事件占位。",
        action: "mapEventTodo",
        done: false
      }
    ];
  }
  const todos: FlowTodo[] = [
    {
      id: "dialogue",
      label: "下一步：创建角色对话",
      description: "生成 Characters/Dialogue/<NPC> 的基础每日与雨天对话。",
      action: "dialogue",
      done: false
    },
    {
      id: "giftTaste",
      label: "下一步：创建礼物喜好",
      description: "生成 Data/NPCGiftTastes 条目，方便之后补最爱/喜欢/讨厌物品。",
      action: "giftTaste",
      done: false
    },
    {
      id: "schedule",
      label: "下一步：创建日程",
      description: "生成 Characters/schedules/<NPC> 的基础日程占位。",
      action: "schedule",
      done: false
    },
    {
      id: "mail",
      label: "下一步：创建欢迎邮件",
      description: "生成 Data/Mail 欢迎邮件，可后续附带物品或触发动作。",
      action: "mail",
      done: false
    },
    {
      id: "event",
      label: "下一步：创建好感事件",
      description: "生成 Data/Events/Town 的好感事件占位。",
      action: "event",
      done: false
    }
  ];
  if (flow.relationMode === "roommate") {
    todos.splice(2, 0, {
      id: "roommateItem",
      label: "下一步：创建室友提案物品",
      description: `自动写入 context tag：propose_roommate_${roommateTagName(flow.npcName || flow.displayName)}`,
      action: "roommateItem",
      done: false
    });
  }
  if (flow.needsCustomMap || flow.homeRegion === "Custom" || flow.defaultMap === "Custom") {
    todos.unshift({
      id: "customMap",
      label: "下一步：创建自定义地图待办",
      description: "生成 Data/Locations 占位，之后可补地图文件、warp 与地点规则。",
      action: "customMap",
      done: false
    });
  }
  return todos;
}

function createPrimaryItemEntry(flow: WorkflowState): GameDataEntry {
  const itemId = normalizeInternalName(flow.itemId || flow.itemName || "ExampleObject");
  const itemName = flow.itemName || itemId;
  return createWorkflowEntry("item", `${itemName} 物品`, "Data/Objects", itemId, {
    DisplayName: itemName,
    Description: `${itemName} 是通过流程模式创建的物品。`,
    Price: flow.itemPrice,
    Category: flow.itemCategory,
    Edibility: -300,
    ContextTags: []
  });
}

function createPrimaryMapEntry(flow: WorkflowState): GameDataEntry {
  const locationId = normalizeInternalName(flow.locationId || flow.locationName || "ExampleLocation");
  const locationName = flow.locationName || locationId;
  return createWorkflowEntry("custom", `${locationName} 地点`, "Data/Locations", locationId, {
    DisplayName: locationName,
    CreateOnLoad: {
      MapPath: flow.mapPath || `Maps/${locationId}`
    },
    CustomFields: {
      "StardewCPStudio.Todo": "补充地图素材、warp、地点规则。"
    }
  });
}

function createWorkflowResultForAction(action: FlowAction, flow: WorkflowState): WorkflowResult {
  if (action === "dialogue") return createDialogueWorkflowResult(flow);
  return { entries: createEntriesForFlowAction(action, flow), patches: [], i18n: {} };
}

function createDialogueWorkflowResult(flow: WorkflowState): WorkflowResult {
  const npcName = normalizeInternalName(flow.npcName || flow.displayName || "ExampleNPC");
  const displayName = flow.displayName || npcName;
  const format = dialogueFormatById(flow.dialogueKeyType);
  const isMarriage = isMarriageDialogueType(flow.dialogueKeyType);
  const key = buildDialogueKey(flow, npcName);
  const target = dialogueTargetForFlow(flow, npcName);
  const i18nKey = dialogueI18nKey(flow, npcName);
  const state: DialogueEntryState = {
    npcName,
    isMarriage,
    keyType: format.id,
    season: flow.dialogueSeason,
    weekday: flow.dialogueWeekday,
    day: flow.dialogueDay,
    hearts: flow.dialogueHearts,
    eventId: flow.dialogueEventId,
    itemId: flow.dialogueItemId,
    marriageScene: flow.dialogueMarriageScene,
    customKey: flow.dialogueKey,
    i18nPrefix: flow.dialogueI18nPrefix,
    fields: legacyDialogueFields(flow, format, npcName)
  };
  const entries = [
    withDialogueMetadata(createWorkflowEntry("dialogue", `${displayName} ???${key}`, target, key, i18nRef(i18nKey)), state, format, i18nKey)
  ];
  const patchTargets = [`Characters/Dialogue/${npcName}`];
  if (flow.relationMode === "romance" || flow.relationMode === "roommate" || isMarriage) {
    patchTargets.push(`Characters/Dialogue/MarriageDialogue${npcName}`);
  }
  return {
    entries,
    patches: uniqueIds(patchTargets).map((patchTarget) => createDialogueLoadPatch(patchTarget)),
    i18n: {
      [`Name.${npcName}`]: displayName,
      [i18nKey]: flow.dialogueText || defaultDialogueText(flow.dialogueKeyType)
    }
  };
}

function createEntriesForFlowAction(action: FlowAction, flow: WorkflowState): GameDataEntry[] {
  const npcName = normalizeInternalName(flow.npcName || flow.displayName || "ExampleNPC");
  const displayName = flow.displayName || npcName;
  const itemId = normalizeInternalName(flow.itemId || flow.itemName || "ExampleObject");
  const itemName = flow.itemName || itemId;
  const locationId = normalizeInternalName(flow.locationId || flow.locationName || "ExampleLocation");
  const locationName = flow.locationName || locationId;
  switch (action) {
    case "giftTaste":
      return [
        createWorkflowEntry("custom", `${displayName} 礼物喜好`, "Data/NPCGiftTastes", npcName, {
          Love: flow.giftTasteGroup === "Love" && flow.itemId ? [`(O)${normalizeInternalName(flow.itemId)}`] : [],
          Like: flow.giftTasteGroup === "Like" && flow.itemId ? [`(O)${normalizeInternalName(flow.itemId)}`] : [],
          Neutral: flow.giftTasteGroup === "Neutral" && flow.itemId ? [`(O)${normalizeInternalName(flow.itemId)}`] : [],
          Dislike: flow.giftTasteGroup === "Dislike" && flow.itemId ? [`(O)${normalizeInternalName(flow.itemId)}`] : [],
          Hate: flow.giftTasteGroup === "Hate" && flow.itemId ? [`(O)${normalizeInternalName(flow.itemId)}`] : [],
          Notes: "可在代码模式中继续调整为 TextOperations 或完整礼物喜好格式。"
        })
      ];
    case "schedule":
      return [
        createWorkflowEntry("custom", `${displayName} 基础日程`, `Characters/schedules/${npcName}`, flow.scheduleKey || "spring", `900 ${flow.scheduleMap || flow.defaultMap} ${flow.scheduleX} ${flow.scheduleY} 2/2200 ${flow.scheduleMap || flow.defaultMap} ${flow.scheduleX} ${flow.scheduleY} 2`)
      ];
    case "mail":
      return [
        createWorkflowEntry("custom", `${displayName} 欢迎邮件`, "Data/Mail", `${npcName}.Welcome`, flow.mailText || `你好，@！^^${displayName} 已经搬到山谷附近了。[#]来自 ${displayName} 的信`)
      ];
    case "event":
      return [
        createWorkflowEntry("event", `${displayName} 好感事件`, `Data/Events/${flow.eventLocation || "Town"}`, `${workflowEventId(npcName)}/f ${npcName} ${flow.eventFriendship || 2500}`, `pause 500/speak ${npcName} "谢谢你一直以来的照顾，@。"/end`)
      ];
    case "roommateItem":
      return [
        createWorkflowEntry("item", `${displayName} 室友提案物品`, "Data/Objects", `${npcName}RoommateProposal`, {
          DisplayName: `${displayName} 的室友信物`,
          Description: `送给 ${displayName}，提出成为室友。`,
          Price: flow.roommateItemPrice || 5000,
          Category: -2,
          Edibility: -300,
          ContextTags: [roommateContextTag(npcName)]
        })
      ];
    case "customMap":
      return [
        createWorkflowEntry("custom", `${displayName} 自定义地点占位`, "Data/Locations", `${npcName}Home`, {
          DisplayName: `${displayName}的住处`,
          CreateOnLoad: {
            MapPath: `Maps/${npcName}Home`
          },
          CustomFields: {
            "StardewCPStudio.Todo": "补充地图 TMX/TSX 素材、warp、NPC 日程坐标。"
          }
        })
      ];
    case "giftTasteForItem":
      return [
        createWorkflowEntry("custom", `${itemName} 礼物喜好待办`, "Data/NPCGiftTastes", flow.giftNpc || "Universal_Like", {
          TasteGroup: flow.giftTasteGroup,
          AddItems: [`(O)${itemId}`],
          Notes: "建议后续用 TextOperations 或精确字段编辑追加到喜欢/最爱分组。"
        })
      ];
    case "shopForItem":
      return [
        createWorkflowEntry("shop", `${itemName} 商店出售`, "Data/Shops", flow.shopId || "SeedShop", {
          Items: [
            {
              Id: itemId,
              ItemId: `(O)${itemId}`,
              Price: flow.shopPrice || flow.itemPrice,
              AvailableStock: -1
            }
          ]
        })
      ];
    case "mailForItem":
      return [
        createWorkflowEntry("custom", `${itemName} 附件邮件`, "Data/Mail", `${itemId}.RewardMail`, `这是你要的 ${itemName}。^^%item object ${itemId} ${flow.mailQuantity || 1}[#]${itemName}`)
      ];
    case "mapLocation":
      return [
        createPrimaryMapEntry(flow)
      ];
    case "mapWarpTodo":
      return [
        createWorkflowEntry("custom", `${locationName} 地图连接待办`, "Data/Locations", `${locationId}.WarpTodo`, {
          TargetLocation: locationId,
          FromLocation: flow.warpFrom,
          FromTile: {
            X: flow.warpX,
            Y: flow.warpY
          },
          MapPath: flow.mapPath || `Maps/${locationId}`,
          Todo: "补充入口地图、warp 坐标、返回点和 EditMap 补丁。"
        })
      ];
    case "mapEventTodo":
      return [
        createWorkflowEntry("event", `${locationName} 地点事件`, `Data/Events/${locationId}`, `${workflowEventId(locationId)}`, `pause 500/speak Lewis "这里就是 ${locationName}。"/end`)
      ];
    default:
      return [];
  }
}

function createWorkflowEntry(kind: GameDataEntry["kind"], name: string, target: string, key: string, value: unknown): GameDataEntry {
  return {
    id: makeId(),
    kind,
    name,
    target,
    key,
    value,
    when: {},
    advanced: {},
    editMode: "form"
  };
}

function createDialogueLoadPatch(target: string): Patch {
  return {
    id: makeId(),
    name: `初始化 ${target}`,
    action: "Load",
    enabled: true,
    target,
    from_file: "assets/blank.json",
    when: {},
    fields: {},
    advanced: {}
  };
}

function createCharacterAssetLoadPatches(project: Project, npcName: string, flow: WorkflowState): Patch[] {
  const patches: Patch[] = [];
  if (flow.portraitAssetPath) {
    patches.push({
      id: makeId(),
      name: `加载 ${npcName} 头像`,
      action: "Load",
      enabled: true,
      target: `Portraits/${npcName}`,
      from_file: flow.portraitAssetPath,
      when: {},
      fields: {},
      advanced: {}
    });
  }
  if (flow.spriteAssetPath) {
    patches.push({
      id: makeId(),
      name: `加载 ${npcName} 行走图`,
      action: "Load",
      enabled: true,
      target: characterAssetGamePath(project, flow.spriteAssetPath, `CharacterFiles/OverworldSprites/${npcName}/${npcName}`),
      from_file: flow.spriteAssetPath,
      when: {},
      fields: {},
      advanced: {}
    });
  }
  return patches;
}

function mergeWorkflowEntries(existing: GameDataEntry[], nextEntries: GameDataEntry[]) {
  let merged = [...existing];
  for (const next of nextEntries) {
    const index = merged.findIndex((entry) => entry.target === next.target && entry.key === next.key);
    merged = index >= 0 ? replaceAt(merged, index, { ...next, id: merged[index].id }) : [...merged, next];
  }
  return merged;
}

function mergedEntryId(project: Project, nextEntry: GameDataEntry) {
  return project.game_data.find((entry) => entry.target === nextEntry.target && entry.key === nextEntry.key)?.id || nextEntry.id;
}

function mergeWorkflowPatches(existing: Patch[], nextPatches: Patch[]) {
  let merged = [...existing];
  for (const next of nextPatches) {
    const index = merged.findIndex((patch) => patch.action === next.action && patch.target === next.target && patch.from_file === next.from_file);
    merged = index >= 0 ? replaceAt(merged, index, { ...next, id: merged[index].id, enabled: merged[index].enabled }) : [...merged, next];
  }
  return merged;
}

function gameDataTemplate(kind: GameDataEntry["kind"]) {
  switch (kind) {
    case "npc":
      return {
        target: "Data/Characters",
        key: "ExampleNPC",
        value: {
          DisplayName: "示例角色",
          BirthSeason: "spring",
          BirthDay: 1,
          HomeRegion: "Town",
          Language: "Default",
          Gender: "Undefined",
          Age: "Adult",
          Manner: "Neutral",
          SocialAnxiety: "Neutral",
          Optimism: "Neutral",
          IsDarkSkinned: false,
          CanBeRomanced: false,
          LoveInterest: "",
          Calendar: "HiddenUntilMet",
          SocialTab: "HiddenUntilMet",
          SpouseAdopts: false,
          SpouseWantsChildren: false,
          CanSocialize: true,
          CanReceiveGifts: true,
          CanGreetNearbyCharacters: false,
          CanVisitIsland: null,
          CanCommentOnPurchasedShopItems: false,
          ExcludeFromIntroductionsQuest: false,
          ExcludeFromPerfectionScore: false,
          EndSlideShow: "MainGroup",
          FriendsAndFamily: {},
          DumpsterDiveFriendshipEffect: 0,
          FlowerDanceCanDance: false,
          WinterStarParticipant: true,
          WinterStarGifts: [],
          UnlockConditions: null,
          SpawnIfMissing: true,
          Appearance: [],
          Home: [],
          DefaultMap: "Town",
          TextureName: "Characters/ExampleNPC",
          Size: {
            X: 16,
            Y: 32
          },
          CustomFields: {}
        }
      };
    case "item":
      return {
        target: "Data/Objects",
        key: "ExampleObject",
        value: {
          DisplayName: "示例物品",
          Description: "这是一个由 Stardew CP Studio 生成的示例物品。",
          Price: 100,
          Category: -2,
          Edibility: -300
        }
      };
    case "dialogue":
      return {
        target: "Characters/Dialogue/ExampleNPC",
        key: "Mon",
        value: "你好，@。这是一个示例对话。"
      };
    case "shop":
      return {
        target: "Data/Shops",
        key: "ExampleShop",
        value: {
          DisplayName: "示例商店",
          Items: [
            {
              Id: "ExampleObject",
              ItemId: "ExampleObject",
              Price: 100
            }
          ]
        }
      };
    case "event":
      return {
        target: "Data/Events/Town",
        key: "999999/f ExampleNPC 2500",
        value: "pause 500/speak ExampleNPC \"这是一个示例事件。\"/end"
      };
    case "mail":
      return {
        target: "Data/Mail",
        key: "ExampleMail",
        value: "你好，@！^^这是一封示例信件。[#]来自 Stardew CP Studio"
      };
    case "trigger_action":
      return {
        target: "Data/TriggerActions",
        key: "ExampleTriggerAction",
        value: {
          Id: "ExampleTriggerAction",
          Trigger: "Manual",
          Actions: ["AddMail ExampleMail"],
          HostOnly: false
        }
      };
    default:
      return {
        target: "Data/Objects",
        key: "ExampleKey",
        value: {}
      };
  }
}

function gameDataPatchPreview(entry: GameDataEntry) {
  const storyEntries = storyEntriesForPreview(entry);
  const mailValue = entry.kind === "mail" ? mailStringFromEntry(entry) : null;
  const patch: JsonDict = {
    Action: "EditData",
    Target: entry.target,
    Entries: storyEntries || {
      [entry.key || "ExampleKey"]: entry.kind === "mail" ? mailValue || entry.value : entry.value
    }
  };
  if (Object.keys(entry.when).length) patch.When = entry.when;
  return { ...patch, ...publicAdvanced(entry.advanced) };
}

function storyEntriesForPreview(entry: GameDataEntry) {
  if (entry.kind !== "event") return null;
  const namespace = isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  const story = isObject(namespace.storyEvent) ? namespace.storyEvent as JsonDict : null;
  if (!story) return null;
  const entries: Record<string, unknown> = {};
  if (entry.key) entries[entry.key] = entry.value;
  const branches = Array.isArray(story.branches) ? story.branches as StoryEventBranch[] : [];
  for (const branch of branches) {
    if (branch.key) entries[branch.key] = buildStoryBranchScript(branch);
  }
  return Object.keys(entries).length ? entries : null;
}

function gameDataFromPatchPreview(entry: GameDataEntry, value: unknown): GameDataEntry {
  if (!isObject(value)) return entry;
  const entries = isObject(value.Entries) ? value.Entries : {};
  const firstKey = Object.keys(entries)[0] || entry.key;
  const nextValue = firstKey ? entries[firstKey] : entry.value;
  return {
    ...entry,
    target: typeof value.Target === "string" ? value.Target : entry.target,
    key: firstKey,
    value: nextValue,
    when: isObject(value.When) ? value.When : entry.when,
    advanced: mergePublicAdvanced(entry.advanced, Object.fromEntries(
      Object.entries(value).filter(([key]) => !["Action", "Target", "Entries", "When"].includes(key))
    ))
  };
}

function isObject(value: unknown): value is JsonDict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function numberOrText(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && value.trim() !== "" ? numberValue : value;
}

function compactObject(value: JsonDict) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function defaultStoryEventMeta(project: Project): StoryEventMeta {
  const baseId = project.manifest.UniqueID ? `${project.manifest.UniqueID}.Event1` : "ExampleMod.Event1";
  return {
    location: "Town",
    eventId: baseId,
    music: "continue",
    viewportX: -1000,
    viewportY: -1000,
    actors: [
      { actor: "farmer", x: -500, y: -500, direction: 2 },
      { actor: "ExampleNPC", x: 64, y: 15, direction: 2 }
    ],
    preconditions: [],
    nodes: [
      defaultStoryNode("pause", { eventId: baseId, i18nPrefix: baseId }, makeId(), 0),
      defaultStoryNode("speak", { eventId: baseId, i18nPrefix: baseId }, makeId(), 1),
      defaultStoryNode("end", { eventId: baseId, i18nPrefix: baseId }, makeId(), 2)
    ],
    branches: [],
    i18nPrefix: baseId
  };
}

function storyMetaFromEntry(project: Project, entry: GameDataEntry): StoryEventMeta {
  const namespace = isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  const stored = isObject(namespace.storyEvent) ? namespace.storyEvent as JsonDict : {};
  const locationFromTarget = (entry.target || "Data/Events/Town").replace(/^Data\/Events\//i, "") || "Town";
  const fallback = defaultStoryEventMeta(project);
  const [eventId, ...rawPreconditions] = (entry.key || fallback.eventId).split("/");
  return {
    location: typeof stored.location === "string" ? stored.location : locationFromTarget,
    eventId: typeof stored.eventId === "string" ? stored.eventId : eventId || fallback.eventId,
    music: typeof stored.music === "string" ? stored.music : inferStoryStart(entry).music,
    viewportX: Number(stored.viewportX ?? inferStoryStart(entry).viewportX ?? fallback.viewportX),
    viewportY: Number(stored.viewportY ?? inferStoryStart(entry).viewportY ?? fallback.viewportY),
    actors: Array.isArray(stored.actors) ? stored.actors as StoryEventMeta["actors"] : inferStoryStart(entry).actors,
    preconditions: Array.isArray(stored.preconditions) ? stored.preconditions as EventPrecondition[] : rawPreconditions.filter(Boolean).map((raw) => ({ id: makeId(), type: "Raw", data: { raw } })),
    nodes: Array.isArray(stored.nodes) ? stored.nodes as StoryEventNode[] : [{ id: makeId(), kind: "custom", label: "旧脚本", data: { raw: stripStoryStart(typeof entry.value === "string" ? entry.value : "") } }],
    branches: Array.isArray(stored.branches) ? stored.branches as StoryEventBranch[] : [],
    i18nPrefix: typeof stored.i18nPrefix === "string" ? stored.i18nPrefix : `${project.manifest.UniqueID || "ExampleMod"}.${sanitizeI18nPart(eventId || fallback.eventId)}`
  };
}

function storyEntryFromMeta(entry: GameDataEntry, meta: StoryEventMeta): GameDataEntry {
  return {
    ...entry,
    kind: "event",
    target: `Data/Events/${meta.location || "Town"}`,
    key: buildStoryEventKey(meta),
    value: buildStoryEventScript(meta),
    advanced: {
      ...entry.advanced,
      StardewCPStudio: {
        ...(isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {}),
        storyEvent: meta
      }
    }
  };
}

function storyI18nDefaults(meta: Pick<StoryEventMeta, "eventId" | "i18nPrefix" | "nodes">) {
  const entries: Record<string, string> = {};
  for (const node of meta.nodes) {
    const key = typeof node.data.i18nKey === "string" ? node.data.i18nKey : "";
    const text = typeof node.data.text === "string" ? node.data.text : "";
    if (key && text) entries[key] = text;
  }
  return entries;
}

function defaultStoryBranch(meta: StoryEventMeta, keyOverride?: string, labelOverride?: string): StoryEventBranch {
  const key = keyOverride || `${meta.eventId || "ExampleEvent"}_Branch${meta.branches.length + 1}`;
  const branchMeta = { eventId: key, i18nPrefix: `${meta.i18nPrefix}.${sanitizeI18nPart(key)}` };
  return {
    id: makeId(),
    key,
    label: labelOverride || "新分支",
    nodes: [
      defaultStoryNode("pause", branchMeta, makeId(), 0),
      defaultStoryNode("message", branchMeta, makeId(), 1),
      defaultStoryNode("end", branchMeta, makeId(), 2)
    ]
  };
}

function defaultStoryNode(kind: EventNodeKind, meta: Pick<StoryEventMeta, "eventId" | "i18nPrefix">, id = makeId(), index = 0): StoryEventNode {
  const i18nKey = storyNodeI18nKey(meta, { id, kind, label: "", data: {} });
  const defaults: Record<EventNodeKind, JsonDict> = {
    pause: { duration: 500 },
    speak: { actor: "ExampleNPC", i18nKey, text: "你好，@。#$b#这是一个剧情节点。$h" },
    splitSpeak: { actor: "ExampleNPC", i18nKey, text: "第一段台词。#$b#第二段台词。" },
    textAboveHead: { actor: "ExampleNPC", i18nKey, text: "你好，{{PlayerName}}。" },
    message: { i18nKey, text: "剧情消息。" },
    question: { forkId: "fork0", i18nKey, text: "你要怎么回答？#选项 1#选项 2", answers: [{ id: "fork0", text: "选项 1", branchKey: "" }, { id: "fork1", text: "选项 2", branchKey: "" }] },
    quickQuestion: { i18nKey, text: "你要怎么回答？#选项一#选项二(break)message \"{{i18n:Example.Answer1}}\"(break)message \"{{i18n:Example.Answer2}}\"" },
    fork: { requirement: "fork0", eventId: `${meta.eventId || "ExampleEvent"}_Branch` },
    questionAnswered: { answerId: "event_answer", answered: true },
    move: { actor: "farmer", x: 0, y: 1, direction: 2, continue: false },
    advancedMove: { actor: "ExampleNPC", loop: false, path: "0 3 2 0 0 2 -2 0 0 -2 2 0" },
    positionOffset: { actor: "ExampleNPC", x: 0, y: 0, continue: false },
    warp: { actor: "farmer", x: 64, y: 15 },
    warpFarmers: { placements: "64 15 2", defaultOffset: 0, defaultX: 64, defaultY: 15, direction: 2 },
    faceDirection: { actor: "ExampleNPC", direction: 2, continue: false },
    emote: { actor: "ExampleNPC", emote: 16 },
    animate: { actor: "ExampleNPC", flip: false, loop: true, frameDuration: 120, frames: "0 1 2" },
    showFrame: { actor: "ExampleNPC", frame: 0 },
    stopAnimation: { actor: "ExampleNPC" },
    shake: { actor: "ExampleNPC", duration: 1000 },
    jump: { actor: "ExampleNPC", intensity: 8 },
    playSound: { sound: "doorClose" },
    stopSound: { sound: "doorClose", immediate: true },
    playMusic: { music: "continue" },
    stopMusic: {},
    globalFade: { speed: "", continue: false },
    globalFadeToClear: { speed: "", continue: false },
    fade: { unfade: false },
    viewport: { x: -1000, y: -1000 },
    mail: { command: "mailReceived", mailId: "ExampleMail" },
    eventSeen: { eventId: meta.eventId || "ExampleEvent", seen: true },
    addItem: { itemId: "(O)388", count: 1, quality: 0 },
    removeItem: { itemId: "(O)388", count: 1 },
    addObject: { x: 64, y: 15, itemId: "(O)388", layerDepth: "" },
    removeObject: { x: 64, y: 15 },
    removeSprite: { x: 64, y: 15 },
    addTemporaryActor: { spriteAssetName: "Ghost", spriteWidth: 16, spriteHeight: 32, x: 64, y: 15, direction: 2, breather: "", actorType: "", overrideName: "" },
    changeLocation: { location: "Farm" },
    changeMapTile: { layer: "Buildings", x: 64, y: 15, tileIndex: 0 },
    changePortrait: { npc: "ExampleNPC", portrait: "" },
    changeSprite: { actor: "ExampleNPC", sprite: "" },
    farmerEat: { objectId: "200" },
    farmerAnimation: { animation: "drink" },
    friendship: { npc: "ExampleNPC", amount: 250 },
    money: { amount: 100 },
    end: { mode: "end", actor: "ExampleNPC", i18nKey, text: "今天的事，之后再聊吧。$h" },
    custom: { raw: "-- custom command" }
  };
  return { id, kind, label: storyNodeLabel(kind), data: defaults[kind], position: { x: 210 + index * 150, y: 92 + (index % 2) * 70 } };
}

function updateStoryNodePosition(nodes: StoryEventNode[], nodeId: string, position: { x: number; y: number }) {
  return nodes.map((node) => node.id === nodeId ? { ...node, position } : node);
}

function defaultStoryPrecondition(type: string): EventPrecondition {
  const defaults: Record<string, JsonDict> = {
    Friendship: { npc: "ExampleNPC", points: 2500 },
    Time: { min: 600, max: 1100 },
    Season: { season: "spring" },
    DayOfWeek: { day: "Tue" },
    DayOfMonth: { day: 1 },
    Weather: { weather: "sunny" },
    SawEvent: { eventId: "100" },
    LocalMail: { mailId: "ExampleMail" },
    HostMail: { mailId: "ExampleMail" },
    DaysPlayed: { days: 1 },
    IsHost: {},
    GameStateQuery: { query: "SEASON Spring" },
    Raw: { raw: "H" }
  };
  return { id: makeId(), type, data: defaults[type] || { raw: "" }, negated: false };
}

function storyNodeLabel(kind: EventNodeKind) {
  const option = STORY_NODE_OPTIONS.find((item) => item.value === kind);
  return option ? String(option.label).split(" ")[0] : kind;
}

function storyBranchOptions(branches: StoryEventBranch[]): RulesetOption[] {
  const options = branches.map((branch) => ({ label: `${branch.label || "分支"} - ${branch.key}`, value: branch.key }));
  return options.length ? options : [{ label: "暂无分支，请先创建", value: "" }];
}

function storyQuestionAnswers(node: StoryEventNode): StoryQuestionAnswer[] {
  const answers = Array.isArray(node.data?.answers) ? node.data.answers : [];
  return answers
    .filter((answer): answer is JsonDict => isObject(answer))
    .map((answer, index) => ({
      id: stringField(answer.id) || `fork${index}`,
      text: stringField(answer.text) || `选项 ${index + 1}`,
      branchKey: stringField(answer.branchKey)
    }));
}

function storyQuestionPrompt(text: string) {
  return text.split("#")[0] || "你要怎么回答？";
}

function buildStoryQuestionText(prompt: string, answers: StoryQuestionAnswer[]) {
  const labels = answers.map((answer) => answer.text || answer.id).filter(Boolean);
  return [prompt || "你要怎么回答？", ...labels].join("#");
}

function textKeyForStoryNode(meta: Pick<StoryEventMeta, "eventId" | "i18nPrefix">, node: StoryEventNode) {
  return stringField(node.data.i18nKey) || storyNodeI18nKey(meta, node);
}

function buildStoryEventKey(meta: StoryEventMeta) {
  const eventId = meta.eventId || "ExampleEvent";
  const preconditions = meta.preconditions.map(buildStoryPrecondition).filter(Boolean);
  return `${eventId}/${preconditions.join("/")}`;
}

function buildStoryPrecondition(condition: EventPrecondition) {
  const data = condition.data || {};
  let text = "";
  switch (condition.type) {
    case "Friendship":
      text = `Friendship ${data.npc || "ExampleNPC"} ${data.points || 2500}`;
      break;
    case "Time":
      text = `Time ${data.min || 600} ${data.max || 2600}`;
      break;
    case "Season":
      text = `Season ${data.season || "spring"}`;
      break;
    case "DayOfWeek":
      text = `DayOfWeek ${data.day || "Tue"}`;
      break;
    case "DayOfMonth":
      text = `DayOfMonth ${data.day || 1}`;
      break;
    case "Weather":
      text = `Weather ${data.weather || "sunny"}`;
      break;
    case "SawEvent":
      text = `SawEvent ${data.eventId || "100"}`;
      break;
    case "LocalMail":
      text = `LocalMail ${data.mailId || "ExampleMail"}`;
      break;
    case "HostMail":
      text = `HostMail ${data.mailId || "ExampleMail"}`;
      break;
    case "DaysPlayed":
      text = `DaysPlayed ${data.days || 1}`;
      break;
    case "IsHost":
      text = "IsHost";
      break;
    case "GameStateQuery":
      text = `GameStateQuery ${quoteEventArg(String(data.query || "SEASON Spring"))}`;
      break;
    case "Raw":
      text = String(data.raw || "");
      break;
  }
  if (!text) return "";
  return condition.negated && !text.startsWith("!") ? `!${text}` : text;
}

function buildStoryEventScript(meta: StoryEventMeta) {
  const start = [
    meta.music || "continue",
    `${integerInRange(meta.viewportX, -10000, 10000, -1000)} ${integerInRange(meta.viewportY, -10000, 10000, -1000)}`,
    buildStoryActors(meta.actors)
  ];
  const commands = meta.nodes.map((node) => buildStoryCommand(node, meta)).filter(Boolean);
  return [...start, ...commands].join("/");
}

function buildStoryBranchScript(branch: StoryEventBranch) {
  return branch.nodes.map((node) => buildStoryCommand(node, { eventId: branch.key, i18nPrefix: branch.key })).filter(Boolean).join("/");
}

function buildStoryActors(actors: StoryEventMeta["actors"]) {
  const safeActors = actors.length ? actors : [{ actor: "farmer", x: -500, y: -500, direction: 2 }];
  return safeActors.map((actor) => `${actor.actor || "farmer"} ${integerInRange(actor.x, -10000, 10000, 0)} ${integerInRange(actor.y, -10000, 10000, 0)} ${integerInRange(actor.direction, 0, 3, 2)}`).join(" ");
}

function buildStoryCommand(node: StoryEventNode, meta: Pick<StoryEventMeta, "eventId" | "i18nPrefix">) {
  const data = node.data || {};
  const textRef = `{{i18n:${stringField(data.i18nKey) || storyNodeI18nKey(meta, node)}}}`;
  switch (node.kind) {
    case "pause":
      return `pause ${integerInRange(data.duration, 0, 600000, 500)}`;
    case "speak":
      return `speak ${data.actor || "ExampleNPC"} ${quoteEventArg(textRef)}`;
    case "splitSpeak":
      return `splitSpeak ${data.actor || "ExampleNPC"} ${quoteEventArg(textRef)}`;
    case "textAboveHead":
      return `textAboveHead ${data.actor || "ExampleNPC"} ${quoteEventArg(textRef)}`;
    case "message":
      return `message ${quoteEventArg(textRef)}`;
    case "question":
      return `question ${data.forkId || "fork0"} ${quoteEventArg(textRef)}`;
    case "quickQuestion":
      return `quickQuestion ${quoteEventArg(textRef)}`;
    case "fork":
      return data.requirement
        ? `fork ${data.requirement} ${data.eventId || `${meta.eventId}_Branch`}`
        : `fork ${data.eventId || `${meta.eventId}_Branch`}`;
    case "questionAnswered":
      return `questionAnswered ${data.answerId || "event_answer"}${data.answered === false ? " false" : ""}`;
    case "move":
      return `move ${data.actor || "farmer"} ${integerInRange(data.x, -999, 999, 0)} ${integerInRange(data.y, -999, 999, 1)} ${integerInRange(data.direction, 0, 3, 2)}${data.continue ? " true" : ""}`;
    case "advancedMove":
      return `advancedMove ${data.actor || "ExampleNPC"} ${Boolean(data.loop)} ${stringField(data.path) || "0 3 2 0"}`;
    case "positionOffset":
      return `positionOffset ${data.actor || "ExampleNPC"} ${integerInRange(data.x, -999, 999, 0)} ${integerInRange(data.y, -999, 999, 0)}${data.continue ? " true" : ""}`;
    case "warp":
      return `warp ${data.actor || "farmer"} ${integerInRange(data.x, -10000, 10000, 0)} ${integerInRange(data.y, -10000, 10000, 0)}`;
    case "warpFarmers":
      return `warpFarmers ${stringField(data.placements) || "64 15 2"} ${integerInRange(data.defaultOffset, -999, 999, 0)} ${integerInRange(data.defaultX, -10000, 10000, 64)} ${integerInRange(data.defaultY, -10000, 10000, 15)} ${integerInRange(data.direction, 0, 3, 2)}`;
    case "faceDirection":
      return `faceDirection ${data.actor || "ExampleNPC"} ${integerInRange(data.direction, 0, 3, 2)}${data.continue ? " true" : ""}`;
    case "emote":
      return `emote ${data.actor || "ExampleNPC"} ${integerInRange(data.emote, 0, 99, 16)}`;
    case "animate":
      return `animate ${data.actor || "ExampleNPC"} ${Boolean(data.flip)} ${data.loop !== false} ${integerInRange(data.frameDuration, 1, 600000, 120)} ${stringField(data.frames) || "0 1 2"}`;
    case "showFrame":
      return `showFrame ${data.actor || "ExampleNPC"} ${integerInRange(data.frame, 0, 9999, 0)}${data.flip ? " true" : ""}`;
    case "stopAnimation":
      return `stopAnimation ${data.actor || "ExampleNPC"}`;
    case "shake":
      return `shake ${data.actor || "ExampleNPC"} ${integerInRange(data.duration, 0, 600000, 1000)}`;
    case "jump":
      return `jump ${data.actor || "ExampleNPC"} ${integerInRange(data.intensity, 0, 9999, 8)}`;
    case "playSound":
      return `playSound ${data.sound || "doorClose"}`;
    case "stopSound":
      return `stopSound ${data.sound || "doorClose"}${data.immediate === false ? " false" : ""}`;
    case "playMusic":
      return `playMusic ${data.music || "continue"}`;
    case "stopMusic":
      return "stopMusic";
    case "globalFade":
      return `globalFade${data.speed ? ` ${data.speed}` : ""}${data.continue ? " true" : ""}`;
    case "globalFadeToClear":
      return `globalFadeToClear${data.speed ? ` ${data.speed}` : ""}${data.continue ? " true" : ""}`;
    case "fade":
      return data.unfade ? "fade unfade" : "fade";
    case "viewport":
      return `viewport ${integerInRange(data.x, -10000, 10000, -1000)} ${integerInRange(data.y, -10000, 10000, -1000)}`;
    case "mail":
      return `${data.command === "addMailReceived" ? "mailReceived" : data.command || "mailReceived"} ${data.mailId || "ExampleMail"}`;
    case "eventSeen":
      return `eventSeen ${data.eventId || meta.eventId || "ExampleEvent"}${data.seen === false ? " false" : ""}`;
    case "addItem":
      return `addItem ${data.itemId || "(O)388"} ${integerInRange(data.count, 1, 999, 1)} ${integerInRange(data.quality, 0, 4, 0)}`;
    case "removeItem":
      return `removeItem ${data.itemId || "(O)388"} ${integerInRange(data.count, 1, 999, 1)}`;
    case "addObject":
      return `addObject ${integerInRange(data.x, -10000, 10000, 64)} ${integerInRange(data.y, -10000, 10000, 15)} ${data.itemId || "(O)388"}${data.layerDepth ? ` ${data.layerDepth}` : ""}`;
    case "removeObject":
      return `removeObject ${integerInRange(data.x, -10000, 10000, 64)} ${integerInRange(data.y, -10000, 10000, 15)}`;
    case "removeSprite":
      return `removeSprite ${integerInRange(data.x, -10000, 10000, 64)} ${integerInRange(data.y, -10000, 10000, 15)}`;
    case "addTemporaryActor": {
      const parts = [
        "addTemporaryActor",
        quoteEventArg(String(data.spriteAssetName || "Ghost")),
        String(integerInRange(data.spriteWidth, 1, 9999, 16)),
        String(integerInRange(data.spriteHeight, 1, 9999, 32)),
        String(integerInRange(data.x, -10000, 10000, 64)),
        String(integerInRange(data.y, -10000, 10000, 15)),
        String(integerInRange(data.direction, 0, 3, 2))
      ];
      if (data.breather !== "" && data.breather !== undefined) parts.push(String(data.breather));
      if (data.actorType) parts.push(String(data.actorType));
      if (data.overrideName) parts.push(quoteEventArg(String(data.overrideName)));
      return parts.join(" ");
    }
    case "changeLocation":
      return `changeLocation ${data.location || "Farm"}`;
    case "changeMapTile":
      return `changeMapTile ${data.layer || "Buildings"} ${integerInRange(data.x, -10000, 10000, 64)} ${integerInRange(data.y, -10000, 10000, 15)} ${integerInRange(data.tileIndex, -1, 999999, 0)}`;
    case "changePortrait":
      return `changePortrait ${data.npc || "ExampleNPC"}${data.portrait ? ` ${data.portrait}` : ""}`;
    case "changeSprite":
      return `changeSprite ${data.actor || "ExampleNPC"}${data.sprite ? ` ${data.sprite}` : ""}`;
    case "farmerEat":
      return `farmerEat ${data.objectId || "200"}`;
    case "farmerAnimation":
      return `farmerAnimation ${data.animation || "drink"}`;
    case "friendship":
      return `friendship ${data.npc || "ExampleNPC"} ${integerInRange(data.amount, -5000, 5000, 250)}`;
    case "money":
      return `money ${integerInRange(data.amount, -9999999, 9999999, 100)}`;
    case "end":
      if (data.mode === "warpOut") return "end warpOut";
      if (data.mode === "newDay") return "end newDay";
      if (data.mode === "invisible") return `end invisible ${data.actor || "ExampleNPC"}`;
      if (data.mode === "dialogue") return `end dialogue ${data.actor || "ExampleNPC"} ${quoteEventArg(textRef)}`;
      if (data.mode === "dialogueWarpOut") return `end dialogueWarpOut ${data.actor || "ExampleNPC"} ${quoteEventArg(textRef)}`;
      return "end";
    case "custom":
      return String(data.raw || "").trim();
    default:
      return "";
  }
}

function storyNodeI18nKey(meta: Pick<StoryEventMeta, "eventId" | "i18nPrefix">, node: Pick<StoryEventNode, "id" | "kind">) {
  return `${sanitizeI18nPart(meta.i18nPrefix || meta.eventId || "Event")}.${node.kind}.${sanitizeI18nPart(node.id).slice(0, 8)}`;
}

function quoteEventArg(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function inferStoryStart(entry: GameDataEntry): Pick<StoryEventMeta, "music" | "viewportX" | "viewportY" | "actors"> {
  const parts = typeof entry.value === "string" ? entry.value.split("/") : [];
  const viewport = (parts[1] || "-1000 -1000").split(/\s+/);
  return {
    music: parts[0] || "continue",
    viewportX: Number(viewport[0] || -1000),
    viewportY: Number(viewport[1] || -1000),
    actors: parseStoryActors(parts[2] || "farmer -500 -500 2")
  };
}

function parseStoryActors(value: string): StoryEventMeta["actors"] {
  const tokens = value.split(/\s+/).filter(Boolean);
  const actors: StoryEventMeta["actors"] = [];
  for (let index = 0; index + 3 < tokens.length; index += 4) {
    actors.push({
      actor: tokens[index],
      x: Number(tokens[index + 1]) || 0,
      y: Number(tokens[index + 2]) || 0,
      direction: Number(tokens[index + 3]) || 2
    });
  }
  return actors.length ? actors : [{ actor: "farmer", x: -500, y: -500, direction: 2 }];
}

function stripStoryStart(script: string) {
  return script.split("/").slice(3).join("/") || script;
}

const COMMON_LOCATION_OPTIONS: RulesetOption[] = [
  "Town", "Farm", "FarmHouse", "BusStop", "Mountain", "Forest", "Beach", "SeedShop", "Saloon", "ScienceHouse", "Hospital", "CommunityCenter", "JojaMart", "Blacksmith", "ManorHouse", "ArchaeologyHouse", "AnimalShop", "Carpenter", "AdventureGuild", "Railroad", "Desert", "IslandSouth", "IslandWest", "IslandNorth", "IslandEast"
].map((value) => ({ label: value, value }));

function mapLocationOptions(project: Project): RulesetOption[] {
  const values = new Set<string>(COMMON_LOCATION_OPTIONS.map((option) => String(option.value)));
  for (const entry of project.game_data) {
    if (entry.target === "Data/Locations" && entry.key && !entry.key.endsWith(".WarpTodo")) values.add(entry.key);
    if (entry.target === "Data/Locations" && isObject(entry.value) && typeof entry.value.TargetLocation === "string") values.add(entry.value.TargetLocation);
  }
  for (const patch of project.patches) {
    const match = patch.target.match(/^Maps\/(.+)$/);
    if (match?.[1]) values.add(match[1]);
  }
  return [...values].map((value) => ({ label: value, value }));
}

function itemSelectionOptions(project: Project, ruleset: Ruleset, catalog: ItemCatalogResponse, mode: "gift" | "qualified" = "gift"): ItemOption[] {
  const options: ItemOption[] = [];
  const seen = new Set<string>();
  const add = (value: string | number, label: string, source: string) => {
    const key = String(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push({ label, value, source });
  };

  for (const item of catalog.items) {
    const value = mode === "qualified" ? item.qualified_id : item.id;
    const labelName = item.display_name || item.name || "未命名物品";
    const englishName = item.name && item.name !== labelName ? ` / ${item.name}` : "";
    const category = item.category !== undefined && item.category !== null ? ` / ${item.category}` : "";
    add(value, `${labelName} ${value}${englishName}${category}`, "vanilla");
  }

  for (const entry of project.game_data) {
    if (entry.target !== "Data/Objects" || !entry.key) continue;
    const objectValue = isObject(entry.value) ? entry.value : {};
    const displayName = stringField(objectValue.DisplayName || objectValue.Name || entry.name || entry.key);
    const itemId = mode === "qualified" && !entry.key.startsWith("(") ? `(O)${entry.key}` : entry.key;
    add(itemId, `${itemId} - ${displayName}（项目）`, "project");
  }

  if (mode === "gift") {
    for (const category of rulesetOptions(ruleset, "object_categories")) {
      add(typeof category.value === "boolean" ? String(category.value) : category.value, `${category.value} - ${category.label}`, "category");
    }
  }

  return options;
}

function groupedItemOptions(options: ItemOption[]) {
  const groups = [
    { key: "vanilla", label: "原版物品", options: [] as ItemOption[] },
    { key: "project", label: "项目新物品", options: [] as ItemOption[] },
    { key: "category", label: "物品类别", options: [] as ItemOption[] },
    { key: "custom", label: "自定义/其他", options: [] as ItemOption[] }
  ];
  const byKey = Object.fromEntries(groups.map((group) => [group.key, group]));
  for (const option of options) {
    const key = option.source && byKey[option.source] ? option.source : "custom";
    byKey[key].options.push(option);
  }
  return groups.filter((group) => group.options.length);
}

function itemLabel(value: string, options: ItemOption[]) {
  const option = options.find((item) => String(item.value) === value);
  return option ? String(option.label) : `${value}（自定义）`;
}

function arrayOfStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function defaultGiftTasteState(displayName = "这个角色"): GiftTasteState {
  return {
    Love: { text: `这是送给我的吗？谢谢你，@。$1`, items: [] },
    Like: { text: "给我吗？谢谢，我会收好的。$0", items: [] },
    Dislike: { text: "谢谢，但下次送给其他人吧。$5", items: [] },
    Hate: { text: "如果你需要处理掉它的话，可以去找垃圾桶。$8", items: [] },
    Neutral: { text: `嗯，谢谢。$0`, items: [] }
  };
}

function giftTasteFromValue(value: unknown, displayName = "这个角色"): GiftTasteState {
  const state = defaultGiftTasteState(displayName);
  if (typeof value === "string") {
    const parts = value.split("/");
    const order: GiftTasteGroupId[] = ["Love", "Like", "Dislike", "Hate", "Neutral"];
    order.forEach((group, index) => {
      const text = parts[index * 2];
      const items = parts[index * 2 + 1];
      if (text !== undefined) state[group].text = text;
      if (items !== undefined) state[group].items = splitSpaceList(items);
    });
    return state;
  }
  if (isObject(value)) {
    for (const group of GIFT_TASTE_GROUPS) {
      const raw = value[group.id];
      if (Array.isArray(raw)) state[group.id].items = raw.map(String).filter(Boolean);
      if (isObject(raw)) {
        state[group.id].text = stringField(raw.Text || raw.text || state[group.id].text);
        state[group.id].items = arrayOfStrings(raw.Items || raw.items);
      }
    }
  }
  return state;
}

function giftTasteToString(state: GiftTasteState) {
  const order: GiftTasteGroupId[] = ["Love", "Like", "Dislike", "Hate", "Neutral"];
  return `${order.map((group) => `${state[group].text || ""}/${state[group].items.join(" ")}`).join("/")}/`;
}

function splitSpaceList(value: string) {
  return value.split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function withGiftTasteMetadata(entry: GameDataEntry, state: GiftTasteState): GameDataEntry {
  const existingStudio = isObject(entry.advanced.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  return {
    ...entry,
    advanced: {
      ...entry.advanced,
      StardewCPStudio: {
        ...existingStudio,
        giftTaste: state
      }
    }
  };
}

function defaultMovieReactionValue(npcName: string): JsonDict {
  return {
    NPCName: npcName,
    Reactions: [
      normalizeMovieReaction({}, npcName, 0)
    ]
  };
}

function movieReactionValue(value: unknown, npcName: string): JsonDict {
  return isObject(value) ? { NPCName: npcName, ...value } : defaultMovieReactionValue(npcName);
}

function movieReactionRows(value: unknown, npcName: string): JsonDict[] {
  return Array.isArray(value) ? value.filter(isObject).map((item, index) => normalizeMovieReaction(item, npcName, index)) : [];
}

function normalizeMovieReaction(value: JsonDict, npcName: string, index: number): JsonDict {
  return {
    Tag: stringField(value.Tag || MOVIE_TAG_OPTIONS[Math.min(index, MOVIE_TAG_OPTIONS.length - 1)]?.value || "spring_movie_0"),
    Response: movieResponseValue(value.Response),
    Whitelist: arrayOfStrings(value.Whitelist),
    SpecialResponses: movieSpecialResponses(value.SpecialResponses),
    ID: stringField(value.ID || `${normalizeInternalName(npcName).toLowerCase()}_reaction_${index}`)
  };
}

function movieResponseValue(value: unknown): MovieResponse {
  return value === "love" || value === "dislike" ? value : "like";
}

function movieSpecialResponses(value: unknown): JsonDict {
  const source = isObject(value) ? value : {};
  return {
    BeforeMovie: movieResponsePoint(source.BeforeMovie),
    DuringMovie: movieResponsePoint(source.DuringMovie),
    AfterMovie: movieResponsePoint(source.AfterMovie)
  };
}

function movieResponsePoint(value: unknown): JsonDict {
  const source = isObject(value) ? value : {};
  return {
    ResponsePoint: source.ResponsePoint ?? null,
    Script: stringField(source.Script),
    Text: stringField(source.Text)
  };
}

function withMovieReactionMetadata(entry: GameDataEntry, npcName: string): GameDataEntry {
  const existingStudio = isObject(entry.advanced.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  return {
    ...entry,
    advanced: {
      ...entry.advanced,
      StardewCPStudio: {
        ...existingStudio,
        npcModule: {
          npcName,
          module: "movieReaction"
        }
      }
    }
  };
}

function createSpecialDialogueEntry(npcName: string, displayName: string, kind: SpecialDialogueKind, existingEntries: GameDataEntry[] = []): GameDataEntry {
  const existing = new Set(existingEntries.map((entry) => `${entry.target}::${entry.key}`));
  const target = nextSpecialDialogueTarget(kind, npcName, existing);
  const key = nextSpecialDialogueKey(kind, npcName, target, existing);
  const i18nKey = specialDialogueI18nKey(npcName, kind, target, key);
  const entry = createWorkflowEntry("custom", specialDialogueName(displayName, kind, target, key), target, key, i18nRef(i18nKey));
  return withSpecialDialogueMetadata({
    ...entry,
    advanced: kind === "engagement" ? { Priority: "Late" } : {}
  }, kind, npcName);
}

function nextSpecialDialogueTarget(kind: SpecialDialogueKind, npcName: string, existing: Set<string>) {
  if (kind === "engagement") return "Data/EngagementDialogue";
  if (kind === "rain") return "Characters/Dialogue/rain";
  return String(FESTIVAL_DIALOGUE_TARGETS.find((target) => !existing.has(`${target.value}::${npcName}`))?.value || FESTIVAL_DIALOGUE_TARGETS[0].value);
}

function nextSpecialDialogueKey(kind: SpecialDialogueKind, npcName: string, target: string, existing: Set<string>) {
  if (kind === "engagement") {
    const keys = [`${npcName}0`, `${npcName}1`];
    return keys.find((key) => !existing.has(`${target}::${key}`)) || keys[0];
  }
  return npcName;
}

function withSpecialDialogueMetadata(entry: GameDataEntry, kind: SpecialDialogueKind, npcName: string): GameDataEntry {
  const existingStudio = isObject(entry.advanced.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  return {
    ...entry,
    advanced: {
      ...entry.advanced,
      StardewCPStudio: {
        ...existingStudio,
        specialDialogue: {
          kind,
          npcName
        }
      }
    }
  };
}

function isSpecialDialogueEntry(entry: GameDataEntry, npcName: string) {
  const meta = specialDialogueMetadata(entry);
  if (!meta.valid) return false;
  if (meta.npcName !== npcName) return false;
  return meta.kind === "engagement" || meta.kind === "rain" || meta.kind === "festival";
}

function specialDialogueMetadata(entry: GameDataEntry): { kind: SpecialDialogueKind; npcName: string; valid: boolean } {
  const studio = isObject(entry.advanced.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  const stored = isObject(studio.specialDialogue) ? studio.specialDialogue as JsonDict : {};
  const kind = stored.kind === "engagement" || stored.kind === "rain" || stored.kind === "festival"
    ? stored.kind
    : inferSpecialDialogueKind(entry);
  return {
    kind,
    npcName: stringField(stored.npcName || inferSpecialDialogueNpcName(entry, kind)),
    valid: isSpecialDialogueTarget(entry.target)
  };
}

function inferSpecialDialogueKind(entry: GameDataEntry): SpecialDialogueKind {
  if (entry.target === "Data/EngagementDialogue") return "engagement";
  if (entry.target === "Characters/Dialogue/rain") return "rain";
  return "festival";
}

function isSpecialDialogueTarget(target: string) {
  return target === "Data/EngagementDialogue"
    || target === "Characters/Dialogue/rain"
    || FESTIVAL_DIALOGUE_TARGETS.some((item) => item.value === target);
}

function inferSpecialDialogueNpcName(entry: GameDataEntry, kind: SpecialDialogueKind) {
  if (kind === "engagement") return entry.key.replace(/[01]$/, "") || "ExampleNPC";
  return entry.key || "ExampleNPC";
}

function engagementIndexFromKey(key: string, npcName: string) {
  return key === `${npcName}1` ? 1 : 0;
}

function specialDialogueI18nKey(npcName: string, kind: SpecialDialogueKind, target: string, key: string) {
  const suffix = kind === "festival" ? target.replace("Data/Festivals/", "") : key;
  return `${sanitizeI18nPart(npcName)}.SpecialDialogue.${kind}.${sanitizeI18nPart(suffix)}`;
}

function specialDialogueName(npcOrDisplayName: string, kind: SpecialDialogueKind, target: string, key: string) {
  if (kind === "engagement") return dialogueEntryTitle(npcOrDisplayName, "邀请后对话", key);
  if (kind === "rain") return dialogueEntryTitle(npcOrDisplayName, "特殊雨天对话", key);
  return dialogueEntryTitle(npcOrDisplayName, "节日对话", target.replace("Data/Festivals/", ""));
}

function specialDialogueTitle(entry: GameDataEntry) {
  const meta = specialDialogueMetadata(entry);
  return specialDialogueName(meta.npcName, meta.kind, entry.target, entry.key);
}

function textFromSpecialDialogue(entry: GameDataEntry, i18n: Record<string, string>) {
  const key = extractI18nKey(entry.value);
  if (key) return i18n[key] || "";
  return typeof entry.value === "string" ? entry.value : "";
}

function defaultSpecialDialogueText(kind: SpecialDialogueKind) {
  if (kind === "engagement") return "你愿意邀请我一起生活吗？#$b#我会认真考虑的。$h";
  if (kind === "rain") return "下雨天总让山谷安静下来。$s";
  return "节日里见到你真好，@。$h";
}

function dialogueEntryTitle(displayName: string, label: string, key: string) {
  return `${displayName} ${label}：${key}`;
}

function createWinterStarGift(id: string, itemId: string | null = null, randomItemId: string[] | null = null): JsonDict {
  return {
    Condition: null,
    Id: id,
    ItemId: itemId,
    RandomItemId: randomItemId,
    MaxItems: null,
    MinStack: 1,
    MaxStack: -1,
    Quality: -1,
    ObjectInternalName: null,
    ObjectDisplayName: null,
    ToolUpgradeLevel: -1,
    IsRecipe: false,
    StackModifiers: null,
    StackModifierMode: "Stack",
    QualityModifiers: null,
    QualityModifierMode: "Stack",
    ModData: null,
    PerItemCondition: null
  };
}

function normalizeWinterStarGift(value: JsonDict): JsonDict {
  const randomItems = arrayOfStrings(value.RandomItemId);
  const hasRandom = randomItems.length > 0;
  const itemId = hasRandom ? null : setNullableText(stringField(value.ItemId ?? ""));
  const merged = {
    ...createWinterStarGift(stringField(value.Id || "WinterStarGift"), itemId, hasRandom ? randomItems : null),
    ...value
  };
  return {
    ...merged,
    ItemId: itemId,
    RandomItemId: hasRandom ? randomItems : null,
    Condition: merged.Condition === undefined ? null : merged.Condition,
    MaxItems: merged.MaxItems === undefined ? null : merged.MaxItems,
    MinStack: merged.MinStack === undefined ? 1 : merged.MinStack,
    MaxStack: merged.MaxStack === undefined ? -1 : merged.MaxStack,
    Quality: merged.Quality === undefined ? -1 : merged.Quality,
    ObjectInternalName: merged.ObjectInternalName === undefined ? null : merged.ObjectInternalName,
    ObjectDisplayName: merged.ObjectDisplayName === undefined ? null : merged.ObjectDisplayName,
    ToolUpgradeLevel: merged.ToolUpgradeLevel === undefined ? -1 : merged.ToolUpgradeLevel,
    IsRecipe: Boolean(merged.IsRecipe),
    StackModifiers: merged.StackModifiers === undefined ? null : merged.StackModifiers,
    StackModifierMode: merged.StackModifierMode || "Stack",
    QualityModifiers: merged.QualityModifiers === undefined ? null : merged.QualityModifiers,
    QualityModifierMode: merged.QualityModifierMode || "Stack",
    ModData: merged.ModData === undefined ? null : merged.ModData,
    PerItemCondition: merged.PerItemCondition === undefined ? null : merged.PerItemCondition
  };
}

function findNpcPortraitAsset(project: Project, npcName: string) {
  const normalized = normalizeInternalName(npcName || "ExampleNPC");
  const prefix = `assets/CharacterFiles/Portraits/${normalized}/`;
  const candidates = project.assets.filter((asset) => asset.stored_path.startsWith(prefix) && asset.content_type.startsWith("image/"));
  return candidates[candidates.length - 1] || null;
}

function nextDialogueKey(project: Project, target: string, candidates: string[]) {
  const used = new Set(project.game_data.filter((entry) => entry.kind === "dialogue" && entry.target === target).map((entry) => entry.key));
  return candidates.find((key) => !used.has(key)) || `${candidates[0] || "CustomDialogue"}_${used.size}`;
}

function spouseRoomTarget(project: Project, npcName: string) {
  const uniqueId = project.manifest.UniqueID || "Author.Mod";
  return `Mods/${uniqueId}/Custom_${normalizeInternalName(npcName)}SpouseRoom`;
}

function roommateItemTextureTarget(project: Project, npcName: string) {
  const uniqueId = project.manifest.UniqueID || "Author.Mod";
  return `Mods/${uniqueId}/${normalizeInternalName(npcName)}InvitationLetter`;
}

function isInternalAdvancedKey(key: string) {
  return key === "StardewCPStudio" || key.startsWith("StardewCPStudio.");
}

function publicAdvanced(advanced: JsonDict = {}) {
  return Object.fromEntries(Object.entries(advanced).filter(([key]) => !isInternalAdvancedKey(key)));
}

function internalAdvanced(advanced: JsonDict = {}) {
  return Object.fromEntries(Object.entries(advanced).filter(([key]) => isInternalAdvancedKey(key)));
}

function mergePublicAdvanced(previous: JsonDict = {}, nextPublic: JsonDict = {}) {
  return { ...nextPublic, ...internalAdvanced(previous) };
}

function isNpcManagedEntry(entry: GameDataEntry) {
  const studio = isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  return isObject(studio.npcModule) || isObject(studio.specialDialogue) || (entry.kind === "dialogue" && isObject(studio.dialogue));
}

function rulesetOptions(ruleset: Ruleset, key: string): RulesetOption[] {
  const value = ruleset.field_schemas?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is RulesetOption => isObject(item) && "label" in item && "value" in item) as RulesetOption[];
}

function triggerEventOptions(ruleset: Ruleset) {
  const options = rulesetOptions(ruleset, "trigger_types");
  return options.length ? options : FALLBACK_TRIGGER_EVENT_OPTIONS;
}

function whenConditionSchemas(ruleset: Ruleset): WhenConditionSchema[] {
  const value = ruleset.field_schemas?.when_conditions;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is WhenConditionSchema => isObject(item) && typeof item.key === "string" && typeof item.label === "string") as WhenConditionSchema[];
}

function defaultWhenValue(ruleset: Ruleset, schema?: WhenConditionSchema) {
  if (!schema) return "";
  if (schema.valueType === "number") return 1;
  if (schema.valueType === "relationship") return "Abigail | Hearts: 4";
  if (schema.valueType === "select" && schema.options) return rulesetOptions(ruleset, schema.options)[0]?.value ?? "";
  return "";
}

function dialogueKeyBuilderCatalog(ruleset?: Ruleset): DialogueKeyBuilderCatalog {
  const catalog = ruleset?.field_schemas?.dialogue_key_builder;
  return isObject(catalog) ? catalog as DialogueKeyBuilderCatalog : {};
}

function dialogueFormats(ruleset?: Ruleset): DialogueFormat[] {
  const formats = dialogueKeyBuilderCatalog(ruleset).formats;
  return Array.isArray(formats) && formats.length ? formats : FALLBACK_DIALOGUE_FORMATS;
}

function dialogueFieldOptions(ruleset: Ruleset | undefined, key?: string): RulesetOption[] {
  if (!key) return [];
  const fromCatalog = dialogueKeyBuilderCatalog(ruleset).field_options?.[key];
  if (Array.isArray(fromCatalog)) return fromCatalog;
  if (ruleset) {
    const fromRuleset = rulesetOptions(ruleset, key);
    if (fromRuleset.length) return fromRuleset;
  }
  return FALLBACK_DIALOGUE_FIELD_OPTIONS[key] || [];
}

function dialogueFormatById(type: DialogueKeyType, ruleset?: Ruleset) {
  return dialogueFormats(ruleset).find((format) => format.id === type) || dialogueFormats(ruleset)[0] || FALLBACK_DIALOGUE_FORMATS[0];
}

function dialogueFormatsByScope(ruleset: Ruleset | undefined, scope: "normal" | "marriage") {
  return dialogueFormats(ruleset).filter((format) => format.scope === scope);
}

function groupedDialogueFormats(ruleset: Ruleset | undefined, scope: "normal" | "marriage") {
  return dialogueFormatsByScope(ruleset, scope).reduce<Record<string, DialogueFormat[]>>((groups, format) => {
    const group = format.category || "Other";
    groups[group] = [...(groups[group] || []), format];
    return groups;
  }, {});
}

function defaultDialogueFields(format: DialogueFormat, npcName: string): Record<string, string | number> {
  const fields: Record<string, string | number> = {};
  for (const field of format.fields || []) {
    if (field.name === "npc") fields[field.name] = npcName;
    else if (field.name === "day") fields[field.name] = 1;
    else if (field.name === "index") fields[field.name] = 0;
    else if (field.name === "eventId") fields[field.name] = "100";
    else if (field.name === "itemId") fields[field.name] = "(O)388";
    else if (field.name === "location") fields[field.name] = "Town";
    else if (field.name === "x" || field.name === "y") fields[field.name] = 0;
    else if (field.name === "customKey") fields[field.name] = format.scope === "marriage" ? "CustomMarriageDialogue" : "CustomDialogue";
    else if (field.name === "key") fields[field.name] = format.scope === "marriage" ? "Indoor_Day_0" : "Mon";
    else if (field.name === "memoryKey") fields[field.name] = `dating_${npcName}`;
    else if (field.name === "duration") fields[field.name] = "oneweek";
    else fields[field.name] = defaultDialogueOptionValue(field) ?? "";
  }
  return fields;
}

function defaultDialogueOptionValue(field: DialogueFormatField) {
  const options = FALLBACK_DIALOGUE_FIELD_OPTIONS[field.options || ""] || [];
  const value = options[0]?.value;
  return typeof value === "boolean" ? String(value) : value;
}

function normalizeDialogueFields(format: DialogueFormat, fields: Record<string, string | number> | undefined, npcName: string) {
  const defaults = defaultDialogueFields(format, npcName);
  return { ...defaults, ...(fields || {}) };
}

function buildDialogueKey(flow: WorkflowState, npcName: string, ruleset?: Ruleset) {
  const format = dialogueFormatById(flow.dialogueKeyType, ruleset);
  const legacyFields = legacyDialogueFields(flow, format, npcName);
  return buildDialogueKeyForFormat(format, legacyFields, npcName);
}

function buildDialogueKeyFromParts(state: DialogueEntryState, npcName: string, ruleset?: Ruleset) {
  const format = dialogueFormatById(state.keyType, ruleset);
  const fields = normalizeDialogueFields(format, state.fields, npcName);
  return buildDialogueKeyForFormat(format, fields, npcName);
}

function buildDialogueKeyForFormat(format: DialogueFormat, fields: Record<string, string | number>, npcName: string) {
  let key = format.template || "<customKey>";
  const get = (name: string) => String(fields[name] ?? "");
  key = key.replace(/<dayOfMonth>/g, String(clampDay(get("day") || "1")));
  key = key.replace(/<dayOfWeek>/g, get("weekday") || "Mon");
  key = key.replace(/<hearts>/g, String(validGenericHearts(fields.hearts)));
  key = key.replace(/<year>/g, get("year") || "1");
  key = key.replace(/<season>/g, get("season") || "spring");
  key = key.replace(/<npc>/g, normalizeInternalName(get("npc") || npcName));
  key = key.replace(/<itemId>/g, get("itemId") || "(O)388");
  key = key.replace(/<reaction>/g, get("reaction") || "Positive");
  key = key.replace(/<specialKey>/g, get("specialKey") || "give_flowersA");
  key = key.replace(/<resortKey>/g, get("resortKey") || "Resort");
  key = key.replace(/<greenRainKey>/g, get("greenRainKey") || "GreenRain");
  key = key.replace(/<eventId>/g, get("eventId") || "100");
  key = key.replace(/<memoryKey>/g, get("memoryKey") || `dating_${npcName}`);
  key = key.replace(/<duration>/g, get("duration") || "oneweek");
  key = key.replace(/<location>/g, get("location") || "Town");
  key = key.replace(/<x>/g, String(integerInRange(fields.x, 0, 999, 0)));
  key = key.replace(/<y>/g, String(integerInRange(fields.y, 0, 999, 0)));
  key = key.replace(/<scene>/g, get("scene") || "Indoor_Day");
  key = key.replace(/<family>/g, get("family") || "OneKid");
  key = key.replace(/<index>/g, String(integerInRange(fields.index, 0, 99, 0)));
  key = key.replace(/<key>/g, get("key") || (format.scope === "marriage" ? "Indoor_Day_0" : "Mon"));
  key = key.replace(/<customKey>/g, get("customKey") || (format.scope === "marriage" ? "CustomMarriageDialogue" : "CustomDialogue"));
  return key || "Mon";
}

function legacyDialogueFields(flow: WorkflowState, format: DialogueFormat, npcName: string) {
  const fields = defaultDialogueFields(format, npcName);
  fields.season = flow.dialogueSeason || fields.season || "spring";
  fields.weekday = flow.dialogueWeekday || fields.weekday || "Mon";
  fields.day = flow.dialogueDay || fields.day || 1;
  fields.hearts = validGenericHearts(flow.dialogueHearts || fields.hearts || 4);
  fields.eventId = flow.dialogueEventId || fields.eventId || "100";
  fields.itemId = flow.dialogueItemId || fields.itemId || "(O)388";
  fields.customKey = flow.dialogueKey || fields.customKey || "CustomDialogue";
  fields.npc = npcName;
  if (format.id === "marriage_key") fields.key = flow.dialogueMarriageScene || fields.key || "Indoor_Day_0";
  return fields;
}

function workflowDialogueFieldValue(flow: WorkflowState, fieldName: string, format: DialogueFormat, npcName: string) {
  return legacyDialogueFields(flow, format, npcName)[fieldName] ?? "";
}

function workflowDialogueFieldPatch(format: DialogueFormat, fieldName: string, value: string | number): Partial<WorkflowState> {
  const patch: Partial<WorkflowState> = {};
  if (fieldName === "season") patch.dialogueSeason = String(value);
  if (fieldName === "weekday") patch.dialogueWeekday = String(value);
  if (fieldName === "day") patch.dialogueDay = Number(value) || 1;
  if (fieldName === "hearts") patch.dialogueHearts = validGenericHearts(value);
  if (fieldName === "eventId") patch.dialogueEventId = String(value);
  if (fieldName === "itemId") patch.dialogueItemId = String(value);
  if (fieldName === "customKey") patch.dialogueKey = String(value);
  if (fieldName === "scene" || fieldName === "family") patch.dialogueMarriageScene = String(value);
  if (!Object.keys(patch).length) {
    patch.dialogueKey = buildDialogueKeyForFormat(format, { [fieldName]: value }, "ExampleNPC");
  }
  return patch;
}

function dialogueFormStateFromEntry(entry: GameDataEntry): DialogueEntryState {
  const target = entry.target || "Characters/Dialogue/ExampleNPC";
  const marriageMatch = target.match(/MarriageDialogue([^/]+)$/i);
  const normalMatch = target.match(/Characters\/Dialogue\/([^/]+)$/i);
  const npcName = normalizeInternalName(marriageMatch?.[1] || normalMatch?.[1] || "ExampleNPC");
  const stored = dialogueMetadata(entry);
  const inferred = inferDialogueKeyState(entry.key || "Mon", Boolean(marriageMatch));
  const keyType = typeof stored?.formatId === "string" ? stored.formatId : inferred.keyType;
  return {
    npcName,
    isMarriage: Boolean(marriageMatch),
    keyType,
    season: String(inferred.fields.season || "spring"),
    weekday: String(inferred.fields.weekday || "Mon"),
    day: Number(inferred.fields.day || 1),
    hearts: Number(inferred.fields.hearts || 4),
    eventId: String(inferred.fields.eventId || "100"),
    itemId: String(inferred.fields.itemId || "(O)388"),
    marriageScene: String(inferred.fields.scene || "Indoor_Day"),
    customKey: String(inferred.fields.customKey || entry.key || "CustomDialogue"),
    i18nPrefix: typeof stored?.i18nPrefix === "string" ? stored.i18nPrefix : extractI18nKeyPrefix(entry.value, npcName),
    fields: isObject(stored?.fields) ? stored.fields as Record<string, string | number> : inferred.fields
  };
}

function dialogueMetadata(entry: GameDataEntry) {
  const namespace = isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  return isObject(namespace.dialogue) ? namespace.dialogue as JsonDict : null;
}

function extractI18nKey(value: unknown) {
  if (typeof value !== "string") return "";
  const match = value.match(/^\{\{i18n:([^}]+)\}\}$/);
  return match?.[1] || "";
}

function extractI18nKeyPrefix(value: unknown, fallback: string) {
  const key = extractI18nKey(value);
  if (!key) return "";
  const parts = key.split(".");
  const markerIndex = parts.findIndex((part) => part === "CharacterDialogue" || part === "MarriageDialogue");
  return markerIndex > 0 ? parts.slice(0, markerIndex).join(".") : fallback;
}

function inferDialogueKeyState(key: string, isMarriage = false): { keyType: DialogueKeyType; fields: Record<string, string | number> } {
  const base: Record<string, string | number> = { season: "spring", weekday: "Mon", day: 1, hearts: 4, year: "1", eventId: "100", itemId: "(O)388", customKey: key, index: 0, scene: "Indoor_Day" };
  const weekdayHeartYear = key.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(2|4|6|8|10)_([12])$/);
  if (!isMarriage && weekdayHeartYear) return { keyType: "weekday_hearts_year", fields: { ...base, weekday: weekdayHeartYear[1], hearts: Number(weekdayHeartYear[2]), year: weekdayHeartYear[3] } };
  const weekdayHeart = key.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(2|4|6|8|10)$/);
  if (!isMarriage && weekdayHeart) return { keyType: "weekday_hearts", fields: { ...base, weekday: weekdayHeart[1], hearts: Number(weekdayHeart[2]) } };
  const weekdayYear = key.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)_([12])$/);
  if (!isMarriage && weekdayYear) return { keyType: "weekday_year", fields: { ...base, weekday: weekdayYear[1], year: weekdayYear[2] } };
  if (!isMarriage && WEEKDAY_OPTIONS.some((option) => option.value === key)) return { keyType: "weekday", fields: { ...base, weekday: key } };
  const dayAny = key.match(/^([0-9]{1,2})_\*$/);
  if (!isMarriage && dayAny) return { keyType: "day_of_month_any_year", fields: { ...base, day: clampDay(dayAny[1]) } };
  const dayYear = key.match(/^([0-9]{1,2})_([12])$/);
  if (!isMarriage && dayYear) return { keyType: "day_of_month_year", fields: { ...base, day: clampDay(dayYear[1]), year: dayYear[2] } };
  const dayFirst = key.match(/^([0-9]{1,2})$/);
  if (!isMarriage && dayFirst) return { keyType: "day_of_month_first_year", fields: { ...base, day: clampDay(dayFirst[1]) } };
  const seasonWeekdayHeart = key.match(/^(spring|summer|fall|winter)_(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(2|4|6|8|10)$/);
  if (!isMarriage && seasonWeekdayHeart) return { keyType: "season_weekday_hearts", fields: { ...base, season: seasonWeekdayHeart[1], weekday: seasonWeekdayHeart[2], hearts: Number(seasonWeekdayHeart[3]) } };
  const seasonWeekday = key.match(/^(spring|summer|fall|winter)_(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
  if (!isMarriage && seasonWeekday) return { keyType: "season_weekday", fields: { ...base, season: seasonWeekday[1], weekday: seasonWeekday[2] } };
  const seasonDay = key.match(/^(spring|summer|fall|winter)_([0-9]{1,2})$/);
  if (seasonDay) return { keyType: isMarriage ? "marriage_season_day" : "season_day", fields: { ...base, season: seasonDay[1], day: clampDay(seasonDay[2]) } };
  if (!isMarriage && key === "Introduction") return { keyType: "introduction", fields: base };
  if (!isMarriage && key === "divorced") return { keyType: "divorced", fields: base };
  if (!isMarriage && key === "breakUp") return { keyType: "breakup", fields: base };
  const acceptGift = key.match(/^AcceptGift_(.+)$/);
  if (!isMarriage && acceptGift) return { keyType: "accept_gift_item", fields: { ...base, itemId: acceptGift[1] } };
  const birthdayGift = key.match(/^AcceptBirthdayGift_(.+)$/);
  if (!isMarriage && birthdayGift) return { keyType: "accept_birthday_gift", fields: { ...base, reaction: birthdayGift[1] } };
  if (!isMarriage && ["Resort", "Resort_Entering", "Resort_Leaving", "Resort_Shore", "Resort_Chair", "Resort_Bar"].includes(key)) return { keyType: "resort", fields: { ...base, resortKey: key } };
  if (!isMarriage && ["GreenRain", "GreenRainFinished", "GreenRain_2"].includes(key)) return { keyType: "green_rain", fields: { ...base, greenRainKey: key } };
  const eventSeen = key.match(/^eventSeen_(.+)$/);
  if (!isMarriage && eventSeen) return { keyType: "event_seen", fields: { ...base, eventId: eventSeen[1] } };
  const locationTile = key.match(/^(.+)_([0-9]+)_([0-9]+)$/);
  if (!isMarriage && locationTile) return { keyType: "location_tile", fields: { ...base, location: locationTile[1], x: Number(locationTile[2]), y: Number(locationTile[3]) } };
  const marriageRealKey = key.match(/^(Rainy_Day|Indoor_Day|Rainy_Night|Indoor_Night|Outdoor|OneKid|TwoKids|NoBed|Good|Neutral|Bad)_(.+)$/);
  if (isMarriage && marriageRealKey) return { keyType: "marriage_key", fields: { ...base, key } };
  const marriageNpc = key.match(/^(patio|spouseRoom|funLeave|funReturn)_(.+)$/);
  if (isMarriage && marriageNpc) return { keyType: "marriage_npc_suffix", fields: { ...base, scene: marriageNpc[1], npc: marriageNpc[2] } };
  return { keyType: isMarriage ? "marriage_custom" : "normal_custom", fields: { ...base, customKey: key } };
}

function validGenericHearts(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 4;
  return Math.min(14, Math.max(1, Math.round(numberValue)));
}

function integerInRange(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function dialogueI18nKeyFromParts(npcName: string, isMarriage: boolean, prefixOverride: string, key: string) {
  const prefix = normalizeI18nPrefix(prefixOverride || npcName);
  const namespace = isMarriage ? "MarriageDialogue" : "CharacterDialogue";
  return `${prefix}.${namespace}.${sanitizeI18nPart(key)}`;
}

function isMarriageDialogueType(type: DialogueKeyType, ruleset?: Ruleset) {
  return dialogueFormatById(type, ruleset).scope === "marriage";
}

function dialogueTargetForFlow(flow: WorkflowState, npcName: string, ruleset?: Ruleset) {
  return isMarriageDialogueType(flow.dialogueKeyType, ruleset)
    ? `Characters/Dialogue/MarriageDialogue${npcName}`
    : `Characters/Dialogue/${npcName}`;
}

function dialogueI18nKey(flow: WorkflowState, npcName: string, ruleset?: Ruleset) {
  const prefix = normalizeI18nPrefix(flow.dialogueI18nPrefix || npcName);
  const namespace = isMarriageDialogueType(flow.dialogueKeyType, ruleset) ? "MarriageDialogue" : "CharacterDialogue";
  return `${prefix}.${namespace}.${sanitizeI18nPart(buildDialogueKey(flow, npcName, ruleset))}`;
}

function normalizeI18nPrefix(value: string) {
  return sanitizeI18nPart(value || "ExampleNPC");
}

function sanitizeI18nPart(value: string) {
  return (value || "entry")
    .replace(/[{}]/g, "")
    .replace(/[^A-Za-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "entry";
}

function i18nRef(key: string) {
  return `{{i18n:${key}}}`;
}

function defaultDialogueText(type: DialogueKeyType) {
  if (isMarriageDialogueType(type)) return "今天也能和你在一起，真好。$h";
  if (type === "rainy") return "下雨天总让人想慢一点。#$b#你也是这样吗？$s";
  if (type === "divorced") return "我现在还不太想聊这个。";
  if (type === "breakup") return "也许我们都需要一点时间。";
  return "你好，@。#$b#今天也见到你真好。$h";
}

function clampDay(value: string) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 1;
  return Math.min(28, Math.max(1, Math.round(next)));
}

function normalizeInternalName(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9_]/g, "").trim();
  return cleaned || "ExampleNPC";
}

function characterAssetGamePath(project: Project, storedPath: string, fallback: string) {
  if (!storedPath) return `Mods/${project.manifest.UniqueID || "Author.Mod"}/${fallback}`;
  const withoutAssets = storedPath.replace(/\\/g, "/").replace(/^assets\//, "");
  return `Mods/${project.manifest.UniqueID || "Author.Mod"}/${stripExtension(withoutAssets)}`;
}

function stripExtension(path: string) {
  return path.replace(/\.[^/.]+$/, "");
}

function roommateTagName(value: string) {
  return (value || "ExampleNPC")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "example_npc";
}

function roommateContextTag(npcName: string) {
  return `propose_roommate_${roommateTagName(npcName)}`;
}

function workflowEventId(npcName: string) {
  let hash = 0;
  for (const char of npcName) hash = (hash * 31 + char.charCodeAt(0)) % 900000;
  return 9000000 + hash;
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

function mergeTodoState(nextTodos: FlowTodo[], previousTodos: FlowTodo[]) {
  return nextTodos.map((todo) => {
    const previous = previousTodos.find((item) => item.id === todo.id);
    return previous ? { ...todo, done: previous.done } : todo;
  });
}

function defaultAIModel(provider: AIProvider) {
  if (provider === "openai") return "gpt-5.1";
  if (provider === "deepseek") return "deepseek-chat";
  return "";
}

function defaultAIPrompt(kind: AISuggestionKind, entry: GameDataEntry) {
  if (kind === "when") {
    return `为这个 ${gameDataLabel(entry.kind)} 条目生成 Content Patcher 的 When 条件。请根据我的需求返回一个 JSON object，例如按季节、日期、天气、NPC 关系或玩家状态限制生效。`;
  }
  if (kind === "field") {
    return `为这个 ${gameDataLabel(entry.kind)} 条目的 Entries 值生成或改写字段内容。请返回可以放进 Entries 里当前 Key 对应位置的 JSON value。`;
  }
  return `为这个 ${gameDataLabel(entry.kind)} 条目生成完整 Content Patcher EditData 补丁。请返回包含 Action、Target、Entries 的 JSON object，可以包含 When。`;
}

function defaultPatchAIPrompt(kind: AISuggestionKind, patch: Patch) {
  if (kind === "when") {
    return `为这个 ${patch.action} 补丁生成 Content Patcher 的 When 条件。请返回 JSON object，并尽量使用 Content Patcher 支持的 token 写法。`;
  }
  if (kind === "field") {
    return `为这个 ${patch.action} 补丁生成动作字段 JSON，例如 Entries、Fields、FromArea、ToArea、PatchMode 或其他适合当前动作的字段。请返回 JSON object。`;
  }
  return `把这个补丁整理成完整 EditData 补丁 JSON。请返回包含 Action、Target、Entries 的 JSON object，可以包含 When。`;
}

function applyAISuggestionToGameData(entry: GameDataEntry, kind: AISuggestionKind, value: unknown): GameDataEntry {
  if (kind === "when") {
    return isObject(value) ? { ...entry, when: value } : entry;
  }
  if (kind === "field") {
    return { ...entry, value };
  }
  return gameDataFromPatchPreview(entry, value);
}

function applyAISuggestionToPatch(patch: Patch, kind: AISuggestionKind, value: unknown): Patch {
  if (kind === "when") {
    return isObject(value) ? { ...patch, when: value } : patch;
  }
  if (!isObject(value)) {
    return patch;
  }
  if (kind === "field") {
    return { ...patch, fields: { ...patch.fields, ...value } };
  }
  return {
    ...patch,
    action: value.Action === "EditData" ? "EditData" : patch.action,
    target: typeof value.Target === "string" ? value.Target : patch.target,
    when: isObject(value.When) ? value.When : patch.when,
    fields: Object.fromEntries(
      Object.entries(value).filter(([key]) => !["Action", "Target", "FromFile", "When"].includes(key))
    ),
    from_file: typeof value.FromFile === "string" ? value.FromFile : patch.from_file
  };
}

function readError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function makeId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function replaceAt<T>(items: T[], index: number, item: T) {
  return items.map((value, itemIndex) => itemIndex === index ? item : value);
}

createRoot(document.getElementById("root")!).render(
  <SafeAppErrorBoundary>
    <App />
  </SafeAppErrorBoundary>
);

