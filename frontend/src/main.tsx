import React, { useEffect, useMemo, useRef, useState } from "react";
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
  kind: "npc" | "item" | "dialogue" | "schedule" | "animation" | "shop" | "event" | "mail" | "trigger_action" | "quest" | "secret_note" | "special_order" | "custom";
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
  ui_state?: JsonDict;
};

type ValidationIssue = { level: "error" | "warning"; path: string; message: string };
type ValidationResult = { errors: ValidationIssue[]; warnings: ValidationIssue[]; can_export: boolean };
type PendingProjectOpen = { project: Project; label: string };
type RulesetOption = { label: string; value: string | number | boolean };
type WhenConditionSchema = { key: string; label: string; valueType: string; options?: string; allowCustom?: boolean; parameterLabel?: string; parameterOptions?: string };
type TriggerActionCommandKind = "AddMail" | "RemoveMail" | "AddMoney" | "AddQuest" | "RunTriggerAction" | "custom";
type QuestType = "Basic" | "Crafting" | "Location" | "Building" | "ItemDelivery" | "Monster" | "ItemHarvest" | "LostItem" | "SecretLostItem" | "Social";
type QuestNextQuest = { id: string; questId: string; hostOnly: boolean };
type QuestMeta = {
  mode: "builder" | "raw";
  questId: string;
  type: QuestType;
  titleKey: string;
  descriptionKey: string;
  hintKey: string;
  reactionKey: string;
  requirement: JsonDict;
  nextQuests: QuestNextQuest[];
  moneyReward: number;
  rewardDescription: string;
  cancellable: boolean;
  rawValue: string;
};
type SecretNoteMeta = {
  noteId: string;
  textKey: string;
};
type SpecialOrderObjectiveType = "Collect" | "Deliver" | "Fish" | "Gift" | "JKScore" | "ReachMineFloor" | "Ship" | "Donate" | "Slay" | "custom";
type SpecialOrderRewardType = "Money" | "Gems" | "Mail" | "Friendship" | "ResetEvent" | "Object" | "custom";
type SpecialOrderObjective = { id: string; type: SpecialOrderObjectiveType; textKey: string; requiredCount: string; data: JsonDict; customType?: string };
type SpecialOrderReward = { id: string; type: SpecialOrderRewardType; data: JsonDict; customType?: string };
type SpecialOrderRandomValue = { id: string; requiredTags: string; value: string };
type SpecialOrderRandomElement = { id: string; name: string; values: SpecialOrderRandomValue[] };
type SpecialOrderMeta = {
  orderId: string;
  nameKey: string;
  textKey: string;
  requester: string;
  duration: string;
  repeatable: boolean;
  requiredTags: string;
  condition: string;
  orderType: string;
  specialRule: string;
  itemToRemoveOnEnd: string;
  mailToRemoveOnEnd: string;
  objectives: SpecialOrderObjective[];
  rewards: SpecialOrderReward[];
  randomizedElements: SpecialOrderRandomElement[];
  customFields: JsonDict;
};
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
type SessionState = { project: Project; projectPath: string; exportPath: string; revision: number; lastClientId: string };
type ItemCatalogEntry = { id: string; qualified_id: string; name: string; display_name: string; description?: string; category?: number | null; type?: string; source: string };
type ItemCatalogResponse = { items: ItemCatalogEntry[]; source_path: string; warning: string };
type ItemOption = RulesetOption & { source?: string };
type ItemModuleKind = "object" | "crop" | "fruitTree" | "cooking" | "crafting";
type RecipeIngredientRow = { id: string; itemId: string; count: number };
type TriggerActionRow = { kind: TriggerActionCommandKind; player: string; mailId: string; mailType: string; amount: number; questId: string; targetAction: string; raw: string };
type MapResourceEntry = { key: string; filename: string; width: number; height: number; tile_width: number; tile_height: number; url: string };
type MapResourceResponse = { maps: MapResourceEntry[]; source_path: string; warning: string };
type MapArea = { X: number; Y: number; Width: number; Height: number };
type MapPoint = { X: number; Y: number };
type MapPreviewImage = Asset | { url: string; label: string };

type ProjectUiContextValue = { project: Project | null; setProject: (project: Project) => void };
const ProjectUiContext = React.createContext<ProjectUiContextValue>({ project: null, setProject: () => undefined });
type FestivalPositionMeta = { npcName: string; festivalId: string; phaseKey: string; x: number; y: number; direction: string };
type MapDraftKind = "custom" | "edit" | "warp" | "tilesheets";
type MapGeneratedRef = { target: string; key?: string; action?: Patch["action"]; from_file?: string | null };
type MapDraft = { id: string; kind: MapDraftKind; generated: MapGeneratedRef[] };
type CustomMapDraftInitial = { mapKeyRaw: string; displayName: string; mapFile: string; previewFile: string; arrival: MapPoint; locationType: string; alwaysActive: boolean; canPlant: boolean; greenRainSpawns: boolean; excludePathfinding: boolean };
type WarpMapDraftInitial = { warpSourceMap: string; warpTargetMap: string; warpFrom: MapPoint; warpTo: MapPoint; warpKind: "AddWarps" | "AddNpcWarps" };
type ScheduleKeyField = { name: string; type: string; options?: string; min?: number; max?: number };
type ScheduleKeyFormat = { id: string; category: string; label: string; template: string; fields: ScheduleKeyField[] };
type AffinityDialogueGroupId = "0123" | "4567" | "8910" | "married";
type AffinityDialogueVariants = Record<AffinityDialogueGroupId, string>;
type SchedulePoint = { id: string; time: string; location: string; x: number; y: number; direction: number; animation: string; dialogueKey: string; dialogueText: string; dialogueVariants: AffinityDialogueVariants };
type ScheduleMeta = { npcName: string; keyType: string; fields: Record<string, string | number>; initialCommand: string; gotoKey: string; friendshipNpc: string; friendshipHearts: number; mailId: string; mailMissingKey: string; mailReceivedKey: string; points: SchedulePoint[]; dialogueEntries: { key: string; i18nKey: string }[] };
type AnimationMeta = { npcName: string; isSleep: boolean; customKey: string; entryFrames: string; repeatFrames: string; leavingFrames: string; messageText: string; messageVariants: AffinityDialogueVariants; layingDown: boolean; useOffset: boolean; offsetX: number; offsetY: number; rawMode?: boolean; rawValue?: string };
type FlowTodo = { id: string; label: string; description: string; action: FlowAction; done: boolean };
type FlowAction = "dialogue" | "giftTaste" | "schedule" | "mail" | "event" | "roommateItem" | "customMap" | "giftTasteForItem" | "mailForItem" | "mapLocation" | "mapWarpTodo" | "mapEventTodo";
type FlowKind = "character" | "item" | "map";
type DialogueKeyType = string;
type WorkflowResult = { entries: GameDataEntry[]; patches: Patch[]; i18n: Record<string, string> };
type DialogueEntryState = {
  npcName: string;
  isMarriage: boolean;
  keyType: DialogueKeyType;
  textId: string;
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
  const [tab, setTab] = useState("manifest");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projectPath, setProjectPath] = useState("E:\\Codex\\stardew-cp-studio\\example.cpgen");
  const [openPath, setOpenPath] = useState("");
  const [exportPath, setExportPath] = useState("E:\\Codex\\stardew-cp-studio\\exports");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [status, setStatus] = useState("");
  const [toast, setToast] = useState("");
  const [loadError, setLoadError] = useState("");
  const [pendingProjectOpen, setPendingProjectOpen] = useState<PendingProjectOpen | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [itemCatalog, setItemCatalog] = useState<ItemCatalogResponse>({ items: [], source_path: "", warning: "" });
  const clientIdRef = useRef(makeId());
  const revisionRef = useRef(0);
  const projectRef = useRef<Project | null>(null);
  const projectPathRef = useRef(projectPath);
  const exportPathRef = useRef(exportPath);
  const websocketRef = useRef<WebSocket | null>(null);
  const broadcastTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  function notify(message: string) {
    setStatus(message);
    setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast("");
      toastTimerRef.current = null;
    }, 4200);
  }

  function applySession(snapshot: SessionState) {
    revisionRef.current = snapshot.revision;
    projectRef.current = snapshot.project;
    projectPathRef.current = snapshot.projectPath || projectPathRef.current;
    exportPathRef.current = snapshot.exportPath || exportPathRef.current;
    setProject(snapshot.project);
    if (isObject(snapshot.project.ui_state) && typeof snapshot.project.ui_state.sidebarCollapsed === "boolean") {
      setSidebarCollapsed(snapshot.project.ui_state.sidebarCollapsed);
    }
    setProjectPath(snapshot.projectPath || projectPathRef.current);
    setExportPath(snapshot.exportPath || exportPathRef.current);
    setValidation(null);
  }

  function broadcastSession(delay = 250) {
    if (!projectRef.current) return;
    if (broadcastTimerRef.current !== null) window.clearTimeout(broadcastTimerRef.current);
    broadcastTimerRef.current = window.setTimeout(() => {
      broadcastTimerRef.current = null;
      if (!projectRef.current) return;
      const payload = {
        project: projectRef.current,
        projectPath: projectPathRef.current,
        exportPath: exportPathRef.current,
        clientId: clientIdRef.current
      };
      const socket = websocketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
      } else {
        postJson<SessionState>("/api/session/state", payload)
          .then((snapshot) => { revisionRef.current = snapshot.revision; })
          .catch(() => undefined);
      }
    }, delay);
  }

  function updateProject(next: Project) {
    projectRef.current = next;
    setProject(next);
    setValidation(null);
    broadcastSession();
  }

  function updateSidebarCollapsed(next: boolean) {
    setSidebarCollapsed(next);
    if (!projectRef.current) return;
    const current = projectRef.current;
    const uiState = isObject(current.ui_state) ? current.ui_state : {};
    updateProject({ ...current, ui_state: { ...uiState, sidebarCollapsed: next } });
  }

  function updateProjectPath(next: string) {
    projectPathRef.current = next;
    setProjectPath(next);
    broadcastSession();
  }

  function updateExportPath(next: string) {
    exportPathRef.current = next;
    setExportPath(next);
    broadcastSession();
  }

  useEffect(() => {
    Promise.all([fetchJson<Ruleset>("/api/ruleset"), fetchJson<SessionState>("/api/session"), fetchJson<HealthStatus>("/api/health"), fetchJson<ItemCatalogResponse>("/api/items/catalog")])
      .then(([nextRuleset, session, nextHealth, nextCatalog]) => {
        setRuleset(nextRuleset);
        applySession(session);
        setHealth(nextHealth);
        setItemCatalog(nextCatalog);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : String(error)));
  }, []);

  useEffect(() => {
    let reconnectTimer: number | null = null;
    let closed = false;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/session/ws`);
      websocketRef.current = socket;
      socket.onmessage = (event) => {
        const snapshot = JSON.parse(event.data) as SessionState;
        if (snapshot.lastClientId === clientIdRef.current) {
          revisionRef.current = snapshot.revision;
          return;
        }
        if (snapshot.revision >= revisionRef.current) {
          applySession(snapshot);
          notify(`已同步另一台设备的修改（版本 ${snapshot.revision}）。`);
        }
      };
      socket.onclose = () => {
        if (closed) return;
        reconnectTimer = window.setTimeout(connect, 1500);
      };
      socket.onerror = () => socket.close();
    }

    connect();
    return () => {
      closed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (broadcastTimerRef.current !== null) window.clearTimeout(broadcastTimerRef.current);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      websocketRef.current?.close();
    };
  }, []);

  async function validate(current = project) {
    if (!current) return null;
    const result = await postJson<ValidationResult>("/api/validate", current);
    setValidation(result);
    return result;
  }

  async function saveProject() {
    const currentProject = projectRef.current || project;
    if (!currentProject) return;
    try {
      await postJson("/api/projects/save", { project: currentProject, path: projectPathRef.current });
      notify(`已保存工程：${projectPathRef.current}`);
    } catch (error) {
      notify(`保存失败：${errorMessage(error)}`);
    }
  }

  async function openProject() {
    if (!openPath.trim()) {
      notify("请先填写 .cpgen 工程路径，或直接拖入/选择工程文件。");
      return;
    }
    try {
      const opened = await postJson<Project>("/api/projects/open", { path: openPath });
      projectRef.current = opened;
      setProject(opened);
      setValidation(null);
      setPendingProjectOpen(null);
      projectPathRef.current = openPath;
      setProjectPath(openPath);
      notify(`已打开工程：${openPath}`);
      await validate(opened);
    } catch (error) {
      notify(`打开失败：${errorMessage(error)}`);
    }
  }

  async function previewProjectFile(file: File) {
    try {
      const opened = await openUploadedProject(file);
      setPendingProjectOpen({ project: opened, label: file.name });
      notify(`已读取工程预览：${file.name}`);
    } catch (error) {
      notify(`读取工程失败：${errorMessage(error)}`);
    }
  }

  async function confirmPendingProjectOpen() {
    if (!pendingProjectOpen) return;
    updateProject(pendingProjectOpen.project);
    setOpenPath("");
    setPendingProjectOpen(null);
    notify(`已打开工程：${pendingProjectOpen.label}。保存位置仍使用当前“保存到 .cpgen 路径”。`);
    await validate(pendingProjectOpen.project);
  }

  async function exportPack() {
    if (!project) return;
    const result = await validate(project);
    if (result && result.errors.length > 0) {
      notify("导出前请先修复阻止性错误。");
      return;
    }
    try {
      const response = await postJson<{ path: string }>("/api/export/content-pack", {
        project,
        output_dir: exportPath,
        folder_name: project.manifest.Name
      });
      notify(`已导出内容包：${response.path}`);
    } catch (error) {
      notify(`导出失败：${errorMessage(error)}`);
    }
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
    <ProjectUiContext.Provider value={{ project, setProject: updateProject }}>
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {toast && <div className={`toast ${/失败|错误|修复/.test(toast) ? "error" : ""}`}>{toast}</div>}
      <aside className="sidebar">
        <div className="brand">
          <Icon name="pkg" />
          <div>
            <strong>Stardew CP Studio</strong>
            <span>Content Patcher 本地工作台</span>
          </div>
        </div>
        <button type="button" className="sidebar-toggle" onClick={() => updateSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}>
          <Icon name="menu" />{!sidebarCollapsed && "收起侧栏"}
        </button>
        <nav>
          <TabButton icon={<Icon name="settings" />} id="manifest" label="模组信息" tab={tab} setTab={setTab} />
          <details className="sidebar-subnav" open={tab === "data" || tab === "dialogue" || tab === "events" || tab === "schedules" || tab === "mail" || tab === "items" || tab === "maps" || tab === "shops" || tab === "quests" || tab === "special-orders"}>
            <summary><Icon name="data" /><span>游戏数据</span></summary>
            <div>
              <TabButton icon={<Icon name="data" />} id="data" label="角色 / 通用数据" tab={tab} setTab={setTab} />
              <TabButton icon={<Icon name="dialogue" />} id="dialogue" label="对话模块" tab={tab} setTab={setTab} />
              <TabButton icon={<Icon name="story" />} id="events" label="剧情事件" tab={tab} setTab={setTab} />
              <TabButton icon={<Icon name="schedule" />} id="schedules" label="日程模块" tab={tab} setTab={setTab} />
              <TabButton icon={<Icon name="mail" />} id="mail" label="信件模块" tab={tab} setTab={setTab} />
              <TabButton icon={<Icon name="item" />} id="items" label="物品添加" tab={tab} setTab={setTab} />
              <TabButton icon={<Icon name="map" />} id="maps" label="地图添加" tab={tab} setTab={setTab} />
              <TabButton icon={<Icon name="shop" />} id="shops" label="商店功能" tab={tab} setTab={setTab} />
              <TabButton icon={<Icon name="quest" />} id="quests" label="任务功能" tab={tab} setTab={setTab} />
              <TabButton icon={<Icon name="order" />} id="special-orders" label="特殊订单" tab={tab} setTab={setTab} />
            </div>
          </details>
          <TabButton icon={<Icon name="json" />} id="patches" label="CP 补丁" tab={tab} setTab={setTab} />
          <TabButton icon={<Icon name="assets" />} id="assets" label="素材库" tab={tab} setTab={setTab} />
          <div className="nav-spacer" />
          <TabButton icon={<Icon name="box" />} id="workspace" label="工程管理" tab={tab} setTab={setTab} />
          <TabButton icon={<Icon name="rules" />} id="rules" label="规则库" tab={tab} setTab={setTab} />
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

        {tab === "manifest" && <ManifestEditor project={project} setProject={updateProject} />}
        {(tab === "events" || tab === "story") && <StoryEventStudio project={project} ruleset={ruleset} itemCatalog={itemCatalog} setProject={updateProject} />}
        {tab === "patches" && <PatchEditor project={project} ruleset={ruleset} setProject={updateProject} />}
        {tab === "data" && <GameDataEditor project={project} ruleset={ruleset} itemCatalog={itemCatalog} setProject={updateProject} />}
        {tab === "dialogue" && <DialogueStudio project={project} ruleset={ruleset} itemCatalog={itemCatalog} setProject={updateProject} />}
        {tab === "schedules" && <ScheduleStudio project={project} ruleset={ruleset} setProject={updateProject} />}
        {tab === "mail" && <MailStudio project={project} ruleset={ruleset} itemCatalog={itemCatalog} setProject={updateProject} />}
        {tab === "items" && <ItemStudio project={project} ruleset={ruleset} itemCatalog={itemCatalog} setProject={updateProject} />}
        {tab === "maps" && <MapStudio project={project} ruleset={ruleset} setProject={updateProject} />}
        {tab === "shops" && <ShopStudio project={project} ruleset={ruleset} itemCatalog={itemCatalog} setProject={updateProject} />}
        {tab === "quests" && <QuestStudio project={project} ruleset={ruleset} itemCatalog={itemCatalog} setProject={updateProject} />}
        {tab === "special-orders" && <SpecialOrderStudio project={project} ruleset={ruleset} itemCatalog={itemCatalog} setProject={updateProject} />}
        {tab === "assets" && <AssetManager project={project} setProject={updateProject} />}
        {tab === "rules" && <RuleLibraryView />}
        {tab === "workspace" && (
          <WorkspaceManager
            project={project}
            projectPath={projectPath}
            openPath={openPath}
            exportPath={exportPath}
            issues={issues}
            setProjectPath={updateProjectPath}
            setOpenPath={setOpenPath}
            setExportPath={updateExportPath}
            updateProject={updateProject}
            openProject={openProject}
            pendingProjectOpen={pendingProjectOpen}
            previewProjectFile={previewProjectFile}
            confirmPendingProjectOpen={confirmPendingProjectOpen}
            cancelPendingProjectOpen={() => setPendingProjectOpen(null)}
            saveProject={saveProject}
            validate={() => validate()}
            exportPack={exportPack}
          />
        )}
      </main>
    </div>
    </ProjectUiContext.Provider>
  );
}

function ProjectOpenPreview({ pending, onConfirm, onCancel }: { pending: PendingProjectOpen; onConfirm: () => void; onCancel: () => void }) {
  const project = pending.project;
  return (
    <div className="project-open-preview">
      <div>
        <strong>待打开工程预览</strong>
        <span>{pending.label}</span>
      </div>
      <div className="preview-grid">
        <div><span>工程名</span><strong>{project.meta.name}</strong></div>
        <div><span>模组名</span><strong>{project.manifest.Name || "未填写"}</strong></div>
        <div><span>UniqueID</span><strong>{project.manifest.UniqueID || "未填写"}</strong></div>
        <div><span>数据条目</span><strong>{project.game_data.length}</strong></div>
        <div><span>补丁</span><strong>{project.patches.length}</strong></div>
        <div><span>素材</span><strong>{project.assets.length}</strong></div>
      </div>
      <div className="button-row">
        <button type="button" onClick={onConfirm}><Icon name="open" />确认打开</button>
        <button type="button" className="secondary" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

function TabButton({ icon, id, label, tab, setTab }: { icon: React.ReactNode; id: string; label: string; tab: string; setTab: (id: string) => void }) {
  return <button className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{icon}<span>{label}</span></button>;
}

function PlaceholderModule({ title, description }: { title: string; description: string }) {
  return (
    <Section title={title}>
      <div className="placeholder-module">
        <strong>模块占位</strong>
        <p>{description}</p>
        <span>后续会从“游戏数据向导”中拆分到这个独立页面，降低角色创建后的拥挤度。</span>
      </div>
    </Section>
  );
}

function ItemStudio({ project, ruleset, itemCatalog, setProject }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; setProject: (project: Project) => void }) {
  const [addPanelOpen, setAddPanelOpen] = useState(true);
  const itemEntries = project.game_data
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => isItemStudioEntry(entry));

  function addItemEntry(module: ItemModuleKind) {
    const entry = defaultItemStudioEntry(project, module);
    setProject({ ...project, game_data: [...project.game_data, entry], i18n: { ...project.i18n, ...defaultItemStudioI18n(project, entry, module) } });
  }

  function updateEntry(index: number, entry: GameDataEntry) {
    setProject({ ...project, game_data: replaceAt(project.game_data, index, entry) });
  }

  function removeEntry(entry: GameDataEntry) {
    setProject({
      ...project,
      game_data: project.game_data.filter((item) => item.id !== entry.id)
    });
  }

  return (
    <Section title="物品添加">
      <div className={`game-data-layout ${addPanelOpen ? "" : "add-panel-collapsed"}`}>
        <aside className="game-data-add-panel">
          <button type="button" className="secondary game-data-add-toggle" onClick={() => setAddPanelOpen(!addPanelOpen)}>
            <Icon name="menu" />{addPanelOpen && "添加物品类型"}
          </button>
          {addPanelOpen && (
            <div className="game-data-add-list">
              <button type="button" className="compact-add-button" onClick={() => addItemEntry("object")}><Icon name="plus" /><span>一般物品</span></button>
              <button type="button" className="compact-add-button" onClick={() => addItemEntry("crop")}><Icon name="plus" /><span>作物</span></button>
              <button type="button" className="compact-add-button" onClick={() => addItemEntry("fruitTree")}><Icon name="plus" /><span>果树</span></button>
              <button type="button" className="compact-add-button" onClick={() => addItemEntry("cooking")}><Icon name="plus" /><span>烹饪配方</span></button>
              <button type="button" className="compact-add-button" onClick={() => addItemEntry("crafting")}><Icon name="plus" /><span>制作配方</span></button>
            </div>
          )}
        </aside>
        <div className="stack game-data-stack">
          <div className="notice compact-note">
            一般物品写入 Data/Objects；作物写入 Data/Crops，Key 是种子 ID；果树写入 Data/FruitTrees，Key 是树苗 ID；烹饪配方写入 Data/CookingRecipes；制作配方写入 Data/CraftingRecipes。
          </div>
          <div className="recipe-split">
            <ItemStudioGroup
              title="一般物品与作物"
              entries={itemEntries.filter(({ entry }) => itemModuleKind(entry) === "object" || itemModuleKind(entry) === "crop" || itemModuleKind(entry) === "fruitTree")}
              project={project}
              ruleset={ruleset}
              itemCatalog={itemCatalog}
              setProject={setProject}
              updateEntry={updateEntry}
              removeEntry={removeEntry}
            />
            <ItemStudioGroup
              title="烹饪配方"
              entries={itemEntries.filter(({ entry }) => itemModuleKind(entry) === "cooking")}
              project={project}
              ruleset={ruleset}
              itemCatalog={itemCatalog}
              setProject={setProject}
              updateEntry={updateEntry}
              removeEntry={removeEntry}
            />
            <ItemStudioGroup
              title="制作配方"
              entries={itemEntries.filter(({ entry }) => itemModuleKind(entry) === "crafting")}
              project={project}
              ruleset={ruleset}
              itemCatalog={itemCatalog}
              setProject={setProject}
              updateEntry={updateEntry}
              removeEntry={removeEntry}
            />
          </div>
        </div>
      </div>
    </Section>
  );
}

function DialogueStudio({ project, ruleset, itemCatalog, setProject }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; setProject: (project: Project) => void }) {
  const [addPanelOpen, setAddPanelOpen] = useState(true);
  const [npcName, setNpcName] = useState("ExampleNPC");
  const normalizedNpc = normalizeInternalName(npcName || "ExampleNPC");
  const entries = project.game_data
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.kind === "dialogue" || specialDialogueMetadata(entry).valid);

  function addDialogue(isMarriage: boolean) {
    const entry = defaultDialogueEntry(project, normalizedNpc, isMarriage);
    const key = extractI18nKey(entry.value);
    setProject({ ...project, game_data: [...project.game_data, entry], i18n: { ...project.i18n, [key]: defaultDialogueText(isMarriage ? "marriage_key" : "weekday") } });
  }

  function addSpecial(kind: SpecialDialogueKind) {
    const entry = createSpecialDialogueEntry(normalizedNpc, normalizedNpc, kind, project.game_data);
    const key = extractI18nKey(entry.value);
    setProject({ ...project, game_data: [...project.game_data, entry], i18n: { ...project.i18n, [key]: defaultSpecialDialogueText(kind) } });
  }

  function updateEntry(index: number, nextEntry: GameDataEntry, nextI18n?: Record<string, string>) {
    setProject({ ...project, game_data: replaceAt(project.game_data, index, nextEntry), i18n: nextI18n || project.i18n });
  }

  function moveEntry(fromIndex: number, toIndex: number) {
    setProject({ ...project, game_data: moveArrayItem(project.game_data, fromIndex, toIndex) });
  }

  return (
    <Section title="对话模块">
      <div className={`game-data-layout ${addPanelOpen ? "" : "add-panel-collapsed"}`}>
        <aside className="game-data-add-panel">
          <button type="button" className="secondary game-data-add-toggle" onClick={() => setAddPanelOpen(!addPanelOpen)}>
            <Icon name="menu" />{addPanelOpen && "添加对话"}
          </button>
          {addPanelOpen && (
            <div className="game-data-add-list">
              <Field label="默认 NPC 内部名" value={npcName} onChange={setNpcName} />
              <button type="button" className="compact-add-button" onClick={() => addDialogue(false)}><Icon name="plus" /><span>普通对话</span></button>
              <button type="button" className="compact-add-button" onClick={() => addDialogue(true)}><Icon name="plus" /><span>婚后/室友对话</span></button>
              <button type="button" className="compact-add-button" onClick={() => addSpecial("engagement")}><Icon name="plus" /><span>邀请后对话</span></button>
              <button type="button" className="compact-add-button" onClick={() => addSpecial("rain")}><Icon name="plus" /><span>特殊雨天对话</span></button>
              <button type="button" className="compact-add-button" onClick={() => addSpecial("festival")}><Icon name="plus" /><span>节日对话</span></button>
            </div>
          )}
        </aside>
        <div className="stack game-data-stack">
          <DialogueStudioGroup
            title="普通与婚后/室友对话"
            entries={entries.filter(({ entry }) => entry.kind === "dialogue")}
            project={project}
            ruleset={ruleset}
            itemCatalog={itemCatalog}
            updateEntry={updateEntry}
            moveEntry={moveEntry}
            removeEntry={(entry) => setProject({ ...project, game_data: project.game_data.filter((item) => item.id !== entry.id) })}
          />
          <SpecialDialogueStudioGroup
            entries={entries.filter(({ entry }) => specialDialogueMetadata(entry).valid)}
            project={project}
            updateEntry={updateEntry}
            moveEntry={moveEntry}
            removeEntry={(entry) => setProject({ ...project, game_data: project.game_data.filter((item) => item.id !== entry.id) })}
          />
        </div>
      </div>
    </Section>
  );
}

function DialogueStudioGroup({ title, entries, project, ruleset, itemCatalog, updateEntry, moveEntry, removeEntry }: { title: string; entries: { entry: GameDataEntry; index: number }[]; project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; updateEntry: (index: number, entry: GameDataEntry, i18n?: Record<string, string>) => void; moveEntry: (fromIndex: number, toIndex: number) => void; removeEntry: (entry: GameDataEntry) => void }) {
  return (
    <CollapsibleSubsection title={`${title} (${entries.length})`} stateKey="dialogue-studio:normal">
      {entries.map(({ entry, index }, position) => (
        <StudioEntryShell
          key={entry.id}
          entry={entry}
          stateKey={`dialogue-studio:entry:${entry.id}`}
          onNameChange={(name) => updateEntry(index, { ...entry, name })}
          onMoveUp={position > 0 ? () => moveEntry(index, entries[position - 1].index) : undefined}
          onMoveDown={position < entries.length - 1 ? () => moveEntry(index, entries[position + 1].index) : undefined}
          onRemove={() => removeEntry(entry)}
        >
          <DialogueEntryFormClean
            project={project}
            entry={entry}
            ruleset={ruleset}
            itemCatalog={itemCatalog}
            i18n={project.i18n}
            onI18nChange={(i18n) => updateEntry(index, entry, i18n)}
            onEntryAndI18nChange={(next, i18n) => updateEntry(index, next, i18n)}
            onChange={(next) => updateEntry(index, next)}
          />
        </StudioEntryShell>
      ))}
      {!entries.length && <div className="empty compact-empty">暂无普通或婚后对话，请从左侧添加。</div>}
    </CollapsibleSubsection>
  );
}

function SpecialDialogueStudioGroup({ entries, project, updateEntry, moveEntry, removeEntry }: { entries: { entry: GameDataEntry; index: number }[]; project: Project; updateEntry: (index: number, entry: GameDataEntry, i18n?: Record<string, string>) => void; moveEntry: (fromIndex: number, toIndex: number) => void; removeEntry: (entry: GameDataEntry) => void }) {
  return (
    <CollapsibleSubsection title={`特殊对话 (${entries.length})`} stateKey="dialogue-studio:special">
      {entries.map(({ entry, index }, position) => (
        <StudioEntryShell
          key={entry.id}
          entry={entry}
          stateKey={`dialogue-studio:special:${entry.id}`}
          onNameChange={(name) => updateEntry(index, { ...entry, name })}
          onMoveUp={position > 0 ? () => moveEntry(index, entries[position - 1].index) : undefined}
          onMoveDown={position < entries.length - 1 ? () => moveEntry(index, entries[position + 1].index) : undefined}
          onRemove={() => removeEntry(entry)}
        >
          <SpecialDialogueEditor
            project={project}
            entry={entry}
            i18n={project.i18n}
            onI18nChange={(i18n) => updateEntry(index, entry, i18n)}
            onChange={(next) => updateEntry(index, next)}
          />
        </StudioEntryShell>
      ))}
      {!entries.length && <div className="empty compact-empty">暂无特殊对话，请从左侧添加。</div>}
    </CollapsibleSubsection>
  );
}

function ScheduleStudio({ project, ruleset, setProject }: { project: Project; ruleset: Ruleset; setProject: (project: Project) => void }) {
  const [addPanelOpen, setAddPanelOpen] = useState(true);
  const [npcName, setNpcName] = useState("ExampleNPC");
  const entries = project.game_data.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.kind === "schedule");

  function addSchedule() {
    const entry = defaultScheduleEntry(normalizeInternalName(npcName || "ExampleNPC"));
    setProject({ ...project, game_data: [...project.game_data, entry] });
  }

  function moveEntry(fromIndex: number, toIndex: number) {
    setProject({ ...project, game_data: moveArrayItem(project.game_data, fromIndex, toIndex) });
  }

  return (
    <Section title="日程模块">
      <div className={`game-data-layout ${addPanelOpen ? "" : "add-panel-collapsed"}`}>
        <aside className="game-data-add-panel">
          <button type="button" className="secondary game-data-add-toggle" onClick={() => setAddPanelOpen(!addPanelOpen)}>
            <Icon name="menu" />{addPanelOpen && "添加日程"}
          </button>
          {addPanelOpen && (
            <div className="game-data-add-list">
              <Field label="默认 NPC 内部名" value={npcName} onChange={setNpcName} />
              <button type="button" className="compact-add-button" onClick={addSchedule}><Icon name="plus" /><span>新增日程条目</span></button>
            </div>
          )}
        </aside>
        <div className="stack game-data-stack">
          {entries.map(({ entry, index }, position) => (
            <StudioEntryShell
              key={entry.id}
              entry={entry}
              stateKey={`schedule-studio:entry:${entry.id}`}
              onNameChange={(name) => setProject({ ...project, game_data: replaceAt(project.game_data, index, { ...entry, name }) })}
              onMoveUp={position > 0 ? () => moveEntry(index, entries[position - 1].index) : undefined}
              onMoveDown={position < entries.length - 1 ? () => moveEntry(index, entries[position + 1].index) : undefined}
              onRemove={() => setProject({ ...project, game_data: project.game_data.filter((item) => item.id !== entry.id) })}
            >
              <ScheduleEntryForm project={project} entry={entry} ruleset={ruleset} onChange={(next) => setProject({ ...project, game_data: replaceAt(project.game_data, index, next) })} />
            </StudioEntryShell>
          ))}
          {!entries.length && <div className="empty compact-empty">暂无日程，请从左侧添加。</div>}
        </div>
      </div>
    </Section>
  );
}

function MailStudio({ project, ruleset, itemCatalog, setProject }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; setProject: (project: Project) => void }) {
  const [addPanelOpen, setAddPanelOpen] = useState(true);
  const entries = project.game_data.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.kind === "mail");

  function addMail() {
    setProject({ ...project, game_data: [...project.game_data, defaultMailEntry(project)] });
  }

  function moveEntry(fromIndex: number, toIndex: number) {
    setProject({ ...project, game_data: moveArrayItem(project.game_data, fromIndex, toIndex) });
  }

  return (
    <Section title="信件模块">
      <div className={`game-data-layout ${addPanelOpen ? "" : "add-panel-collapsed"}`}>
        <aside className="game-data-add-panel">
          <button type="button" className="secondary game-data-add-toggle" onClick={() => setAddPanelOpen(!addPanelOpen)}>
            <Icon name="menu" />{addPanelOpen && "添加信件"}
          </button>
          {addPanelOpen && (
            <div className="game-data-add-list">
              <button type="button" className="compact-add-button" onClick={addMail}><Icon name="plus" /><span>新增信件</span></button>
            </div>
          )}
        </aside>
        <div className="stack game-data-stack">
          {entries.map(({ entry, index }, position) => (
            <StudioEntryShell
              key={entry.id}
              entry={entry}
              stateKey={`mail-studio:entry:${entry.id}`}
              onNameChange={(name) => setProject({ ...project, game_data: replaceAt(project.game_data, index, { ...entry, name }) })}
              onMoveUp={position > 0 ? () => moveEntry(index, entries[position - 1].index) : undefined}
              onMoveDown={position < entries.length - 1 ? () => moveEntry(index, entries[position + 1].index) : undefined}
              onRemove={() => setProject({ ...project, game_data: project.game_data.filter((item) => item.id !== entry.id) })}
            >
              <MailEntryForm project={project} entry={entry} ruleset={ruleset} itemCatalog={itemCatalog} onChange={(next) => setProject({ ...project, game_data: replaceAt(project.game_data, index, next) })} setProject={setProject} />
            </StudioEntryShell>
          ))}
          {!entries.length && <div className="empty compact-empty">暂无信件，请从左侧添加。</div>}
        </div>
      </div>
    </Section>
  );
}

function ItemStudioGroup({ title, entries, project, ruleset, itemCatalog, setProject, updateEntry, removeEntry }: { title: string; entries: { entry: GameDataEntry; index: number }[]; project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; setProject: (project: Project) => void; updateEntry: (index: number, entry: GameDataEntry) => void; removeEntry: (entry: GameDataEntry) => void }) {
  return (
    <CollapsibleSubsection title={title} className="item-studio-group" stateKey={`item-studio:${title}`}>
        {entries.map(({ entry, index }) => (
          <article className="card compact-card" key={entry.id}>
            <div className="card-head">
              <input value={entry.name} onChange={(event) => updateEntry(index, { ...entry, name: event.target.value })} />
              <button type="button" className="secondary" onClick={() => removeEntry(entry)}>删除</button>
            </div>
            <ItemStudioEntryForm
              project={project}
              ruleset={ruleset}
              itemCatalog={itemCatalog}
              entry={entry}
              onChange={(next) => updateEntry(index, next)}
              setProject={setProject}
            />
          </article>
        ))}
        {!entries.length && <div className="empty compact-empty">暂无条目，请从左侧添加。</div>}
    </CollapsibleSubsection>
  );
}

function ItemStudioEntryForm({ project, ruleset, itemCatalog, entry, onChange, setProject }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; entry: GameDataEntry; onChange: (entry: GameDataEntry) => void; setProject: (project: Project) => void }) {
  const module = itemModuleKind(entry);
  if (module === "crop") return <CropEntryForm project={project} ruleset={ruleset} itemCatalog={itemCatalog} entry={entry} onChange={onChange} setProject={setProject} />;
  if (module === "fruitTree") return <FruitTreeEntryForm project={project} ruleset={ruleset} itemCatalog={itemCatalog} entry={entry} onChange={onChange} setProject={setProject} />;
  if (module === "cooking" || module === "crafting") return <RecipeEntryForm project={project} ruleset={ruleset} itemCatalog={itemCatalog} entry={entry} recipeKind={module} onChange={onChange} />;
  return <ObjectEntryForm project={project} ruleset={ruleset} entry={entry} onChange={onChange} setProject={setProject} />;
}

function ObjectEntryForm({ project, ruleset, entry, onChange, setProject }: { project: Project; ruleset: Ruleset; entry: GameDataEntry; onChange: (entry: GameDataEntry) => void; setProject: (project: Project) => void }) {
  const value = isObject(entry.value) ? entry.value : {};
  const objectId = entry.key || "ExampleObject";
  const textureTarget = itemTextureTarget(project, objectId);
  const displayNameKey = i18nKeyFromRef(value.DisplayName) || itemI18nKey(project, "Object", objectId, "Name");
  const descriptionKey = i18nKeyFromRef(value.Description) || itemI18nKey(project, "Object", objectId, "Description");
  function commitEntry(nextEntry: GameDataEntry, i18nPatch: Record<string, string> = {}) {
    if (!Object.keys(i18nPatch).length) {
      onChange(nextEntry);
      return;
    }
    setProject({
      ...project,
      game_data: project.game_data.map((item) => item.id === entry.id ? nextEntry : item),
      i18n: { ...project.i18n, ...i18nPatch }
    });
  }
  function setValueField(key: string, nextValue: unknown) {
    onChange({ ...entry, target: "Data/Objects", value: { ...value, [key]: nextValue } });
  }
  function setLocalizedField(field: "DisplayName" | "Description", key: string, text: string) {
    commitEntry({ ...entry, target: "Data/Objects", value: { ...value, [field]: i18nRef(key) } }, { [key]: text });
  }
  function setKey(key: string) {
    const normalized = normalizeItemId(key);
    const oldDisplayKey = itemI18nKey(project, "Object", objectId, "Name");
    const oldDescriptionKey = itemI18nKey(project, "Object", objectId, "Description");
    const nextDisplayKey = itemI18nKey(project, "Object", normalized, "Name");
    const nextDescriptionKey = itemI18nKey(project, "Object", normalized, "Description");
    const nextValue = {
      ...value,
      Name: !value.Name || value.Name === objectId ? normalized : value.Name,
      DisplayName: i18nKeyFromRef(value.DisplayName) === oldDisplayKey ? i18nRef(nextDisplayKey) : value.DisplayName,
      Description: i18nKeyFromRef(value.Description) === oldDescriptionKey ? i18nRef(nextDescriptionKey) : value.Description
    };
    const i18nPatch: Record<string, string> = {};
    if (i18nKeyFromRef(value.DisplayName) === oldDisplayKey && project.i18n[oldDisplayKey]) i18nPatch[nextDisplayKey] = project.i18n[oldDisplayKey];
    if (i18nKeyFromRef(value.Description) === oldDescriptionKey && project.i18n[oldDescriptionKey]) i18nPatch[nextDescriptionKey] = project.i18n[oldDescriptionKey];
    commitEntry({
      ...entry,
      key: normalized,
      name: entry.name.includes(objectId) ? entry.name.replace(objectId, normalized) : entry.name,
      target: "Data/Objects",
      value: nextValue
    }, i18nPatch);
  }
  return (
    <div className="grid two item-form-grid">
      <div className="notice compact-note wide-editor">参考 Objects：定义一般物品。Texture 是可选贴图资源；ContextTags 用空格分隔。</div>
      <Field label="物品 ID（Data/Objects Key）" value={objectId} onChange={setKey} />
      <Field label="内部名称 Name" value={stringField(value.Name || objectId)} onChange={(next) => setValueField("Name", next)} />
      <Field label="显示名称 DisplayName（写入 i18n）" value={localizedText(project, value.DisplayName, objectId)} onChange={(next) => setLocalizedField("DisplayName", displayNameKey, next)} />
      <Field label="描述 Description（写入 i18n）" value={localizedText(project, value.Description, "这是一个新物品。")} onChange={(next) => setLocalizedField("Description", descriptionKey, next)} textarea />
      <ComboField label="物品类型 Type（Object/Fish/Seeds/Crafting 等）" value={value.Type || "Basic"} options={OBJECT_TYPE_OPTIONS} onChange={(next) => setValueField("Type", next)} />
      <ComboField label="分类 Category（负数类别，影响礼物/职业/显示）" value={value.Category ?? -2} options={rulesetOptions(ruleset, "object_categories")} onChange={(next) => setValueField("Category", numberOrText(String(next)))} />
      <Field label="价格 Price（基础售价）" value={stringField(value.Price ?? 100)} onChange={(next) => setValueField("Price", numberOrText(next))} />
      <ComboField label="可食用值 Edibility（-300 表示不可食用）" value={value.Edibility ?? -300} options={rulesetOptions(ruleset, "edibility")} onChange={(next) => setValueField("Edibility", numberOrText(String(next)))} />
      <BoolField label="是否饮料 IsDrink" value={Boolean(value.IsDrink)} onChange={(next) => setValueField("IsDrink", next)} />
      <Field label="贴图资源 Texture" value={stringField(value.Texture)} onChange={(next) => setValueField("Texture", next)} />
      <Field label="贴图索引 SpriteIndex" value={stringField(value.SpriteIndex ?? 0)} onChange={(next) => setValueField("SpriteIndex", numberOrText(next))} />
      <Field label="ContextTags（空格分隔）" value={arrayOfStrings(value.ContextTags).join(" ")} onChange={(next) => setValueField("ContextTags", splitSpaceList(next))} />
      <TargetedAssetImport
        label="导入物品贴图 PNG"
        project={project}
        accept="image/png,image/jpeg,image/webp"
        storedPath={`assets/Objects/${objectId}/${objectId}.png`}
        onImported={(nextProject, storedPath) => {
          const patch = withItemModuleMetadata({
            id: makeId(),
            name: `加载物品贴图 ${objectId}`,
            action: "Load",
            enabled: true,
            target: textureTarget,
            from_file: storedPath,
            when: {},
            fields: {},
            advanced: {}
          }, "object");
          const nextEntry = { ...entry, target: "Data/Objects", value: { ...value, Texture: textureTarget } };
          setProject({
            ...nextProject,
            game_data: nextProject.game_data.map((item) => item.id === entry.id ? nextEntry : item),
            patches: mergeWorkflowPatches(nextProject.patches, [patch])
          });
        }}
      />
      <JsonField label="Buffs / GeodeDrops / CustomFields 等高级字段" value={publicAdvancedValue(value, ["Name", "DisplayName", "Description", "Type", "Category", "Price", "Edibility", "IsDrink", "Texture", "SpriteIndex", "ContextTags"])} onChange={(next) => onChange({ ...entry, target: "Data/Objects", value: { ...pickObjectFields(value, ["Name", "DisplayName", "Description", "Type", "Category", "Price", "Edibility", "IsDrink", "Texture", "SpriteIndex", "ContextTags"]), ...(next as JsonDict) } })} />
      <WhenBuilder ruleset={ruleset} value={entry.when} onChange={(when) => onChange({ ...entry, when })} />
      <JsonField label="高级 JSON（仅公开字段）" value={publicAdvanced(entry.advanced)} onChange={(advanced) => onChange({ ...entry, advanced: mergePublicAdvanced(entry.advanced, advanced as JsonDict) })} />
    </div>
  );
}

function CropEntryForm({ project, ruleset, itemCatalog, entry, onChange, setProject }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; entry: GameDataEntry; onChange: (entry: GameDataEntry) => void; setProject: (project: Project) => void }) {
  const value = isObject(entry.value) ? entry.value : {};
  const options = projectObjectOptions(project, itemCatalog, "raw");
  const seedId = entry.key || modScopedId(project, "ExampleCropSeeds");
  const textureTarget = cropTextureTarget(project, seedId);
  const seasons = Array.isArray(value.Seasons) ? value.Seasons.map(String) : ["Spring"];
  const days = Array.isArray(value.DaysInPhase) ? value.DaysInPhase.map(Number) : [1, 2, 2, 2];
  function setValueField(key: string, nextValue: unknown) {
    onChange({ ...entry, target: "Data/Crops", value: { ...value, [key]: nextValue } });
  }
  return (
    <div className="grid two item-form-grid">
      <div className="notice compact-note wide-editor">参考 Crop data：Key 是种子物品 ID，HarvestItemId 是收获物品 ID；阶段天数按空格分隔。</div>
      <ItemSingleSelect label="种子 ID（Data/Crops Key）" options={options} value={entry.key} onChange={(next) => onChange({ ...entry, target: "Data/Crops", key: next })} />
      <ItemSingleSelect label="收获物 HarvestItemId" options={options} value={stringField(value.HarvestItemId)} onChange={(next) => setValueField("HarvestItemId", next)} />
      <ItemMultiSelect label="可生长季节 Seasons" options={SEASON_LONG_OPTIONS as ItemOption[]} value={seasons} onChange={(next) => setValueField("Seasons", next)} placeholder="选择 Spring / Summer / Fall / Winter，可多选。" />
      <Field label="阶段天数 DaysInPhase（空格分隔）" value={days.join(" ")} onChange={(next) => setValueField("DaysInPhase", splitSpaceList(next).map((item) => integerInRange(item, 0, 99, 0)))} />
      <Field label="再生天数 RegrowDays（-1 不再生）" value={stringField(value.RegrowDays ?? -1)} onChange={(next) => setValueField("RegrowDays", numberOrText(next))} />
      <Field label="收获最小数量 HarvestMinStack" value={stringField(value.HarvestMinStack ?? 1)} onChange={(next) => setValueField("HarvestMinStack", numberOrText(next))} />
      <Field label="收获最大数量 HarvestMaxStack" value={stringField(value.HarvestMaxStack ?? 1)} onChange={(next) => setValueField("HarvestMaxStack", numberOrText(next))} />
      <Field label="额外收获概率 ExtraHarvestChance" value={stringField(value.ExtraHarvestChance ?? 0)} onChange={(next) => setValueField("ExtraHarvestChance", numberOrText(next))} />
      <Field label="作物贴图 Texture（默认 TileSheets/crops）" value={stringField(value.Texture || "TileSheets/crops")} onChange={(next) => setValueField("Texture", next)} />
      <Field label="贴图索引 SpriteIndex" value={stringField(value.SpriteIndex ?? 0)} onChange={(next) => setValueField("SpriteIndex", numberOrText(next))} />
      <TargetedAssetImport
        label="导入作物贴图 PNG"
        project={project}
        accept="image/png,image/jpeg,image/webp"
        storedPath={`assets/Crops/${seedId}/Crops.png`}
        onImported={(nextProject, storedPath) => {
          const patch = withItemModuleMetadata({
            id: makeId(),
            name: `加载作物贴图 ${seedId}`,
            action: "Load",
            enabled: true,
            target: textureTarget,
            from_file: storedPath,
            when: {},
            fields: {},
            advanced: {}
          }, "crop");
          const nextEntry = { ...entry, target: "Data/Crops", value: { ...value, Texture: textureTarget } };
          setProject({
            ...nextProject,
            game_data: nextProject.game_data.map((item) => item.id === entry.id ? nextEntry : item),
            patches: mergeWorkflowPatches(nextProject.patches, [patch])
          });
        }}
      />
      <ComboField label="收获方式 HarvestMethod" value={value.HarvestMethod || "Grab"} options={CROP_HARVEST_METHOD_OPTIONS} onChange={(next) => setValueField("HarvestMethod", next)} />
      <BoolField label="需要浇水 NeedsWatering" value={value.NeedsWatering !== false} onChange={(next) => setValueField("NeedsWatering", next)} />
      <BoolField label="棚架作物 TrellisCrop" value={Boolean(value.TrellisCrop)} onChange={(next) => setValueField("TrellisCrop", next)} />
      <BoolField label="水田作物 PaddyCrop" value={Boolean(value.PaddyCrop)} onChange={(next) => setValueField("PaddyCrop", next)} />
      <BoolField label="种子凸起 RaisedSeeds" value={Boolean(value.RaisedSeeds)} onChange={(next) => setValueField("RaisedSeeds", next)} />
      <JsonField label="TintColors / HarvestSounds / CustomFields 等高级字段" value={publicAdvancedValue(value, ["Seasons", "DaysInPhase", "RegrowDays", "HarvestItemId", "HarvestMinStack", "HarvestMaxStack", "ExtraHarvestChance", "Texture", "SpriteIndex", "HarvestMethod", "NeedsWatering", "TrellisCrop", "PaddyCrop", "RaisedSeeds"])} onChange={(next) => onChange({ ...entry, target: "Data/Crops", value: { ...pickObjectFields(value, ["Seasons", "DaysInPhase", "RegrowDays", "HarvestItemId", "HarvestMinStack", "HarvestMaxStack", "ExtraHarvestChance", "Texture", "SpriteIndex", "HarvestMethod", "NeedsWatering", "TrellisCrop", "PaddyCrop", "RaisedSeeds"]), ...(next as JsonDict) } })} />
      <WhenBuilder ruleset={ruleset} value={entry.when} onChange={(when) => onChange({ ...entry, when })} />
      <JsonField label="高级 JSON（仅公开字段）" value={publicAdvanced(entry.advanced)} onChange={(advanced) => onChange({ ...entry, advanced: mergePublicAdvanced(entry.advanced, advanced as JsonDict) })} />
    </div>
  );
}

function FruitTreeEntryForm({ project, ruleset, itemCatalog, entry, onChange, setProject }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; entry: GameDataEntry; onChange: (entry: GameDataEntry) => void; setProject: (project: Project) => void }) {
  const value = isObject(entry.value) ? entry.value : {};
  const saplingId = entry.key || modScopedId(project, "ExampleFruitTreeSapling");
  const seasons = Array.isArray(value.Seasons) ? value.Seasons.map(String) : ["Spring"];
  const fruits = Array.isArray(value.Fruit) ? value.Fruit.filter(isObject).map(normalizeFruitTreeFruit) : [normalizeFruitTreeFruit({ ItemId: "(O)638" })];
  const textureTarget = fruitTreeTextureTarget(project, saplingId);
  const displayNameKey = i18nKeyFromRef(value.DisplayName) || itemI18nKey(project, "FruitTree", saplingId, "Name");
  function commitEntry(nextEntry: GameDataEntry, i18nPatch: Record<string, string> = {}) {
    if (!Object.keys(i18nPatch).length) {
      onChange(nextEntry);
      return;
    }
    setProject({
      ...project,
      game_data: project.game_data.map((item) => item.id === entry.id ? nextEntry : item),
      i18n: { ...project.i18n, ...i18nPatch }
    });
  }
  function setValueField(key: string, nextValue: unknown) {
    onChange({ ...entry, target: "Data/FruitTrees", value: { ...value, [key]: nextValue } });
  }
  function setKey(key: string) {
    const normalized = normalizeItemId(key);
    const oldDisplayKey = itemI18nKey(project, "FruitTree", saplingId, "Name");
    const nextDisplayKey = itemI18nKey(project, "FruitTree", normalized, "Name");
    const nextValue = {
      ...value,
      DisplayName: i18nKeyFromRef(value.DisplayName) === oldDisplayKey ? i18nRef(nextDisplayKey) : value.DisplayName
    };
    const i18nPatch: Record<string, string> = {};
    if (i18nKeyFromRef(value.DisplayName) === oldDisplayKey && project.i18n[oldDisplayKey]) i18nPatch[nextDisplayKey] = project.i18n[oldDisplayKey];
    commitEntry({
      ...entry,
      key: normalized,
      name: entry.name.includes(saplingId) ? entry.name.replace(saplingId, normalized) : entry.name,
      target: "Data/FruitTrees",
      value: nextValue
    }, i18nPatch);
  }
  function updateFruit(index: number, patch: JsonDict) {
    const nextFruits = [...fruits];
    nextFruits[index] = normalizeFruitTreeFruit({ ...nextFruits[index], ...patch });
    setValueField("Fruit", nextFruits);
  }
  function removeFruit(index: number) {
    setValueField("Fruit", fruits.filter((_, fruitIndex) => fruitIndex !== index));
  }
  function addFruit() {
    setValueField("Fruit", [...fruits, normalizeFruitTreeFruit({ Id: `Fruit${fruits.length + 1}`, ItemId: "(O)638" })]);
  }
  return (
    <div className="grid two item-form-grid">
      <div className="notice compact-note wide-editor">
        参考 Fruit trees：Key 是树苗物品 ID。树苗本身仍需要在“一般物品”中创建为种子/树苗物品；这里定义成熟果树、结果季节、果实和果树贴图。
      </div>
      <Field label="树苗 ID（Data/FruitTrees Key）" value={saplingId} onChange={setKey} />
      <Field label="果树显示名 DisplayName（写入 i18n）" value={localizedText(project, value.DisplayName, saplingId)} onChange={(next) => commitEntry({ ...entry, target: "Data/FruitTrees", value: { ...value, DisplayName: i18nRef(displayNameKey) } }, { [displayNameKey]: next })} />
      <ItemMultiSelect label="结果季节 Seasons" options={SEASON_LONG_OPTIONS as ItemOption[]} value={seasons} onChange={(next) => setValueField("Seasons", next)} placeholder="选择 Spring / Summer / Fall / Winter，可多选。" />
      <Field label="贴图资源 Texture" value={stringField(value.Texture || "TileSheets\\fruitTrees")} onChange={(next) => setValueField("Texture", next)} />
      <Field label="贴图行 TextureSpriteRow" value={stringField(value.TextureSpriteRow ?? 0)} onChange={(next) => setValueField("TextureSpriteRow", numberOrText(next))} />
      <TargetedAssetImport
        label="导入果树贴图 PNG"
        project={project}
        accept="image/png,image/jpeg,image/webp"
        storedPath={`assets/FruitTrees/${saplingId}/FruitTrees.png`}
        onImported={(nextProject, storedPath) => {
          const patch = withItemModuleMetadata({
            id: makeId(),
            name: `加载果树贴图 ${saplingId}`,
            action: "Load",
            enabled: true,
            target: textureTarget,
            from_file: storedPath,
            when: {},
            fields: {},
            advanced: {}
          }, "fruitTree");
          const nextEntry = { ...entry, target: "Data/FruitTrees", value: { ...value, Texture: textureTarget } };
          setProject({
            ...nextProject,
            game_data: nextProject.game_data.map((item) => item.id === entry.id ? nextEntry : item),
            patches: mergeWorkflowPatches(nextProject.patches, [patch])
          });
        }}
      />
      <div className="structured-editor wide-editor">
        <div className="structured-editor-head">
          <div>
            <strong>果实 Fruit</strong>
            <span>每条会写成 ItemSpawnFields。固定果实用 ItemId；随机果实用 RandomItemId。</span>
          </div>
          <button type="button" className="secondary" onClick={addFruit}><Icon name="plus" />添加果实规则</button>
        </div>
        {fruits.map((fruit, index) => (
          <FruitTreeFruitRow key={`${fruit.Id || "Fruit"}-${index}`} project={project} ruleset={ruleset} itemCatalog={itemCatalog} fruit={fruit} index={index} onChange={(patch) => updateFruit(index, patch)} onRemove={() => removeFruit(index)} />
        ))}
        {!fruits.length && <div className="empty compact-empty">暂无果实规则。</div>}
      </div>
      <JsonField label="PlantableLocationRules / CustomFields 等高级字段" value={publicAdvancedValue(value, ["PlantableLocationRules", "DisplayName", "Seasons", "Fruit", "Texture", "TextureSpriteRow", "CustomFields"])} onChange={(next) => onChange({ ...entry, target: "Data/FruitTrees", value: { ...pickObjectFields(value, ["PlantableLocationRules", "DisplayName", "Seasons", "Fruit", "Texture", "TextureSpriteRow", "CustomFields"]), ...(next as JsonDict) } })} />
      <WhenBuilder ruleset={ruleset} value={entry.when} onChange={(when) => onChange({ ...entry, when })} />
      <JsonField label="高级 JSON（仅公开字段）" value={publicAdvanced(entry.advanced)} onChange={(advanced) => onChange({ ...entry, advanced: mergePublicAdvanced(entry.advanced, advanced as JsonDict) })} />
    </div>
  );
}

function FruitTreeFruitRow({ project, ruleset, itemCatalog, fruit, index, onChange, onRemove }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; fruit: JsonDict; index: number; onChange: (patch: JsonDict) => void; onRemove: () => void }) {
  const options = itemSelectionOptions(project, ruleset, itemCatalog, "qualified");
  const randomItems = arrayOfStrings(fruit.RandomItemId);
  const isRandom = randomItems.length > 0;
  return (
    <div className="compact-card">
      <div className="card-head">
        <strong>果实规则 {index + 1}</strong>
        <button type="button" className="secondary" onClick={onRemove}>删除</button>
      </div>
      <div className="grid two">
        <Field label="规则 ID Id" value={stringField(fruit.Id || "Default")} onChange={(next) => onChange({ Id: next })} />
        <ConditionField label="条件 Condition" value={fruit.Condition ?? null} onChange={(next) => onChange({ Condition: next })} />
        <ComboField label="专属季节 Season（可留空）" value={fruit.Season ?? ""} options={[{ label: "留空 / 跟随 Seasons", value: "" }, ...SEASON_LONG_OPTIONS]} onChange={(next) => onChange({ Season: String(next) || null })} />
        <Field label="概率 Chance" value={stringField(fruit.Chance ?? 1)} onChange={(next) => onChange({ Chance: Number(next) || 0 })} />
        {!isRandom && <ItemSingleSelect label="固定果实 ItemId" options={options} value={stringField(fruit.ItemId || "")} onChange={(next) => onChange({ ItemId: next, RandomItemId: null })} />}
        <ItemMultiSelect label="随机果实 RandomItemId" options={options} value={randomItems} onChange={(next) => onChange({ RandomItemId: next.length ? next : null, ItemId: next.length ? null : fruit.ItemId })} placeholder="添加任意候选后，此规则会改为随机果实。" />
        <Field label="最小数量 MinStack" value={stringField(fruit.MinStack ?? -1)} onChange={(next) => onChange({ MinStack: numberOrText(next) })} />
        <Field label="最大数量 MaxStack" value={stringField(fruit.MaxStack ?? -1)} onChange={(next) => onChange({ MaxStack: numberOrText(next) })} />
        <Field label="品质 Quality（-1 默认）" value={stringField(fruit.Quality ?? -1)} onChange={(next) => onChange({ Quality: numberOrText(next) })} />
        <BoolField label="是否配方 IsRecipe" value={Boolean(fruit.IsRecipe)} onChange={(next) => onChange({ IsRecipe: next })} />
      </div>
    </div>
  );
}

function RecipeEntryForm({ project, ruleset, itemCatalog, entry, recipeKind, onChange }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; entry: GameDataEntry; recipeKind: "cooking" | "crafting"; onChange: (entry: GameDataEntry) => void }) {
  const meta = recipeMetaFromEntry(entry, recipeKind);
  const allOptions = itemSelectionOptions(project, ruleset, itemCatalog, "gift");
  const productOptions = projectObjectOptions(project, itemCatalog, "raw");
  const target = recipeKind === "cooking" ? "Data/CookingRecipes" : "Data/CraftingRecipes";
  function updateMeta(patch: Partial<ReturnType<typeof recipeMetaFromEntry>>) {
    const nextMeta = { ...meta, ...patch };
    onChange({
      ...entry,
      target,
      key: nextMeta.recipeName,
      value: recipeString(nextMeta, recipeKind),
      advanced: withItemModuleAdvanced(entry.advanced, recipeKind, { recipe: nextMeta })
    });
  }
  return (
    <div className="grid two item-form-grid">
      <div className="notice compact-note wide-editor">
        {recipeKind === "cooking"
          ? "烹饪配方格式：ingredients / unused pair / yield / unlock / display name。"
          : "制作配方格式：ingredients / Home 或 Field / yield / big craftable? / unlock / display name。"}
      </div>
      <Field label="配方 Key（通常是产物英文名）" value={meta.recipeName} onChange={(recipeName) => updateMeta({ recipeName })} />
      <ItemSingleSelect label="产物 Yield" options={productOptions} value={meta.yieldItemId} onChange={(yieldItemId) => updateMeta({ yieldItemId })} />
      <Field label="产物数量 Yield Count" value={String(meta.yieldCount)} onChange={(yieldCount) => updateMeta({ yieldCount: integerInRange(yieldCount, 1, 999, 1) })} />
      {recipeKind === "cooking" ? (
        <Field label="Unused pair（Wiki 标明未使用，但必须存在）" value={meta.unusedPair} onChange={(unusedPair) => updateMeta({ unusedPair })} />
      ) : (
        <>
          <ComboField label="可制作位置（未使用字段）" value={meta.craftingLocation} options={CRAFTING_LOCATION_OPTIONS} onChange={(craftingLocation) => updateMeta({ craftingLocation: String(craftingLocation) })} />
          <BoolField label="产物是 Big Craftable" value={meta.bigCraftable} onChange={(bigCraftable) => updateMeta({ bigCraftable })} />
        </>
      )}
      <ComboField label="解锁条件类型" value={meta.unlockKind} options={RECIPE_UNLOCK_KIND_OPTIONS} onChange={(unlockKind) => updateMeta({ unlockKind: String(unlockKind) })} />
      {meta.unlockKind === "friendship" && <Field label="NPC 与心数（例如 Emily 3）" value={`${meta.unlockNpc} ${meta.unlockLevel}`} onChange={(next) => { const parts = splitSpaceList(next); updateMeta({ unlockNpc: parts[0] || "", unlockLevel: integerInRange(parts[1] || "0", 0, 14, 0) }); }} />}
      {meta.unlockKind === "skill" && (
        <>
          <ComboField label="技能 Skill" value={meta.unlockSkill} options={SKILL_OPTIONS} onChange={(unlockSkill) => updateMeta({ unlockSkill: String(unlockSkill) })} />
          <Field label="等级 Level" value={String(meta.unlockLevel)} onChange={(unlockLevel) => updateMeta({ unlockLevel: integerInRange(unlockLevel, 0, 10, 0) })} />
        </>
      )}
      {meta.unlockKind === "custom" && <Field label="自定义解锁条件" value={meta.unlockRaw} onChange={(unlockRaw) => updateMeta({ unlockRaw })} />}
      <Field label="显示名 Display name（可选）" value={meta.displayName} onChange={(displayName) => updateMeta({ displayName })} />
      <RecipeIngredientEditor label="构成物品 Ingredients" options={allOptions} value={meta.ingredients} onChange={(ingredients) => updateMeta({ ingredients })} />
      <div className="field wide-editor"><span>最终配方字符串</span><code>{recipeString(meta, recipeKind)}</code></div>
      <WhenBuilder ruleset={ruleset} value={entry.when} onChange={(when) => onChange({ ...entry, when })} />
      <JsonField label="高级 JSON（仅公开字段）" value={publicAdvanced(entry.advanced)} onChange={(advanced) => onChange({ ...entry, advanced: mergePublicAdvanced(entry.advanced, advanced as JsonDict) })} />
    </div>
  );
}

function RecipeIngredientEditor({ label, options, value, onChange }: { label: string; options: ItemOption[]; value: RecipeIngredientRow[]; onChange: (value: RecipeIngredientRow[]) => void }) {
  function updateRow(index: number, patch: Partial<RecipeIngredientRow>) {
    onChange(replaceAt(value, index, { ...value[index], ...patch }));
  }
  return (
    <div className="structured-editor wide-editor">
      <div className="structured-editor-head">
        <div>
          <strong>{label}</strong>
          <span>Wiki 使用“物品 ID 数量”成对写入；负数类别也可选。</span>
        </div>
        <button type="button" className="secondary" onClick={() => onChange([...value, { id: makeId(), itemId: "388", count: 1 }])}><Icon name="plus" />添加材料</button>
      </div>
      {value.map((row, index) => (
        <div className="recipe-row" key={row.id}>
          <ItemSingleSelect label="物品 / 类别" options={options} value={row.itemId} onChange={(itemId) => updateRow(index, { itemId })} />
          <Field label="数量" value={String(row.count)} onChange={(count) => updateRow(index, { count: integerInRange(count, 1, 999, 1) })} />
          <button type="button" className="secondary" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>删除</button>
        </div>
      ))}
      {!value.length && <div className="empty compact-empty">暂无材料。</div>}
    </div>
  );
}

function WorkspaceManager({ project, projectPath, openPath, exportPath, issues, pendingProjectOpen, setProjectPath, setOpenPath, setExportPath, updateProject, openProject, previewProjectFile, confirmPendingProjectOpen, cancelPendingProjectOpen, saveProject, validate, exportPack }: { project: Project; projectPath: string; openPath: string; exportPath: string; issues: ValidationIssue[]; pendingProjectOpen: PendingProjectOpen | null; setProjectPath: (value: string) => void; setOpenPath: (value: string) => void; setExportPath: (value: string) => void; updateProject: (project: Project) => void; openProject: () => void; previewProjectFile: (file: File) => void; confirmPendingProjectOpen: () => void; cancelPendingProjectOpen: () => void; saveProject: () => void; validate: () => void; exportPack: () => void }) {
  function handleProjectFile(file: File | undefined) {
    if (!file) return;
    previewProjectFile(file);
  }

  return (
    <div className="workspace-grid">
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
        <div
          className="project-drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleProjectFile(event.dataTransfer.files?.[0]);
          }}
        >
          <div>
            <strong>拖入 .cpgen 工程文件</strong>
            <span>或选择文件后先预览，再确认打开。</span>
          </div>
          <label className="file-button"><Icon name="upload" />选择工程文件<input type="file" accept=".cpgen,application/zip" onChange={(event) => handleProjectFile(event.currentTarget.files?.[0])} /></label>
        </div>
        {pendingProjectOpen && <ProjectOpenPreview pending={pendingProjectOpen} onConfirm={confirmPendingProjectOpen} onCancel={cancelPendingProjectOpen} />}
        <Stats project={project} issues={issues} />
      </Section>
      <Section title="校验与导出">
        <div className="grid two">
          <Field label="导出目录" value={exportPath} onChange={setExportPath} />
          <div className="button-row align-end">
            <button onClick={validate}><Icon name="check" />校验</button>
            <button onClick={exportPack}><Icon name="export" />导出内容包</button>
          </div>
        </div>
        <IssueList issues={issues} />
      </Section>
      <AISettings />
    </div>
  );
}

function Icon({ name }: { name: string }) {
  const glyphs: Record<string, string> = {
    assets: "A",
    ai: "AI",
    box: "O",
    check: "V",
    data: "D",
    dialogue: "T",
    export: "E",
    flow: "F",
    item: "I",
    json: "{}",
    mail: "@",
    map: "M",
    menu: "≡",
    open: "O",
    order: "SO",
    pkg: "S",
    plus: "+",
    quest: "Q",
    rules: "R",
    save: "S",
    schedule: "SC",
    settings: "*",
    shop: "$",
    story: "EV",
    upload: "U",
    warn: "!"
  };
  return <span className="icon" aria-hidden="true">{glyphs[name] || "-"}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="section"><h2>{title}</h2>{children}</section>;
}

function getPersistedDetailsOpen(project: Project | null, key: string, defaultOpen: boolean) {
  const uiState = project && isObject(project.ui_state) ? project.ui_state : {};
  const details = isObject(uiState.detailsOpen) ? uiState.detailsOpen : {};
  const value = details[key];
  return typeof value === "boolean" ? value : defaultOpen;
}

function setPersistedDetailsOpen(project: Project | null, setProject: (project: Project) => void, key: string, open: boolean) {
  if (!project) return;
  const uiState = isObject(project.ui_state) ? project.ui_state : {};
  const details = isObject(uiState.detailsOpen) ? uiState.detailsOpen : {};
  if (details[key] === open) return;
  setProject({
    ...project,
    ui_state: {
      ...uiState,
      detailsOpen: {
        ...details,
        [key]: open
      }
    }
  });
}

function CollapsibleSubsection({ title, children, highlight = false, defaultOpen = true, className = "", stateKey }: { title: string; children: React.ReactNode; highlight?: boolean; defaultOpen?: boolean; className?: string; stateKey?: string }) {
  const { project, setProject } = React.useContext(ProjectUiContext);
  const detailsKey = stateKey || `subsection:${title}`;
  const open = getPersistedDetailsOpen(project, detailsKey, defaultOpen);
  return (
    <details
      className={`subsection collapsible-subsection ${highlight ? "highlight" : ""} ${className}`}
      open={open}
      onToggle={(event) => setPersistedDetailsOpen(project, setProject, detailsKey, event.currentTarget.open)}
    >
      <summary><h3>{title}</h3></summary>
      <div className="collapsible-subsection-body">{children}</div>
    </details>
  );
}

function PersistentDetails({ title, children, className = "", defaultOpen = false, stateKey }: { title: string; children: React.ReactNode; className?: string; defaultOpen?: boolean; stateKey: string }) {
  const { project, setProject } = React.useContext(ProjectUiContext);
  const open = getPersistedDetailsOpen(project, stateKey, defaultOpen);
  return (
    <details
      className={className}
      open={open}
      onToggle={(event) => setPersistedDetailsOpen(project, setProject, stateKey, event.currentTarget.open)}
    >
      <summary>{title}</summary>
      {children}
    </details>
  );
}

function StudioEntryShell({ entry, stateKey, children, onNameChange, onMoveUp, onMoveDown, onRemove }: { entry: GameDataEntry; stateKey: string; children: React.ReactNode; onNameChange: (name: string) => void; onMoveUp?: () => void; onMoveDown?: () => void; onRemove: () => void }) {
  const { project, setProject } = React.useContext(ProjectUiContext);
  const open = getPersistedDetailsOpen(project, stateKey, true);
  return (
    <details
      className="card compact-card studio-entry-card"
      open={open}
      onToggle={(event) => setPersistedDetailsOpen(project, setProject, stateKey, event.currentTarget.open)}
    >
      <summary className="card-head studio-entry-head">
        <input value={entry.name} onClick={(event) => event.stopPropagation()} onChange={(event) => onNameChange(event.target.value)} />
        <div className="button-row studio-entry-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="secondary" disabled={!onMoveUp} onClick={onMoveUp}>上移</button>
          <button type="button" className="secondary" disabled={!onMoveDown} onClick={onMoveDown}>下移</button>
          <button type="button" className="secondary" onClick={onRemove}>删除</button>
        </div>
      </summary>
      <div className="studio-entry-body">{children}</div>
    </details>
  );
}

function Field({ label, value, onChange, textarea = false }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean }) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  function updateDraft(next: string) {
    setDraft(next);
    onChange(next);
  }

  function finishEditing() {
    setFocused(false);
    setDraft(value);
  }

  const inputProps = {
    value: draft,
    onFocus: () => setFocused(true),
    onBlur: finishEditing,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateDraft(event.target.value)
  };

  return (
    <label className="field">
      <span>{label}</span>
      {textarea ? <textarea {...inputProps} /> : <input {...inputProps} />}
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
  const dependencies = Array.isArray(manifest.Dependencies) ? manifest.Dependencies : [];

  function updateDependency(index: number, patch: Partial<Manifest["Dependencies"][number]>) {
    update("Dependencies", dependencies.map((dependency, itemIndex) => itemIndex === index ? { ...dependency, ...patch } : dependency));
  }

  function addDependency() {
    update("Dependencies", [...dependencies, { UniqueID: "", IsRequired: true, MinimumVersion: null }]);
  }

  function removeDependency(index: number) {
    update("Dependencies", dependencies.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <Section title="模组信息">
      <div className="stack">
        <div className="grid two">
          <Field label="模组名称 Name" value={manifest.Name} onChange={(value) => update("Name", value)} />
          <Field label="作者 Author" value={manifest.Author} onChange={(value) => update("Author", value)} />
          <Field label="唯一 ID UniqueID" value={manifest.UniqueID} onChange={(value) => update("UniqueID", value)} />
          <Field label="版本 Version" value={manifest.Version} onChange={(value) => update("Version", value)} />
          <Field label="最低 SMAPI 版本 MinimumApiVersion" value={manifest.MinimumApiVersion} onChange={(value) => update("MinimumApiVersion", value)} />
          <Field label="更新键 UpdateKeys，用逗号分隔" value={manifest.UpdateKeys.join(", ")} onChange={(value) => update("UpdateKeys", splitComma(value))} />
          <Field label="简介 Description" value={manifest.Description} textarea onChange={(value) => update("Description", value)} />
        </div>
        <CollapsibleSubsection title={`依赖模组 Dependencies (${dependencies.length})`} stateKey="manifest:dependencies">
          <div className="structured-editor-head">
            <div>
              <strong>依赖模组</strong>
              <span>用于声明其他模组是否必须安装，可选填写最低版本。</span>
            </div>
            <button type="button" className="secondary" onClick={addDependency}><Icon name="plus" />添加依赖</button>
          </div>
          <div className="stack">
            {dependencies.map((dependency, index) => (
              <div className="card compact-card" key={`${dependency.UniqueID}-${index}`}>
                <div className="grid two">
                  <Field label="依赖 UniqueID" value={dependency.UniqueID} onChange={(value) => updateDependency(index, { UniqueID: value })} />
                  <Field label="最低版本 MinimumVersion" value={stringField(dependency.MinimumVersion)} onChange={(value) => updateDependency(index, { MinimumVersion: value.trim() ? value.trim() : null })} />
                  <BoolField label="必选 IsRequired" value={dependency.IsRequired !== false} onChange={(value) => updateDependency(index, { IsRequired: value })} />
                  <div className="field">
                    <span>导出预览</span>
                    <code>{JSON.stringify(compactObject({ UniqueID: dependency.UniqueID || "Mod.UniqueID", IsRequired: dependency.IsRequired !== false, MinimumVersion: dependency.MinimumVersion || undefined }))}</code>
                  </div>
                </div>
                <div className="button-row">
                  <button type="button" className="secondary" onClick={() => removeDependency(index)}>删除依赖</button>
                </div>
              </div>
            ))}
            {!dependencies.length && <div className="empty compact-empty">暂无依赖。比如 DLX.PIF、Sharogg.Tilesheets、mushymato.MMAP 可以从这里添加。</div>}
          </div>
        </CollapsibleSubsection>
      </div>
    </Section>
  );
}

function FlowMode({ project, ruleset, itemCatalog = { items: [], source_path: "", warning: "" }, setProject }: { project: Project; ruleset: Ruleset; itemCatalog?: ItemCatalogResponse; setProject: (project: Project) => void }) {
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
    const entry = flow.kind === "item" ? createPrimaryItemEntry(project, flow) : createPrimaryMapEntry(project, flow);
    const i18nPatch = createPrimaryFlowI18n(project, flow);
    const existingIndex = project.game_data.findIndex((item) => flow.createdEntryIds.includes(item.id) && item.target === entry.target && item.key === entry.key);
    const nextGameData = existingIndex >= 0 ? replaceAt(project.game_data, existingIndex, { ...entry, id: project.game_data[existingIndex].id }) : [...project.game_data, entry];
    const nextCreatedIds = existingIndex >= 0 ? flow.createdEntryIds : uniqueIds([...flow.createdEntryIds, entry.id]);
    const nextFlow = { ...flow, active: true, createdEntryIds: nextCreatedIds };
    setProject({ ...project, game_data: nextGameData, i18n: { ...project.i18n, ...i18nPatch } });
    setFlow({ ...nextFlow, todos: mergeTodoState(buildTodos(nextFlow), flow.todos) });
  }

  function runTodo(todo: FlowTodo) {
    setFlow({ ...flow, configuringAction: todo.action });
  }

  function confirmTodo(action: FlowAction) {
    const result = createWorkflowResultForAction(project, action, flow);
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
                project={project}
                ruleset={ruleset}
                itemCatalog={itemCatalog}
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

function FlowTodoConfigurator({ flow, project, ruleset, itemCatalog, onChange, onConfirm, onCancel }: { flow: WorkflowState; project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; onChange: (patch: Partial<WorkflowState>) => void; onConfirm: () => void; onCancel: () => void }) {
  const action = flow.configuringAction;
  const options = (key: string) => rulesetOptions(ruleset, key);
  const title = flow.todos.find((todo) => todo.action === action)?.label || "配置下一步";

  return (
    <div className="flow-config">
      <h3>{title}</h3>
      {action === "dialogue" && (
        <DialogueKeyBuilder flow={flow} project={project} ruleset={ruleset} itemCatalog={itemCatalog} onChange={onChange} />
      )}
      {action === "giftTaste" && (
        <div className="grid two">
          <ComboField label="默认喜好分组" value={flow.giftTasteGroup} options={options("gift_taste_groups")} onChange={(giftTasteGroup) => onChange({ giftTasteGroup: String(giftTasteGroup) })} />
          <ItemSingleSelect label="初始物品 ID（可留空）" options={itemSelectionOptions(project, ruleset, itemCatalog, "qualified")} value={flow.itemId} onChange={(itemId) => onChange({ itemId })} />
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
          <ItemSingleSelect label="目标物品" options={itemSelectionOptions(project, ruleset, itemCatalog, "qualified")} value={flow.itemId} onChange={(itemId) => onChange({ itemId })} />
          <ComboField label="喜好分组" value={flow.giftTasteGroup} options={options("gift_taste_groups")} onChange={(giftTasteGroup) => onChange({ giftTasteGroup: String(giftTasteGroup) })} />
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
      {!["giftTasteForItem", "mailForItem", "mapWarpTodo", "mapEventTodo"].includes(String(action)) && (
        <div className="notice compact-note">这个待办会按当前流程信息生成基础模板，之后可在游戏数据页面继续编辑。</div>
      )}
      <div className="button-row">
        <button onClick={onConfirm}><Icon name="plus" />确认创建</button>
        <button className="secondary" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

function DialogueKeyBuilder({ flow, ruleset, itemCatalog, project, onChange }: { flow: WorkflowState; ruleset: Ruleset; itemCatalog?: ItemCatalogResponse; project?: Project; onChange: (patch: Partial<WorkflowState>) => void }) {
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
            itemOptions={project && itemCatalog ? itemSelectionOptions(project, ruleset, itemCatalog, "qualified") : []}
            npcName={npcName}
            value={workflowDialogueFieldValue(flow, field.name, format, npcName)}
            onChange={(value) => updateField(field, value)}
          />
        ))}
        <DialogueTextareaWithTools label="台词正文（写入 i18n/default.json）" value={flow.dialogueText} onChange={(dialogueText) => onChange({ dialogueText })} stateKey="dialogue:workflow-tools" />
      </div>
      {format.warning && <div className="notice compact-note">{format.warning}</div>}
      <div className="notice compact-note">
        当前导出：<code>{target}</code> / Key <code>{key}</code> = <code>{i18nRef(i18nKey)}</code>
      </div>
    </div>
  );
}

function DialogueFormatInput({ field, ruleset, itemOptions = [], npcName, value, onChange }: { field: DialogueFormatField; ruleset?: Ruleset; itemOptions?: ItemOption[]; npcName: string; value: string | number; onChange: (value: string | number) => void }) {
  const label = dialogueFieldLabel(field);
  if (field.type === "item" || field.name === "itemId") {
    return <ItemSingleSelect label={label} options={itemOptions} value={String(value || "")} onChange={onChange} />;
  }
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
  const [addPanelOpen, setAddPanelOpen] = useState(true);
  const creatableKinds = ruleset.game_data_kinds.filter((kind) => kind.kind !== "shop");
  const visibleEntries = project.game_data
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !isNpcManagedEntry(entry) && entry.kind !== "shop" && entry.target !== "Data/Shops");

  function addEntry(kind: GameDataEntry["kind"]) {
    const rule = ruleset.game_data_kinds.find((item) => item.kind === kind);
    const template = gameDataTemplate(kind);
    let entry: GameDataEntry = {
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
    let i18nPatch: Record<string, string> = {};
    if (kind === "npc") {
      const nameKey = `Name.${entry.key || "ExampleNPC"}`;
      entry = { ...entry, value: { ...(isObject(entry.value) ? entry.value : {}), DisplayName: i18nRef(nameKey) } };
      i18nPatch = { [nameKey]: "示例角色" };
    }
    if (kind === "item") {
      const nameKey = itemI18nKey(project, "Object", entry.key || "ExampleObject", "Name");
      const descriptionKey = itemI18nKey(project, "Object", entry.key || "ExampleObject", "Description");
      entry = { ...entry, value: { ...(isObject(entry.value) ? entry.value : {}), DisplayName: i18nRef(nameKey), Description: i18nRef(descriptionKey) } };
      i18nPatch = { [nameKey]: "示例物品", [descriptionKey]: "这是一个由 Stardew CP Studio 生成的示例物品。" };
    }
    if (kind === "secret_note") {
      entry = defaultSecretNoteEntry(project);
      i18nPatch = { [secretNoteMetaFromEntry(project, entry).textKey]: "这是一张秘密纸条。\n第二行文本。" };
    }
    if (kind === "special_order") {
      entry = defaultSpecialOrderEntry(project);
      i18nPatch = defaultSpecialOrderI18n(project, specialOrderMetaFromEntry(project, entry));
    }
    setProject({ ...project, game_data: [...project.game_data, entry], i18n: { ...project.i18n, ...i18nPatch } });
  }

  return (
    <Section title="游戏数据向导">
      <div className={`game-data-layout ${addPanelOpen ? "" : "add-panel-collapsed"}`}>
        <aside className="game-data-add-panel">
          <button type="button" className="secondary game-data-add-toggle" onClick={() => setAddPanelOpen(!addPanelOpen)}>
            <Icon name="menu" />{addPanelOpen && "添加类型"}
          </button>
          {addPanelOpen && (
            <div className="game-data-add-list">
              {creatableKinds.map((kind) => <button className="compact-add-button" key={kind.kind} onClick={() => addEntry(kind.kind)}><Icon name="plus" /><span>{gameDataLabel(kind.kind, kind.label)}</span></button>)}
            </div>
          )}
        </aside>
        <div className="stack game-data-stack">
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
                  onEntryAndI18nChange={(next, i18n) => setProject({ ...project, game_data: replaceAt(project.game_data, index, next), i18n })}
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
      </div>
    </Section>
  );
}

function GameDataForm({ project, entry, ruleset, itemCatalog, i18n = {}, onI18nChange, onEntryAndI18nChange, onChange, setProject }: { project: Project; entry: GameDataEntry; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; i18n?: Record<string, string>; onI18nChange?: (i18n: Record<string, string>) => void; onEntryAndI18nChange?: (entry: GameDataEntry, i18n: Record<string, string>) => void; onChange: (entry: GameDataEntry) => void; setProject: (project: Project) => void }) {
  const value = isObject(entry.value) ? entry.value : {};
  const setValueField = (key: string, nextValue: unknown) => onChange({ ...entry, value: { ...value, [key]: nextValue } });
  const setEntryAndI18n = (nextEntry: GameDataEntry, patch: Record<string, string>) => {
    const nextI18n = { ...i18n, ...patch };
    if (onEntryAndI18nChange) onEntryAndI18nChange(nextEntry, nextI18n);
    else {
      onChange(nextEntry);
      onI18nChange?.(nextI18n);
    }
  };
  const genericItemNameKey = i18nKeyFromRef(value.DisplayName) || itemI18nKey(project, "Object", entry.key || "ExampleObject", "Name");
  const genericItemDescriptionKey = i18nKeyFromRef(value.Description) || itemI18nKey(project, "Object", entry.key || "ExampleObject", "Description");
  const options = (key: string) => rulesetOptions(ruleset, key);

  return (
    <div className="grid two">
      {entry.kind !== "dialogue" && entry.kind !== "schedule" && entry.kind !== "animation" && entry.kind !== "mail" && entry.kind !== "trigger_action" && entry.kind !== "quest" && entry.kind !== "secret_note" && entry.kind !== "special_order" && (
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
          <Field label="显示名称 DisplayName（写入 i18n）" value={localizedText(project, value.DisplayName, entry.key || "示例物品")} onChange={(next) => setEntryAndI18n({ ...entry, target: entry.target || "Data/Objects", value: { ...value, DisplayName: i18nRef(genericItemNameKey) } }, { [genericItemNameKey]: next })} />
          <Field label="描述 Description（写入 i18n）" value={localizedText(project, value.Description, "这是一个新物品。")} onChange={(next) => setEntryAndI18n({ ...entry, target: entry.target || "Data/Objects", value: { ...value, Description: i18nRef(genericItemDescriptionKey) } }, { [genericItemDescriptionKey]: next })} />
          <Field label="价格 Price" value={stringField(value.Price)} onChange={(next) => setValueField("Price", numberOrText(next))} />
          <ComboField label="分类 Category" value={value.Category} options={options("object_categories")} onChange={(next) => setValueField("Category", numberOrText(String(next)))} />
          <ComboField label="可食用值 Edibility" value={value.Edibility} options={options("edibility")} onChange={(next) => setValueField("Edibility", numberOrText(String(next)))} />
        </>
      )}

      {entry.kind === "dialogue" && (
        <DialogueEntryFormClean project={project} entry={entry} ruleset={ruleset} itemCatalog={itemCatalog} i18n={i18n} onI18nChange={onI18nChange} onEntryAndI18nChange={onEntryAndI18nChange} onChange={onChange} />
      )}

      {entry.kind === "schedule" && (
        <ScheduleEntryForm project={project} entry={entry} ruleset={ruleset} i18n={i18n} onI18nChange={onI18nChange} onChange={onChange} />
      )}

      {entry.kind === "animation" && (
        <AnimationEntryForm project={project} entry={entry} onChange={onChange} />
      )}

      {entry.kind === "mail" && (
        <MailEntryForm project={project} entry={entry} ruleset={ruleset} itemCatalog={itemCatalog} onChange={onChange} setProject={setProject} />
      )}

      {entry.kind === "trigger_action" && (
        <TriggerActionForm project={project} entry={entry} ruleset={ruleset} onChange={onChange} />
      )}

      {entry.kind === "quest" && (
        <QuestEntryForm project={project} entry={entry} ruleset={ruleset} itemCatalog={itemCatalog} i18n={i18n} onI18nChange={onI18nChange} onEntryAndI18nChange={onEntryAndI18nChange} onChange={onChange} />
      )}

      {entry.kind === "secret_note" && (
        <SecretNoteEntryForm project={project} entry={entry} i18n={i18n} onI18nChange={onI18nChange} onEntryAndI18nChange={onEntryAndI18nChange} onChange={onChange} />
      )}

      {entry.kind === "special_order" && (
        <SpecialOrderEntryForm project={project} entry={entry} ruleset={ruleset} itemCatalog={itemCatalog} i18n={i18n} onI18nChange={onI18nChange} onEntryAndI18nChange={onEntryAndI18nChange} onChange={onChange} />
      )}

      {entry.kind === "event" && (
        <StoryEventForm
          project={project}
          entry={entry}
          ruleset={ruleset}
          itemCatalog={itemCatalog}
          i18n={i18n}
          onChange={(nextEntry, i18nPatch) => i18nPatch ? setEntryAndI18n(nextEntry, i18nPatch) : onChange(nextEntry)}
          setProject={setProject}
        />
      )}

      {entry.kind === "custom" && (
        <JsonField label="条目内容 Value" value={entry.value} onChange={(next) => onChange({ ...entry, value: next })} />
      )}

      <WhenBuilder ruleset={ruleset} value={entry.when} onChange={(when) => onChange({ ...entry, when })} />
      {entry.kind !== "dialogue" && entry.kind !== "schedule" && entry.kind !== "animation" && entry.kind !== "quest" && entry.kind !== "secret_note" && entry.kind !== "special_order" && (
        <JsonField label="高级 JSON（仅公开字段）" value={publicAdvanced(entry.advanced)} onChange={(advanced) => onChange({ ...entry, advanced: mergePublicAdvanced(entry.advanced, advanced as JsonDict) })} />
      )}
    </div>
  );
}

function QuestStudio({ project, ruleset, itemCatalog, setProject }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; setProject: (project: Project) => void }) {
  const [addPanelOpen, setAddPanelOpen] = useState(true);
  const entries = project.game_data
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => isQuestEntry(entry));

  function addQuest() {
    const entry = defaultQuestEntry(project);
    setProject({
      ...project,
      game_data: [...project.game_data, entry],
      i18n: { ...project.i18n, ...defaultQuestI18n(project, questMetaFromEntry(project, entry)) }
    });
  }

  return (
    <Section title="任务功能">
      <div className={`game-data-layout ${addPanelOpen ? "" : "add-panel-collapsed"}`}>
        <aside className="game-data-add-panel">
          <button type="button" className="secondary game-data-add-toggle" onClick={() => setAddPanelOpen(!addPanelOpen)}>
            <Icon name="menu" />{addPanelOpen && "任务操作"}
          </button>
          {addPanelOpen && (
            <div className="game-data-add-list">
              <button className="compact-add-button" type="button" onClick={addQuest}><Icon name="plus" /><span>添加任务</span></button>
            </div>
          )}
        </aside>
        <div className="stack game-data-stack">
          {entries.length ? entries.map(({ entry, index }) => (
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
                <QuestEntryForm
                  project={project}
                  entry={entry}
                  ruleset={ruleset}
                  itemCatalog={itemCatalog}
                  i18n={project.i18n}
                  onI18nChange={(i18n) => setProject({ ...project, i18n })}
                  onEntryAndI18nChange={(next, i18n) => setProject({ ...project, game_data: replaceAt(project.game_data, index, next), i18n })}
                  onChange={(next) => setProject({ ...project, game_data: replaceAt(project.game_data, index, next) })}
                />
              ) : (
                <div className="code-layout">
                  <JsonField label="当前导出的 EditData 补丁" value={gameDataPatchPreview(entry)} onChange={(value) => setProject({ ...project, game_data: replaceAt(project.game_data, index, gameDataFromPatchPreview(entry, value)) })} />
                </div>
              )}
            </article>
          )) : <div className="empty">暂无任务。点击左侧“添加任务”开始。</div>}
        </div>
      </div>
    </Section>
  );
}

function SpecialOrderStudio({ project, ruleset, itemCatalog, setProject }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; setProject: (project: Project) => void }) {
  const entries = project.game_data
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => isSpecialOrderEntry(entry));

  function addOrder() {
    const entry = defaultSpecialOrderEntry(project);
    setProject({
      ...project,
      game_data: [...project.game_data, entry],
      i18n: { ...project.i18n, ...defaultSpecialOrderI18n(project, specialOrderMetaFromEntry(project, entry)) }
    });
  }

  return (
    <Section title="特殊订单">
      <div className="toolbar">
        <button type="button" onClick={addOrder}><Icon name="plus" />新增特殊订单</button>
      </div>
      <div className="stack">
        {entries.map(({ entry, index }) => (
          <article className="card" key={entry.id}>
            <div className="card-head">
              <input value={entry.name} onChange={(event) => setProject({ ...project, game_data: replaceAt(project.game_data, index, { ...entry, name: event.target.value }) })} />
              <button type="button" onClick={() => setProject({ ...project, game_data: project.game_data.filter((item) => item.id !== entry.id) })}>删除</button>
            </div>
            <SpecialOrderEntryForm
              project={project}
              entry={entry}
              ruleset={ruleset}
              itemCatalog={itemCatalog}
              i18n={project.i18n}
              onI18nChange={(i18n) => setProject({ ...project, i18n })}
              onEntryAndI18nChange={(next, i18n) => setProject({ ...project, game_data: replaceAt(project.game_data, index, next), i18n })}
              onChange={(next) => setProject({ ...project, game_data: replaceAt(project.game_data, index, next) })}
            />
          </article>
        ))}
        {!entries.length && <div className="empty">暂无特殊订单。点击“新增特殊订单”创建。</div>}
      </div>
    </Section>
  );
}

function QuestEntryForm({ project, entry, ruleset, itemCatalog, i18n = {}, onI18nChange, onEntryAndI18nChange, onChange }: { project: Project; entry: GameDataEntry; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; i18n?: Record<string, string>; onI18nChange?: (i18n: Record<string, string>) => void; onEntryAndI18nChange?: (entry: GameDataEntry, i18n: Record<string, string>) => void; onChange: (entry: GameDataEntry) => void }) {
  const [mapResources, setMapResources] = useState<MapResourceResponse>({ maps: [], source_path: "", warning: "" });
  const meta = questMetaFromEntry(project, entry);
  const itemOptions = itemSelectionOptions(project, ruleset, itemCatalog, "qualified");
  const quests = questOptions(project);
  const npcs = npcOptions(project);
  const questMapOptions = mapLocationOptionsWithResources(project, mapResources.maps);
  const warningFields = questSlashWarnings(meta, i18n);

  useEffect(() => {
    let cancelled = false;
    fetchJson<MapResourceResponse>("/api/maps/resources")
      .then((next) => { if (!cancelled) setMapResources(next); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  function commit(nextMeta: QuestMeta, nextI18n: Record<string, string> = {}) {
    const normalized = normalizeQuestMeta(project, nextMeta);
    const nextEntry = questEntryFromMeta(project, entry, normalized);
    if (Object.keys(nextI18n).length && onEntryAndI18nChange) {
      onEntryAndI18nChange(nextEntry, { ...i18n, ...nextI18n });
      return;
    }
    onChange(nextEntry);
    if (onI18nChange && Object.keys(nextI18n).length) onI18nChange({ ...i18n, ...nextI18n });
  }

  function updateMeta(patch: Partial<QuestMeta>) {
    commit({ ...meta, ...patch });
  }

  function updateQuestId(questId: string) {
    const next = normalizeQuestMeta(project, { ...meta, questId: normalizeItemId(questId || "ExampleQuest") });
    const currentTexts = questTextValues(meta, i18n);
    const nextI18n = {
      [next.titleKey]: currentTexts.Title || "示例任务",
      [next.descriptionKey]: currentTexts.Description || "完成这个任务。",
      [next.hintKey]: currentTexts.Hint || "",
      [next.reactionKey]: currentTexts.Reaction || ""
    };
    commit(next, nextI18n);
  }

  function updateText(field: "Title" | "Description" | "Hint" | "Reaction", text: string) {
    const key = questTextKey(meta, field);
    if (onI18nChange) onI18nChange({ ...i18n, [key]: text });
  }

  function updateRequirement(patch: JsonDict) {
    commit({ ...meta, requirement: { ...meta.requirement, ...patch } });
  }

  function addNextQuest() {
    commit({ ...meta, nextQuests: [...meta.nextQuests, { id: makeId(), questId: quests[0] ? String(quests[0].value) : modScopedId(project, "NextQuest"), hostOnly: false }] });
  }

  function updateNextQuest(index: number, patch: Partial<QuestNextQuest>) {
    commit({ ...meta, nextQuests: replaceAt(meta.nextQuests, index, { ...meta.nextQuests[index], ...patch }) });
  }

  function removeNextQuest(index: number) {
    commit({ ...meta, nextQuests: meta.nextQuests.filter((_, itemIndex) => itemIndex !== index) });
  }

  const texts = questTextValues(meta, i18n);
  const lostLocation = stringField(meta.requirement.location || "Forest");
  const lostPreview = previewForMapTarget(project, lostLocation.startsWith("Maps/") ? lostLocation : `Maps/${lostLocation}`, mapResources.maps);

  return (
    <div className="subsection highlight quest-module">
      <h3>任务模块</h3>
      {meta.mode === "raw" ? (
        <div className="grid two">
          <Field label="任务 ID" value={entry.key || meta.questId} onChange={updateQuestId} />
          <Field label="原始 Quest 字符串" value={meta.rawValue || stringField(entry.value)} textarea onChange={(rawValue) => updateMeta({ rawValue })} />
          <button type="button" className="secondary" onClick={() => commit({ ...defaultQuestMeta(project, entry.key || meta.questId), rawValue: meta.rawValue, mode: "builder" })}>尝试切换为表单模式</button>
          <div className="notice compact-note">旧任务文本不是 i18n 引用时会进入原始模式，避免保存时把旧文本改写为空 i18n。</div>
        </div>
      ) : (
        <>
          <CollapsibleSubsection title="基础字段" highlight defaultOpen>
            <div className="grid two">
              <Field label="任务 ID" value={meta.questId} onChange={updateQuestId} />
              <ComboField label="任务类型 Type" value={meta.type} options={QUEST_TYPE_OPTIONS} onChange={(type) => updateMeta({ type: String(type) as QuestType, requirement: defaultQuestRequirement(String(type) as QuestType) })} />
              <Field label="标题 Title" value={texts.Title} onChange={(text) => updateText("Title", text)} />
              <Field label="目标提示 Hint" value={texts.Hint} onChange={(text) => updateText("Hint", text)} />
              <Field label="描述 Description" value={texts.Description} textarea onChange={(text) => updateText("Description", text)} />
              <DialogueTextareaWithTools label="完成反应 Reaction Text" value={texts.Reaction} onChange={(text) => updateText("Reaction", text)} stateKey="dialogue:quest-reaction-tools" />
            </div>
            {warningFields.length > 0 && <div className="notice warn compact-note">这些文本包含 <code>/</code>，Quest 数据是斜杠分隔格式，建议改写：{warningFields.join("、")}</div>}
          </CollapsibleSubsection>

          <CollapsibleSubsection title="完成条件" highlight defaultOpen>
            <QuestRequirementEditor
              type={meta.type}
              requirement={meta.requirement}
              itemOptions={itemOptions}
              mapOptions={questMapOptions}
              npcOptions={npcs}
              questOptions={quests}
              buildingOptions={buildingTypeOptions(ruleset)}
              monsterOptions={monsterNameOptions(ruleset)}
              preview={lostPreview}
              onChange={updateRequirement}
            />
            <div className="field">
              <span>Requirement 预览</span>
              <code>{questRequirementString(meta)}</code>
            </div>
          </CollapsibleSubsection>

          <CollapsibleSubsection title="奖励与后续任务" highlight defaultOpen={false}>
            <div className="grid two">
              <Field label="金钱奖励 Money Reward" value={String(meta.moneyReward)} onChange={(moneyReward) => updateMeta({ moneyReward: integerInRange(moneyReward, 0, 9999999, 0) })} />
              <Field label="Reward Description（通常 -1）" value={meta.rewardDescription} onChange={(rewardDescription) => updateMeta({ rewardDescription })} />
              <BoolField label="可取消 Cancellable" value={meta.cancellable} onChange={(cancellable) => updateMeta({ cancellable })} />
            </div>
            <div className="structured-editor">
              <div className="structured-editor-head">
                <div>
                  <strong>后续任务 Next Quests</strong>
                  <span>多个任务以空格连接；Host-only 会导出为 h&lt;QuestId&gt;。</span>
                </div>
                <button type="button" className="secondary" onClick={addNextQuest}><Icon name="plus" />添加后续任务</button>
              </div>
              {meta.nextQuests.map((row, index) => (
                <div className="mail-attachment-row" key={row.id || index}>
                  <div className="grid two">
                    <ComboField label="任务 ID" value={row.questId} options={quests} onChange={(questId) => updateNextQuest(index, { questId: String(questId) })} />
                    <BoolField label="仅主机 h" value={row.hostOnly} onChange={(hostOnly) => updateNextQuest(index, { hostOnly })} />
                  </div>
                  <div className="button-row"><button type="button" className="secondary" onClick={() => removeNextQuest(index)}>删除后续任务</button></div>
                </div>
              ))}
            </div>
          </CollapsibleSubsection>

          <div className="notice compact-note">
            导出：<code>Data/Quests</code> / <code>{meta.questId}</code> = <code>{buildQuestString(meta)}</code>
          </div>
        </>
      )}
    </div>
  );
}

function SecretNoteEntryForm({ project, entry, i18n = {}, onI18nChange, onEntryAndI18nChange, onChange }: { project: Project; entry: GameDataEntry; i18n?: Record<string, string>; onI18nChange?: (i18n: Record<string, string>) => void; onEntryAndI18nChange?: (entry: GameDataEntry, i18n: Record<string, string>) => void; onChange: (entry: GameDataEntry) => void }) {
  const meta = secretNoteMetaFromEntry(project, entry);
  const text = i18n[meta.textKey] ?? secretNoteTextFromValue(entry.value);

  function commit(nextMeta: SecretNoteMeta, textPatch?: Record<string, string>) {
    const nextEntry = secretNoteEntryFromMeta(entry, nextMeta);
    if (textPatch) {
      const nextI18n = { ...i18n, ...textPatch };
      if (onEntryAndI18nChange) onEntryAndI18nChange(nextEntry, nextI18n);
      else {
        onChange(nextEntry);
        onI18nChange?.(nextI18n);
      }
      return;
    }
    onChange(nextEntry);
  }

  return (
    <div className="subsection highlight">
      <h3>秘密纸条</h3>
      <div className="grid two">
        <Field label="纸条 Key（可非数字）" value={meta.noteId} onChange={(noteId) => commit({ ...meta, noteId })} />
        <Field label="i18n Key" value={meta.textKey} onChange={(textKey) => commit({ ...meta, textKey }, { [textKey]: text })} />
        <DialogueTextTools label="纸条正文" project={project} npcName="ExampleNPC" value={text} onChange={(next) => commit(meta, { [meta.textKey]: next })} />
        <div className="field">
          <span>导出值</span>
          <code>{i18nRef(meta.textKey)}</code>
        </div>
      </div>
      <div className="notice compact-note">导出到 <code>code/Other/SecretNotes.json</code>；正文保存在 i18n，文本换行会在最终 i18n 文本中保留，游戏读取时可按纸条格式使用 <code>^</code> 表示换行。</div>
    </div>
  );
}

function SpecialOrderEntryForm({ project, entry, ruleset, itemCatalog, i18n = {}, onI18nChange, onEntryAndI18nChange, onChange }: { project: Project; entry: GameDataEntry; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; i18n?: Record<string, string>; onI18nChange?: (i18n: Record<string, string>) => void; onEntryAndI18nChange?: (entry: GameDataEntry, i18n: Record<string, string>) => void; onChange: (entry: GameDataEntry) => void }) {
  const meta = specialOrderMetaFromEntry(project, entry);
  const itemOptions = itemSelectionOptions(project, ruleset, itemCatalog, "qualified");
  const mapOptions = mapLocationOptions(project);
  const npcs = npcOptions(project);

  function commit(nextMeta: SpecialOrderMeta, i18nPatch: Record<string, string> = {}) {
    const nextEntry = specialOrderEntryFromMeta(project, entry, nextMeta);
    if (Object.keys(i18nPatch).length) {
      const nextI18n = { ...i18n, ...i18nPatch };
      if (onEntryAndI18nChange) onEntryAndI18nChange(nextEntry, nextI18n);
      else {
        onChange(nextEntry);
        onI18nChange?.(nextI18n);
      }
      return;
    }
    onChange(nextEntry);
  }

  function updateMeta(patch: Partial<SpecialOrderMeta>, i18nPatch: Record<string, string> = {}) {
    commit({ ...meta, ...patch }, i18nPatch);
  }

  function updateObjective(index: number, objective: SpecialOrderObjective, i18nPatch: Record<string, string> = {}) {
    commit({ ...meta, objectives: replaceAt(meta.objectives, index, objective) }, i18nPatch);
  }

  function updateReward(index: number, reward: SpecialOrderReward) {
    commit({ ...meta, rewards: replaceAt(meta.rewards, index, reward) });
  }

  const stringEntries = specialOrderStringEntries(project, meta);

  return (
    <div className="subsection highlight">
      <h3>特别订单</h3>
      <div className="grid two">
        <Field label="订单 ID" value={meta.orderId} onChange={(orderId) => updateMeta(specialOrderRekey(project, meta, orderId))} />
        <ComboField label="请求者 Requester" value={meta.requester} options={npcs} onChange={(requester) => updateMeta({ requester: String(requester) })} />
        <ComboField label="期限 Duration" value={meta.duration} options={SPECIAL_ORDER_DURATION_OPTIONS} onChange={(duration) => updateMeta({ duration: String(duration) })} />
        <BoolField label="可重复 Repeatable" value={meta.repeatable} onChange={(repeatable) => updateMeta({ repeatable })} />
        <Field label="RequiredTags" value={meta.requiredTags} onChange={(requiredTags) => updateMeta({ requiredTags })} />
        <Field label="Condition / GSQ" value={meta.condition} onChange={(condition) => updateMeta({ condition })} />
        <ComboField label="OrderType" value={meta.orderType} options={SPECIAL_ORDER_TYPE_OPTIONS} onChange={(orderType) => updateMeta({ orderType: String(orderType) })} />
        <ComboField label="SpecialRule" value={meta.specialRule} options={SPECIAL_ORDER_RULE_OPTIONS} onChange={(specialRule) => updateMeta({ specialRule: String(specialRule) })} />
        <Field label="结束时移除物品 ItemToRemoveOnEnd" value={meta.itemToRemoveOnEnd} onChange={(itemToRemoveOnEnd) => updateMeta({ itemToRemoveOnEnd })} />
        <Field label="结束时移除邮件 MailToRemoveOnEnd" value={meta.mailToRemoveOnEnd} onChange={(mailToRemoveOnEnd) => updateMeta({ mailToRemoveOnEnd })} />
        <Field label="标题 Name" value={i18n[meta.nameKey] ?? ""} onChange={(text) => updateMeta({}, { [meta.nameKey]: text })} />
        <Field label="正文 Text" value={i18n[meta.textKey] ?? ""} textarea onChange={(text) => updateMeta({}, { [meta.textKey]: text })} />
      </div>

      <CollapsibleSubsection title={`目标 Objectives（${meta.objectives.length}）`} defaultOpen>
        <div className="stack">
          {meta.objectives.map((objective, index) => (
            <SpecialOrderObjectiveEditor
              key={objective.id}
              objective={objective}
              index={index}
              project={project}
              itemOptions={itemOptions}
              mapOptions={mapOptions}
              i18n={i18n}
              onChange={(next, patch) => updateObjective(index, next, patch)}
              onRemove={() => updateMeta({ objectives: meta.objectives.filter((item) => item.id !== objective.id) })}
            />
          ))}
          <button type="button" className="secondary" onClick={() => updateMeta({ objectives: [...meta.objectives, defaultSpecialOrderObjective(project, meta.orderId, meta.objectives.length)] })}><Icon name="plus" />添加目标</button>
        </div>
      </CollapsibleSubsection>

      <CollapsibleSubsection title={`奖励 Rewards（${meta.rewards.length}）`} defaultOpen>
        <div className="stack">
          {meta.rewards.map((reward, index) => (
            <SpecialOrderRewardEditor
              key={reward.id}
              reward={reward}
              itemOptions={itemOptions}
              onChange={(next) => updateReward(index, next)}
              onRemove={() => updateMeta({ rewards: meta.rewards.filter((item) => item.id !== reward.id) })}
            />
          ))}
          <button type="button" className="secondary" onClick={() => updateMeta({ rewards: [...meta.rewards, defaultSpecialOrderReward("Money")] })}><Icon name="plus" />添加奖励</button>
        </div>
      </CollapsibleSubsection>

      <CollapsibleSubsection title="随机元素 RandomizedElements">
        <SpecialOrderRandomizedEditor value={meta.randomizedElements} onChange={(randomizedElements) => updateMeta({ randomizedElements })} />
      </CollapsibleSubsection>

      <CollapsibleSubsection title="高级字段">
        <JsonField label="额外字段 CustomFields" value={meta.customFields} onChange={(customFields) => updateMeta({ customFields: isObject(customFields) ? customFields as JsonDict : {} })} />
        <JsonField label="Data/SpecialOrders 预览" value={{ [meta.orderId]: specialOrderValueFromMeta(meta) }} onChange={() => undefined} />
        <JsonField label="Strings/SpecialOrderStrings 预览" value={stringEntries} onChange={() => undefined} />
      </CollapsibleSubsection>
    </div>
  );
}

function QuestRequirementEditor({ type, requirement, itemOptions, mapOptions, npcOptions, questOptions, buildingOptions, monsterOptions, preview, onChange }: {
  type: QuestType;
  requirement: JsonDict;
  itemOptions: ItemOption[];
  mapOptions: RulesetOption[];
  npcOptions: RulesetOption[];
  questOptions: RulesetOption[];
  buildingOptions: RulesetOption[];
  monsterOptions: RulesetOption[];
  preview: MapPreviewImage | null;
  onChange: (patch: JsonDict) => void;
}) {
  if (type === "Basic") {
    return <Field label="自定义 Requirement（空则 null）" value={stringField(requirement.raw || "")} onChange={(raw) => onChange({ raw })} />;
  }
  if (type === "Crafting") {
    return <div className="grid two">
      <ItemSingleSelect label="制作目标物品" options={itemOptions} value={stringField(requirement.itemId || "(O)388")} onChange={(itemId) => onChange({ itemId })} />
      <BoolField label="大件物品 isBigCraftable" value={Boolean(requirement.isBigCraftable)} onChange={(isBigCraftable) => onChange({ isBigCraftable })} />
    </div>;
  }
  if (type === "Location") {
    return <ComboField label="目标地点" value={stringField(requirement.location || "Town")} options={mapOptions} onChange={(location) => onChange({ location })} />;
  }
  if (type === "Building") {
    return <ComboField label="建筑类型" value={stringField(requirement.buildingType || "Coop")} options={buildingOptions} onChange={(buildingType) => onChange({ buildingType })} />;
  }
  if (type === "ItemDelivery") {
    return <div className="grid two">
      <ComboField label="交付 NPC" value={stringField(requirement.npc || "Abigail")} options={npcOptions} onChange={(npc) => onChange({ npc })} />
      <ItemSingleSelect label="交付物品" options={itemOptions} value={stringField(requirement.itemId || "(O)66")} onChange={(itemId) => onChange({ itemId })} />
      <ComboField label="数量 Count" value={String(requirement.count ?? 1)} options={QUEST_COUNT_OPTIONS} onChange={(count) => onChange({ count: integerInRange(count, 1, 9999, 1) })} />
    </div>;
  }
  if (type === "Monster") {
    return <div className="grid two">
      <ComboField label="怪物名" value={stringField(requirement.monster || "Green_Slime")} options={monsterOptions} onChange={(monster) => onChange({ monster })} />
      <Field label="数量 Count" value={String(requirement.count ?? 10)} onChange={(count) => onChange({ count: integerInRange(count, 1, 9999, 10) })} />
      <ComboField label="汇报 NPC（可自定义 null）" value={stringField(requirement.npc || "Marlon")} options={npcOptions} onChange={(npc) => onChange({ npc })} />
      <BoolField label="忽略农场怪物 ignoreFarmMonsters" value={requirement.ignoreFarmMonsters !== false} onChange={(ignoreFarmMonsters) => onChange({ ignoreFarmMonsters })} />
    </div>;
  }
  if (type === "ItemHarvest") {
    return <div className="grid two">
      <ItemSingleSelect label="收获物品" options={itemOptions} value={stringField(requirement.itemId || "(O)24")} onChange={(itemId) => onChange({ itemId })} />
      <Field label="数量 Count" value={String(requirement.count ?? 1)} onChange={(count) => onChange({ count: integerInRange(count, 1, 9999, 1) })} />
    </div>;
  }
  if (type === "LostItem") {
    const point = { X: integerInRange(requirement.x, 0, 999, 0), Y: integerInRange(requirement.y, 0, 999, 0) };
    return <div className="stack">
      <div className="grid two">
        <ComboField label="失主 NPC" value={stringField(requirement.npc || "Robin")} options={npcOptions} onChange={(npc) => onChange({ npc })} />
        <ItemSingleSelect label="遗失物品 Object" options={itemOptions} value={stringField(requirement.itemId || "(O)788")} onChange={(itemId) => onChange({ itemId })} />
        <ComboField label="地点 Location" value={stringField(requirement.location || "Forest")} options={mapOptions} onChange={(location) => onChange({ location })} />
        <Field label="X" value={String(point.X)} onChange={(x) => onChange({ x: integerInRange(x, 0, 999, 0) })} />
        <Field label="Y" value={String(point.Y)} onChange={(y) => onChange({ y: integerInRange(y, 0, 999, 0) })} />
      </div>
      <div className="notice compact-note">坐标建议通过下方地图点击选择；X/Y 输入框只用于没有预览图或需要精确微调时。</div>
      {preview && <MapPreviewPicker title="遗失物坐标" image={preview} selected={point} onPick={(next) => onChange({ x: next.X, y: next.Y })} />}
    </div>;
  }
  if (type === "SecretLostItem") {
    return <div className="grid two">
      <ComboField label="NPC" value={stringField(requirement.npc || "Abigail")} options={npcOptions} onChange={(npc) => onChange({ npc })} />
      <ItemSingleSelect label="物品 Object" options={itemOptions} value={stringField(requirement.itemId || "(O)191")} onChange={(itemId) => onChange({ itemId })} />
      <ComboField label="友情点数 Friendship" value={String(requirement.friendship ?? 100)} options={QUEST_FRIENDSHIP_OPTIONS} onChange={(friendship) => onChange({ friendship: integerInRange(friendship, -9999, 9999, 100) })} />
      <ComboField label="完成后移除任务 ID" value={stringField(requirement.removeQuestId || "")} options={optionalQuestOptions(questOptions)} onChange={(removeQuestId) => onChange({ removeQuestId })} />
    </div>;
  }
  return <div className="notice compact-note">Social 任务固定为与所有人说话，Wiki 标明 completion requirement 字段不会改变完成逻辑，因此导出为 <code>null</code>。</div>;
}

type ShopModuleMode = "new" | "editItems";
type ShopOpenMeta = {
  shopId: string;
  mapTarget: string;
  position: MapPoint;
  direction: string;
  openTime: string;
  closeTime: string;
  ownerArea: MapArea | null;
};

const VANILLA_SHOP_OPTIONS: RulesetOption[] = [
  { label: "皮埃尔杂货店 SeedShop", value: "SeedShop" },
  { label: "木匠商店 Carpenter", value: "Carpenter" },
  { label: "铁匠铺 Blacksmith", value: "Blacksmith" },
  { label: "鱼店 FishShop", value: "FishShop" },
  { label: "探险家公会 AdventureShop", value: "AdventureShop" },
  { label: "玛妮牧场 AnimalShop", value: "AnimalShop" },
  { label: "诊所 Hospital", value: "Hospital" },
  { label: "星之果实餐吧 Saloon", value: "Saloon" },
  { label: "下水道 Krobus", value: "Krobus" },
  { label: "矮人商店 Dwarf", value: "Dwarf" },
  { label: "绿洲 Sandy", value: "Sandy" },
  { label: "赌场 Casino", value: "Casino" },
  { label: "帽子店 HatMouse", value: "HatMouse" },
  { label: "旅行货车 TravelingCart", value: "TravelingCart" },
  { label: "冰淇淋摊 IceCreamStand", value: "IceCreamStand" },
  { label: "火山矮人 VolcanoShop", value: "VolcanoShop" },
  { label: "姜岛度假村 IslandResort", value: "IslandResort" },
  { label: "齐先生核桃房 QiGemShop", value: "QiGemShop" },
  { label: "书商 Bookseller", value: "Bookseller" },
  { label: "沙漠节 DesertFestival", value: "DesertFestival" },
  { label: "蛋蛋节 EggFestival", value: "EggFestival" },
  { label: "花舞节 FlowerDance", value: "FlowerDance" },
  { label: "星露谷展览会 StardewValleyFair", value: "StardewValleyFair" },
  { label: "冬日星盛宴 FeastOfTheWinterStar", value: "FeastOfTheWinterStar" },
  { label: "夜市 NightMarket", value: "NightMarket" }
];

const SHOP_CURRENCY_OPTIONS: RulesetOption[] = [
  { label: "金币 Money (0)", value: 0 },
  { label: "星之币 Festival Prize Tickets (1)", value: 1 },
  { label: "齐钻 Qi Gems (2)", value: 2 },
  { label: "金核桃 Golden Walnuts (4)", value: 4 }
];

const SHOP_STOCK_LIMIT_OPTIONS: RulesetOption[] = [
  { label: "不限制", value: "" },
  { label: "每名玩家 Player", value: "Player" },
  { label: "所有玩家 Global", value: "Global" }
];

const SHOP_DIRECTION_OPTIONS: RulesetOption[] = [
  { label: "默认向下 down", value: "down" },
  { label: "无方向限制 none", value: "none" },
  { label: "上方 up", value: "up" },
  { label: "左侧 left", value: "left" },
  { label: "右侧 right", value: "right" }
];

const SHOP_TIME_OPTIONS: RulesetOption[] = [
  { label: "不写入时间", value: "" },
  ...Array.from({ length: 52 }, (_, index) => {
    const hour = Math.floor(index / 2);
    const minute = index % 2 === 0 ? "00" : "30";
    const value = `${String(hour).padStart(2, "0")}${minute}`;
    return { label: shopTimeLabel(value), value };
  }),
  { label: "次日 02:00 / 2600", value: "2600" }
];

function ShopStudio({ project, ruleset, itemCatalog, setProject }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; setProject: (project: Project) => void }) {
  const [addPanelOpen, setAddPanelOpen] = useState(true);
  const [mapResources, setMapResources] = useState<MapResourceResponse>({ maps: [], source_path: "", warning: "" });
  const shopEntries = project.game_data.map((entry, index) => ({ entry, index })).filter(({ entry }) => isShopModuleEntry(entry));
  const shopPatches = project.patches.map((patch, index) => ({ patch, index })).filter(({ patch }) => isShopOpenPatch(patch));

  useEffect(() => {
    let cancelled = false;
    fetchJson<MapResourceResponse>("/api/maps/resources").then((next) => { if (!cancelled) setMapResources(next); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  function addNewShop() {
    const shopId = modScopedId(project, "CustomShop");
    const entry = withShopModuleMetadata(createWorkflowEntry("shop", "自定义新商店", "Data/Shops", shopId, {
      Owners: [defaultShopOwner(shopId)],
      Items: [defaultShopItem(`${shopId}.IceCream`, "(O)233")],
      Currency: 0,
      OpenSound: "doorCreak",
      PurchaseSound: "purchase"
    }), "new");
    setProject({ ...project, game_data: [...project.game_data, entry] });
  }

  function addEditItems() {
    const shopId = "FishShop";
    const item = defaultShopItem(`${project.manifest.UniqueID || "Custom"}.Pufferfish`, "(O)128");
    const entry = withShopModuleMetadata({
      ...createWorkflowEntry("shop", "修改已有商店商品", "Data/Shops", stringField(item.Id), item),
      advanced: mergePublicAdvanced({}, { TargetField: [shopId, "Items"] })
    }, "editItems");
    setProject({ ...project, game_data: [...project.game_data, entry] });
  }

  function addOpenShopPatch() {
    const patch = withShopOpenMetadata({
      id: makeId(),
      name: "地图 OpenShop 点",
      action: "EditMap",
      enabled: true,
      target: "Maps/Town",
      from_file: null,
      when: {},
      fields: shopOpenMapFields(modScopedId(project, "CustomShop"), { X: 0, Y: 0 }, "down", "", "", null),
      advanced: {}
    });
    setProject({ ...project, patches: [...project.patches, patch] });
  }

  return (
    <Section title="商店功能">
      <div className={`map-module-layout ${addPanelOpen ? "" : "add-panel-collapsed"}`}>
        <aside className="game-data-add-panel">
          <button type="button" className="secondary game-data-add-toggle" onClick={() => setAddPanelOpen(!addPanelOpen)}>
            <Icon name="menu" />{addPanelOpen && "添加商店操作"}
          </button>
          {addPanelOpen && (
            <div className="game-data-add-list">
              <button type="button" className="compact-add-button" onClick={addNewShop}><Icon name="plus" /><span>自定义新商店</span></button>
              <button type="button" className="compact-add-button" onClick={addEditItems}><Icon name="plus" /><span>修改已有商店商品</span></button>
              <button type="button" className="compact-add-button" onClick={addOpenShopPatch}><Icon name="plus" /><span>地图 OpenShop 点</span></button>
            </div>
          )}
        </aside>
        <div className="stack game-data-stack">
          {shopEntries.map(({ entry, index }) => (
            <article className="card" key={entry.id}>
              <div className="card-head">
                <input value={entry.name} onChange={(event) => setProject({ ...project, game_data: replaceAt(project.game_data, index, { ...entry, name: event.target.value }) })} />
                <strong>{shopModuleMode(entry) === "new" ? "自定义新商店" : "修改已有商店商品"}</strong>
                <button type="button" className="secondary" onClick={() => setProject({ ...project, game_data: project.game_data.filter((_, itemIndex) => itemIndex !== index) })}>删除</button>
              </div>
              {shopModuleMode(entry) === "new"
                ? <NewShopForm project={project} ruleset={ruleset} itemCatalog={itemCatalog} entry={entry} onChange={(next) => setProject({ ...project, game_data: replaceAt(project.game_data, index, next) })} />
                : <EditShopItemsForm project={project} ruleset={ruleset} itemCatalog={itemCatalog} entry={entry} onChange={(next) => setProject({ ...project, game_data: replaceAt(project.game_data, index, next) })} />}
            </article>
          ))}
          {shopPatches.map(({ patch, index }) => (
            <article className="card" key={patch.id}>
              <div className="card-head">
                <input value={patch.name} onChange={(event) => setProject({ ...project, patches: replaceAt(project.patches, index, { ...patch, name: event.target.value }) })} />
                <strong>地图 OpenShop 点</strong>
                <button type="button" className="secondary" onClick={() => setProject({ ...project, patches: project.patches.filter((_, itemIndex) => itemIndex !== index) })}>删除</button>
              </div>
              <OpenShopMapPatchForm project={project} ruleset={ruleset} mapResources={mapResources.maps} patch={patch} onChange={(next) => setProject({ ...project, patches: replaceAt(project.patches, index, next) })} />
            </article>
          ))}
          {!shopEntries.length && !shopPatches.length && <div className="empty compact-empty">暂无商店操作。请从左侧添加。</div>}
        </div>
      </div>
    </Section>
  );
}

function SpecialOrderObjectiveEditor({ objective, index, project, itemOptions, mapOptions, i18n, onChange, onRemove }: { objective: SpecialOrderObjective; index: number; project: Project; itemOptions: ItemOption[]; mapOptions: RulesetOption[]; i18n: Record<string, string>; onChange: (objective: SpecialOrderObjective, i18nPatch?: Record<string, string>) => void; onRemove: () => void }) {
  const data = objective.data || {};
  const objectiveText = i18n[objective.textKey] ?? "";
  const patchData = (patch: JsonDict) => onChange({ ...objective, data: { ...data, ...patch } });
  return (
    <div className="structured-editor">
      <div className="structured-editor-head">
        <div>
          <strong>目标 {index + 1}</strong>
          <span>{objective.type === "custom" ? objective.customType || "custom" : objective.type}</span>
        </div>
        <button type="button" className="secondary" onClick={onRemove}>删除目标</button>
      </div>
      <div className="grid two">
        <ComboField label="目标类型 Type" value={objective.type} options={SPECIAL_ORDER_OBJECTIVE_OPTIONS} onChange={(type) => onChange({ ...objective, type: type as SpecialOrderObjectiveType })} />
        {objective.type === "custom" && <Field label="自定义 Type" value={objective.customType || ""} onChange={(customType) => onChange({ ...objective, customType })} />}
        <Field label="RequiredCount" value={objective.requiredCount} onChange={(requiredCount) => onChange({ ...objective, requiredCount })} />
        <Field label="目标文本" value={objectiveText} onChange={(text) => onChange(objective, { [objective.textKey]: text })} />
        {objective.type === "Collect" && <>
          <Field label="物品查询 ItemName" value={stringField(data.ItemName || data.AcceptedContextTags || "item_wood")} onChange={(ItemName) => patchData({ ItemName })} />
          <Field label="目标物品描述" value={stringField(data.Description || "")} onChange={(Description) => patchData({ Description })} />
        </>}
        {objective.type === "Donate" && <>
          <Field label="收集箱 DropBox" value={stringField(data.DropBox || "DropBox")} onChange={(DropBox) => patchData({ DropBox })} />
          <ComboField label="收集箱地点" value={stringField(data.DropBoxGameLocation || "Town")} options={mapOptions} onChange={(DropBoxGameLocation) => patchData({ DropBoxGameLocation: String(DropBoxGameLocation) })} />
          <Field label="指示坐标 X Y" value={stringField(data.DropBoxIndicatorLocation || "0 0")} onChange={(DropBoxIndicatorLocation) => patchData({ DropBoxIndicatorLocation })} />
          <ItemSingleSelect label="捐赠物品 ItemId" options={itemOptions} value={stringField(data.ItemId || "(O)388")} onChange={(ItemId) => patchData({ ItemId })} />
          <Field label="接受 Context Tags" value={stringField(data.AcceptedContextTags || "item_wood")} onChange={(AcceptedContextTags) => patchData({ AcceptedContextTags })} />
        </>}
        {objective.type === "Deliver" && <>
          <ItemSingleSelect label="交付物品" options={itemOptions} value={stringField(data.ItemId || "(O)388")} onChange={(ItemId) => patchData({ ItemId })} />
          <Field label="接受者 NPC" value={stringField(data.TargetName || "Lewis")} onChange={(TargetName) => patchData({ TargetName })} />
        </>}
        {objective.type === "Fish" && <>
          <Field label="鱼类 Context Tags" value={stringField(data.AcceptedContextTags || "category_fish")} onChange={(AcceptedContextTags) => patchData({ AcceptedContextTags })} />
          <Field label="地点限制" value={stringField(data.Location || "")} onChange={(Location) => patchData({ Location })} />
        </>}
        {objective.type === "Gift" && <>
          <Field label="NPC" value={stringField(data.NpcName || "")} onChange={(NpcName) => patchData({ NpcName })} />
          <Field label="礼物 Context Tags" value={stringField(data.AcceptedContextTags || "")} onChange={(AcceptedContextTags) => patchData({ AcceptedContextTags })} />
        </>}
        {objective.type === "Ship" && <Field label="出货 Context Tags" value={stringField(data.AcceptedContextTags || "item_wood")} onChange={(AcceptedContextTags) => patchData({ AcceptedContextTags })} />}
        {objective.type === "Slay" && <Field label="怪物名称/Tag" value={stringField(data.TargetName || "Green_Slime")} onChange={(TargetName) => patchData({ TargetName })} />}
        {objective.type === "ReachMineFloor" && <Field label="矿井层数" value={stringField(data.MineLevel || objective.requiredCount)} onChange={(MineLevel) => patchData({ MineLevel })} />}
        <JsonField label="目标 Data 高级 JSON" value={data} onChange={(next) => onChange({ ...objective, data: isObject(next) ? next as JsonDict : {} })} />
      </div>
    </div>
  );
}

function SpecialOrderRewardEditor({ reward, itemOptions, onChange, onRemove }: { reward: SpecialOrderReward; itemOptions: ItemOption[]; onChange: (reward: SpecialOrderReward) => void; onRemove: () => void }) {
  const data = reward.data || {};
  const patchData = (patch: JsonDict) => onChange({ ...reward, data: { ...data, ...patch } });
  return (
    <div className="structured-editor">
      <div className="structured-editor-head">
        <div>
          <strong>奖励</strong>
          <span>{reward.type === "custom" ? reward.customType || "custom" : reward.type}</span>
        </div>
        <button type="button" className="secondary" onClick={onRemove}>删除奖励</button>
      </div>
      <div className="grid two">
        <ComboField label="奖励类型 Type" value={reward.type} options={SPECIAL_ORDER_REWARD_OPTIONS} onChange={(type) => onChange({ ...reward, type: type as SpecialOrderRewardType })} />
        {reward.type === "custom" && <Field label="自定义 Type" value={reward.customType || ""} onChange={(customType) => onChange({ ...reward, customType })} />}
        {reward.type === "Money" && <Field label="金额 Amount" value={stringField(data.Amount || "1000")} onChange={(Amount) => patchData({ Amount })} />}
        {reward.type === "Gems" && <Field label="齐钻 Amount" value={stringField(data.Amount || "10")} onChange={(Amount) => patchData({ Amount })} />}
        {reward.type === "Mail" && <Field label="MailReceived" value={stringField(data.MailReceived || "ExampleMail")} onChange={(MailReceived) => patchData({ MailReceived })} />}
        {reward.type === "Friendship" && <>
          <Field label="NPC" value={stringField(data.NpcName || "")} onChange={(NpcName) => patchData({ NpcName })} />
          <Field label="友情点 Amount" value={stringField(data.Amount || "")} onChange={(Amount) => patchData({ Amount })} />
        </>}
        {reward.type === "ResetEvent" && <Field label="事件 ID EventID" value={stringField(data.EventID || "")} onChange={(EventID) => patchData({ EventID })} />}
        {reward.type === "Object" && <>
          <ItemSingleSelect label="物品 ID" options={itemOptions} value={stringField(data.ItemId || "(O)388")} onChange={(ItemId) => patchData({ ItemId })} />
          <Field label="数量 Amount" value={stringField(data.Amount || "1")} onChange={(Amount) => patchData({ Amount })} />
        </>}
        <JsonField label="奖励 Data 高级 JSON" value={data} onChange={(next) => onChange({ ...reward, data: isObject(next) ? next as JsonDict : {} })} />
      </div>
    </div>
  );
}

function SpecialOrderRandomizedEditor({ value, onChange }: { value: SpecialOrderRandomElement[]; onChange: (value: SpecialOrderRandomElement[]) => void }) {
  function updateElement(index: number, element: SpecialOrderRandomElement) {
    onChange(replaceAt(value, index, element));
  }
  return (
    <div className="stack">
      {value.map((element, index) => (
        <div className="structured-editor" key={element.id}>
          <div className="structured-editor-head">
            <strong>随机元素</strong>
            <button type="button" className="secondary" onClick={() => onChange(value.filter((item) => item.id !== element.id))}>删除</button>
          </div>
          <div className="grid two">
            <Field label="Name" value={element.name} onChange={(name) => updateElement(index, { ...element, name })} />
          </div>
          {element.values.map((row, rowIndex) => (
            <div className="story-row" key={row.id}>
              <Field label="RequiredTags" value={row.requiredTags} onChange={(requiredTags) => updateElement(index, { ...element, values: replaceAt(element.values, rowIndex, { ...row, requiredTags }) })} />
              <Field label="Value" value={row.value} onChange={(nextValue) => updateElement(index, { ...element, values: replaceAt(element.values, rowIndex, { ...row, value: nextValue }) })} />
              <button type="button" className="secondary" onClick={() => updateElement(index, { ...element, values: element.values.filter((item) => item.id !== row.id) })}>删除值</button>
            </div>
          ))}
          <button type="button" className="secondary" onClick={() => updateElement(index, { ...element, values: [...element.values, { id: makeId(), requiredTags: "", value: "" }] })}>添加值</button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => onChange([...value, { id: makeId(), name: "RandomItem", values: [{ id: makeId(), requiredTags: "", value: "" }] }])}><Icon name="plus" />添加随机元素</button>
    </div>
  );
}

function NewShopForm({ project, ruleset, itemCatalog, entry, onChange }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; entry: GameDataEntry; onChange: (entry: GameDataEntry) => void }) {
  const value = isObject(entry.value) ? entry.value : {};
  const owners = Array.isArray(value.Owners) ? value.Owners.filter(isObject) : [];
  const items = Array.isArray(value.Items) ? value.Items.filter(isObject) : [];
  const itemOptions = itemSelectionOptions(project, ruleset, itemCatalog, "qualified");
  const updateValue = (patch: JsonDict) => onChange({ ...entry, target: "Data/Shops", value: compactObject({ ...value, ...patch }) });
  return (
    <div className="stack">
      <div className="grid two">
        <Field label="新商店 ID" value={entry.key} onChange={(key) => onChange({ ...entry, target: "Data/Shops", key: normalizeInternalName(key || modScopedId(project, "CustomShop")) })} />
        <ComboField label="货币 Currency" value={value.Currency ?? 0} options={SHOP_CURRENCY_OPTIONS} onChange={(next) => updateValue({ Currency: numberOrText(String(next)) })} />
        <Field label="打开音效 OpenSound" value={stringField(value.OpenSound)} onChange={(next) => updateValue({ OpenSound: setNullableText(next) })} />
        <Field label="购买音效 PurchaseSound" value={stringField(value.PurchaseSound)} onChange={(next) => updateValue({ PurchaseSound: setNullableText(next) })} />
        <Field label="关闭消息 ClosedMessage" value={stringField(value.ClosedMessage)} onChange={(next) => updateValue({ ClosedMessage: setNullableText(next) })} />
        <Field label="商店主题 Theme" value={stringField(value.Theme)} onChange={(next) => updateValue({ Theme: setNullableText(next) })} />
      </div>
      <CollapsibleSubsection title="店主 Owners">
        <div className="stack">
          {owners.map((owner, index) => <ShopOwnerEditor key={index} owner={owner} index={index} onChange={(next) => updateValue({ Owners: replaceAt(owners, index, next) })} onRemove={() => updateValue({ Owners: owners.filter((_, itemIndex) => itemIndex !== index) })} />)}
          <button type="button" className="secondary" onClick={() => updateValue({ Owners: [...owners, defaultShopOwner(entry.key)] })}><Icon name="plus" />添加店主</button>
        </div>
      </CollapsibleSubsection>
      <CollapsibleSubsection title="出售商品 Items">
        <div className="stack">
          {items.map((item, index) => <ShopItemEditor key={index} item={item} itemOptions={itemOptions} onChange={(next) => updateValue({ Items: replaceAt(items, index, next) })} onRemove={() => updateValue({ Items: items.filter((_, itemIndex) => itemIndex !== index) })} />)}
          <button type="button" className="secondary" onClick={() => updateValue({ Items: [...items, defaultShopItem(`${entry.key}.Item${items.length + 1}`, "(O)233")] })}><Icon name="plus" />添加商品</button>
        </div>
      </CollapsibleSubsection>
      <WhenBuilder ruleset={ruleset} value={entry.when} onChange={(when) => onChange({ ...entry, when })} />
      <JsonField label="商店高级字段" value={publicAdvancedValue(value, ["Owners", "Items", "Currency", "OpenSound", "PurchaseSound", "ClosedMessage", "Theme"])} onChange={(next) => onChange({ ...entry, value: { ...pickObjectFields(value, ["Owners", "Items", "Currency", "OpenSound", "PurchaseSound", "ClosedMessage", "Theme"]), ...(next as JsonDict) } })} />
    </div>
  );
}

function EditShopItemsForm({ project, ruleset, itemCatalog, entry, onChange }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; entry: GameDataEntry; onChange: (entry: GameDataEntry) => void }) {
  const targetField = shopTargetField(entry);
  const shopId = targetField[0] || "SeedShop";
  const itemOptions = itemSelectionOptions(project, ruleset, itemCatalog, "qualified");
  const item = isObject(entry.value) ? entry.value : defaultShopItem(entry.key || "ExampleItem", "(O)128");
  const removeMode = entry.value === null;
  const publicAdvancedFields = publicAdvanced(entry.advanced);
  const moveEntries = Array.isArray(publicAdvancedFields.MoveEntries) ? publicAdvancedFields.MoveEntries.filter(isObject) : [];
  const firstMove = moveEntries[0] || {};
  const updateAdvanced = (patch: JsonDict) => onChange({ ...entry, advanced: mergePublicAdvanced(entry.advanced, patch) });
  return (
    <div className="stack">
      <div className="grid two">
        <ComboField label="要修改的 Vanilla / 自定义商店 ID" value={shopId} options={shopIdOptions(project)} onChange={(next) => updateAdvanced({ TargetField: [String(next), "Items"] })} />
        <BoolField label="删除该商品" value={removeMode} onChange={(next) => onChange({ ...entry, value: next ? null : item })} />
        <Field label={removeMode ? "要删除的商品 ID" : "商品条目 ID"} value={entry.key} onChange={(next) => onChange({ ...entry, key: next, value: removeMode ? null : { ...item, Id: next } })} />
        <div className="field"><span>导出 TargetField</span><code>{JSON.stringify([shopId, "Items"])}</code></div>
      </div>
      {!removeMode && <ShopItemEditor item={item} itemOptions={itemOptions} onChange={(next) => onChange({ ...entry, target: "Data/Shops", key: stringField(next.Id || entry.key), value: next })} />}
      <CollapsibleSubsection title="排序 MoveEntries" defaultOpen={false}>
        <div className="grid two">
          <Field label="BeforeId：移动到此 ID 前" value={stringField(firstMove.BeforeId)} onChange={(next) => updateAdvanced({ MoveEntries: next ? [{ Id: entry.key, BeforeId: next }] : [] })} />
          <Field label="AfterId：移动到此 ID 后" value={stringField(firstMove.AfterId)} onChange={(next) => updateAdvanced({ MoveEntries: next ? [{ Id: entry.key, AfterId: next }] : [] })} />
        </div>
      </CollapsibleSubsection>
      <WhenBuilder ruleset={ruleset} value={entry.when} onChange={(when) => onChange({ ...entry, when })} />
    </div>
  );
}

function OpenShopMapPatchForm({ project, ruleset, mapResources, patch, onChange }: { project: Project; ruleset: Ruleset; mapResources: MapResourceEntry[]; patch: Patch; onChange: (patch: Patch) => void }) {
  const meta = shopOpenMetaFromPatch(patch);
  const preview = previewForMapTarget(project, meta.mapTarget, mapResources);
  const updateMeta = (next: Partial<ShopOpenMeta>) => {
    const merged = { ...meta, ...next };
    onChange(withShopOpenMetadata({ ...patch, action: "EditMap", target: merged.mapTarget, fields: shopOpenMapFields(merged.shopId, merged.position, merged.direction, merged.openTime, merged.closeTime, merged.ownerArea) }));
  };
  return (
    <div className="stack">
      <div className="grid two">
        <ComboField label="Shop ID" value={meta.shopId} options={shopIdOptions(project)} onChange={(next) => updateMeta({ shopId: String(next) })} />
        <ComboField label="目标地图 Target" value={meta.mapTarget} options={mapTargetOptions(project, ruleset)} onChange={(next) => updateMeta({ mapTarget: String(next) })} />
        <ComboField label="玩家相对方向" value={meta.direction} options={SHOP_DIRECTION_OPTIONS} onChange={(next) => updateMeta({ direction: String(next) })} />
        <ComboField label="开门时间" value={meta.openTime} options={SHOP_TIME_OPTIONS} onChange={(next) => updateMeta({ openTime: String(next) })} />
        <ComboField label="关门时间" value={meta.closeTime} options={SHOP_TIME_OPTIONS} onChange={(next) => updateMeta({ closeTime: String(next) })} />
        <Field label="X" value={String(meta.position.X)} onChange={(next) => updateMeta({ position: { ...meta.position, X: integerInRange(next, 0, 999, 0) } })} />
        <Field label="Y" value={String(meta.position.Y)} onChange={(next) => updateMeta({ position: { ...meta.position, Y: integerInRange(next, 0, 999, 0) } })} />
      </div>
      {preview && <MapPreviewPicker title="开店点坐标" image={preview} selected={meta.position} onPick={(point) => updateMeta({ position: point })} />}
      <CollapsibleSubsection title="店主所在区域 owner tile area" defaultOpen={false}>
        <div className="grid two">
          <BoolField label="写入 owner tile area" value={Boolean(meta.ownerArea)} onChange={(next) => updateMeta({ ownerArea: next ? { X: meta.position.X, Y: meta.position.Y, Width: 1, Height: 1 } : null })} />
          {meta.ownerArea && <>
            <Field label="区域 X" value={String(meta.ownerArea.X)} onChange={(next) => updateMeta({ ownerArea: { ...meta.ownerArea!, X: integerInRange(next, 0, 999, 0) } })} />
            <Field label="区域 Y" value={String(meta.ownerArea.Y)} onChange={(next) => updateMeta({ ownerArea: { ...meta.ownerArea!, Y: integerInRange(next, 0, 999, 0) } })} />
            <Field label="区域宽 Width" value={String(meta.ownerArea.Width)} onChange={(next) => updateMeta({ ownerArea: { ...meta.ownerArea!, Width: integerInRange(next, 1, 999, 1) } })} />
            <Field label="区域高 Height" value={String(meta.ownerArea.Height)} onChange={(next) => updateMeta({ ownerArea: { ...meta.ownerArea!, Height: integerInRange(next, 1, 999, 1) } })} />
          </>}
        </div>
      </CollapsibleSubsection>
      <div className="notice compact-note">当前 Action：<code>{buildOpenShopAction(meta.shopId, meta.direction, meta.openTime, meta.closeTime, meta.ownerArea)}</code></div>
      <WhenBuilder ruleset={ruleset} value={patch.when} onChange={(when) => onChange({ ...patch, when })} />
    </div>
  );
}

function ShopItemEditor({ item, itemOptions, onChange, onRemove }: { item: JsonDict; itemOptions: ItemOption[]; onChange: (item: JsonDict) => void; onRemove?: () => void }) {
  const patch = (next: JsonDict) => onChange(compactObject({ ...item, ...next }));
  return (
    <CollapsibleSubsection title={stringField(item.Id || "ShopItem")} className="shop-nested-editor" stateKey={`shop-item:${stringField(item.Id || "new")}`}>
      <div className="grid two">
        <Field label="商品条目 ID" value={stringField(item.Id)} onChange={(next) => patch({ Id: next })} />
        <ItemSingleSelect label="出售物品 ItemId" options={itemOptions} value={stringField(item.ItemId)} onChange={(next) => patch({ ItemId: next })} />
        <Field label="价格 Price（留空用默认价）" value={stringField(item.Price)} onChange={(next) => patch({ Price: next.trim() ? numberOrText(next) : undefined })} />
        <ConditionField label="上架条件 Condition" value={item.Condition} onChange={(next) => patch({ Condition: next })} placeholder="SEASON Summer" />
        <Field label="库存 AvailableStock" value={stringField(item.AvailableStock)} onChange={(next) => patch({ AvailableStock: next.trim() ? numberOrText(next) : undefined })} />
        <ComboField label="库存限制 AvailableStockLimit" value={item.AvailableStockLimit || ""} options={SHOP_STOCK_LIMIT_OPTIONS} onChange={(next) => patch({ AvailableStockLimit: next || undefined })} />
        <Field label="每次购买数量 Stack" value={stringField(item.Stack)} onChange={(next) => patch({ Stack: next.trim() ? numberOrText(next) : undefined })} />
        <ItemSingleSelect label="交易物品 TradeItemId" options={itemOptions} value={stringField(item.TradeItemId)} onChange={(next) => patch({ TradeItemId: setNullableText(next) })} />
        <Field label="交易数量 TradeItemAmount" value={stringField(item.TradeItemAmount)} onChange={(next) => patch({ TradeItemAmount: next.trim() ? numberOrText(next) : undefined })} />
        <BoolField label="这是配方 IsRecipe" value={Boolean(item.IsRecipe)} onChange={(next) => patch({ IsRecipe: next })} />
      </div>
      <JsonField label="商品高级字段" value={publicAdvancedValue(item, ["Id", "ItemId", "Price", "Condition", "AvailableStock", "AvailableStockLimit", "Stack", "TradeItemId", "TradeItemAmount", "IsRecipe"])} onChange={(next) => onChange({ ...pickObjectFields(item, ["Id", "ItemId", "Price", "Condition", "AvailableStock", "AvailableStockLimit", "Stack", "TradeItemId", "TradeItemAmount", "IsRecipe"]), ...(next as JsonDict) })} />
      {onRemove && <div className="button-row"><button type="button" className="secondary" onClick={onRemove}>删除商品</button></div>}
    </CollapsibleSubsection>
  );
}

function ShopOwnerEditor({ owner, index, onChange, onRemove }: { owner: JsonDict; index: number; onChange: (owner: JsonDict) => void; onRemove: () => void }) {
  const dialogues = Array.isArray(owner.Dialogues) ? owner.Dialogues.filter(isObject) : [];
  const patch = (next: JsonDict) => onChange(compactObject({ ...owner, ...next }));
  return (
    <CollapsibleSubsection title={`店主 ${index + 1}: ${stringField(owner.Name || "Any")}`} className="shop-nested-editor" stateKey={`shop-owner:${index}:${stringField(owner.Name || "Any")}`}>
      <div className="grid two">
        <Field label="Name（NPC 名或 Any）" value={stringField(owner.Name || "Any")} onChange={(next) => patch({ Name: next || "Any" })} />
        <ConditionField label="店主条件 Condition" value={owner.Condition} onChange={(next) => patch({ Condition: next })} placeholder="SEASON Summer" />
        <Field label="关闭消息 ClosedMessage" value={stringField(owner.ClosedMessage)} onChange={(next) => patch({ ClosedMessage: setNullableText(next) })} />
      </div>
      <div className="stack">
        {dialogues.map((dialogue, dialogueIndex) => (
          <div className="card compact-card" key={dialogueIndex}>
            <div className="grid two">
              <Field label="Dialogue ID" value={stringField(dialogue.Id)} onChange={(next) => patch({ Dialogues: replaceAt(dialogues, dialogueIndex, { ...dialogue, Id: next }) })} />
              <ConditionField label="Dialogue Condition" value={dialogue.Condition} onChange={(next) => patch({ Dialogues: replaceAt(dialogues, dialogueIndex, { ...dialogue, Condition: next }) })} placeholder="SEASON Summer, WEATHER Here Sun" />
              <DialogueTextareaWithTools label="Dialogue" value={stringField(dialogue.Dialogue)} onChange={(next) => patch({ Dialogues: replaceAt(dialogues, dialogueIndex, { ...dialogue, Dialogue: next }) })} stateKey={`dialogue:shop-owner:${index}:${dialogueIndex}`} />
            </div>
            <button type="button" className="secondary" onClick={() => patch({ Dialogues: dialogues.filter((_, itemIndex) => itemIndex !== dialogueIndex) })}>删除对话</button>
          </div>
        ))}
        <button type="button" className="secondary" onClick={() => patch({ Dialogues: [...dialogues, { Id: `Dialogue${dialogues.length + 1}`, Dialogue: "Welcome!" }] })}><Icon name="plus" />添加店主对话</button>
      </div>
      <div className="button-row"><button type="button" className="secondary" onClick={onRemove}>删除店主</button></div>
    </CollapsibleSubsection>
  );
}

function MapStudio({ project, ruleset, setProject }: { project: Project; ruleset: Ruleset; setProject: (project: Project) => void }) {
  const [addPanelOpen, setAddPanelOpen] = useState(true);
  const [drafts, setDrafts] = useState<MapDraft[]>(() => mapDraftsFromProject(project));
  const [mapResources, setMapResources] = useState<MapResourceResponse>({ maps: [], source_path: "", warning: "" });

  useEffect(() => {
    let cancelled = false;
    fetchJson<MapResourceResponse>("/api/maps/resources")
      .then((next) => { if (!cancelled) setMapResources(next); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setDrafts(mapDraftsFromProject(project));
  }, [project.meta.id, project.meta.updated_at]);

  function addDraft(kind: MapDraftKind) {
    setDrafts([...drafts, { id: makeId(), kind, generated: [] }]);
  }

  function removeDraft(id: string) {
    const draft = drafts.find((item) => item.id === id);
    setDrafts(drafts.filter((draft) => draft.id !== id));
    if (!draft) return;
    const generatedRefs = draft.generated.length ? draft.generated : draft.kind === "custom" ? [
      { target: "Data/Locations", key: "Custom_ExampleCave" },
      { action: "Load" as const, target: "Maps/Custom_ExampleCave" }
    ] : [];
    setProject({
      ...project,
      game_data: project.game_data.filter((entry) => !isMapDraftOwned(entry.advanced, id) && !generatedRefs.some((ref) => mapRefMatchesEntry(ref, entry))),
      patches: project.patches.filter((patch) => !isMapDraftOwned(patch.advanced, id) && !generatedRefs.some((ref) => mapRefMatchesPatch(ref, patch)))
    });
  }

  function recordGenerated(id: string, refs: MapGeneratedRef[]) {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, generated: refs } : draft));
  }

  return (
    <Section title="地图添加">
      <div className={`map-module-layout ${addPanelOpen ? "" : "add-panel-collapsed"}`}>
        <aside className="game-data-add-panel">
          <button type="button" className="secondary game-data-add-toggle" onClick={() => setAddPanelOpen(!addPanelOpen)}>
            <Icon name="menu" />{addPanelOpen && "添加地图操作"}
          </button>
          {addPanelOpen && (
            <div className="game-data-add-list">
              <button type="button" className="compact-add-button" onClick={() => addDraft("custom")}><Icon name="plus" /><span>自定义新地图</span></button>
              <button type="button" className="compact-add-button" onClick={() => addDraft("edit")}><Icon name="plus" /><span>修改原有地图</span></button>
              <button type="button" className="compact-add-button" onClick={() => addDraft("warp")}><Icon name="plus" /><span>添加传送点</span></button>
              <button type="button" className="compact-add-button" onClick={() => addDraft("tilesheets")}><Icon name="plus" /><span>额外贴图文件</span></button>
            </div>
          )}
        </aside>
        <div className="stack game-data-stack">
          {drafts.map((draft, index) => (
            <article className="card" key={draft.id}>
              <div className="card-head">
                <strong>{index + 1}. {draft.kind === "custom" ? "自定义新地图" : draft.kind === "edit" ? "修改原有地图" : draft.kind === "warp" ? "添加传送点" : "额外贴图文件"}</strong>
                <button type="button" className="secondary" onClick={() => removeDraft(draft.id)}>删除</button>
              </div>
              {draft.kind === "custom" && <CustomMapDraftForm draftId={draft.id} initial={customMapDraftInitial(project, draft.id)} project={project} setProject={setProject} onGenerated={(refs) => recordGenerated(draft.id, refs)} />}
              {draft.kind === "edit" && <EditMapDraftForm draftId={draft.id} project={project} ruleset={ruleset} setProject={setProject} mapResources={mapResources.maps} onGenerated={(refs) => recordGenerated(draft.id, refs)} />}
              {draft.kind === "warp" && <MapWarpDraftForm draftId={draft.id} initial={warpMapDraftInitial(project, draft.id)} project={project} ruleset={ruleset} setProject={setProject} mapResources={mapResources.maps} onGenerated={(refs) => recordGenerated(draft.id, refs)} />}
              {draft.kind === "tilesheets" && <MapTilesheetDraftForm draftId={draft.id} project={project} setProject={setProject} onGenerated={(refs) => recordGenerated(draft.id, refs)} />}
            </article>
          ))}
          {!drafts.length && <div className="empty compact-empty">暂无地图操作。请从左侧添加。</div>}
        </div>
      </div>
    </Section>
  );
}

function isMapDraftOwned(advanced: JsonDict | undefined, draftId: string) {
  const studio = isObject(advanced?.StardewCPStudio) ? advanced?.StardewCPStudio as JsonDict : {};
  const mapDraft = isObject(studio.mapDraft) ? studio.mapDraft as JsonDict : {};
  return mapDraft.draftId === draftId;
}

function mapDraftId(advanced: JsonDict | undefined) {
  const studio = isObject(advanced?.StardewCPStudio) ? advanced?.StardewCPStudio as JsonDict : {};
  const mapDraft = isObject(studio.mapDraft) ? studio.mapDraft as JsonDict : {};
  return typeof mapDraft.draftId === "string" ? mapDraft.draftId : "";
}

function mapDraftKind(advanced: JsonDict | undefined): MapDraftKind | "" {
  const studio = isObject(advanced?.StardewCPStudio) ? advanced?.StardewCPStudio as JsonDict : {};
  const mapDraft = isObject(studio.mapDraft) ? studio.mapDraft as JsonDict : {};
  return mapDraft.kind === "custom" || mapDraft.kind === "edit" || mapDraft.kind === "warp" || mapDraft.kind === "tilesheets" ? mapDraft.kind : "";
}

function mapDraftsFromProject(project: Project): MapDraft[] {
  const byId = new Map<string, MapDraft>();
  function add(draftId: string, kind: MapDraftKind, ref: MapGeneratedRef) {
    if (!draftId) return;
    const existing = byId.get(draftId);
    if (existing) existing.generated.push(ref);
    else byId.set(draftId, { id: draftId, kind, generated: [ref] });
  }
  for (const entry of project.game_data) {
    const draftId = mapDraftId(entry.advanced);
    const kind = mapDraftKind(entry.advanced);
    if (draftId && kind) add(draftId, kind, { target: entry.target, key: entry.key });
  }
  for (const patch of project.patches) {
    const draftId = mapDraftId(patch.advanced);
    const kind = mapDraftKind(patch.advanced);
    if (draftId && kind) add(draftId, kind, { action: patch.action, target: patch.target, from_file: patch.from_file ?? null });
  }
  for (const entry of project.game_data) {
    if (entry.target !== "Data/Locations" || mapDraftId(entry.advanced)) continue;
    const value = isObject(entry.value) ? entry.value as JsonDict : {};
    const createOnLoad = isObject(value.CreateOnLoad) ? value.CreateOnLoad as JsonDict : {};
    const mapPath = stringField(createOnLoad.MapPath);
    if (!entry.key || !mapPath.startsWith("Maps/")) continue;
    add(`restored-custom-${entry.key}`, "custom", { target: entry.target, key: entry.key });
    const loadPatch = project.patches.find((patch) => patch.action === "Load" && patch.target === mapPath);
    if (loadPatch) add(`restored-custom-${entry.key}`, "custom", { action: "Load", target: loadPatch.target, from_file: loadPatch.from_file ?? null });
  }
  project.patches.forEach((patch, index) => {
    if (mapDraftId(patch.advanced)) return;
    if (patch.action === "EditMap" && (Array.isArray(patch.fields.AddWarps) || Array.isArray(patch.fields.AddNpcWarps))) {
      add(`restored-warp-${patch.id || index}`, "warp", { action: patch.action, target: patch.target, from_file: patch.from_file ?? null });
    }
  });
  const restored = Array.from(byId.values()).filter((draft) => draft.kind === "custom" || draft.kind === "warp" || draft.kind === "edit" || draft.kind === "tilesheets");
  return restored.length ? restored : [{ id: makeId(), kind: "custom", generated: [] }];
}

function mapRefMatchesEntry(ref: MapGeneratedRef, entry: GameDataEntry) {
  return ref.target === entry.target && (ref.key === undefined || ref.key === entry.key);
}

function mapRefMatchesPatch(ref: MapGeneratedRef, patch: Patch) {
  return ref.action === patch.action && ref.target === patch.target && (ref.from_file === undefined || (ref.from_file ?? null) === (patch.from_file ?? null));
}

function withMapDraftAdvanced<T extends { advanced: JsonDict }>(item: T, draftId: string, kind: MapDraftKind): T {
  const studio = isObject(item.advanced.StardewCPStudio) ? item.advanced.StardewCPStudio as JsonDict : {};
  return {
    ...item,
    advanced: {
      ...item.advanced,
      StardewCPStudio: {
        ...studio,
        mapDraft: { draftId, kind }
      }
    }
  };
}

function customMapDraftInitial(project: Project, draftId: string): CustomMapDraftInitial {
  const restoredKey = draftId.startsWith("restored-custom-") ? draftId.replace(/^restored-custom-/, "") : "";
  const entry = project.game_data.find((item) =>
    item.target === "Data/Locations" &&
    (isMapDraftOwned(item.advanced, draftId) || Boolean(restoredKey && item.key === restoredKey))
  );
  const value = isObject(entry?.value) ? entry.value as JsonDict : {};
  const studio = isObject(entry?.advanced?.StardewCPStudio) ? entry?.advanced.StardewCPStudio as JsonDict : {};
  const mapMeta = isObject(studio.map) ? studio.map as JsonDict : {};
  const mapKey = stringField(entry?.key || mapMeta.key || "Custom_ExampleCave");
  const mapKeyRaw = mapKey.replace(/^Custom_/, "") || "ExampleCave";
  const loadPatch = project.patches.find((patch) => patch.action === "Load" && patch.target === `Maps/${mapKey}`);
  const arrival = isObject(value.DefaultArrivalTile) ? value.DefaultArrivalTile as JsonDict : {};
  const displayNameKey = i18nKeyFromRef(value.DisplayName);
  const inferredPreview = stringField(mapMeta.previewFile || `assets/Maps/${mapKey}/preview.png`);
  const previewFile = previewAssetForPath(project, inferredPreview) ? inferredPreview : stringField(mapMeta.previewFile || "");
  return {
    mapKeyRaw,
    displayName: displayNameKey ? stringField(project.i18n[displayNameKey] || mapKeyRaw) : mapKeyRaw,
    mapFile: stringField(mapMeta.mapFile || loadPatch?.from_file || ""),
    previewFile,
    arrival: { X: integerInRange(arrival.X, 0, 999, 0), Y: integerInRange(arrival.Y, 0, 999, 0) },
    locationType: stringField(value.Type || "Default"),
    alwaysActive: Boolean(value.AlwaysActive),
    canPlant: Boolean(value.CanPlantHere),
    greenRainSpawns: Boolean(value.CanHaveGreenRainSpawns),
    excludePathfinding: Boolean(value.ExcludeFromNpcPathfinding)
  };
}

function warpMapDraftInitial(project: Project, draftId: string): WarpMapDraftInitial {
  const restoredWarpId = draftId.startsWith("restored-warp-") ? draftId.replace(/^restored-warp-/, "") : "";
  const patch = project.patches.find((item) => item.action === "EditMap" && isMapDraftOwned(item.advanced, draftId)) ||
    (restoredWarpId ? project.patches.find((item, index) => item.action === "EditMap" && (item.id || String(index)) === restoredWarpId) : undefined) ||
    project.patches.find((item) => item.action === "EditMap" && (Array.isArray(item.fields.AddWarps) || Array.isArray(item.fields.AddNpcWarps)));
  const studio = isObject(patch?.advanced?.StardewCPStudio) ? patch?.advanced.StardewCPStudio as JsonDict : {};
  const saved = isObject(studio.mapWarp) ? studio.mapWarp as JsonDict : {};
  if (Object.keys(saved).length) {
    return {
      warpSourceMap: stringField(saved.warpSourceMap || patch?.target || "Maps/Town"),
      warpTargetMap: stringField(saved.warpTargetMap || "Maps/Farm"),
      warpFrom: mapPointFromUnknown(saved.warpFrom),
      warpTo: mapPointFromUnknown(saved.warpTo),
      warpKind: saved.warpKind === "AddNpcWarps" ? "AddNpcWarps" : "AddWarps"
    };
  }
  const warpKind = Array.isArray(patch?.fields?.AddNpcWarps) ? "AddNpcWarps" : "AddWarps";
  const raw = Array.isArray(patch?.fields?.[warpKind]) ? stringField((patch?.fields?.[warpKind] as unknown[])[0]) : "";
  const parts = raw.split(/\s+/).filter(Boolean);
  return {
    warpSourceMap: stringField(patch?.target || "Maps/Town"),
    warpTargetMap: parts[2] ? `Maps/${parts[2]}` : "Maps/Farm",
    warpFrom: { X: integerInRange(parts[0], 0, 999, 0), Y: integerInRange(parts[1], 0, 999, 0) },
    warpTo: { X: integerInRange(parts[3], 0, 999, 0), Y: integerInRange(parts[4], 0, 999, 0) },
    warpKind
  };
}

function mapPointFromUnknown(value: unknown): MapPoint {
  const point = isObject(value) ? value : {};
  return { X: integerInRange(point.X, 0, 999, 0), Y: integerInRange(point.Y, 0, 999, 0) };
}

function CustomMapDraftForm({ draftId, initial, project, setProject, onGenerated }: { draftId: string; initial: CustomMapDraftInitial; project: Project; setProject: (project: Project) => void; onGenerated: (refs: MapGeneratedRef[]) => void }) {
  const [mapKeyRaw, setMapKeyRaw] = useState(initial.mapKeyRaw);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [mapFile, setMapFile] = useState(initial.mapFile);
  const [previewFile, setPreviewFile] = useState(initial.previewFile);
  const [arrival, setArrival] = useState<MapPoint>(initial.arrival);
  const [locationType, setLocationType] = useState(initial.locationType);
  const [alwaysActive, setAlwaysActive] = useState(initial.alwaysActive);
  const [canPlant, setCanPlant] = useState(initial.canPlant);
  const [greenRainSpawns, setGreenRainSpawns] = useState(initial.greenRainSpawns);
  const [excludePathfinding, setExcludePathfinding] = useState(initial.excludePathfinding);
  const [status, setStatus] = useState("");
  const mapKey = customMapKey(mapKeyRaw);
  const customPreview = previewAssetForPath(project, previewFile);

  function upsertCustomMap(nextProject = project, nextMapFile = mapFile, nextPreviewFile = previewFile) {
    if (!nextMapFile) {
      setStatus("请先导入 tmx/tbin 地图文件。");
      return;
    }
    const displayNameKey = locationI18nKey(nextProject, mapKey, "Name");
    const locationEntry = createWorkflowEntry("custom", `${mapKey} 地点数据`, "Data/Locations", mapKey, compactObject({
      DisplayName: i18nRef(displayNameKey),
      CreateOnLoad: { MapPath: `Maps/${mapKey}` },
      DefaultArrivalTile: arrival,
      Type: locationType || undefined,
      AlwaysActive: alwaysActive || undefined,
      CanPlantHere: canPlant || undefined,
      CanHaveGreenRainSpawns: greenRainSpawns || undefined,
      ExcludeFromNpcPathfinding: excludePathfinding || undefined
    }));
    const locationEntryWithMeta: GameDataEntry = {
      ...locationEntry,
      advanced: {
        ...locationEntry.advanced,
        StardewCPStudio: {
          ...(isObject(locationEntry.advanced.StardewCPStudio) ? locationEntry.advanced.StardewCPStudio as JsonDict : {}),
          map: { key: mapKey, mapFile: nextMapFile, previewFile: nextPreviewFile },
          mapDraft: { draftId, kind: "custom" }
        }
      }
    };
    const loadPatch: Patch = withMapDraftAdvanced({
      id: makeId(),
      name: `加载地图 ${mapKey}`,
      action: "Load",
      enabled: true,
      target: `Maps/${mapKey}`,
      from_file: nextMapFile,
      when: {},
      fields: {},
      advanced: {}
    }, draftId, "custom");
    setProject({
      ...nextProject,
      game_data: mergeWorkflowEntries(nextProject.game_data, [locationEntryWithMeta]),
      patches: mergeWorkflowPatches(nextProject.patches, [loadPatch]),
      i18n: { ...nextProject.i18n, [displayNameKey]: displayName || mapKey }
    });
    onGenerated([
      { target: "Data/Locations", key: mapKey },
      { action: "Load", target: `Maps/${mapKey}`, from_file: nextMapFile }
    ]);
    setStatus(`已生成 ${mapKey} 的 Data/Locations 与 Load Maps/${mapKey}。`);
  }

  return (
    <div className="map-studio">
      {status && <div className="status">{status}</div>}
      <div className="grid two">
        <Field label="地图 Key（自动 Custom_ 前缀）" value={mapKeyRaw} onChange={setMapKeyRaw} />
        <div className="field"><span>最终地图 Key</span><code>{mapKey}</code></div>
        <Field label="显示名称 DisplayName" value={displayName} onChange={setDisplayName} />
        <ComboField label="地点类型 Type" value={locationType} options={MAP_LOCATION_TYPE_OPTIONS} onChange={(value) => setLocationType(String(value))} />
        <Field label="默认到达 X" value={String(arrival.X)} onChange={(value) => setArrival({ ...arrival, X: integerInRange(value, 0, 999, 0) })} />
        <Field label="默认到达 Y" value={String(arrival.Y)} onChange={(value) => setArrival({ ...arrival, Y: integerInRange(value, 0, 999, 0) })} />
        <BoolField label="AlwaysActive" value={alwaysActive} onChange={setAlwaysActive} />
        <BoolField label="CanPlantHere" value={canPlant} onChange={setCanPlant} />
        <BoolField label="CanHaveGreenRainSpawns" value={greenRainSpawns} onChange={setGreenRainSpawns} />
        <BoolField label="ExcludeFromNpcPathfinding" value={excludePathfinding} onChange={setExcludePathfinding} />
        <TargetedAssetImport label="导入地图文件 tmx/tbin" project={project} accept=".tmx,.tbin" storedPath={`assets/Maps/${mapKey}/${mapKey}.tmx`} onImported={(nextProject, storedPath) => { setMapFile(storedPath); upsertCustomMap(nextProject, storedPath, previewFile); }} />
        <TargetedAssetImport label="导入预览图 PNG" project={project} accept="image/png,image/jpeg,image/webp" storedPath={`assets/Maps/${mapKey}/preview.png`} onImported={(nextProject, storedPath) => { setPreviewFile(storedPath); upsertCustomMap(nextProject, mapFile, storedPath); }} />
      </div>
      <div className="button-row">
        <button type="button" onClick={() => upsertCustomMap()}><Icon name="plus" />生成/更新自定义地图</button>
      </div>
      {customPreview && <MapPreviewPicker title="预览图坐标" image={assetToMapPreview(customPreview)} selected={arrival} onPick={setArrival} />}
    </div>
  );
}

type TilesheetDraftItem = { id: string; file: File; name: string; draftName: string; storedPath: string; previewUrl: string; assetId?: string; status: string };

function MapTilesheetDraftForm({ draftId, project, setProject, onGenerated }: { draftId: string; project: Project; setProject: (project: Project) => void; onGenerated: (refs: MapGeneratedRef[]) => void }) {
  const [items, setItems] = useState<TilesheetDraftItem[]>([]);
  const [status, setStatus] = useState("");
  const target = tilesheetLoadTarget(items);
  const fromFile = "assets/Tilesheets/{{TargetWithoutPath}}.png";

  async function importItem(baseProject: Project, item: TilesheetDraftItem) {
    const storedPath = tilesheetStoredPath(item.name);
    const response = await importProjectAssetWithRecord(baseProject, item.file, storedPath);
    return {
      project: response.project,
      item: {
        ...item,
        storedPath,
        assetId: response.asset.id,
        status: `已导入：${storedPath}`
      }
    };
  }

  async function importFiles(files: File[]) {
    let nextProject = project;
    const imported: TilesheetDraftItem[] = [];
    for (const file of files) {
      const name = normalizeTilesheetName(file.name.replace(/\.[^.]+$/, ""));
      const previewUrl = URL.createObjectURL(file);
      const item: TilesheetDraftItem = { id: makeId(), file, name, draftName: name, storedPath: tilesheetStoredPath(name), previewUrl, status: "导入中..." };
      try {
        const result = await importItem(nextProject, item);
        nextProject = result.project;
        imported.push(result.item);
      } catch (error) {
        imported.push({ ...item, status: `导入失败：${readError(error)}` });
      }
    }
    setItems((current) => [...current, ...imported]);
    setProject(nextProject);
    setStatus(imported.length ? `已导入 ${imported.length} 张贴图。` : "");
  }

  function updateDraftName(index: number, nextName: string) {
    const item = items[index];
    if (!item) return;
    setItems(replaceAt(items, index, { ...item, draftName: nextName }));
  }

  async function applyRename(index: number) {
    const item = items[index];
    if (!item) return;
    const renamed = { ...item, name: normalizeTilesheetName(item.draftName), draftName: normalizeTilesheetName(item.draftName), status: "正在更新文件名..." };
    setItems(replaceAt(items, index, renamed));
    try {
      const result = await importItem(project, renamed);
      setProject(result.project);
      setItems((current) => replaceAt(current, index, result.item));
    } catch (error) {
      setItems((current) => replaceAt(current, index, { ...renamed, status: `重命名导入失败：${readError(error)}` }));
    }
  }

  function removeItem(index: number) {
    setItems(items.filter((_, itemIndex) => itemIndex !== index));
  }

  function upsertTilesheetLoad() {
    const validItems = items.filter((item) => item.name.trim());
    if (!validItems.length) {
      setStatus("请先导入至少一张 PNG 贴图。");
      return;
    }
    const patch: Patch = withMapDraftAdvanced({
      id: makeId(),
      name: "加载地图额外贴图文件",
      action: "Load",
      enabled: true,
      target: tilesheetLoadTarget(validItems),
      from_file: fromFile,
      when: {},
      fields: { Priority: "Low" },
      advanced: {}
    }, draftId, "tilesheets");
    setProject({
      ...project,
      patches: mergeWorkflowPatches(project.patches, [patch])
    });
    onGenerated([{ action: "Load", target: patch.target, from_file: fromFile }]);
    setStatus(`已生成总导入：${patch.target}`);
  }

  return (
    <div className="map-studio">
      {status && <div className="status">{status}</div>}
      <div className="grid two">
        <label className="field character-asset-field">
          <span>导入多张 PNG 贴图</span>
          <input type="file" accept="image/png" multiple onChange={(event) => importFiles(Array.from(event.target.files || []))} />
          <code>assets/Tilesheets/&lt;文件名&gt;.png</code>
        </label>
        <div className="field">
          <span>总 Load Target</span>
          <code>{target || "Maps/<文件名>, Maps/<文件名>"}</code>
        </div>
        <div className="field">
          <span>总 FromFile</span>
          <code>{fromFile}</code>
        </div>
      </div>
      <div className="tilesheet-grid">
        {items.map((item, index) => (
          <div className="tilesheet-card" key={item.id}>
            <img src={item.previewUrl} alt={item.name} />
            <Field label="文件名（不含 .png）" value={item.draftName} onChange={(next) => updateDraftName(index, next)} />
            <code>{item.storedPath}</code>
            <small>{item.status}</small>
            <div className="button-row">
              <button type="button" className="secondary" onClick={() => applyRename(index)}>应用文件名</button>
              <button type="button" className="secondary" onClick={() => removeItem(index)}>删除贴图</button>
            </div>
          </div>
        ))}
        {!items.length && <div className="empty compact-empty">还没有导入贴图。案例中的 VanillaCraftables、AI、blanket 等就是这里的文件名。</div>}
      </div>
      <div className="button-row">
        <button type="button" onClick={upsertTilesheetLoad}><Icon name="plus" />生成/更新贴图总导入</button>
      </div>
    </div>
  );
}

function EditMapDraftForm({ draftId, project, ruleset, setProject, mapResources, onGenerated }: { draftId: string; project: Project; ruleset: Ruleset; setProject: (project: Project) => void; mapResources: MapResourceEntry[]; onGenerated: (refs: MapGeneratedRef[]) => void }) {
  const [sourceMapFile, setSourceMapFile] = useState("");
  const [sourcePreviewFile, setSourcePreviewFile] = useState("");
  const [editTarget, setEditTarget] = useState("Maps/Town");
  const [patchMode, setPatchMode] = useState("ReplaceByLayer");
  const [fromArea, setFromArea] = useState<MapArea>({ X: 0, Y: 0, Width: 4, Height: 4 });
  const [toArea, setToArea] = useState<MapArea>({ X: 0, Y: 0, Width: 4, Height: 4 });
  const [status, setStatus] = useState("");
  const allMapOptions = mapTargetOptions(project, ruleset);
  const sourcePreview = assetToMapPreview(previewAssetForPath(project, sourcePreviewFile));
  const targetPreview = previewForMapTarget(project, editTarget, mapResources);

  function addOverlayPatch() {
    if (!sourceMapFile) {
      setStatus("请先导入用于覆盖的 tmx/tbin 地图文件。");
      return;
    }
    const patch: Patch = withMapDraftAdvanced({
      id: makeId(),
      name: `地图区域替换 ${editTarget}`,
      action: "EditMap",
      enabled: true,
      target: editTarget,
      from_file: sourceMapFile,
      when: {},
      fields: {
        FromArea: fromArea,
        ToArea: { ...toArea, Width: fromArea.Width, Height: fromArea.Height },
        PatchMode: patchMode
      },
      advanced: {}
    }, draftId, "edit");
    setProject({ ...project, patches: mergeWorkflowPatches(project.patches, [patch]) });
    onGenerated([{ action: "EditMap", target: editTarget, from_file: sourceMapFile }]);
    setStatus(`已生成 EditMap 区域替换：${editTarget}`);
  }

  return (
    <div className="map-studio">
      {status && <div className="status">{status}</div>}
      <div className="grid two">
        <ComboField label="目标地图 Target" value={editTarget} options={allMapOptions} onChange={(value) => setEditTarget(String(value))} />
        <ComboField label="合并模式 PatchMode" value={patchMode} options={MAP_PATCH_MODE_OPTIONS} onChange={(value) => setPatchMode(String(value))} />
        <TargetedAssetImport label="导入替换来源 tmx/tbin" project={project} accept=".tmx,.tbin" storedPath={`assets/MapEdits/${sanitizeI18nPart(mapNameFromTarget(editTarget))}/overlay.tmx`} onImported={(nextProject, storedPath) => { setSourceMapFile(storedPath); setProject(nextProject); }} />
        <TargetedAssetImport label="导入替换来源预览图" project={project} accept="image/png,image/jpeg,image/webp" storedPath={`assets/MapEdits/${sanitizeI18nPart(mapNameFromTarget(editTarget))}/preview.png`} onImported={(nextProject, storedPath) => { setSourcePreviewFile(storedPath); setProject(nextProject); }} />
      </div>
      <div className="map-compare-grid">
        <MapAreaPicker title="来源区域 FromArea" image={sourcePreview} area={fromArea} onChange={(area) => { setFromArea(area); setToArea({ ...toArea, Width: area.Width, Height: area.Height }); }} />
        <MapAreaPicker title="目标区域 ToArea" image={targetPreview} area={{ ...toArea, Width: fromArea.Width, Height: fromArea.Height }} onChange={(area) => setToArea({ ...area, Width: fromArea.Width, Height: fromArea.Height })} lockSize />
      </div>
      <div className="button-row">
        <button type="button" onClick={addOverlayPatch}><Icon name="plus" />确认生成区域替换</button>
      </div>
    </div>
  );
}

function MapWarpDraftForm({ draftId, initial, project, ruleset, setProject, mapResources, onGenerated }: { draftId: string; initial: WarpMapDraftInitial; project: Project; ruleset: Ruleset; setProject: (project: Project) => void; mapResources: MapResourceEntry[]; onGenerated: (refs: MapGeneratedRef[]) => void }) {
  const [warpSourceMap, setWarpSourceMap] = useState(initial.warpSourceMap);
  const [warpTargetMap, setWarpTargetMap] = useState(initial.warpTargetMap);
  const [warpFrom, setWarpFrom] = useState<MapPoint>(initial.warpFrom);
  const [warpTo, setWarpTo] = useState<MapPoint>(initial.warpTo);
  const [warpKind, setWarpKind] = useState<"AddWarps" | "AddNpcWarps">(initial.warpKind);
  const [status, setStatus] = useState("");
  const allMapOptions = mapTargetOptions(project, ruleset);
  const warpSourcePreview = previewForMapTarget(project, warpSourceMap, mapResources);
  const warpTargetPreview = previewForMapTarget(project, warpTargetMap, mapResources);

  function addWarpPatch() {
    const warp = `${warpFrom.X} ${warpFrom.Y} ${mapNameFromTarget(warpTargetMap)} ${warpTo.X} ${warpTo.Y}`;
    const patch = withMapDraftAdvanced({
      id: makeId(),
      name: `${warpKind === "AddNpcWarps" ? "NPC" : "玩家"}传送 ${warpSourceMap}`,
      action: "EditMap",
      enabled: true,
      target: warpSourceMap,
      from_file: null,
      when: {},
      fields: { [warpKind]: [warp] },
      advanced: {}
    }, draftId, "warp");
    patch.advanced = {
      ...patch.advanced,
      StardewCPStudio: {
        ...(isObject(patch.advanced.StardewCPStudio) ? patch.advanced.StardewCPStudio as JsonDict : {}),
        mapWarp: { warpSourceMap, warpTargetMap, warpFrom, warpTo, warpKind }
      }
    };
    setProject({ ...project, patches: mergeWorkflowPatches(project.patches, [patch]) });
    onGenerated([{ action: "EditMap", target: warpSourceMap, from_file: null }]);
    setStatus(`已生成 ${warpKind}: ${warp}`);
  }

  return (
    <div className="map-studio">
      {status && <div className="status">{status}</div>}
      <div className="grid two">
        <ComboField label="出发地图 Target" value={warpSourceMap} options={allMapOptions} onChange={(value) => setWarpSourceMap(String(value))} />
        <ComboField label="目标地图" value={warpTargetMap} options={allMapOptions} onChange={(value) => setWarpTargetMap(String(value))} />
        <ComboField label="传送类型" value={warpKind} options={MAP_WARP_KIND_OPTIONS} onChange={(value) => setWarpKind(value as "AddWarps" | "AddNpcWarps")} />
        <div className="field"><span>生成语句</span><code>{`${warpFrom.X} ${warpFrom.Y} ${mapNameFromTarget(warpTargetMap)} ${warpTo.X} ${warpTo.Y}`}</code></div>
      </div>
      <div className="map-compare-grid">
        <MapPreviewPicker title="出发坐标" image={warpSourcePreview} selected={warpFrom} onPick={setWarpFrom} />
        <MapPreviewPicker title="到达坐标" image={warpTargetPreview} selected={warpTo} onPick={setWarpTo} />
      </div>
      <div className="button-row">
        <button type="button" onClick={addWarpPatch}><Icon name="plus" />确认生成传送</button>
      </div>
    </div>
  );
}

function LegacyMapStudio({ project, ruleset, setProject }: { project: Project; ruleset: Ruleset; setProject: (project: Project) => void }) {
  const [mapKeyRaw, setMapKeyRaw] = useState("ExampleCave");
  const [displayName, setDisplayName] = useState("Example Cave");
  const [mapFile, setMapFile] = useState("");
  const [previewFile, setPreviewFile] = useState("");
  const [arrival, setArrival] = useState<MapPoint>({ X: 0, Y: 0 });
  const [locationType, setLocationType] = useState("Default");
  const [alwaysActive, setAlwaysActive] = useState(false);
  const [canPlant, setCanPlant] = useState(false);
  const [greenRainSpawns, setGreenRainSpawns] = useState(false);
  const [excludePathfinding, setExcludePathfinding] = useState(false);
  const [sourceMapFile, setSourceMapFile] = useState("");
  const [sourcePreviewFile, setSourcePreviewFile] = useState("");
  const [editTarget, setEditTarget] = useState("Maps/Town");
  const [patchMode, setPatchMode] = useState("ReplaceByLayer");
  const [fromArea, setFromArea] = useState<MapArea>({ X: 0, Y: 0, Width: 4, Height: 4 });
  const [toArea, setToArea] = useState<MapArea>({ X: 0, Y: 0, Width: 4, Height: 4 });
  const [warpSourceMap, setWarpSourceMap] = useState("Maps/Town");
  const [warpTargetMap, setWarpTargetMap] = useState("Maps/Farm");
  const [warpFrom, setWarpFrom] = useState<MapPoint>({ X: 0, Y: 0 });
  const [warpTo, setWarpTo] = useState<MapPoint>({ X: 0, Y: 0 });
  const [warpKind, setWarpKind] = useState<"AddWarps" | "AddNpcWarps">("AddWarps");
  const [status, setStatus] = useState("");
  const mapKey = customMapKey(mapKeyRaw);
  const allMapOptions = mapTargetOptions(project, ruleset);
  const customPreview = previewAssetForPath(project, previewFile);
  const sourcePreview = previewAssetForPath(project, sourcePreviewFile);
  const targetPreview = previewForMapTarget(project, editTarget);
  const warpSourcePreview = previewForMapTarget(project, warpSourceMap);
  const warpTargetPreview = previewForMapTarget(project, warpTargetMap);

  function upsertCustomMap(nextProject = project, nextMapFile = mapFile, nextPreviewFile = previewFile) {
    if (!nextMapFile) {
      setStatus("请先导入 tmx/tbin 地图文件。");
      return;
    }
    const displayNameKey = locationI18nKey(nextProject, mapKey, "Name");
    const locationEntry = createWorkflowEntry("custom", `${mapKey} 地点数据`, "Data/Locations", mapKey, compactObject({
      DisplayName: i18nRef(displayNameKey),
      CreateOnLoad: { MapPath: `Maps/${mapKey}` },
      DefaultArrivalTile: arrival,
      Type: locationType || undefined,
      AlwaysActive: alwaysActive || undefined,
      CanPlantHere: canPlant || undefined,
      CanHaveGreenRainSpawns: greenRainSpawns || undefined,
      ExcludeFromNpcPathfinding: excludePathfinding || undefined
    }));
    const locationEntryWithMeta: GameDataEntry = {
      ...locationEntry,
      advanced: {
        ...locationEntry.advanced,
        StardewCPStudio: {
          ...(isObject(locationEntry.advanced.StardewCPStudio) ? locationEntry.advanced.StardewCPStudio as JsonDict : {}),
          map: {
            key: mapKey,
            previewFile: nextPreviewFile
          }
        }
      }
    };
    const loadPatch: Patch = {
      id: makeId(),
      name: `加载地图 ${mapKey}`,
      action: "Load",
      enabled: true,
      target: `Maps/${mapKey}`,
      from_file: nextMapFile,
      when: {},
      fields: {},
      advanced: {}
    };
    setProject({
      ...nextProject,
      game_data: mergeWorkflowEntries(nextProject.game_data, [locationEntryWithMeta]),
      patches: mergeWorkflowPatches(nextProject.patches, [loadPatch]),
      i18n: { ...nextProject.i18n, [displayNameKey]: displayName || mapKey }
    });
    setStatus(`已生成 ${mapKey} 的 Data/Locations 与 Load Maps/${mapKey}。`);
  }

  function addOverlayPatch() {
    if (!sourceMapFile) {
      setStatus("请先导入用于覆盖的 tmx/tbin 地图文件。");
      return;
    }
    const patch: Patch = {
      id: makeId(),
      name: `地图区域替换 ${editTarget}`,
      action: "EditMap",
      enabled: true,
      target: editTarget,
      from_file: sourceMapFile,
      when: {},
      fields: {
        FromArea: fromArea,
        ToArea: { ...toArea, Width: fromArea.Width, Height: fromArea.Height },
        PatchMode: patchMode
      },
      advanced: {}
    };
    setProject({ ...project, patches: mergeWorkflowPatches(project.patches, [patch]) });
    setStatus(`已生成 EditMap 区域替换：${editTarget}`);
  }

  function addWarpPatch() {
    const warp = `${warpFrom.X} ${warpFrom.Y} ${mapNameFromTarget(warpTargetMap)} ${warpTo.X} ${warpTo.Y}`;
    const patch: Patch = {
      id: makeId(),
      name: `${warpKind === "AddNpcWarps" ? "NPC" : "玩家"}传送 ${warpSourceMap}`,
      action: "EditMap",
      enabled: true,
      target: warpSourceMap,
      from_file: null,
      when: {},
      fields: { [warpKind]: [warp] },
      advanced: {}
    };
    setProject({ ...project, patches: mergeWorkflowPatches(project.patches, [patch]) });
    setStatus(`已生成 ${warpKind}: ${warp}`);
  }

  return (
    <Section title="地图添加">
      {status && <div className="status">{status}</div>}
      <div className="map-studio">
        <CollapsibleSubsection title="自定义新地图" highlight>
          <div className="grid two">
            <Field label="地图 Key（自动 Custom_ 前缀）" value={mapKeyRaw} onChange={setMapKeyRaw} />
            <div className="field"><span>最终地图 Key</span><code>{mapKey}</code></div>
            <Field label="显示名称 DisplayName" value={displayName} onChange={setDisplayName} />
            <ComboField label="地点类型 Type" value={locationType} options={MAP_LOCATION_TYPE_OPTIONS} onChange={(value) => setLocationType(String(value))} />
            <Field label="默认到达 X" value={String(arrival.X)} onChange={(value) => setArrival({ ...arrival, X: integerInRange(value, 0, 999, 0) })} />
            <Field label="默认到达 Y" value={String(arrival.Y)} onChange={(value) => setArrival({ ...arrival, Y: integerInRange(value, 0, 999, 0) })} />
            <BoolField label="AlwaysActive" value={alwaysActive} onChange={setAlwaysActive} />
            <BoolField label="CanPlantHere" value={canPlant} onChange={setCanPlant} />
            <BoolField label="CanHaveGreenRainSpawns" value={greenRainSpawns} onChange={setGreenRainSpawns} />
            <BoolField label="ExcludeFromNpcPathfinding" value={excludePathfinding} onChange={setExcludePathfinding} />
            <TargetedAssetImport label="导入地图文件 tmx/tbin" project={project} accept=".tmx,.tbin" storedPath={`assets/Maps/${mapKey}/${mapKey}.tmx`} onImported={(nextProject, storedPath) => { setMapFile(storedPath); upsertCustomMap(nextProject, storedPath, previewFile); }} />
            <TargetedAssetImport label="导入预览图 PNG" project={project} accept="image/png,image/jpeg,image/webp" storedPath={`assets/Maps/${mapKey}/preview.png`} onImported={(nextProject, storedPath) => { setPreviewFile(storedPath); upsertCustomMap(nextProject, mapFile, storedPath); }} />
          </div>
          <div className="button-row">
            <button type="button" onClick={() => upsertCustomMap()}><Icon name="plus" />生成/更新自定义地图</button>
          </div>
          {customPreview && <MapPreviewPicker title="预览图坐标" image={customPreview} selected={arrival} onPick={setArrival} />}
        </CollapsibleSubsection>

        <CollapsibleSubsection title="编辑原有地图：区域替换">
          <div className="grid two">
            <ComboField label="目标地图 Target" value={editTarget} options={allMapOptions} onChange={(value) => setEditTarget(String(value))} />
            <ComboField label="合并模式 PatchMode" value={patchMode} options={MAP_PATCH_MODE_OPTIONS} onChange={(value) => setPatchMode(String(value))} />
            <TargetedAssetImport label="导入替换来源 tmx/tbin" project={project} accept=".tmx,.tbin" storedPath={`assets/MapEdits/${sanitizeI18nPart(mapNameFromTarget(editTarget))}/overlay.tmx`} onImported={(nextProject, storedPath) => { setSourceMapFile(storedPath); setProject(nextProject); }} />
            <TargetedAssetImport label="导入替换来源预览图" project={project} accept="image/png,image/jpeg,image/webp" storedPath={`assets/MapEdits/${sanitizeI18nPart(mapNameFromTarget(editTarget))}/preview.png`} onImported={(nextProject, storedPath) => { setSourcePreviewFile(storedPath); setProject(nextProject); }} />
          </div>
          <div className="map-compare-grid">
            <MapAreaPicker title="来源区域 FromArea" image={sourcePreview} area={fromArea} onChange={(area) => { setFromArea(area); setToArea({ ...toArea, Width: area.Width, Height: area.Height }); }} />
            <MapAreaPicker title="目标区域 ToArea" image={targetPreview} area={{ ...toArea, Width: fromArea.Width, Height: fromArea.Height }} onChange={(area) => setToArea({ ...area, Width: fromArea.Width, Height: fromArea.Height })} lockSize />
          </div>
          <div className="button-row">
            <button type="button" onClick={addOverlayPatch}><Icon name="plus" />确认生成区域替换</button>
          </div>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="添加传送点 Warp / NPCWarp">
          <div className="grid two">
            <ComboField label="出发地图 Target" value={warpSourceMap} options={allMapOptions} onChange={(value) => setWarpSourceMap(String(value))} />
            <ComboField label="目标地图" value={warpTargetMap} options={allMapOptions} onChange={(value) => setWarpTargetMap(String(value))} />
            <ComboField label="传送类型" value={warpKind} options={MAP_WARP_KIND_OPTIONS} onChange={(value) => setWarpKind(value as "AddWarps" | "AddNpcWarps")} />
            <div className="field"><span>生成语句</span><code>{`${warpFrom.X} ${warpFrom.Y} ${mapNameFromTarget(warpTargetMap)} ${warpTo.X} ${warpTo.Y}`}</code></div>
          </div>
          <div className="map-compare-grid">
            <MapPreviewPicker title="出发坐标" image={warpSourcePreview} selected={warpFrom} onPick={setWarpFrom} />
            <MapPreviewPicker title="到达坐标" image={warpTargetPreview} selected={warpTo} onPick={setWarpTo} />
          </div>
          <div className="button-row">
            <button type="button" onClick={addWarpPatch}><Icon name="plus" />确认生成传送</button>
          </div>
        </CollapsibleSubsection>
      </div>
    </Section>
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
        <Field label="信件正文" value={body} textarea onChange={(next) => updateMail({ Body: next })} />
      </div>
      <div className="mail-subsection">
        <h4>附件</h4>
        <MailAttachmentEditor value={attachments} itemOptions={itemSelectionOptions(project, ruleset, itemCatalog, "qualified")} questOptions={questOptions(project)} specialOrderOptions={specialOrderOptions(project)} onChange={(next) => updateMail({ Attachments: next })} />
        <div className="notice compact-note">信件只导出 <code>Data/Mail</code> 正文。发送信件请另建 <code>Data/TriggerActions</code>，例如 <code>AddMail Current {mailKey}</code>，再用 When 限制触发条件。</div>
      </div>
    </div>
  );
}

function ScheduleEntryForm({ project, entry, ruleset, onChange }: { project: Project; entry: GameDataEntry; ruleset: Ruleset; i18n?: Record<string, string>; onI18nChange?: (i18n: Record<string, string>) => void; onChange: (entry: GameDataEntry) => void }) {
  const [mapResources, setMapResources] = useState<MapResourceResponse>({ maps: [], source_path: "", warning: "" });
  const [mapError, setMapError] = useState("");
  const meta = scheduleMetaFromEntry(entry);
  const formats = scheduleKeyFormats(ruleset);
  const selectedFormat = formats.find((format) => format.id === meta.keyType) || formats.find((format) => format.id === "season") || formats[0];
  const finalKey = selectedFormat ? buildScheduleKey(selectedFormat, meta.fields) : entry.key || "spring";
  const npcName = normalizeInternalName(meta.npcName || npcNameFromScheduleTarget(entry.target) || "ExampleNPC");

  useEffect(() => {
    let cancelled = false;
    fetchJson<MapResourceResponse>("/api/maps/resources")
      .then((next) => { if (!cancelled) setMapResources(next); })
      .catch((error) => { if (!cancelled) setMapError(error instanceof Error ? error.message : String(error)); });
    return () => { cancelled = true; };
  }, []);

  function commit(nextMeta: ScheduleMeta) {
    const nextFormat = formats.find((format) => format.id === nextMeta.keyType) || selectedFormat;
    const nextKey = nextFormat ? buildScheduleKey(nextFormat, nextMeta.fields) : finalKey;
    const nextNpc = normalizeInternalName(nextMeta.npcName || npcName);
    const nextTarget = `Characters/schedules/${nextNpc}`;
    const nextValue = buildScheduleScript(nextMeta, nextNpc, nextKey);
    onChange({
      ...entry,
      target: nextTarget,
      key: nextKey,
      value: nextValue,
      advanced: {
        ...entry.advanced,
        StardewCPStudio: {
          ...(isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {}),
          schedule: {
            ...nextMeta,
            npcName: nextNpc,
            dialogueEntries: scheduleDialogueRows(nextMeta, nextNpc, nextKey)
          }
        }
      }
    });
  }

  function updateMeta(patch: Partial<ScheduleMeta>) {
    commit({ ...meta, ...patch });
  }

  function updateField(name: string, value: string | number) {
    commit({ ...meta, fields: { ...meta.fields, [name]: value } });
  }

  function addPoint() {
    const nextPoint = defaultSchedulePoint(meta.points.length, mapResources.maps[0]?.key || "Town");
    commit({ ...meta, points: [...meta.points, nextPoint] });
  }

  function updatePoint(index: number, point: SchedulePoint) {
    const points = replaceAt(meta.points, index, point);
    commit({ ...meta, points });
  }

  function removePoint(index: number) {
    commit({ ...meta, points: meta.points.filter((_, itemIndex) => itemIndex !== index) });
  }

  function movePoint(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= meta.points.length) return;
    const points = [...meta.points];
    [points[index], points[target]] = [points[target], points[index]];
    commit({ ...meta, points });
  }

  return (
    <div className="subsection highlight schedule-module">
      <h3>日程模块</h3>
      <div className="grid two">
        <Field label="NPC 内部名" value={npcName} onChange={(next) => updateMeta({ npcName: normalizeInternalName(next || "ExampleNPC") })} />
        <div className="field">
          <span>导出目标</span>
          <code>{`Characters/schedules/${npcName}`}</code>
        </div>
        <ComboField label="Key 类型" value={meta.keyType} options={scheduleFormatOptions(formats)} onChange={(keyType) => {
          const format = formats.find((item) => item.id === keyType) || selectedFormat;
          commit({ ...meta, keyType: String(keyType), fields: { ...meta.fields, ...defaultScheduleFields(format) } });
        }} />
        <div className="field">
          <span>最终 Key</span>
          <code>{finalKey}</code>
        </div>
        {selectedFormat?.fields.map((field) => (
          <ScheduleKeyFieldInput key={field.name} field={field} ruleset={ruleset} value={meta.fields[field.name] ?? defaultScheduleFieldValue(field)} onChange={(next) => updateField(field.name, next)} />
        ))}
      </div>
      {finalKey === "spring" && <div className="notice compact-note">Wiki 提醒：spring 常作为默认日程，建议保留至少一个可用 spring 日程。</div>}
      <div className="grid two">
        <ComboField label="初始命令" value={meta.initialCommand} options={rulesetOptions(ruleset, "schedule_initial_commands")} onChange={(initialCommand) => updateMeta({ initialCommand: String(initialCommand) })} />
        {meta.initialCommand === "GOTO" && <ComboField label="跳转 Key" value={meta.gotoKey} options={scheduleGotoKeyOptions(project, npcName, finalKey)} onChange={(gotoKey) => updateMeta({ gotoKey: String(gotoKey) })} />}
        {meta.initialCommand === "NOT_FRIENDSHIP" && <>
          <Field label="NPC" value={meta.friendshipNpc} onChange={(friendshipNpc) => updateMeta({ friendshipNpc })} />
          <Field label="心数" value={stringField(meta.friendshipHearts)} onChange={(friendshipHearts) => updateMeta({ friendshipHearts: integerInRange(friendshipHearts, 0, 14, 6) })} />
          <Field label="好感不足跳转 Key" value={meta.gotoKey} onChange={(gotoKey) => updateMeta({ gotoKey })} />
        </>}
        {meta.initialCommand === "MAIL" && <>
          <Field label="邮件 ID" value={meta.mailId} onChange={(mailId) => updateMeta({ mailId })} />
          <Field label="未收到跳转 Key" value={meta.mailMissingKey} onChange={(mailMissingKey) => updateMeta({ mailMissingKey })} />
          <Field label="已收到跳转 Key" value={meta.mailReceivedKey} onChange={(mailReceivedKey) => updateMeta({ mailReceivedKey })} />
        </>}
      </div>
      {meta.initialCommand === "GOTO" ? (
        <div className="notice compact-note">GOTO 日程只导出 <code>{`GOTO ${meta.gotoKey || "spring"}`}</code>。地点列表已临时隐藏，原点位数据会保留，切回普通日程后仍可继续编辑。</div>
      ) : (
        <div className="structured-editor">
          <div className="structured-editor-head">
            <div>
            <strong>移动点位 / 地点列表</strong>
            <span>一个日程可以去多个地方；每个点位会按 Wiki 格式用 / 串成 schedule script。</span>
          </div>
            <button type="button" className="secondary" onClick={addPoint}><Icon name="plus" />添加下一个地点</button>
          </div>
          {mapError && <div className="inline-error">{mapError}</div>}
          {meta.points.map((point, index) => (
            <SchedulePointEditor
              key={point.id}
              project={project}
              npcName={npcName}
              scheduleKey={finalKey}
              index={index}
              point={point}
              ruleset={ruleset}
              mapResources={mapResources.maps}
              onChange={(nextPoint) => updatePoint(index, nextPoint)}
              onMoveUp={() => movePoint(index, -1)}
              onMoveDown={() => movePoint(index, 1)}
              onRemove={() => removePoint(index)}
            />
          ))}
          {!meta.points.length && <div className="empty compact-empty">暂无日程点位。</div>}
        </div>
      )}
      <div className="field">
        <span>脚本预览</span>
        <code>{buildScheduleScript(meta, npcName, finalKey)}</code>
      </div>
      {entry.kind !== "schedule" && <WhenBuilder ruleset={ruleset} value={entry.when} onChange={(when) => onChange({ ...entry, when })} />}
    </div>
  );
}

function SchedulePointEditor({ project, npcName, scheduleKey, index, point, ruleset, mapResources, onChange, onMoveUp, onMoveDown, onRemove }: { project: Project; npcName: string; scheduleKey: string; index: number; point: SchedulePoint; ruleset: Ruleset; mapResources: MapResourceEntry[]; onChange: (point: SchedulePoint) => void; onMoveUp: () => void; onMoveDown: () => void; onRemove: () => void }) {
  const isBed = point.location === "bed";
  const selectedMapPreview = isBed ? null : previewForMapTarget(project, point.location.startsWith("Maps/") ? point.location : `Maps/${point.location}`, mapResources);
  const locationOptions = scheduleLocationOptions(project, mapResources);
  const dialogueKey = point.dialogueKey || `${scheduleKey}.${String(index).padStart(3, "0")}`;

  function patchPoint(patch: Partial<SchedulePoint>) {
    onChange({ ...point, ...patch });
  }

  return (
    <div className="schedule-point-row">
      <div className="schedule-point-toolbar">
        <strong>{index + 1}. {point.time} {point.location}</strong>
        <div className="button-row">
          <button type="button" className="secondary" onClick={onMoveUp}>上移</button>
          <button type="button" className="secondary" onClick={onMoveDown}>下移</button>
          <button type="button" className="secondary" onClick={onRemove}>删除</button>
        </div>
      </div>
      <div className="grid two">
        <ComboField label="时间" value={point.time} options={SCHEDULE_TIME_OPTIONS} onChange={(time) => patchPoint({ time: String(time) })} />
        <ComboField label="地点" value={point.location} options={locationOptions} onChange={(location) => patchPoint({ location: String(location) })} />
        {!isBed && <>
          <Field label="X" value={stringField(point.x)} onChange={(x) => patchPoint({ x: integerInRange(x, 0, 999, 0) })} />
          <Field label="Y" value={stringField(point.y)} onChange={(y) => patchPoint({ y: integerInRange(y, 0, 999, 0) })} />
          <ComboField label="朝向" value={point.direction} options={SCHEDULE_DIRECTION_OPTIONS} onChange={(direction) => patchPoint({ direction: Number(direction) })} />
          <ComboField label="动画" value={point.animation} options={scheduleAnimationOptions(project, ruleset, npcName)} onChange={(animation) => patchPoint({ animation: String(animation).replace("<npc>", npcName) })} />
          <Field label="自定义动画" value={point.animation} onChange={(animation) => patchPoint({ animation })} />
          <Field label="日程台词 Key" value={dialogueKey} onChange={(nextKey) => patchPoint({ dialogueKey: nextKey })} />
          <AffinityDialogueVariantEditor
            title="日程台词"
            project={project}
            npcName={npcName}
            variants={point.dialogueVariants}
            onChange={(dialogueVariants) => patchPoint({ dialogueVariants, dialogueText: dialogueVariants["0123"], dialogueKey })}
          />
        </>}
      </div>
      {!isBed && (
        <MapPreviewPicker
          title="日程点位坐标"
          image={selectedMapPreview}
          selected={{ X: point.x, Y: point.y }}
          onPick={(nextPoint) => patchPoint({ x: nextPoint.X, y: nextPoint.Y })}
        />
      )}
    </div>
  );
}

function AnimationEntryForm({ project, entry, onChange }: { project: Project; entry: GameDataEntry; onChange: (entry: GameDataEntry) => void }) {
  const [activePart, setActivePart] = useState<AnimationFramePart>("repeatFrames");
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const meta = animationMetaFromEntry(entry);
  const npcName = normalizeInternalName(meta.npcName || npcNameFromAnimationKey(entry.key) || "ExampleNPC");
  const finalKey = meta.isSleep ? sleepAnimationKey(npcName) : normalizeAnimationKey(meta.customKey || entry.key || `${npcName}_CustomAnimation`);
  const value = buildAnimationDescriptionValue(meta, npcName, finalKey);
  const activeFramesText = stringField(meta[activePart] || "");
  const editableFrames = parseAnimationFrameNumbers(activeFramesText);

  function commit(nextMeta: AnimationMeta) {
    const nextNpc = normalizeInternalName(nextMeta.npcName || npcName);
    const key = nextMeta.isSleep ? sleepAnimationKey(nextNpc) : normalizeAnimationKey(nextMeta.customKey || `${nextNpc}_CustomAnimation`);
    const nextValue = buildAnimationDescriptionValue(nextMeta, nextNpc, key);
    onChange({
      ...entry,
      target: "Data/animationDescriptions",
      key,
      value: nextValue,
      name: entry.name || `${nextNpc} 动画`,
      advanced: {
        ...entry.advanced,
        StardewCPStudio: {
          ...(isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {}),
          animation: {
            ...nextMeta,
            npcName: nextNpc,
            customKey: key,
            rawValue: nextMeta.rawMode ? stringField(nextMeta.rawValue || nextValue) : "",
            exportValue: nextValue
          }
        }
      }
    });
  }

  function updateMeta(patch: Partial<AnimationMeta>) {
    commit({ ...meta, npcName, customKey: finalKey, ...patch });
  }

  function updateFrames(frames: number[]) {
    const nextFramesText = animationFramesToText(frames);
    updateMeta({ [activePart]: nextFramesText, rawMode: false } as Partial<AnimationMeta>);
    setInsertIndex(Math.min(insertIndex ?? frames.length, frames.length));
  }

  function insertFrame(frame: number) {
    const frames = editableFrames.valid ? editableFrames.frames : [];
    const targetIndex = Math.max(0, Math.min(insertIndex ?? frames.length, frames.length));
    updateFrames([...frames.slice(0, targetIndex), frame, ...frames.slice(targetIndex)]);
    setInsertIndex(targetIndex + 1);
  }

  function removeFrame(index: number) {
    if (!editableFrames.valid) return;
    updateFrames(editableFrames.frames.filter((_, itemIndex) => itemIndex !== index));
    setInsertIndex(Math.max(0, Math.min(index, editableFrames.frames.length - 1)));
  }

  function switchPart(part: AnimationFramePart) {
    setActivePart(part);
    const parsed = parseAnimationFrameNumbers(stringField(meta[part] || ""));
    setInsertIndex(parsed.valid ? parsed.frames.length : 0);
  }

  return (
    <div className="subsection highlight animation-module">
      <h3>角色特定动画</h3>
      <div className="grid two">
        <Field label="NPC 内部名" value={npcName} onChange={(next) => updateMeta({ npcName: normalizeInternalName(next) })} />
        <label className="field">
          <span>动画类型</span>
          <select value={meta.isSleep ? "sleep" : "custom"} onChange={(event) => updateMeta({ isSleep: event.target.value === "sleep" })}>
            <option value="sleep">睡眠动画：&lt;lowercase npc&gt;_sleep</option>
            <option value="custom">自定义动画 Key</option>
          </select>
        </label>
        {meta.isSleep ? (
          <div className="field">
            <span>动画 Key</span>
            <code>{sleepAnimationKey(npcName)}</code>
          </div>
        ) : (
          <Field label="动画 Key" value={finalKey} onChange={(customKey) => updateMeta({ customKey: normalizeAnimationKey(customKey), isSleep: false })} />
        )}
        <div className="field">
          <span>导出目标</span>
          <code>Data/animationDescriptions</code>
        </div>
      </div>
      <div className="animation-part-tabs">
        {ANIMATION_FRAME_PARTS.map((part) => (
          <button type="button" className={activePart === part.key ? "active" : ""} key={part.key} onClick={() => switchPart(part.key)}>
            {part.label}
          </button>
        ))}
      </div>
      {ANIMATION_FRAME_PARTS.map((part) => {
        const parsed = parseAnimationFrameNumbers(stringField(meta[part.key] || ""));
        return (
          <AnimationFrameSequence
            key={part.key}
            title={part.label}
            note={part.note}
            frames={parsed.valid ? parsed.frames : []}
            valid={parsed.valid}
            error={parsed.error}
            active={activePart === part.key}
            insertIndex={activePart === part.key ? insertIndex ?? (parsed.valid ? parsed.frames.length : 0) : -1}
            onActivate={() => switchPart(part.key)}
            onSelectInsertIndex={(index) => { setActivePart(part.key); setInsertIndex(index); }}
            onRemove={(index) => { setActivePart(part.key); const frames = parsed.valid ? parsed.frames : []; updateMeta({ [part.key]: animationFramesToText(frames.filter((_, itemIndex) => itemIndex !== index)), rawMode: false } as Partial<AnimationMeta>); }}
          />
        );
      })}
      <div className="grid two">
        <BoolField label="去掉阴影 laying_down" value={meta.layingDown} onChange={(layingDown) => updateMeta({ layingDown, rawMode: false })} />
        <BoolField label="启用像素偏移 offset" value={meta.useOffset} onChange={(useOffset) => updateMeta({ useOffset, rawMode: false })} />
        {meta.useOffset && <>
          <Field label="offset X" value={String(meta.offsetX)} onChange={(offsetX) => updateMeta({ offsetX: integerInRange(offsetX, -999, 999, 0), rawMode: false })} />
          <Field label="offset Y" value={String(meta.offsetY)} onChange={(offsetY) => updateMeta({ offsetY: integerInRange(offsetY, -999, 999, 0), rawMode: false })} />
        </>}
      </div>
      <AffinityDialogueVariantEditor
        title="动画期间对话"
        project={project}
        npcName={npcName}
        variants={meta.messageVariants}
        onChange={(messageVariants) => updateMeta({ messageVariants, messageText: messageVariants["0123"], rawMode: false })}
      />
      {meta.rawMode && (
        <div className="subsection">
          <div className="notice compact-note">旧动画值无法安全拆分，当前处于原始字符串模式。修改任意帧区块或选项后会切换为结构化导出。</div>
          <Field label="原始 animationDescriptions 值" value={stringField(meta.rawValue || entry.value)} textarea onChange={(rawValue) => updateMeta({ rawValue, rawMode: true })} />
        </div>
      )}
      <SpriteFramePicker project={project} npcName={npcName} framesText={activeFramesText} insertIndex={insertIndex ?? (editableFrames.valid ? editableFrames.frames.length : 0)} onInsert={insertFrame} />
      <div className="notice compact-note">
        当前导出：<code>Data/animationDescriptions</code> / Key <code>{finalKey}</code> = <code>{value || "0/1/2"}</code>
        {hasAffinityDialogueText(meta.messageVariants) && <>；文本：<code>Strings/animation/{npcName}</code> / <code>{finalKey}</code> → <code>{animationI18nKey(npcName, finalKey)}.&lt;group&gt;</code></>}
      </div>
    </div>
  );
}

function AnimationFrameSequence({ title = "动画帧序列", note = "点击两个编号之间的空隙选择插入位置；点击下方行走图帧后会插入到该位置。", frames, valid, error, active = true, insertIndex, onActivate, onSelectInsertIndex, onRemove }: { title?: string; note?: string; frames: number[]; valid: boolean; error: string; active?: boolean; insertIndex: number; onActivate?: () => void; onSelectInsertIndex: (index: number) => void; onRemove: (index: number) => void }) {
  return (
    <div className={`animation-sequence-editor ${active ? "active" : ""}`} onClick={onActivate}>
      <div className="structured-editor-head">
        <div>
          <strong>{title}</strong>
          <span>{note}</span>
        </div>
      </div>
      {!valid && <div className="inline-error">{error}</div>}
      {valid ? (
        <div className="animation-frame-sequence">
          <button type="button" className={`animation-insert-slot ${insertIndex === 0 ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); onSelectInsertIndex(0); }} title="插入到开头" />
          {frames.map((frame, index) => (
            <React.Fragment key={`${index}-${frame}`}>
              <div className="animation-frame-cell">
                <span>{frame}</span>
                <button type="button" className="animation-frame-remove" onClick={(event) => { event.stopPropagation(); onRemove(index); }} title={`删除 ${frame}`}>×</button>
              </div>
              <button type="button" className={`animation-insert-slot ${insertIndex === index + 1 ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); onSelectInsertIndex(index + 1); }} title={`插入到第 ${index + 1} 格后`} />
            </React.Fragment>
          ))}
          {!frames.length && <div className="compact-empty">暂无帧。选择下方编号后会插入到这里。</div>}
        </div>
      ) : (
        <div className="button-row">
          <button type="button" className="secondary" onClick={(event) => { event.stopPropagation(); onSelectInsertIndex(0); }}>等待正确格式</button>
        </div>
      )}
    </div>
  );
}

function SpriteFramePicker({ project, npcName, framesText, insertIndex, onInsert }: { project: Project; npcName: string; framesText: string; insertIndex: number; onInsert: (index: number) => void }) {
  const [frames, setFrames] = useState<string[]>([]);
  const [activeFrame, setActiveFrame] = useState(0);
  const spriteAsset = findNpcSpriteAsset(project, npcName);
  const parsed = parseAnimationFrames(framesText, frames.length);

  useEffect(() => {
    let cancelled = false;
    setFrames([]);
    if (!spriteAsset) return;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const columns = Math.floor(image.width / 16);
      const rows = Math.floor(image.height / 32);
      const nextFrames: string[] = [];
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 32;
      const context = canvas.getContext("2d");
      if (!context) return;
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          context.clearRect(0, 0, 16, 32);
          context.drawImage(image, x * 16, y * 32, 16, 32, 0, 0, 16, 32);
          nextFrames.push(canvas.toDataURL("image/png"));
        }
      }
      setFrames(nextFrames);
      setActiveFrame(0);
    };
    image.src = `/api/assets/${spriteAsset.id}`;
    return () => {
      cancelled = true;
    };
  }, [spriteAsset?.id]);

  useEffect(() => {
    if (!parsed.valid || parsed.frames.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveFrame((current) => (current + 1) % parsed.frames.length);
    }, 100);
    return () => window.clearInterval(timer);
  }, [parsed.valid, parsed.frames.join("/")]);

  if (!spriteAsset) {
    return <div className="notice compact-note">导入该 NPC 的行走图 Sprite PNG 后，这里会显示 16x32 动画帧按钮。</div>;
  }

  const previewIndex = parsed.valid ? parsed.frames[activeFrame % Math.max(1, parsed.frames.length)] : null;

  return (
    <div className="sprite-frame-picker">
      <div className="structured-editor-head">
        <div>
          <strong>行走图帧编号</strong>
          <span>{spriteAsset.stored_path}；从左到右、从上到下编号。当前插入位置：{insertIndex}</span>
        </div>
        <div className="animation-preview">
          {previewIndex !== null && frames[previewIndex] ? (
            <img src={frames[previewIndex]} alt={`frame ${previewIndex}`} />
          ) : (
            <span>{framesText.trim() ? "等待正确格式" : "等待帧序列"}</span>
          )}
        </div>
      </div>
      {!parsed.valid && framesText.trim() && <div className="inline-error">{parsed.error}</div>}
      <div className="sprite-frame-grid">
        {frames.map((frame, index) => (
          <button type="button" className="sprite-frame-token" key={`${spriteAsset.id}-${index}`} onClick={() => onInsert(index)} title={`插入 ${index}`}>
            <img src={frame} alt={`frame ${index}`} />
            <span>{index}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EventSpriteFramePicker({ project, setProject, actorName, framesText, onChange }: { project: Project; setProject: (project: Project) => void; actorName: string; framesText: string; onChange: (frames: string) => void }) {
  const [frames, setFrames] = useState<string[]>([]);
  const [activeFrame, setActiveFrame] = useState(0);
  const [insertIndex, setInsertIndex] = useState(0);
  const normalizedActor = normalizeInternalName(actorName || "ExampleNPC");
  const spriteAsset = findNpcSpriteAsset(project, normalizedActor);
  const parsed = parseEventAnimationFrames(framesText, frames.length);
  const sequenceFrames = parsed.valid ? parsed.frames : [];

  useEffect(() => {
    if (insertIndex > sequenceFrames.length) setInsertIndex(sequenceFrames.length);
  }, [insertIndex, sequenceFrames.length]);

  useEffect(() => {
    let cancelled = false;
    setFrames([]);
    if (!spriteAsset) return;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const columns = Math.floor(image.width / 16);
      const rows = Math.floor(image.height / 32);
      const nextFrames: string[] = [];
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 32;
      const context = canvas.getContext("2d");
      if (!context) return;
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          context.clearRect(0, 0, 16, 32);
          context.drawImage(image, x * 16, y * 32, 16, 32, 0, 0, 16, 32);
          nextFrames.push(canvas.toDataURL("image/png"));
        }
      }
      setFrames(nextFrames);
      setActiveFrame(0);
    };
    image.src = `/api/assets/${spriteAsset.id}`;
    return () => {
      cancelled = true;
    };
  }, [spriteAsset?.id]);

  useEffect(() => {
    if (!parsed.valid || parsed.frames.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveFrame((current) => (current + 1) % parsed.frames.length);
    }, 100);
    return () => window.clearInterval(timer);
  }, [parsed.valid, parsed.frames.join(" ")]);

  function commitFrames(nextFrames: number[]) {
    onChange(eventAnimationFramesToText(nextFrames));
  }

  function insertFrame(frame: number) {
    if (!parsed.valid) return;
    const nextFrames = [...sequenceFrames];
    nextFrames.splice(Math.max(0, Math.min(insertIndex, nextFrames.length)), 0, frame);
    commitFrames(nextFrames);
    setInsertIndex(Math.max(0, Math.min(insertIndex + 1, nextFrames.length)));
  }

  function removeFrame(index: number) {
    const nextFrames = sequenceFrames.filter((_, itemIndex) => itemIndex !== index);
    commitFrames(nextFrames);
    setInsertIndex(Math.max(0, Math.min(insertIndex, nextFrames.length)));
  }

  const previewIndex = parsed.valid ? parsed.frames[activeFrame % Math.max(1, parsed.frames.length)] : null;

  return (
    <div className="sprite-frame-picker">
      <CharacterAssetImport
        label="导入该角色行走图 Sprite"
        project={project}
        npcName={normalizedActor}
        assetKind="sprite"
        currentPath={spriteAsset?.stored_path || ""}
        onImported={(nextProject) => setProject(nextProject)}
      />
      <AnimationFrameSequence
        frames={sequenceFrames}
        valid={parsed.valid}
        error={parsed.error}
        insertIndex={Math.max(0, Math.min(insertIndex, sequenceFrames.length))}
        onSelectInsertIndex={setInsertIndex}
        onRemove={removeFrame}
      />
      <div className="structured-editor-head">
        <div>
          <strong>事件动画帧编号</strong>
          <span>{spriteAsset ? `${spriteAsset.stored_path}；事件 animate 使用空格分隔帧。` : "导入或选择该角色的行走图后，可以点击 16x32 帧生成 animate 帧列表。"}</span>
        </div>
        <div className="animation-preview">
          {previewIndex !== null && frames[previewIndex] ? (
            <img src={frames[previewIndex]} alt={`frame ${previewIndex}`} />
          ) : (
            <span>{framesText.trim() ? "等待正确格式" : "等待帧序列"}</span>
          )}
        </div>
      </div>
      {!parsed.valid && framesText.trim() && <div className="inline-error">{parsed.error}</div>}
      {spriteAsset ? (
        <div className="sprite-frame-grid">
          {frames.map((frame, index) => (
            <button type="button" className="sprite-frame-token" key={`${spriteAsset.id}-${index}`} onClick={() => insertFrame(index)} title={`插入 ${index}`}>
              <img src={frame} alt={`frame ${index}`} />
              <span>{index}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="notice compact-note">当前项目里还没有找到 <code>{normalizedActor}</code> 的行走图素材。可以在这里直接导入，或先到角色素材里导入。</div>
      )}
    </div>
  );
}

function PatioSpriteFramePicker({ project, setProject, npcName, framesText, onChange }: { project: Project; setProject: (project: Project) => void; npcName: string; framesText: string; onChange: (frames: string) => void }) {
  const [frames, setFrames] = useState<string[]>([]);
  const [activeFrame, setActiveFrame] = useState(0);
  const [insertIndex, setInsertIndex] = useState(0);
  const normalizedNpc = normalizeInternalName(npcName || "ExampleNPC");
  const spriteAsset = findNpcSpriteAsset(project, normalizedNpc);
  const parsed = parsePatioFrameSequence(framesText, frames.length);
  const sequenceFrames = parsed.valid ? parsed.frames : [];

  useEffect(() => {
    if (insertIndex > sequenceFrames.length) setInsertIndex(sequenceFrames.length);
  }, [insertIndex, sequenceFrames.length]);

  useEffect(() => {
    let cancelled = false;
    setFrames([]);
    if (!spriteAsset) return;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const columns = Math.floor(image.width / 16);
      const rows = Math.floor(image.height / 32);
      const nextFrames: string[] = [];
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 32;
      const context = canvas.getContext("2d");
      if (!context) return;
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          context.clearRect(0, 0, 16, 32);
          context.drawImage(image, x * 16, y * 32, 16, 32, 0, 0, 16, 32);
          nextFrames.push(canvas.toDataURL("image/png"));
        }
      }
      setFrames(nextFrames);
      setActiveFrame(0);
    };
    image.src = `/api/assets/${spriteAsset.id}`;
    return () => {
      cancelled = true;
    };
  }, [spriteAsset?.id]);

  useEffect(() => {
    if (!parsed.valid || parsed.frames.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveFrame((current) => (current + 1) % parsed.frames.length);
    }, 100);
    return () => window.clearInterval(timer);
  }, [parsed.valid, parsed.frames.join(" ")]);

  function commitFrames(nextFrames: number[]) {
    onChange(eventAnimationFramesToText(nextFrames));
  }

  function insertFrame(frame: number) {
    if (!parsed.valid) return;
    const nextFrames = [...sequenceFrames];
    nextFrames.splice(Math.max(0, Math.min(insertIndex, nextFrames.length)), 0, frame);
    commitFrames(nextFrames);
    setInsertIndex(Math.max(0, Math.min(insertIndex + 1, nextFrames.length)));
  }

  function removeFrame(index: number) {
    const nextFrames = sequenceFrames.filter((_, itemIndex) => itemIndex !== index);
    commitFrames(nextFrames);
    setInsertIndex(Math.max(0, Math.min(insertIndex, nextFrames.length)));
  }

  const previewIndex = parsed.valid ? parsed.frames[activeFrame % Math.max(1, parsed.frames.length)] : null;

  return (
    <div className="sprite-frame-picker">
      <CharacterAssetImport
        label="导入该角色行走图 Sprite"
        project={project}
        npcName={normalizedNpc}
        assetKind="sprite"
        currentPath={spriteAsset?.stored_path || ""}
        onImported={(nextProject) => setProject(nextProject)}
      />
      <AnimationFrameSequence
        frames={sequenceFrames}
        valid={parsed.valid}
        error={parsed.error}
        insertIndex={Math.max(0, Math.min(insertIndex, sequenceFrames.length))}
        onSelectInsertIndex={setInsertIndex}
        onRemove={removeFrame}
      />
      <div className="structured-editor-head">
        <div>
          <strong>庭院动画帧编号</strong>
          <span>{spriteAsset ? `${spriteAsset.stored_path}；预览按每帧 100ms 播放，导出时连续相同帧会自动合并时长。` : "导入角色行走图后，可以点击 16x32 帧生成庭院动画。"}</span>
        </div>
        <div className="animation-preview">
          {previewIndex !== null && frames[previewIndex] ? (
            <img src={frames[previewIndex]} alt={`frame ${previewIndex}`} />
          ) : (
            <span>{framesText.trim() ? "等待正确格式" : "等待帧序列"}</span>
          )}
        </div>
      </div>
      {!parsed.valid && framesText.trim() && <div className="inline-error">{parsed.error}</div>}
      {spriteAsset ? (
        <div className="sprite-frame-grid">
          {frames.map((frame, index) => (
            <button type="button" className="sprite-frame-token" key={`${spriteAsset.id}-patio-${index}`} onClick={() => insertFrame(index)} title={`插入 ${index}`}>
              <img src={frame} alt={`frame ${index}`} />
              <span>{index}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="notice compact-note">当前项目里还没有找到 <code>{normalizedNpc}</code> 的行走图素材。可以在这里直接导入。</div>
      )}
      <div className="notice compact-note">例如 <code>19 19 18 18 18 19</code> 会导出为 <code>[[19,200],[18,300],[19]]</code>。</div>
    </div>
  );
}

function animationMetaFromEntry(entry: GameDataEntry): AnimationMeta {
  const studio = isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  const saved = isObject(studio.animation) ? studio.animation as JsonDict : {};
  const npcName = stringField(saved.npcName || npcNameFromAnimationKey(entry.key) || "ExampleNPC");
  const isSleep = saved.isSleep === undefined ? /_sleep$/i.test(entry.key) : Boolean(saved.isSleep);
  const parsed = parseAnimationDescriptionValue(stringField(entry.value || saved.exportValue || saved.framesText || "0/1/2"));
  const savedOffset = isObject(saved.offset) ? saved.offset as JsonDict : {};
  const hasSavedMessage = stringField(saved.messageText || "").trim().length > 0;
  const messageVariants = normalizeAffinityDialogueVariants(saved.messageVariants, stringField(saved.messageText || ""));
  return {
    npcName,
    isSleep,
    customKey: stringField(saved.customKey || entry.key || `${npcName}_CustomAnimation`),
    entryFrames: stringField(saved.entryFrames ?? parsed.entryFrames),
    repeatFrames: stringField(saved.repeatFrames ?? parsed.repeatFrames),
    leavingFrames: stringField(saved.leavingFrames ?? parsed.leavingFrames),
    messageText: stringField(saved.messageText || ""),
    messageVariants,
    layingDown: saved.layingDown === undefined ? parsed.layingDown : Boolean(saved.layingDown),
    useOffset: saved.useOffset === undefined ? parsed.useOffset : Boolean(saved.useOffset),
    offsetX: integerInRange(saved.offsetX ?? savedOffset.X ?? parsed.offsetX, -999, 999, 0),
    offsetY: integerInRange(saved.offsetY ?? savedOffset.Y ?? parsed.offsetY, -999, 999, 0),
    rawMode: saved.rawMode === undefined ? (parsed.rawMode || (parsed.hasExternalMessage && !hasSavedMessage && !hasAffinityDialogueText(messageVariants))) : Boolean(saved.rawMode),
    rawValue: stringField(saved.rawValue || (parsed.rawMode ? entry.value : ""))
  };
}

function parseAnimationFrames(text: string, frameCount: number) {
  const trimmed = text.trim();
  if (!trimmed) return { valid: false, frames: [] as number[], error: "请输入帧编号，例如 16 16 17 17。" };
  if (!/^\d+(\s+\d+)*$/.test(trimmed)) return { valid: false, frames: [] as number[], error: "格式应为空格分隔数字，例如 16 16 17 17。" };
  const frames = trimmed.split(/\s+/).map((part) => Number(part.trim()));
  const outOfRange = frames.find((frame) => frame < 0 || frame >= frameCount);
  if (outOfRange !== undefined) return { valid: false, frames, error: `帧 ${outOfRange} 超出当前行走图范围。` };
  return { valid: true, frames, error: "" };
}

function parseAnimationFrameNumbers(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return { valid: true, frames: [] as number[], error: "" };
  if (!/^\d+(\s+\d+)*$/.test(trimmed)) return { valid: false, frames: [] as number[], error: "已有帧序列格式异常；请选择下方帧重新生成序列。" };
  return { valid: true, frames: trimmed.split(/\s+/).map((part) => Number(part.trim())), error: "" };
}

function animationFramesToText(frames: number[]) {
  return frames.map((frame) => String(Math.max(0, Math.round(frame)))).join(" ");
}

type AnimationFramePart = "entryFrames" | "repeatFrames" | "leavingFrames";

const ANIMATION_FRAME_PARTS: { key: AnimationFramePart; label: string; note: string }[] = [
  { key: "entryFrames", label: "开场帧 Entry Frames", note: "NPC 到达日程点后先播放一次。" },
  { key: "repeatFrames", label: "循环帧 Repeat Frames", note: "停留期间循环播放，常用重复帧控制停留时间。" },
  { key: "leavingFrames", label: "离开帧 Leaving Frames", note: "离开前播放一次，然后前往下一个日程点。" }
];

function buildAnimationDescriptionValue(meta: AnimationMeta, npcName: string, animationKey: string) {
  if (meta.rawMode) return stringField(meta.rawValue || "");
  const base = [
    animationFramePartValue(meta.entryFrames, "0"),
    animationFramePartValue(meta.repeatFrames, "0"),
    animationFramePartValue(meta.leavingFrames, "0")
  ];
  const messageKey = hasAffinityDialogueText(meta.messageVariants) ? `Strings\\\\animation\\\\${npcName}:${animationKey}` : "";
  const extras: string[] = [];
  if (meta.layingDown) extras.push("laying_down");
  if (meta.useOffset) extras.push(`offset ${integerInRange(meta.offsetX, -999, 999, 0)} ${integerInRange(meta.offsetY, -999, 999, 0)}`);
  if (messageKey || extras.length) base.push(messageKey);
  return [...base, ...extras].join("/");
}

function animationFramePartValue(value: string, fallback: string) {
  const parsed = parseAnimationFrameNumbers(value);
  return parsed.valid && parsed.frames.length ? animationFramesToText(parsed.frames) : fallback;
}

function parseAnimationDescriptionValue(value: string): AnimationMeta & { hasExternalMessage?: boolean } {
  const parts = stringField(value || "0/1/2").split("/");
  const frameParts = parts.slice(0, 3);
  const framesValid = frameParts.length >= 3 && frameParts.every((part) => parseAnimationFrameNumbers(part.trim()).valid);
  if (!framesValid) {
    return {
      npcName: "ExampleNPC",
      isSleep: false,
      customKey: "CustomAnimation",
      entryFrames: "0",
      repeatFrames: "1",
      leavingFrames: "2",
      messageText: "",
      messageVariants: emptyAffinityDialogueVariants(),
      layingDown: false,
      useOffset: false,
      offsetX: 0,
      offsetY: 0,
      rawMode: true,
      rawValue: value
    };
  }
  const extraParts = parts.slice(3).map((part) => part.trim());
  const messagePart = extraParts[0] && extraParts[0] !== "laying_down" && !/^offset\s+/i.test(extraParts[0]) ? extraParts[0] : "";
  const offsetPart = extraParts.find((part) => /^offset\s+-?\d+\s+-?\d+$/i.test(part));
  const offsetMatch = offsetPart?.match(/^offset\s+(-?\d+)\s+(-?\d+)$/i);
  return {
    npcName: "ExampleNPC",
    isSleep: false,
    customKey: "CustomAnimation",
    entryFrames: frameParts[0].trim(),
    repeatFrames: frameParts[1].trim(),
    leavingFrames: frameParts[2].trim(),
    messageText: "",
    messageVariants: emptyAffinityDialogueVariants(),
    layingDown: extraParts.some((part) => part === "laying_down"),
    useOffset: Boolean(offsetMatch),
    offsetX: integerInRange(offsetMatch?.[1], -999, 999, 0),
    offsetY: integerInRange(offsetMatch?.[2], -999, 999, 0),
    rawMode: false,
    rawValue: "",
    hasExternalMessage: Boolean(messagePart)
  };
}

function animationI18nKey(npcName: string, animationKey: string) {
  return `${normalizeInternalName(npcName || "ExampleNPC")}.Animation.${normalizeAnimationKey(animationKey || "CustomAnimation")}`;
}

function patioFramesToText(value: unknown) {
  if (!Array.isArray(value)) return "";
  const expanded: number[] = [];
  value.forEach((frame) => {
    if (Array.isArray(frame)) {
      const index = Number(frame[0] ?? 0);
      const duration = frame.length > 1 ? Number(frame[1]) : null;
      const repeats = Number.isFinite(duration) && duration !== null ? Math.max(1, Math.round(duration / 100)) : 1;
      for (let count = 0; count < repeats; count += 1) expanded.push(index);
      return;
    }
    const frameNumber = Number(frame);
    if (Number.isFinite(frameNumber)) expanded.push(frameNumber);
  });
  return expanded.join(" ");
}

function patioFramesFromText(text: string) {
  const frames = parsePatioFrameSequence(text).frames;
  const grouped: number[][] = [];
  for (const frame of frames) {
    const last = grouped[grouped.length - 1];
    if (last && last[0] === frame) {
      last[1] = (last[1] || 100) + 100;
    } else {
      grouped.push([frame]);
    }
  }
  return grouped.map((frame, index) => {
    if (frame.length === 1) return frame;
    if (index === grouped.length - 1 && frame[1] === 100) return [frame[0]];
    return frame;
  });
}

function parsePatioAnimationFrames(text: string) {
  const parsed = parsePatioFrameSequence(text);
  return { valid: parsed.valid, error: parsed.error };
}

function parsePatioFrameSequence(text: string, frameCount = 0) {
  const trimmed = text.trim();
  if (!trimmed) return { valid: true, frames: [] as number[], error: "" };
  if (!/^\d+(\s+\d+)*$/.test(trimmed)) {
    return { valid: false, frames: [] as number[], error: "格式应为空格分隔的帧编号，例如 19 19 18 18 18 19。" };
  }
  const frames = trimmed.split(/\s+/).map((part) => Number(part));
  const outOfRange = frameCount > 0 ? frames.find((frame) => frame < 0 || frame >= frameCount) : undefined;
  if (outOfRange !== undefined) return { valid: false, frames, error: `帧 ${outOfRange} 超出当前行走图范围。` };
  return { valid: true, frames, error: "" };
}

function parseEventAnimationFrames(text: string, frameCount: number) {
  const trimmed = text.trim();
  if (!trimmed) return { valid: true, frames: [] as number[], error: "" };
  if (!/^\d+(\s+\d+)*$/.test(trimmed)) return { valid: false, frames: [] as number[], error: "事件 animate 帧应使用空格分隔，例如 0 1 2。" };
  const frames = trimmed.split(/\s+/).map((part) => Number(part));
  const outOfRange = frameCount > 0 ? frames.find((frame) => frame < 0 || frame >= frameCount) : undefined;
  if (outOfRange !== undefined) return { valid: false, frames, error: `帧 ${outOfRange} 超出当前行走图范围。` };
  return { valid: true, frames, error: "" };
}

function eventAnimationFramesToText(frames: number[]) {
  return frames.map((frame) => String(Math.max(0, Math.round(frame)))).join(" ");
}

function npcNameFromAnimationKey(key: string) {
  const sleep = key.match(/^(.+)_sleep$/i);
  if (sleep) return normalizeInternalName(sleep[1]);
  const custom = key.match(/^([A-Za-z0-9_]+?)[._-]/);
  return custom ? normalizeInternalName(custom[1]) : "";
}

function sleepAnimationKey(npcName: string) {
  return normalizeInternalName(npcName).toLowerCase() + "_sleep";
}

function normalizeAnimationKey(key: string) {
  return key.replace(/[^A-Za-z0-9_.-]/g, "").trim() || "CustomAnimation";
}

function scheduleMetaFromEntry(entry: GameDataEntry): ScheduleMeta {
  const studio = isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  const saved = isObject(studio.schedule) ? studio.schedule as JsonDict : {};
  const npcName = stringField(saved.npcName || npcNameFromScheduleTarget(entry.target) || "ExampleNPC");
  const keyType = stringField(saved.keyType || inferScheduleKeyType(entry.key) || "season");
  const fields = isObject(saved.fields) ? saved.fields as Record<string, string | number> : fieldsFromScheduleKey(entry.key);
  const points = Array.isArray(saved.points) ? saved.points.map(normalizeSchedulePoint) : parseSchedulePoints(stringField(entry.value), entry.key || "spring");
  return {
    npcName,
    keyType,
    fields,
    initialCommand: stringField(saved.initialCommand || inferScheduleInitialCommand(stringField(entry.value)) || "none"),
    gotoKey: stringField(saved.gotoKey || inferScheduleGotoKey(stringField(entry.value)) || "spring"),
    friendshipNpc: stringField(saved.friendshipNpc || npcName),
    friendshipHearts: integerInRange(saved.friendshipHearts, 0, 14, 6),
    mailId: stringField(saved.mailId || "ExampleMail"),
    mailMissingKey: stringField(saved.mailMissingKey || "spring"),
    mailReceivedKey: stringField(saved.mailReceivedKey || "spring"),
    points: points.length ? points : [defaultSchedulePoint(0, "Town")],
    dialogueEntries: Array.isArray(saved.dialogueEntries) ? saved.dialogueEntries as { key: string; i18nKey: string }[] : []
  };
}

function normalizeSchedulePoint(value: unknown): SchedulePoint {
  const source = isObject(value) ? value : {};
  return {
    id: stringField(source.id || makeId()),
    time: stringField(source.time || "0900"),
    location: stringField(source.location || "Town"),
    x: integerInRange(source.x, 0, 999, 64),
    y: integerInRange(source.y, 0, 999, 15),
    direction: integerInRange(source.direction, 0, 3, 2),
    animation: stringField(source.animation || ""),
    dialogueKey: stringField(source.dialogueKey || ""),
    dialogueText: stringField(source.dialogueText || ""),
    dialogueVariants: normalizeAffinityDialogueVariants(source.dialogueVariants, stringField(source.dialogueText || ""))
  };
}

function defaultSchedulePoint(index: number, location: string): SchedulePoint {
  const times = ["0900", "1200", "1500", "1800", "2200"];
  return { id: makeId(), time: times[index] || "0900", location, x: 0, y: 0, direction: 2, animation: "", dialogueKey: "", dialogueText: "", dialogueVariants: emptyAffinityDialogueVariants() };
}

function scheduleKeyFormats(ruleset: Ruleset): ScheduleKeyFormat[] {
  const target = (ruleset.field_schemas?.schedule_key_formats || ruleset.field_schemas?.schedule_formats) as unknown;
  if (Array.isArray(target)) return target.filter((item): item is ScheduleKeyFormat => isObject(item) && typeof item.id === "string" && Array.isArray(item.fields)) as ScheduleKeyFormat[];
  return FALLBACK_SCHEDULE_KEY_FORMATS;
}

function scheduleFormatOptions(formats: ScheduleKeyFormat[]): RulesetOption[] {
  return formats.map((format) => ({ label: `${format.category} - ${format.label}`, value: format.id }));
}

function buildScheduleKey(format: ScheduleKeyFormat, fields: Record<string, string | number>) {
  return (format.template || "spring").replace(/<([^>]+)>/g, (_, name) => String(fields[name] ?? defaultScheduleFieldValue({ name, type: "text" })));
}

function defaultScheduleFields(format?: ScheduleKeyFormat) {
  const fields: Record<string, string | number> = {};
  for (const field of format?.fields || []) fields[field.name] = defaultScheduleFieldValue(field);
  return fields;
}

function defaultScheduleFieldValue(field: ScheduleKeyField): string | number {
  if (field.name === "season") return "spring";
  if (field.name === "weekday") return "Mon";
  if (field.name === "hearts") return 6;
  if (field.name === "day") return 1;
  if (field.name === "festivalDay") return 1;
  if (field.name === "festival") return "spring13";
  if (field.name === "customKey") return "CustomSchedule";
  return field.type === "number" ? field.min ?? 1 : "";
}

function ScheduleKeyFieldInput({ field, ruleset, value, onChange }: { field: ScheduleKeyField; ruleset: Ruleset; value: string | number; onChange: (value: string | number) => void }) {
  if (field.type === "select" && field.options) {
    return <ComboField label={scheduleFieldLabel(field.name)} value={value} options={rulesetOptions(ruleset, field.options)} onChange={(next) => onChange(String(next))} />;
  }
  if (field.type === "number") {
    return <Field label={scheduleFieldLabel(field.name)} value={stringField(value)} onChange={(next) => onChange(integerInRange(next, field.min ?? 0, field.max ?? 999, Number(defaultScheduleFieldValue(field))))} />;
  }
  return <Field label={scheduleFieldLabel(field.name)} value={stringField(value)} onChange={onChange} />;
}

function scheduleFieldLabel(name: string) {
  const labels: Record<string, string> = { season: "季节", weekday: "星期", day: "日期", hearts: "心数", festival: "节日 ID", festivalDay: "节日天数", customKey: "自定义 Key" };
  return labels[name] || name;
}

function buildScheduleScript(meta: ScheduleMeta, npcName: string, scheduleKey: string) {
  const parts: string[] = [];
  if (meta.initialCommand === "GOTO") return `GOTO ${meta.gotoKey || "spring"}`;
  if (meta.initialCommand === "NOT_FRIENDSHIP") parts.push(`NOT friendship ${meta.friendshipNpc || npcName} ${Math.max(0, meta.friendshipHearts || 0) * 250}`, `GOTO ${meta.gotoKey || "spring"}`);
  if (meta.initialCommand === "MAIL") parts.push(`MAIL ${meta.mailId || "ExampleMail"}`, `GOTO ${meta.mailMissingKey || "spring"}`, `GOTO ${meta.mailReceivedKey || "spring"}`);
  for (const [index, point] of meta.points.entries()) parts.push(schedulePointScript(point, npcName, scheduleKey, index));
  return parts.filter(Boolean).join("/");
}

function scheduleGotoKeyOptions(project: Project, npcName: string, currentKey: string): RulesetOption[] {
  const target = `Characters/schedules/${normalizeInternalName(npcName || "ExampleNPC")}`;
  const values = new Set<string>();
  for (const entry of project.game_data) {
    if (entry.kind === "schedule" && entry.target === target && entry.key && entry.key !== currentKey) values.add(entry.key);
  }
  values.add("spring");
  values.add("default");
  values.delete(currentKey);
  return [...values].map((value) => ({ label: value === currentKey ? `${value}（当前 Key）` : value, value }));
}

function inferScheduleInitialCommand(script: string) {
  const trimmed = script.trim();
  if (/^GOTO\s+\S+$/i.test(trimmed)) return "GOTO";
  if (/^NOT\s+friendship\s+/i.test(trimmed)) return "NOT_FRIENDSHIP";
  if (/^MAIL\s+/i.test(trimmed)) return "MAIL";
  return "";
}

function inferScheduleGotoKey(script: string) {
  const goto = script.trim().match(/^GOTO\s+(\S+)$/i);
  return goto?.[1] || "";
}

function schedulePointScript(point: SchedulePoint, npcName: string, scheduleKey: string, index: number) {
  if (point.location === "bed") return `${point.time} bed`;
  const pieces = [point.time, point.location || "Town", String(point.x || 0), String(point.y || 0), String(point.direction ?? 2)];
  if (point.animation.trim()) pieces.push(point.animation.trim().replace("<npc>", npcName));
  if (hasAffinityDialogueText(point.dialogueVariants)) pieces.push(`"Strings\\\\schedules\\\\${npcName}:${point.dialogueKey || `${scheduleKey}.${String(index).padStart(3, "0")}`}"`);
  return pieces.join(" ");
}

function scheduleDialogueRows(meta: ScheduleMeta, npcName: string, scheduleKey: string) {
  return meta.points
    .map((point, index) => {
      if (!hasAffinityDialogueText(point.dialogueVariants)) return null;
      const key = point.dialogueKey || `${scheduleKey}.${String(index).padStart(3, "0")}`;
      return { key, i18nKey: `${npcName}.Schedule.${key}` };
    })
    .filter((item): item is { key: string; i18nKey: string } => Boolean(item));
}

function parseSchedulePoints(script: string, scheduleKey: string): SchedulePoint[] {
  if (!script.trim()) return [];
  return script.split("/").map((segment, index) => {
    const tokens = segment.trim().match(/"[^"]*"|\S+/g) || [];
    if (!tokens.length || ["GOTO", "NOT", "MAIL"].includes(tokens[0])) return null;
    if (tokens[1] === "bed") return { ...defaultSchedulePoint(index, "bed"), time: tokens[0], location: "bed" };
    const point = defaultSchedulePoint(index, tokens[1] || "Town");
    point.time = tokens[0] || point.time;
    point.x = integerInRange(tokens[2], 0, 999, 0);
    point.y = integerInRange(tokens[3], 0, 999, 0);
    point.direction = integerInRange(tokens[4], 0, 3, 2);
    if (tokens[5] && !tokens[5].startsWith("\"")) point.animation = tokens[5];
    const dialogue = tokens.find((token) => token.startsWith("\"Strings\\\\schedules\\\\"));
    if (dialogue) point.dialogueKey = dialogue.replace(/^"|"$/g, "").split(":")[1] || `${scheduleKey}.${String(index).padStart(3, "0")}`;
    return point;
  }).filter((point): point is SchedulePoint => Boolean(point));
}

function npcNameFromScheduleTarget(target: string) {
  return target.match(/^Characters\/[Ss]chedules\/([^/]+)$/)?.[1] || "";
}

function inferScheduleKeyType(key: string) {
  if (key === "GreenRain") return "green_rain";
  if (key === "marriageJob") return "marriage_job";
  if (key === "bus" || key === "rain" || key === "rain2" || key === "default") return key;
  if (/^marriage_[A-Z][a-z]{2}$/.test(key)) return "marriage_weekday";
  if (/^[a-z]+_[A-Z][a-z]{2}_\d+$/.test(key)) return "season_weekday_hearts";
  if (/^[a-z]+_[A-Z][a-z]{2}$/.test(key)) return "season_weekday";
  if (/^[A-Z][a-z]{2}_\d+$/.test(key)) return "weekday_hearts";
  if (/^[A-Z][a-z]{2}$/.test(key)) return "weekday";
  if (/^[a-z]+_\d+$/.test(key)) return "season_day";
  if (/^\d+_\d+$/.test(key)) return "day_hearts";
  if (/^\d+$/.test(key)) return "day";
  if (["spring", "summer", "fall", "winter"].includes(key)) return "season";
  return "custom";
}

function fieldsFromScheduleKey(key: string): Record<string, string | number> {
  const type = inferScheduleKeyType(key);
  if (type === "season") return { season: key || "spring" };
  if (type === "weekday") return { weekday: key };
  if (type === "season_weekday_hearts") { const [season, weekday, hearts] = key.split("_"); return { season, weekday, hearts: Number(hearts) || 6 }; }
  if (type === "season_weekday") { const [season, weekday] = key.split("_"); return { season, weekday }; }
  if (type === "weekday_hearts") { const [weekday, hearts] = key.split("_"); return { weekday, hearts: Number(hearts) || 6 }; }
  if (type === "season_day") { const [season, day] = key.split("_"); return { season, day: Number(day) || 1 }; }
  if (type === "day_hearts") { const [day, hearts] = key.split("_"); return { day: Number(day) || 1, hearts: Number(hearts) || 6 }; }
  if (type === "day") return { day: Number(key) || 1 };
  if (type === "custom") return { customKey: key || "CustomSchedule" };
  return {};
}

function scheduleLocationOptions(project: Project, maps: MapResourceEntry[]): RulesetOption[] {
  const values = new Set<string>(["bed", ...maps.map((map) => map.key), ...mapLocationOptions(project).map((option) => String(option.value))]);
  return [...values].map((value) => ({ label: value === "bed" ? "bed 睡觉" : value, value }));
}

function MapPreviewPicker({ title, image, selected, onPick }: { title: string; image: MapPreviewImage | null; selected: MapPoint; onPick: (point: MapPoint) => void }) {
  const [locked, setLocked] = useState(true);
  if (!image) return <div className="notice compact-note">{title}：请先导入预览图，之后可点击图片选择 16x16 tile 坐标。</div>;
  const imageUrl = "id" in image ? `/api/assets/${image.id}` : image.url;
  const imageLabel = "stored_path" in image ? image.stored_path : image.label;
  return (
    <div className="map-visual-picker">
      <div className="map-picker-head">
        <div className="schedule-map-meta">{title}：当前 {selected.X} {selected.Y}；{imageLabel}</div>
        <button type="button" className={`secondary compact-toggle ${locked ? "" : "active"}`} onClick={() => setLocked(!locked)}>
          {locked ? "解锁取点" : "锁定取点"}
        </button>
      </div>
      {locked && <div className="notice compact-note">已锁定，点击地图不会修改坐标。</div>}
      <div className="schedule-map-scroll">
        <img
          className={locked ? "map-pick-locked" : "map-pick-unlocked"}
          src={imageUrl}
          alt={title}
          onClick={(event) => {
            if (locked) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const naturalWidth = event.currentTarget.naturalWidth || rect.width;
            const naturalHeight = event.currentTarget.naturalHeight || rect.height;
            const x = Math.floor(((event.clientX - rect.left) / rect.width) * naturalWidth / 16);
            const y = Math.floor(((event.clientY - rect.top) / rect.height) * naturalHeight / 16);
            onPick({ X: Math.max(0, x), Y: Math.max(0, y) });
          }}
        />
      </div>
    </div>
  );
}

function MapAreaPicker({ title, image, area, onChange, lockSize = false }: { title: string; image: MapPreviewImage | null; area: MapArea; onChange: (area: MapArea) => void; lockSize?: boolean }) {
  function patch(patchValue: Partial<MapArea>) {
    onChange({ ...area, ...patchValue });
  }
  return (
    <div className="map-area-picker">
      <div className="grid two tight-grid">
        <Field label={`${title} X`} value={String(area.X)} onChange={(value) => patch({ X: integerInRange(value, 0, 999, 0) })} />
        <Field label={`${title} Y`} value={String(area.Y)} onChange={(value) => patch({ Y: integerInRange(value, 0, 999, 0) })} />
        <Field label="宽 Width" value={String(area.Width)} onChange={(value) => !lockSize && patch({ Width: integerInRange(value, 1, 999, 1) })} />
        <Field label="高 Height" value={String(area.Height)} onChange={(value) => !lockSize && patch({ Height: integerInRange(value, 1, 999, 1) })} />
      </div>
      <MapPreviewPicker title={title} image={image} selected={{ X: area.X, Y: area.Y }} onPick={(point) => patch({ X: point.X, Y: point.Y })} />
      <div className="field"><span>{title} 预览</span><code>{`{ X: ${area.X}, Y: ${area.Y}, Width: ${area.Width}, Height: ${area.Height} }`}</code></div>
    </div>
  );
}

function scheduleAnimationOptions(project: Project, ruleset: Ruleset, npcName: string): RulesetOption[] {
  const normalizedNpc = normalizeInternalName(npcName || "ExampleNPC");
  const options = rulesetOptions(ruleset, "schedule_animations").map((option) => ({ ...option, value: String(option.value).replace("<npc>", normalizedNpc), label: String(option.label).replace("<npc>", normalizedNpc) }));
  for (const entry of project.game_data) {
    if (!isNpcAnimationEntry(entry, normalizedNpc)) continue;
    const key = entry.key || normalizeAnimationKey(stringField(animationMetaFromEntry(entry).customKey));
    if (!key || options.some((option) => String(option.value) === key)) continue;
    options.push({ label: `角色动画 ${key}`, value: key });
  }
  return options;
}

function TriggerActionForm({ project, entry, ruleset, onChange }: { project: Project; entry: GameDataEntry; ruleset: Ruleset; onChange: (entry: GameDataEntry) => void }) {
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
      <TriggerActionCommandEditor value={actions} questOptions={questOptions(project)} onChange={(next) => updateValue({ Actions: next })} />
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

function MailAttachmentEditor({ value, itemOptions, questOptions, specialOrderOptions = [], onChange }: { value: MailAttachmentRow[]; itemOptions: ItemOption[]; questOptions: RulesetOption[]; specialOrderOptions?: RulesetOption[]; onChange: (value: MailAttachmentRow[]) => void }) {
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
              <ItemSingleSelect label="物品 ID" options={itemOptions} value={row.itemId} onChange={(itemId) => updateRow(index, { itemId })} />
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
              <ComboField label="任务 ID" value={row.questId} options={questOptions} onChange={(questId) => updateRow(index, { questId: String(questId) })} />
              <Field label="自定义任务 ID" value={row.questId} onChange={(questId) => updateRow(index, { questId })} />
              <BoolField label="自动接取" value={row.autoGrant} onChange={(autoGrant) => updateRow(index, { autoGrant })} />
            </>}
            {row.kind === "specialOrder" && <>
              <ComboField label="订单 ID" value={row.orderId} options={specialOrderOptions.length ? specialOrderOptions : [{ label: "暂无项目订单", value: row.orderId || "" }]} onChange={(orderId) => updateRow(index, { orderId: String(orderId) })} />
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
    questId: stringField(source.questId || source.QuestId || "ExampleQuest"),
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
  if (kind === "AddQuest") return normalizeTriggerActionRow({ kind, questId: parts[1] || "ExampleQuest" });
  if (kind === "RunTriggerAction") return normalizeTriggerActionRow({ kind, targetAction: parts[1] || "ExampleTriggerAction" });
  return normalizeTriggerActionRow({ kind: "custom", raw: value });
}

function triggerActionKind(value: unknown): TriggerActionCommandKind {
  return value === "AddMail" || value === "RemoveMail" || value === "AddMoney" || value === "AddQuest" || value === "RunTriggerAction" ? value : "custom";
}

function triggerActionString(row: TriggerActionRow) {
  if (row.kind === "AddMail" || row.kind === "RemoveMail") {
    const defaultType = row.kind === "AddMail" ? "tomorrow" : "all";
    const type = row.mailType && row.mailType !== defaultType ? ` ${row.mailType}` : "";
    return `${row.kind} ${row.player || "Current"} ${row.mailId || "ExampleMail"}${type}`;
  }
  if (row.kind === "AddMoney") return `AddMoney ${integerInRange(row.amount, -9999999, 9999999, 500)}`;
  if (row.kind === "AddQuest") return `AddQuest ${row.questId || "ExampleQuest"}`;
  if (row.kind === "RunTriggerAction") return `RunTriggerAction ${row.targetAction || "ExampleTriggerAction"}`;
  return row.raw.trim();
}

function TriggerActionCommandEditor({ value, questOptions, onChange }: { value: TriggerActionRow[]; questOptions: RulesetOption[]; onChange: (value: string[]) => void }) {
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
            {row.kind === "AddQuest" && <>
              <ComboField label="任务 ID" value={row.questId} options={questOptions} onChange={(questId) => updateRow(index, { questId: String(questId) })} />
              <Field label="自定义任务 ID" value={row.questId} onChange={(questId) => updateRow(index, { questId })} />
            </>}
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
  { label: "AddQuest 添加任务", value: "AddQuest" },
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

const MAP_LOCATION_TYPE_OPTIONS: RulesetOption[] = [
  { label: "Default 默认", value: "Default" },
  { label: "Town 城镇", value: "Town" },
  { label: "Farm 农场", value: "Farm" },
  { label: "Mine 矿洞", value: "Mine" },
  { label: "Underground 地下", value: "Underground" },
  { label: "Outdoors 户外", value: "Outdoors" },
  { label: "Indoors 室内", value: "Indoors" }
];

const MAP_PATCH_MODE_OPTIONS: RulesetOption[] = [
  { label: "ReplaceByLayer 默认：按图层替换", value: "ReplaceByLayer" },
  { label: "Overlay：只覆盖非空瓦片", value: "Overlay" },
  { label: "Replace：完整替换", value: "Replace" }
];

const MAP_WARP_KIND_OPTIONS: RulesetOption[] = [
  { label: "玩家 Warp / AddWarps", value: "AddWarps" },
  { label: "NPC Warp / AddNpcWarps", value: "AddNpcWarps" }
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

function SpouseMapImport({ label, project, npcName, shortName, fallbackName, onImported }: { label: string; project: Project; npcName: string; shortName: string; fallbackName: string; onImported: (project: Project, storedPath: string, asset: Asset) => void }) {
  const [status, setStatus] = useState("");
  const basePath = `assets/Maps/${normalizeInternalName(npcName)}/${spouseMapShortName(shortName, fallbackName)}`;
  return (
    <label className="field character-asset-field">
      <span>{label}</span>
      <input type="file" accept=".tmx,.tbin" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const ext = file.name.toLowerCase().endsWith(".tbin") ? ".tbin" : ".tmx";
        const storedPath = `${basePath}${ext}`;
        try {
          const response = await importProjectAssetWithRecord(project, file, storedPath);
          onImported(response.project, storedPath, response.asset);
          setStatus(`已导入：${storedPath}`);
        } catch (error) {
          setStatus(`导入失败：${readError(error)}`);
        }
      }} />
      <code>{basePath}.tmx / {basePath}.tbin</code>
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
  const hasRoom = Object.keys(room).length > 0;
  const shortName = spouseMapShortName(stringField(room.MapAsset), `${npcName}SpouseRoom`);
  const mapAsset = spouseMapAsset(shortName);

  function roomValue(nextShortName: string, patch: JsonDict = {}) {
    return {
      ...room,
      ...patch,
      MapAsset: spouseMapAsset(nextShortName),
      MapSourceRect: spouseRoomSourceRect()
    };
  }

  function updateShortName(nextShortName: string) {
    onChange(roomValue(nextShortName));
  }

  function importSpouseRoomMap(nextProject: Project, storedPath: string) {
    const target = spouseMapLoadTarget(shortName);
    const patch: Patch = {
      id: makeId(),
      name: `加载 ${npcName} 配偶房地图`,
      action: "Load",
      enabled: true,
      target,
      from_file: storedPath,
      when: {},
      fields: {},
      advanced: {}
    };
    onImportMap(nextProject, roomValue(shortName), patch);
  }

  return (
    <div className="structured-editor">
      <div className="structured-editor-head">
        <div>
          <strong>配偶房 SpouseRoom</strong>
          <span>导入 tmx/tbin 地图；MapAsset 会自动写为 <code>{mapAsset}</code>，Load Target 写为 <code>{spouseMapLoadTarget(shortName)}</code>。</span>
        </div>
        {!hasRoom && <button type="button" className="secondary" onClick={() => onChange(roomValue(shortName))}><Icon name="plus" />添加配偶房</button>}
      </div>
      {hasRoom && (
        <div className="grid two">
          <Field label="地图短名" value={shortName} onChange={updateShortName} />
          <div className="field">
            <span>写入 MapAsset</span>
            <code>{mapAsset}</code>
          </div>
          <div className="field">
            <span>固定 MapSourceRect</span>
            <code>{JSON.stringify(spouseRoomSourceRect())}</code>
          </div>
          <SpouseMapImport label="导入配偶房地图 tmx/tbin" project={project} npcName={npcName} shortName={shortName} fallbackName={`${npcName}SpouseRoom`} onImported={(nextProject, storedPath) => importSpouseRoomMap(nextProject, storedPath)} />
          {stringField(room.MapAsset).startsWith("Mods/") && <div className="inline-warning">检测到旧的贴图式 MapAsset。请重新导入 tmx/tbin 地图以改为 <code>{mapAsset}</code>。</div>}
        </div>
      )}
      <JsonField label="SpouseRoom 高级 JSON" value={room} onChange={(next) => onChange(isObject(next) ? next : {})} />
    </div>
  );
}

function NpcSpousePatioEditor({ value, project, setProject, npcName, entry, characterValue, onChange }: { value: unknown; project: Project; setProject: (project: Project) => void; npcName: string; entry: GameDataEntry; characterValue: JsonDict; onChange: (value: JsonDict) => void }) {
  const patio = isObject(value) ? value : {};
  const rect = isObject(patio.MapSourceRect) ? patio.MapSourceRect : {};
  const pixelOffset = isObject(patio.SpriteAnimationPixelOffset) ? patio.SpriteAnimationPixelOffset : {};
  const frames = patioFramesToText(patio.SpriteAnimationFrames);
  const parsedFrames = parsePatioAnimationFrames(frames);
  const shortName = spouseMapShortName(stringField(patio.MapAsset), "SpousePatio");

  function updatePatio(patch: JsonDict) {
    onChange({ ...patio, ...patch });
  }

  function updateRect(key: "X" | "Y" | "Width" | "Height", next: string) {
    updatePatio({ MapSourceRect: { ...spousePatioSourceRect(rect), [key]: numberOrText(next) } });
  }

  function updatePixelOffset(key: "X" | "Y", next: string) {
    updatePatio({ SpriteAnimationPixelOffset: { ...pixelOffset, [key]: numberOrText(next) } });
  }

  function updateFrames(nextFrames: string) {
    updatePatio({ SpriteAnimationFrames: patioFramesFromText(nextFrames) });
  }

  function importSpousePatioMap(nextProject: Project, storedPath: string) {
    const nextPatio = { ...patio, MapAsset: spouseMapAsset(shortName), MapSourceRect: spousePatioSourceRect(rect) };
    const patch: Patch = {
      id: makeId(),
      name: `加载 ${npcName} 配偶庭院地图`,
      action: "Load",
      enabled: true,
      target: spouseMapLoadTarget(shortName),
      from_file: storedPath,
      when: {},
      fields: {},
      advanced: {}
    };
    setProject({
      ...nextProject,
      patches: mergeWorkflowPatches(nextProject.patches, [patch]),
      game_data: project.game_data.map((item) => item.id === entry.id ? { ...entry, value: { ...characterValue, SpousePatio: nextPatio } } : item)
    });
  }

  return (
    <div className="structured-editor">
      <div className="structured-editor-head">
        <div>
          <strong>配偶庭院 SpousePatio</strong>
          <span>MapAsset 不包含 Maps/ 前缀；导入 tmx/tbin 后会生成 <code>{spouseMapLoadTarget(shortName)}</code>。动画按 100ms 帧序列编辑并自动压缩导出。</span>
        </div>
      </div>
      <div className="grid two">
        <Field label="庭院地图短名" value={shortName} onChange={(next) => updatePatio({ MapAsset: spouseMapAsset(next), MapSourceRect: spousePatioSourceRect(rect) })} />
        <div className="field">
          <span>写入 MapAsset</span>
          <code>{spouseMapAsset(shortName)}</code>
        </div>
        <Field label="矩形 X" value={stringField(rectField(rect, "X", 0))} onChange={(next) => updateRect("X", next)} />
        <Field label="矩形 Y" value={stringField(rectField(rect, "Y", 0))} onChange={(next) => updateRect("Y", next)} />
        <Field label="宽度 Width" value={stringField(rectField(rect, "Width", 4))} onChange={(next) => updateRect("Width", next)} />
        <Field label="高度 Height" value={stringField(rectField(rect, "Height", 4))} onChange={(next) => updateRect("Height", next)} />
        <SpouseMapImport label="导入配偶庭院地图 tmx/tbin" project={project} npcName={npcName} shortName={shortName} fallbackName="SpousePatio" onImported={(nextProject, storedPath) => importSpousePatioMap(nextProject, storedPath)} />
        <Field label="动画帧序列 SpriteAnimationFrames" value={frames} onChange={updateFrames} />
        {!parsedFrames.valid && frames.trim() && <div className="inline-error">{parsedFrames.error}</div>}
        <PatioSpriteFramePicker project={project} setProject={setProject} npcName={npcName} framesText={frames} onChange={updateFrames} />
        <Field label="像素偏移 X" value={stringField(pointField(pixelOffset, "X", 0))} onChange={(next) => updatePixelOffset("X", next)} />
        <Field label="像素偏移 Y" value={stringField(pointField(pixelOffset, "Y", 0))} onChange={(next) => updatePixelOffset("Y", next)} />
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

function DialogueInsertToolbox({ onInsert, stateKey = "dialogue:text-tools" }: { onInsert: (token: string) => void; stateKey?: string }) {
  const toolGroups = [
    {
      title: "常用",
      tools: [
        { label: "停顿", token: "#$b#", title: "插入一段停顿/换段，常用于同一句对话的第二段。" },
        { label: "中断", token: "#$e#", title: "结束当前对话段并等待玩家继续。" },
        { label: "换页", token: "$b", title: "对话命令：换到下一页文本。" },
        { label: "结束", token: "$e", title: "对话命令：结束对话。" },
        { label: "关闭", token: "$k", title: "对话命令：关闭对话框。" },
        { label: "玩家名", token: "@", title: "替换为玩家名字。" }
      ]
    },
    {
      title: "问答",
      tools: [
        { label: "提问 $q", token: "$q response_id fallback_id#问题文本", title: "创建可回答的问题；后续用 $r 定义回答。" },
        { label: "回答 $r", token: "$r response_id 10 neutral#回答文本", title: "添加一个回答选项：回答 ID、友情变化、反应、显示文本。" },
        { label: "回答分支 $p", token: "$p response_id#选过时文本|没选过时文本", title: "根据玩家是否选过某个回答显示不同文本。" },
        { label: "快速问答 $y", token: "$y 'Yes_好的|No_不了'", title: "快速 yes/no 式回答与回复。" }
      ]
    },
    {
      title: "条件",
      tools: [
        { label: "随机 $c", token: "$c 0.5#文本A#文本B", title: "按概率随机显示文本 A 或文本 B。" },
        { label: "状态 $d", token: "$d state_id#已有状态文本|无状态文本", title: "根据对话状态/flag 选择文本。" },
        { label: "查询 $query", token: "$query PLAYER_HAS_MAIL Current ExampleMail#满足时文本|不满足时文本", title: "按 Game State Query 条件选择文本。" },
        { label: "性别", token: "${先生^女士^朋友}$", title: "按玩家性别显示不同文本，第三段为非二元选项。" }
      ]
    },
    {
      title: "动作",
      tools: [
        { label: "动作 $action", token: "$action AddMoney 500", title: "执行一个 action/trigger action 字符串。" },
        { label: "话题 $t", token: "$t topic_id 7", title: "开启一个 active dialogue topic，后面数字是持续天数。" },
        { label: "事件 $v", token: "$v event_id true true", title: "触发事件；后两个参数用于检查前置条件和已看过时跳过。" },
        { label: "信件 $1", token: "$1 LetterId#首次文本#$e#再次文本", title: "按信件读取状态显示首次/再次文本。" },
        { label: "分支 %fork", token: "%fork", title: "在支持的位置分叉后续对话。" },
        { label: "揭示喜好", token: "%revealtaste:NPC:(O)336", title: "揭示某个 NPC 对某物品的喜好。" }
      ]
    },
    {
      title: "替换符",
      tools: [
        { label: "农场名", token: "%farm", title: "替换为农场名。" },
        { label: "配偶", token: "%spouse", title: "替换为玩家配偶名。" },
        { label: "孩子1", token: "%kid1", title: "替换为第一个孩子名。" },
        { label: "孩子2", token: "%kid2", title: "替换为第二个孩子名。" },
        { label: "时间", token: "%time", title: "替换为当前时间相关文本。" },
        { label: "物品图标", token: "[336]", title: "插入物品图标/物品引用标记，可把 336 改为目标 ID。" }
      ]
    }
  ];

  return (
    <PersistentDetails className="dialogue-toolbox" stateKey={stateKey} title="对话插入按钮" defaultOpen={false}>
      <div className="dialogue-tool-groups">
        {toolGroups.map((group) => (
          <div className="dialogue-tool-group" key={group.title}>
            <strong>{group.title}</strong>
            <div className="button-row compact-buttons">
              {group.tools.map((tool) => (
                <button type="button" className="secondary" key={`${group.title}-${tool.label}`} onClick={() => onInsert(tool.token)} title={tool.title}>
                  {tool.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PersistentDetails>
  );
}

function DialogueTextareaWithTools({ label, value, onChange, stateKey }: { label: string; value: string; onChange: (value: string) => void; stateKey?: string }) {
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
      <DialogueInsertToolbox onInsert={insertToken} stateKey={stateKey} />
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
      <DialogueInsertToolbox onInsert={insertToken} />
      <PersistentDetails className="portrait-tools" stateKey={`dialogue:portrait-tools:${npcName || "default"}`} title="头像编号按钮" defaultOpen={false}>
        <PortraitTokenPicker project={project} npcName={npcName} onInsert={insertToken} />
      </PersistentDetails>
    </div>
  );
}

const AFFINITY_DIALOGUE_GROUPS: { id: AffinityDialogueGroupId; label: string; whenLabel: string; suffix: string }[] = [
  { id: "0123", label: "0-3 心", whenLabel: "Hearts:<NPC> = 0, 1, 2, 3", suffix: "0123" },
  { id: "4567", label: "4-7 心", whenLabel: "Hearts:<NPC> = 4, 5, 6, 7", suffix: "4567" },
  { id: "8910", label: "8-10 心", whenLabel: "Hearts:<NPC> = 8, 9, 10", suffix: "8910" },
  { id: "married", label: "已婚", whenLabel: "Relationship:<NPC> = Married", suffix: "married" }
];

function emptyAffinityDialogueVariants(): AffinityDialogueVariants {
  return { "0123": "", "4567": "", "8910": "", married: "" };
}

function normalizeAffinityDialogueVariants(value: unknown, legacyText = ""): AffinityDialogueVariants {
  const source = isObject(value) ? value as JsonDict : {};
  return {
    "0123": stringField(source["0123"] ?? legacyText),
    "4567": stringField(source["4567"] ?? ""),
    "8910": stringField(source["8910"] ?? ""),
    married: stringField(source.married ?? "")
  };
}

function hasAffinityDialogueText(variants: AffinityDialogueVariants) {
  return AFFINITY_DIALOGUE_GROUPS.some((group) => variants[group.id].trim());
}

function AffinityDialogueVariantEditor({ title, project, npcName, variants, onChange }: { title: string; project: Project; npcName: string; variants: AffinityDialogueVariants; onChange: (variants: AffinityDialogueVariants) => void }) {
  return (
    <div className="affinity-dialogue-editor">
      <div className="structured-editor-head">
        <div>
          <strong>{title}</strong>
          <span>默认按好感/关系分组导出；NPC 会自动填入 {npcName}。</span>
        </div>
      </div>
      {AFFINITY_DIALOGUE_GROUPS.map((group) => (
        <PersistentDetails key={group.id} className="dialogue-section" stateKey={`affinity-dialogue:${title}:${npcName}:${group.id}`} title={`${group.label} / ${group.whenLabel.replace("<NPC>", npcName)}`} defaultOpen={group.id === "0123" || Boolean(variants[group.id].trim())}>
          <DialogueTextTools
            label={`${title} ${group.label}`}
            project={project}
            npcName={npcName}
            value={variants[group.id]}
            onChange={(text) => onChange({ ...variants, [group.id]: text })}
          />
        </PersistentDetails>
      ))}
    </div>
  );
}

function ItemMultiSelect({ label, options, value, onChange, placeholder }: { label: string; options: ItemOption[]; value: string[]; onChange: (value: string[]) => void; placeholder?: string }) {
  const [custom, setCustom] = useState("");
  const [query, setQuery] = useState("");
  const selected = value.map(String).filter(Boolean);
  const selectedSet = new Set(selected);
  const grouped = groupedItemOptions(filterItemOptions(options.filter((option) => !selectedSet.has(String(option.value))), query));

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
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索中文名 / ID / 来源" />
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

function ItemSingleSelect({ label, options, value, onChange }: { label: string; options: ItemOption[]; value: string; onChange: (value: string) => void }) {
  const matched = options.some((option) => String(option.value) === value);
  const [custom, setCustom] = useState(!matched && value !== "");
  const [query, setQuery] = useState("");
  const filteredOptions = filterItemOptions(options, query);
  useEffect(() => {
    setCustom(!options.some((option) => String(option.value) === value) && value !== "");
  }, [value, options]);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="combo-field">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索中文名 / ID / 来源" />
        <select value={custom ? "__custom__" : value} onChange={(event) => {
          if (event.target.value === "__custom__") {
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(event.target.value);
        }}>
          <option value="">选择一个物品...</option>
          {groupedItemOptions(filteredOptions).map((group) => (
            <optgroup label={group.label} key={group.key}>
              {group.options.map((option) => <option key={`${option.source || "option"}-${option.value}`} value={String(option.value)}>{option.label}</option>)}
            </optgroup>
          ))}
          <option value="__custom__">自定义...</option>
        </select>
        {custom && <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="输入自定义物品 ID" />}
      </div>
    </label>
  );
}

function filterItemOptions(options: ItemOption[], query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return options;
  return options.filter((option) => {
    const haystack = [
      option.label,
      String(option.value),
      option.source || ""
    ].join(" ").toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
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
  const [festivalMapResources, setFestivalMapResources] = useState<MapResourceResponse>({ maps: [], source_path: "", warning: "" });
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
  const npcDisplayNameKey = i18nKeyFromRef(value.DisplayName) || `Name.${npcName}`;
  const npcDisplayNameText = localizedText(project, value.DisplayName, npcName);

  useEffect(() => {
    let cancelled = false;
    fetchJson<MapResourceResponse>("/api/maps/resources")
      .then((next) => { if (!cancelled) setFestivalMapResources(next); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  function updateValue(patch: JsonDict) {
    onChange({ ...entry, value: compactObject({ ...value, ...patch }) });
  }

  function updateNpcDisplayName(text: string) {
    setProject({
      ...project,
      game_data: project.game_data.map((item) => item.id === entry.id ? {
        ...entry,
        value: compactObject({ ...value, DisplayName: i18nRef(npcDisplayNameKey) })
      } : item),
      i18n: { ...project.i18n, [npcDisplayNameKey]: text }
    });
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
    const description = stringField(roommate.description || `把这封信交给 ${npcDisplayNameText || npcName}，邀请他/她成为室友。`);
    const displayNameKey = itemI18nKey(project, "Object", itemId, "Name");
    const descriptionKey = itemI18nKey(project, "Object", itemId, "Description");
    const price = Number(roommate.price || 5000);
    const itemEntry = createWorkflowEntry("item", `${npcName} 室友提案物品`, "Data/Objects", itemId, {
      Name: stringField(roommate.name || "A special invitation letter"),
      DisplayName: i18nRef(displayNameKey),
      Description: i18nRef(descriptionKey),
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
      patches: mergeWorkflowPatches(project.patches, [texturePatch]),
      i18n: { ...project.i18n, [displayNameKey]: displayName, [descriptionKey]: description }
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
    const displayName = npcDisplayNameText || npcName;
    const target = isMarriage ? `Characters/Dialogue/MarriageDialogue${npcName}` : `Characters/Dialogue/${npcName}`;
    const nextKey = nextDialogueKey(project, target, isMarriage
      ? marriageKeyOptions(npcName).map((item) => String(item.value))
      : normalDialogueKeyCandidates());
    const isWeekdayKey = WEEKDAY_OPTIONS.some((item) => item.value === nextKey);
    const formatId = isMarriage ? "marriage_key" : (isWeekdayKey ? "weekday" : "normal_custom");
    const format = dialogueFormatById(formatId, ruleset);
    const fields = normalizeDialogueFields(format, {
      weekday: nextKey,
      key: nextKey,
      customKey: nextKey,
      scene: "Indoor_Day",
      index: 0,
      npc: npcName
    }, npcName);
    const state: DialogueEntryState = {
      npcName,
      isMarriage,
      keyType: format.id,
      textId: "",
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
    const entryName = dialogueEntryTitle(displayName, isMarriage ? "婚后/室友对话" : "普通对话", key);
    const baseEntry = createWorkflowEntry("dialogue", entryName, target, key, "");
    const textId = dialogueTextId(baseEntry);
    const i18nKey = dialogueI18nKeyFromParts(npcName, isMarriage, "", key, textId);
    const dialogueEntry = withDialogueMetadata({ ...baseEntry, value: i18nRef(i18nKey) }, { ...state, textId }, format, i18nKey);
    setExpandedNpcEntryId(mergedEntryId(project, dialogueEntry));
    upsertNpcEntries([dialogueEntry], {
      [i18nKey]: project.i18n[i18nKey] || defaultDialogueText(format.id)
    });
  }

  function createSpecialDialogue(kind: SpecialDialogueKind) {
    const displayName = npcDisplayNameText || npcName;
    const entry = createSpecialDialogueEntry(npcName, displayName, kind, project.game_data);
    setExpandedNpcEntryId(mergedEntryId(project, entry));
    upsertNpcEntries([entry], {
      [extractI18nKey(entry.value)]: defaultSpecialDialogueText(kind)
    });
  }

  function createNpcGiftTastePlaceholder() {
    const displayName = npcDisplayNameText || npcName;
    upsertNpcEntries([
      npcModuleMetadata(createWorkflowEntry("custom", `${displayName} 礼物喜好`, "Data/NPCGiftTastes", npcName, giftTasteToString(defaultGiftTasteState(displayName))), "giftTaste")
    ]);
  }

  function createMovieReactionPlaceholder() {
    const displayName = npcDisplayNameText || npcName;
    upsertNpcEntries([
      npcModuleMetadata(withMovieReactionMetadata(createWorkflowEntry("custom", `${displayName} 电影观感`, "Data/MoviesReactions", npcName, defaultMovieReactionValue(npcName)), npcName), "movieReaction")
    ]);
  }

  function createNpcSchedulePlaceholder() {
    const displayName = npcDisplayNameText || npcName;
    const map = stringField(value.DefaultMap || (dictArray(value.Home)[0]?.Location) || "Town");
    const home = dictArray(value.Home)[0] || {};
    const tile = isObject(home.Tile) ? home.Tile : {};
    const x = Number(tile.X ?? 0);
    const y = Number(tile.Y ?? 0);
    const startX = Number.isFinite(x) ? x : 0;
    const startY = Number.isFinite(y) ? y : 0;
    const points: SchedulePoint[] = [
      { ...defaultSchedulePoint(0, map), x: startX, y: startY, direction: 2 },
      { ...defaultSchedulePoint(1, map), time: "2200", x: startX, y: startY, direction: 2 }
    ];
    const meta: ScheduleMeta = {
      npcName,
      keyType: "season",
      fields: { season: "spring" },
      initialCommand: "none",
      gotoKey: "spring",
      friendshipNpc: npcName,
      friendshipHearts: 6,
      mailId: "ExampleMail",
      mailMissingKey: "spring",
      mailReceivedKey: "spring",
      points,
      dialogueEntries: []
    };
    const scheduleEntry = npcModuleMetadata(createWorkflowEntry("schedule", `${displayName} 基础日程`, `Characters/schedules/${npcName}`, "spring", buildScheduleScript(meta, npcName, "spring")), "schedule");
    upsertNpcEntries([{ ...scheduleEntry, advanced: { ...scheduleEntry.advanced, StardewCPStudio: { ...(isObject(scheduleEntry.advanced.StardewCPStudio) ? scheduleEntry.advanced.StardewCPStudio as JsonDict : {}), schedule: meta } } }]);
  }

  function createNpcAnimationPlaceholder(isSleep: boolean) {
    const displayName = npcDisplayNameText || npcName;
    const key = isSleep ? sleepAnimationKey(npcName) : `${npcName}_CustomAnimation`;
    const meta: AnimationMeta = {
      npcName,
      isSleep,
      customKey: key,
      entryFrames: "0",
      repeatFrames: "1",
      leavingFrames: "2",
      messageText: "",
      messageVariants: emptyAffinityDialogueVariants(),
      layingDown: false,
      useOffset: false,
      offsetX: 0,
      offsetY: 0
    };
    const animationEntry = npcModuleMetadata(createWorkflowEntry("animation", `${displayName} ${isSleep ? "睡眠动画" : "自定义动画"}`, "Data/animationDescriptions", key, buildAnimationDescriptionValue(meta, npcName, key)), "animation");
    setExpandedNpcEntryId(mergedEntryId(project, animationEntry));
    upsertNpcEntries([{ ...animationEntry, advanced: { ...animationEntry.advanced, StardewCPStudio: { ...(isObject(animationEntry.advanced.StardewCPStudio) ? animationEntry.advanced.StardewCPStudio as JsonDict : {}), animation: meta } } }]);
  }

  function createNpcMailPlaceholder() {
    const displayName = npcDisplayNameText || npcName;
    upsertNpcEntries([
      npcModuleMetadata(createWorkflowEntry("custom", `${displayName} 欢迎邮件`, "Data/Mail", `${npcName}.Welcome`, `你好，@！^^${displayName} 已经来到星露谷了。[#]来自 ${displayName} 的信`), "mail")
    ]);
  }

  function createNpcEventPlaceholder() {
    const displayName = npcDisplayNameText || npcName;
    upsertNpcEntries([
      npcModuleMetadata(createWorkflowEntry("event", `${displayName} 好感事件`, "Data/Events/Town", `${workflowEventId(npcName)}/f ${npcName} 2500`, `pause 500/speak ${npcName} "谢谢你来看我，@。"/end`), "event")
    ]);
  }

  function createNpcFestivalPosition() {
    const displayName = npcDisplayNameText || npcName;
    setProject({
      ...project,
      patches: [...project.patches, createFestivalPositionPatch(npcName, displayName, project.patches)]
    });
  }

  function hasEntry(target: string, key: string) {
    return project.game_data.some((item) => item.target === target && item.key === key);
  }

  function updateDialogueEntry(nextEntry: GameDataEntry) {
    const index = project.game_data.findIndex((item) => item.id === nextEntry.id);
    if (index < 0) return;
    setProject({ ...project, game_data: replaceAt(project.game_data, index, nextEntry) });
  }

  function updateDialogueEntryAndI18n(nextEntry: GameDataEntry, nextI18n: Record<string, string>) {
    const index = project.game_data.findIndex((item) => item.id === nextEntry.id);
    if (index < 0) return;
    setProject({ ...project, game_data: replaceAt(project.game_data, index, nextEntry), i18n: nextI18n });
  }

  function updateNpcModuleEntry(nextEntry: GameDataEntry) {
    const index = project.game_data.findIndex((item) => item.id === nextEntry.id);
    if (index < 0) return;
    setProject({ ...project, game_data: replaceAt(project.game_data, index, nextEntry) });
  }

  function updateFestivalPositionPatch(nextPatch: Patch) {
    const index = project.patches.findIndex((item) => item.id === nextPatch.id);
    if (index < 0) return;
    setProject({ ...project, patches: replaceAt(project.patches, index, nextPatch) });
  }

  function removeDialogueEntry(entryId: string) {
    setProject({ ...project, game_data: project.game_data.filter((item) => item.id !== entryId) });
  }

  function removeFestivalPositionPatch(patchId: string) {
    setProject({ ...project, patches: project.patches.filter((item) => item.id !== patchId) });
  }

  const hasNormalDialogue = hasEntry(`Characters/Dialogue/${npcName}`, "Mon");
  const hasMarriageDialogue = hasEntry(`Characters/Dialogue/MarriageDialogue${npcName}`, "Indoor_Day_0");
  const normalDialogueEntries = project.game_data.filter((item) => item.kind === "dialogue" && item.target === `Characters/Dialogue/${npcName}`);
  const marriageDialogueEntries = project.game_data.filter((item) => item.kind === "dialogue" && item.target === `Characters/Dialogue/MarriageDialogue${npcName}`);
  const specialDialogueEntries = project.game_data.filter((item) => isSpecialDialogueEntry(item, npcName));
  const scheduleEntries = project.game_data.filter((item) => item.kind === "schedule" && item.target === `Characters/schedules/${npcName}`);
  const animationEntries = project.game_data.filter((item) => isNpcAnimationEntry(item, npcName));
  const giftTasteEntry = project.game_data.find((item) => item.target === "Data/NPCGiftTastes" && item.key === npcName);
  const movieReactionEntry = project.game_data.find((item) => item.target === "Data/MoviesReactions" && item.key === npcName);
  const festivalPositionPatches = project.patches.filter((patch) => isFestivalPositionPatch(patch, npcName));
  const hasGiftTaste = hasEntry("Data/NPCGiftTastes", npcName);
  const hasMovieReaction = hasEntry("Data/MoviesReactions", npcName);
  const hasSchedule = hasEntry(`Characters/schedules/${npcName}`, "spring");
  const hasSleepAnimation = hasEntry("Data/animationDescriptions", sleepAnimationKey(npcName));
  const hasMail = hasEntry("Data/Mail", `${npcName}.Welcome`);
  const hasEvent = project.game_data.some((item) => item.target === "Data/Events/Town" && item.key.startsWith(`${workflowEventId(npcName)}/`));
  const canVisitIsland = value.CanVisitIsland ?? value.CanVisitIslandCondition;
  const hasExpandedSpecialDialogue = specialDialogueEntries.some((item) => item.id === expandedNpcEntryId);
  const hasExpandedMarriageDialogue = marriageDialogueEntries.some((item) => item.id === expandedNpcEntryId);
  const hasExpandedSchedule = scheduleEntries.some((item) => item.id === expandedNpcEntryId);
  const hasExpandedAnimation = animationEntries.some((item) => item.id === expandedNpcEntryId);

  return (
    <div className="npc-group">
      <div className="npc-group-head">
        <div>
          <strong>{npcName}</strong>
          <span>角色组块：基础信息、素材、婚前/婚后对话、室友物品和后续内容框架都会以这个内部名为默认值。</span>
        </div>
      </div>

      <CollapsibleSubsection title="基础信息">
        <div className="grid two">
          <Field label="显示名称 DisplayName（写入 i18n）" value={npcDisplayNameText} onChange={updateNpcDisplayName} />
          <ComboField label="语言 Language" value={value.Language || "Default"} options={[{ label: "默认 Default", value: "Default" }, { label: "矮人语 Dwarvish", value: "Dwarvish" }]} onChange={(next) => updateValue({ Language: next })} />
          <SeasonDayField season={stringField(value.BirthSeason || "spring")} day={Number(value.BirthDay || 1)} seasons={options("seasons")} onChange={(season, day) => updateValue({ BirthSeason: season, BirthDay: day })} />
          <ComboField label="居住地区 HomeRegion" value={value.HomeRegion || "Town"} options={options("home_regions")} onChange={(next) => updateValue({ HomeRegion: next })} />
          <ComboField label="性别 Gender" value={value.Gender || "Undefined"} options={options("genders")} onChange={(next) => updateValue({ Gender: next })} />
          <ComboField label="年龄 Age" value={value.Age || "Adult"} options={options("npc_ages")} onChange={(next) => updateValue({ Age: next })} />
          <ComboField label="礼貌 Manner" value={value.Manner || "Neutral"} options={options("npc_manners")} onChange={(next) => updateValue({ Manner: next })} />
          <ComboField label="社交焦虑 SocialAnxiety" value={value.SocialAnxiety || "Neutral"} options={options("npc_social_anxiety")} onChange={(next) => updateValue({ SocialAnxiety: next })} />
          <ComboField label="乐观程度 Optimism" value={value.Optimism || "Neutral"} options={options("npc_optimism")} onChange={(next) => updateValue({ Optimism: next })} />
          <Field label="默认地图 DefaultMap" value={stringField(value.DefaultMap || "Town")} onChange={(next) => updateValue({ DefaultMap: next })} />
          <BoolField label="配偶收养孩子 SpouseAdopts" value={Boolean(value.SpouseAdopts)} onChange={(next) => updateValue({ SpouseAdopts: next })} />
          <BoolField label="配偶想要孩子 SpouseWantsChildren" value={Boolean(value.SpouseWantsChildren)} onChange={(next) => updateValue({ SpouseWantsChildren: next })} />
          <ConditionField label="配偶送礼嫉妒 SpouseGiftJealousy" value={value.SpouseGiftJealousy ?? true} onChange={(next) => updateValue({ SpouseGiftJealousy: next })} placeholder="TRUE" />
          <Field label="嫉妒友谊变化 SpouseGiftJealousyFriendshipChange" value={stringField(value.SpouseGiftJealousyFriendshipChange ?? -30)} onChange={(next) => updateValue({ SpouseGiftJealousyFriendshipChange: numberOrText(next) })} />
          <Field label="配偶可用地板 SpouseFloors" value={numberListToText(value.SpouseFloors)} onChange={(next) => updateValue({ SpouseFloors: textToNumberList(next) })} />
          <Field label="配偶可用墙纸 SpouseWallpapers" value={numberListToText(value.SpouseWallpapers)} onChange={(next) => updateValue({ SpouseWallpapers: textToNumberList(next) })} />
          <div className="notice compact-note">SpouseFloors 范围通常为 0-39；SpouseWallpapers 通常为 0-111。留空会省略字段，让游戏随机选择默认范围。</div>
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
          <NpcSpousePatioEditor value={value.SpousePatio || {}} project={project} setProject={setProject} npcName={npcName} entry={entry} characterValue={value} onChange={(next) => updateValue({ SpousePatio: next })} />
        </div>
      </CollapsibleSubsection>

      <CollapsibleSubsection title="社交与关系">
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
      </CollapsibleSubsection>

      {route === "roommate" && (
        <CollapsibleSubsection title="室友提案物品" highlight>
          <div className="notice compact-note">
            参考 Cale.json 的 <code>LCF.InvitationLetter</code>：物品必须包含 <code>{roommateContextTag(npcName)}</code>，送给 NPC 后触发室友提案。
          </div>
          <div className="grid two">
            <Field label="物品 ID" value={stringField(roommate.itemId || `${project.manifest.UniqueID || "Author.Mod"}.InvitationLetter`)} onChange={(next) => setRoommateField("itemId", next)} />
            <Field label="物品内部名 Name" value={stringField(roommate.name || "A special invitation letter")} onChange={(next) => setRoommateField("name", next)} />
            <Field label="显示名称 DisplayName" value={stringField(roommate.displayName || "邀请信")} onChange={(next) => setRoommateField("displayName", next)} />
            <Field label="描述 Description" value={stringField(roommate.description || `把这封信交给 ${npcDisplayNameText || npcName}，邀请他/她成为室友。`)} onChange={(next) => setRoommateField("description", next)} />
            <Field label="价格 Price" value={String(roommate.price || 5000)} onChange={(next) => setRoommateField("price", numberOrText(next))} />
            <Field label="贴图目标 Texture" value={stringField(roommate.textureTarget || roommateItemTextureTarget(project, npcName))} onChange={(next) => setRoommateField("textureTarget", next)} />
            <Field label="贴图文件 FromFile" value={stringField(roommate.fromFile || `assets/CharacterFiles/RoommateItems/${npcName}/invitationletter.png`)} onChange={(next) => setRoommateField("fromFile", next)} />
            <Field label="SpriteIndex" value={String(roommate.spriteIndex || 0)} onChange={(next) => setRoommateField("spriteIndex", numberOrText(next))} />
            <CharacterAssetImport label="导入室友物品贴图" project={project} npcName={npcName} assetKind="roommateItem" currentPath={stringField(roommate.fromFile)} onImported={(nextProject, storedPath) => importRoommateItemTexture(nextProject, storedPath)} />
          </div>
          <div className="button-row">
            <button type="button" onClick={upsertRoommateItem}><Icon name="plus" />生成/更新室友提案物品</button>
          </div>
        </CollapsibleSubsection>
      )}

      <CollapsibleSubsection title="素材与外观">
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
      </CollapsibleSubsection>

      <CollapsibleSubsection title="角色特定动画">
        <div className="button-row">
          <button type="button" className="secondary" onClick={() => createNpcAnimationPlaceholder(true)}><Icon name="plus" />{hasSleepAnimation ? "更新睡眠动画" : "添加睡眠动画"}</button>
          <button type="button" className="secondary" onClick={() => createNpcAnimationPlaceholder(false)}><Icon name="plus" />添加自定义动画</button>
        </div>
        <details className="dialogue-section" open={hasExpandedAnimation || Boolean(animationEntries.length) || undefined}>
          <summary>动画条目 <span>{animationEntries.length} 条</span></summary>
          <NpcAnimationList entries={animationEntries} expandedEntryId={expandedNpcEntryId} project={project} onChange={updateNpcModuleEntry} onRemove={removeDialogueEntry} />
        </details>
      </CollapsibleSubsection>

      <CollapsibleSubsection title="节日与高级字段">
        <div className="grid two">
          <OptionalBoolField label="花舞节可跳舞 FlowerDanceCanDance" value={value.FlowerDanceCanDance} onChange={(next) => updateValue({ FlowerDanceCanDance: next })} />
          <ConditionField label="冬星盛宴参与 WinterStarParticipant" value={value.WinterStarParticipant ?? true} onChange={(next) => updateValue({ WinterStarParticipant: next })} placeholder="TRUE" />
          <BoolField label="生成缺失 NPC SpawnIfMissing" value={value.SpawnIfMissing !== false} onChange={(next) => updateValue({ SpawnIfMissing: next })} />
          <ComboField label="结局幻灯片 EndSlideShow" value={value.EndSlideShow || "MainGroup"} options={options("end_slideshow_groups")} onChange={(next) => updateValue({ EndSlideShow: next })} />
          <Field label="翻垃圾友谊影响 DumpsterDiveFriendshipEffect" value={String(value.DumpsterDiveFriendshipEffect ?? 0)} onChange={(next) => updateValue({ DumpsterDiveFriendshipEffect: numberOrText(next) })} />
          <JsonField label="朋友与家人 FriendsAndFamily" value={value.FriendsAndFamily || {}} onChange={(next) => updateValue({ FriendsAndFamily: next as JsonDict })} />
          <WinterStarGiftsEditor value={value.WinterStarGifts || []} project={project} ruleset={ruleset} itemCatalog={itemCatalog} onChange={(next) => updateValue({ WinterStarGifts: next })} />
          <JsonField label="自定义字段 CustomFields" value={value.CustomFields || {}} onChange={(next) => updateValue({ CustomFields: next as JsonDict })} />
        </div>
        <div className="structured-editor-head">
          <div>
            <strong>节日站位</strong>
            <span>参考 Festival data：追加到 <code>Set-Up_additionalCharacters</code> 或主事件 additionalCharacters，格式为 <code>{npcName} x y direction</code>。</span>
          </div>
          <button type="button" className="secondary" onClick={createNpcFestivalPosition}><Icon name="plus" />添加节日站位</button>
        </div>
        <NpcFestivalPositionList
          patches={festivalPositionPatches}
          mapResources={festivalMapResources.maps}
          onChange={updateFestivalPositionPatch}
          onRemove={removeFestivalPositionPatch}
        />
      </CollapsibleSubsection>

      <CollapsibleSubsection title="对话条目">
        <div className="button-row">
          <button type="button" className="secondary" onClick={() => createNpcDialoguePlaceholder(false)}><Icon name="plus" />添加普通对话</button>
          <button type="button" className="secondary" onClick={() => createSpecialDialogue("engagement")}><Icon name="plus" />添加邀请后对话</button>
          <button type="button" className="secondary" onClick={() => createSpecialDialogue("rain")}><Icon name="plus" />添加特殊雨天对话</button>
          <button type="button" className="secondary" onClick={() => createSpecialDialogue("festival")}><Icon name="plus" />添加节日对话</button>
          <button type="button" className="secondary" disabled={route === "friend"} onClick={() => createNpcDialoguePlaceholder(true)}><Icon name="plus" />添加婚后/室友对话</button>
        </div>
        <details className="dialogue-section" open>
          <summary>普通对话 <span>{normalDialogueEntries.length} 条</span></summary>
          <NpcDialogueList entries={normalDialogueEntries} expandedEntryId={expandedNpcEntryId} project={project} ruleset={ruleset} itemCatalog={itemCatalog} i18n={project.i18n} onI18nChange={(i18n) => setProject({ ...project, i18n })} onEntryAndI18nChange={updateDialogueEntryAndI18n} onChange={updateDialogueEntry} onRemove={removeDialogueEntry} />
        </details>
        <details className="dialogue-section" open={hasExpandedSpecialDialogue || undefined}>
          <summary>特殊对话 <span>{specialDialogueEntries.length} 条</span></summary>
          <SpecialDialogueList entries={specialDialogueEntries} expandedEntryId={expandedNpcEntryId} project={project} i18n={project.i18n} onI18nChange={(i18n) => setProject({ ...project, i18n })} onChange={updateNpcModuleEntry} onRemove={removeDialogueEntry} />
        </details>
        <details className="dialogue-section" open={hasExpandedMarriageDialogue || undefined}>
          <summary>婚后/室友对话 <span>{marriageDialogueEntries.length} 条</span></summary>
          <NpcDialogueList entries={marriageDialogueEntries} expandedEntryId={expandedNpcEntryId} project={project} ruleset={ruleset} itemCatalog={itemCatalog} i18n={project.i18n} onI18nChange={(i18n) => setProject({ ...project, i18n })} onEntryAndI18nChange={updateDialogueEntryAndI18n} onChange={updateDialogueEntry} onRemove={removeDialogueEntry} />
        </details>
      </CollapsibleSubsection>

      <CollapsibleSubsection title="日程">
        <div className="button-row">
          <button type="button" className="secondary" onClick={createNpcSchedulePlaceholder}><Icon name="plus" />{hasSchedule ? "添加/更新 spring 日程" : "创建基础日程"}</button>
        </div>
        <details className="dialogue-section" open={hasExpandedSchedule || Boolean(scheduleEntries.length) || undefined}>
          <summary>日程条目 <span>{scheduleEntries.length} 条</span></summary>
          <NpcScheduleList entries={scheduleEntries} expandedEntryId={expandedNpcEntryId} project={project} ruleset={ruleset} onChange={updateNpcModuleEntry} onRemove={removeDialogueEntry} />
        </details>
      </CollapsibleSubsection>

      <CollapsibleSubsection title="礼物喜好">
        <div className="button-row">
          <button type="button" className="secondary" onClick={createNpcGiftTastePlaceholder}><Icon name="plus" />{hasGiftTaste ? "重置/更新草稿" : "创建礼物喜好"}</button>
        </div>
        {giftTasteEntry ? (
          <GiftTasteEditor project={project} ruleset={ruleset} itemCatalog={itemCatalog} entry={giftTasteEntry} npcName={npcName} displayName={npcDisplayNameText || npcName} onChange={updateNpcModuleEntry} />
        ) : (
          <div className="empty compact-empty">尚未创建礼物喜好条目。</div>
        )}
      </CollapsibleSubsection>

      <CollapsibleSubsection title="电影观感">
        <div className="button-row">
          <button type="button" className="secondary" onClick={createMovieReactionPlaceholder}><Icon name="plus" />{hasMovieReaction ? "重置/更新草稿" : "创建电影观感"}</button>
        </div>
        {movieReactionEntry ? (
          <MovieReactionEditor project={project} entry={movieReactionEntry} npcName={npcName} displayName={npcDisplayNameText || npcName} onChange={updateNpcModuleEntry} />
        ) : (
          <div className="empty compact-empty">尚未创建电影观感条目。</div>
        )}
      </CollapsibleSubsection>

      <CollapsibleSubsection title="后续模块框架" defaultOpen={false} className="floating-framework">
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
      </CollapsibleSubsection>
    </div>
  );
}

function NpcDialogueList({ entries, expandedEntryId, project, ruleset, itemCatalog, i18n, onI18nChange, onChange, onEntryAndI18nChange, onRemove }: { entries: GameDataEntry[]; expandedEntryId: string; project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; i18n: Record<string, string>; onI18nChange: (i18n: Record<string, string>) => void; onChange: (entry: GameDataEntry) => void; onEntryAndI18nChange?: (entry: GameDataEntry, i18n: Record<string, string>) => void; onRemove: (entryId: string) => void }) {
  return (
    <div className="npc-dialogue-list">
      {!entries.length && <div className="empty compact-empty">暂无条目。</div>}
      {entries.map((entry) => (
        <details className="npc-dialogue-item" key={entry.id} open={entry.id === expandedEntryId || undefined}>
          <summary className="npc-dialogue-head">
            <strong>{entry.key}</strong>
            <button type="button" className="secondary" onClick={() => onRemove(entry.id)}>删除</button>
          </summary>
          <DialogueEntryFormClean project={project} entry={entry} ruleset={ruleset} itemCatalog={itemCatalog} i18n={i18n} onI18nChange={onI18nChange} onEntryAndI18nChange={onEntryAndI18nChange} onChange={onChange} />
        </details>
      ))}
    </div>
  );
}

function NpcScheduleList({ entries, expandedEntryId, project, ruleset, onChange, onRemove }: { entries: GameDataEntry[]; expandedEntryId: string; project: Project; ruleset: Ruleset; onChange: (entry: GameDataEntry) => void; onRemove: (entryId: string) => void }) {
  return (
    <div className="npc-dialogue-list">
      {!entries.length && <div className="empty compact-empty">暂无日程条目。</div>}
      {entries.map((entry) => (
        <details className="npc-dialogue-item" key={entry.id} open={entry.id === expandedEntryId || undefined}>
          <summary className="npc-dialogue-head">
            <strong>{entry.key}</strong>
            <button type="button" className="secondary" onClick={() => onRemove(entry.id)}>删除</button>
          </summary>
          <ScheduleEntryForm project={project} entry={entry} ruleset={ruleset} onChange={onChange} />
        </details>
      ))}
    </div>
  );
}

function NpcAnimationList({ entries, expandedEntryId, project, onChange, onRemove }: { entries: GameDataEntry[]; expandedEntryId: string; project: Project; onChange: (entry: GameDataEntry) => void; onRemove: (entryId: string) => void }) {
  return (
    <div className="npc-dialogue-list">
      {!entries.length && <div className="empty compact-empty">暂无动画条目。</div>}
      {entries.map((entry) => (
        <details className="npc-dialogue-item" key={`${entry.id}-${entry.id === expandedEntryId ? "expanded" : "normal"}`} open={entry.id === expandedEntryId || undefined}>
          <summary className="npc-dialogue-head">
            <strong>{entry.key}</strong>
            <button type="button" className="secondary" onClick={() => onRemove(entry.id)}>删除</button>
          </summary>
          <AnimationEntryForm project={project} entry={entry} onChange={onChange} />
        </details>
      ))}
    </div>
  );
}

function NpcFestivalPositionList({ patches, mapResources, onChange, onRemove }: { patches: Patch[]; mapResources: MapResourceEntry[]; onChange: (patch: Patch) => void; onRemove: (patchId: string) => void }) {
  return (
    <div className="npc-dialogue-list">
      {!patches.length && <div className="empty compact-empty">暂无节日站位。</div>}
      {patches.map((patch) => {
        const meta = festivalPositionMetaFromPatch(patch) || normalizeFestivalPositionMeta({});
        return (
          <details className="npc-dialogue-item" key={patch.id} open>
            <summary className="npc-dialogue-head">
              <strong>{meta.festivalId} / {meta.phaseKey}</strong>
              <button type="button" className="secondary" onClick={() => onRemove(patch.id)}>删除</button>
            </summary>
            <FestivalPositionEditor patch={patch} mapResources={mapResources} onChange={onChange} />
          </details>
        );
      })}
    </div>
  );
}

function FestivalPositionEditor({ patch, mapResources, onChange }: { patch: Patch; mapResources: MapResourceEntry[]; onChange: (patch: Patch) => void }) {
  const meta = festivalPositionMetaFromPatch(patch) || normalizeFestivalPositionMeta({});
  const preview = festivalPreviewForId(mapResources, meta.festivalId);

  function updateMeta(nextPatch: Partial<FestivalPositionMeta>) {
    onChange(festivalPositionPatchFromMeta(patch, { ...meta, ...nextPatch }));
  }

  return (
    <div className="dialogue-builder">
      <div className="grid two">
        <Field label="NPC 内部名" value={meta.npcName} onChange={(npcName) => updateMeta({ npcName: normalizeInternalName(npcName) })} />
        <ComboField label="节日" value={meta.festivalId} options={FESTIVAL_POSITION_OPTIONS} onChange={(festivalId) => updateMeta({ festivalId: String(festivalId) })} />
        <ComboField label="站位字段" value={meta.phaseKey} options={FESTIVAL_POSITION_PHASE_OPTIONS} onChange={(phaseKey) => updateMeta({ phaseKey: String(phaseKey) })} />
        <ComboField label="朝向" value={meta.direction} options={FESTIVAL_DIRECTION_OPTIONS} onChange={(direction) => updateMeta({ direction: String(direction) })} />
        <Field label="X 坐标" value={String(meta.x)} onChange={(x) => updateMeta({ x: integerInRange(x, 0, 999, 0) })} />
        <Field label="Y 坐标" value={String(meta.y)} onChange={(y) => updateMeta({ y: integerInRange(y, 0, 999, 0) })} />
      </div>
      <MapPreviewPicker title="节日地图站位" image={preview} selected={{ X: meta.x, Y: meta.y }} onPick={(point) => updateMeta({ x: point.X, y: point.Y })} />
      <div className="notice compact-note">
        当前导出：<code>{patch.target}</code> / <code>{meta.phaseKey}</code> append <code>{festivalPositionValue(meta)}</code>，分隔符 <code>/</code>。
      </div>
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
  const textId = state.textId || dialogueTextId(entry);
  const legacyI18nKey = extractI18nKey(entry.value);
  const i18nKey = dialogueI18nKeyFromParts(state.npcName, state.isMarriage, state.i18nPrefix, key, textId);
  const text = i18n[i18nKey] ?? (legacyI18nKey ? i18n[legacyI18nKey] : undefined) ?? (typeof entry.value === "string" && !entry.value.startsWith("{{i18n:") ? entry.value : "");
  const scope = state.isMarriage ? "marriage" : "normal";

  useEffect(() => {
    setState(dialogueFormStateFromEntry(entry));
  }, [entry.id]);

  function applyState(next: DialogueEntryState, nextText = text) {
    const nextFormat = dialogueFormatById(next.keyType, ruleset);
    const nextTextId = next.textId || textId;
    const nextState = { ...next, textId: nextTextId };
    const nextKey = buildDialogueKeyFromParts(next, next.npcName, ruleset);
    const nextTarget = next.isMarriage ? `Characters/Dialogue/MarriageDialogue${next.npcName}` : `Characters/Dialogue/${next.npcName}`;
    const nextI18nKey = dialogueI18nKeyFromParts(next.npcName, next.isMarriage, next.i18nPrefix, nextKey, nextTextId);
    setState(nextState);
    onChange(withDialogueMetadata({ ...entry, target: nextTarget, key: nextKey, value: i18nRef(nextI18nKey) }, nextState, nextFormat, nextI18nKey));
    if (onI18nChange) onI18nChange({ ...i18n, [nextI18nKey]: nextText });
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
      onChange(withDialogueMetadata({ ...entry, target, key, value: i18nRef(i18nKey) }, { ...state, textId }, format, i18nKey));
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
          itemOptions={[]}
          npcName={state.npcName}
          value={normalizeDialogueFields(format, state.fields, state.npcName)[field.name] ?? ""}
          onChange={(value) => updateField(field, value)}
        />
      ))}
      {format.warning && <div className="notice compact-note">{format.warning}</div>}
      <DialogueTextareaWithTools label="台词正文（写入 i18n/default.json）" value={text} onChange={updateText} stateKey="dialogue:legacy-entry-tools" />
      <div className="notice compact-note">
        当前导出：<code>{target}</code> / <code>{key}</code> = <code>{i18nRef(i18nKey)}</code>
      </div>
    </div>
  );
}

function withDialogueMetadata(entry: GameDataEntry, state: DialogueEntryState, format: DialogueFormat, i18nKey: string): GameDataEntry {
  const existingStudio = isObject(entry.advanced.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  const textId = state.textId || dialogueTextId(entry);
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
          textId,
          fields: normalizeDialogueFields(format, state.fields, state.npcName),
          i18nKey,
          i18nPrefix: state.i18nPrefix
        }
      }
    }
  };
}

function DialogueEntryFormClean({ project, entry, ruleset, itemCatalog, i18n, onI18nChange, onEntryAndI18nChange, onChange }: { project: Project; entry: GameDataEntry; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; i18n: Record<string, string>; onI18nChange?: (i18n: Record<string, string>) => void; onEntryAndI18nChange?: (entry: GameDataEntry, i18n: Record<string, string>) => void; onChange: (entry: GameDataEntry) => void }) {
  const [state, setState] = useState(() => dialogueFormStateFromEntry(entry));
  const format = dialogueFormatById(state.keyType, ruleset);
  const normalizedFields = normalizeDialogueFields(format, state.fields, state.npcName);
  const key = buildDialogueKeyFromParts(state, state.npcName, ruleset);
  const target = state.isMarriage ? `Characters/Dialogue/MarriageDialogue${state.npcName}` : `Characters/Dialogue/${state.npcName}`;
  const textId = state.textId || dialogueTextId(entry);
  const legacyI18nKey = extractI18nKey(entry.value);
  const i18nKey = dialogueI18nKeyFromParts(state.npcName, state.isMarriage, state.i18nPrefix, key, textId);
  const text = i18n[i18nKey] ?? (legacyI18nKey ? i18n[legacyI18nKey] : undefined) ?? (typeof entry.value === "string" && !entry.value.startsWith("{{i18n:") ? entry.value : "");
  const scope = state.isMarriage ? "marriage" : "normal";
  const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const itemOptions = itemSelectionOptions(project, ruleset, itemCatalog, "qualified");

  function applyEntryAndI18n(nextEntry: GameDataEntry, nextI18n: Record<string, string>) {
    if (onEntryAndI18nChange) onEntryAndI18nChange(nextEntry, nextI18n);
    else {
      onChange(nextEntry);
      onI18nChange?.(nextI18n);
    }
  }

  useEffect(() => {
    setState(dialogueFormStateFromEntry(entry));
  }, [entry.id]);

  function applyState(next: DialogueEntryState, nextText = text) {
    const nextFormat = dialogueFormatById(next.keyType, ruleset);
    const nextTextId = next.textId || textId;
    const nextState = { ...next, textId: nextTextId };
    const nextKey = buildDialogueKeyFromParts(next, next.npcName, ruleset);
    const nextTarget = next.isMarriage ? `Characters/Dialogue/MarriageDialogue${next.npcName}` : `Characters/Dialogue/${next.npcName}`;
    const nextI18nKey = dialogueI18nKeyFromParts(next.npcName, next.isMarriage, next.i18nPrefix, nextKey, nextTextId);
    const displayName = entry.name.split("：")[0]?.replace(/ 普通对话$| 婚后\/室友对话$/, "") || next.npcName;
    const nextName = dialogueEntryTitle(displayName, next.isMarriage ? "婚后/室友对话" : "普通对话", nextKey);
    const nextEntry = withDialogueMetadata({ ...entry, name: nextName, target: nextTarget, key: nextKey, value: i18nRef(nextI18nKey) }, nextState, nextFormat, nextI18nKey);
    setState(nextState);
    applyEntryAndI18n(nextEntry, { ...i18n, [nextI18nKey]: nextText });
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
    const nextI18n = { ...i18n, [i18nKey]: nextText };
    if (entry.target !== target || entry.key !== key || entry.value !== i18nRef(i18nKey)) {
      const displayName = entry.name.split("：")[0]?.replace(/ 普通对话$| 婚后\/室友对话$/, "") || state.npcName;
      const nextEntry = withDialogueMetadata({ ...entry, name: dialogueEntryTitle(displayName, state.isMarriage ? "婚后/室友对话" : "普通对话", key), target, key, value: i18nRef(i18nKey) }, { ...state, textId }, format, i18nKey);
      applyEntryAndI18n(nextEntry, nextI18n);
      return;
    }
    onI18nChange?.(nextI18n);
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
          itemOptions={itemOptions}
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
        <DialogueInsertToolbox onInsert={insertToken} />
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

function StoryEventStudio({ project, ruleset, itemCatalog, setProject }: { project: Project; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; setProject: (project: Project) => void }) {
  const [addPanelOpen, setAddPanelOpen] = useState(true);
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

  function moveEntry(fromIndex: number, toIndex: number) {
    updateProject({ ...project, game_data: moveArrayItem(project.game_data, fromIndex, toIndex) });
  }

  return (
    <Section title="剧情事件">
      <div className={`game-data-layout ${addPanelOpen ? "" : "add-panel-collapsed"}`}>
        <aside className="game-data-add-panel">
          <button type="button" className="secondary game-data-add-toggle" onClick={() => setAddPanelOpen(!addPanelOpen)}>
            <Icon name="menu" />{addPanelOpen && "添加剧情"}
          </button>
          {addPanelOpen && (
            <div className="game-data-add-list">
              <button type="button" className="compact-add-button" onClick={addStoryEvent}><Icon name="plus" /><span>新增剧情事件</span></button>
            </div>
          )}
        </aside>
        <div className="stack game-data-stack">
          <div className="notice compact-note">
            事件写入 <code>Data/Events/&lt;LocationName&gt;</code>。当前版本用节点列表表示流程：顺序就是执行顺序，底部会实时生成可导出的事件 Key 与脚本。
          </div>
          {entries.map(({ entry, index }, position) => (
            <StudioEntryShell
              key={entry.id}
              entry={entry}
              stateKey={`event-studio:entry:${entry.id}`}
              onNameChange={(name) => setProject({ ...project, game_data: replaceAt(project.game_data, index, { ...entry, name }) })}
              onMoveUp={position > 0 ? () => moveEntry(index, entries[position - 1].index) : undefined}
              onMoveDown={position < entries.length - 1 ? () => moveEntry(index, entries[position + 1].index) : undefined}
              onRemove={() => setProject({ ...project, game_data: project.game_data.filter((item) => item.id !== entry.id) })}
            >
              <StoryEventForm
                project={project}
                entry={entry}
                ruleset={ruleset}
                itemCatalog={itemCatalog}
                i18n={project.i18n}
                onChange={(next, i18nPatch) => updateStoryEntry(index, next, i18nPatch)}
                setProject={setProject}
              />
            </StudioEntryShell>
          ))}
          {!entries.length && <div className="empty compact-empty">暂无剧情。请从左侧添加。</div>}
        </div>
      </div>
    </Section>
  );
}

function StoryEventForm({ project, entry, ruleset, itemCatalog, i18n = {}, onChange, setProject }: { project: Project; entry: GameDataEntry; ruleset: Ruleset; itemCatalog: ItemCatalogResponse; i18n?: Record<string, string>; onChange: (entry: GameDataEntry, i18nPatch?: Record<string, string>) => void; setProject: (project: Project) => void }) {
  const meta = storyMetaFromEntry(project, entry);
  const [nodeKind, setNodeKind] = useState<EventNodeKind>("speak");
  const [selectedNodeId, setSelectedNodeId] = useState(meta.nodes[0]?.id || "");
  const [mapResources, setMapResources] = useState<MapResourceResponse>({ maps: [], source_path: "", warning: "" });
  const eventMapPreview = previewForMapTarget(project, meta.location.startsWith("Maps/") ? meta.location : `Maps/${meta.location}`, mapResources.maps);
  const scriptPreview = buildStoryEventScript(meta);
  const keyPreview = buildStoryEventKey(meta);
  const branchPreviews = meta.branches.map((branch) => ({ key: branch.key, script: buildStoryBranchScript(branch, meta.actors) }));
  const selectedNodeIndex = meta.nodes.findIndex((node) => node.id === selectedNodeId);
  const selectedNode = selectedNodeIndex >= 0 ? meta.nodes[selectedNodeIndex] : meta.nodes[meta.nodes.length - 1];
  const itemOptions = itemSelectionOptions(project, ruleset, itemCatalog, "qualified");

  useEffect(() => {
    let cancelled = false;
    fetchJson<MapResourceResponse>("/api/maps/resources")
      .then((next) => { if (!cancelled) setMapResources(next); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

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

      <PersistentDetails className="story-panel" stateKey={`story:${entry.id}:actors`} title={`初始角色位置（${meta.actors.length} 个角色）`} defaultOpen>
        <div className="story-list">
          {meta.actors.map((actor, index) => (
            <div className="story-row" key={`${actor.actor}-${index}`}>
              <Field label="角色" value={actor.actor} onChange={(value) => commitMeta({ ...meta, actors: replaceAt(meta.actors, index, { ...actor, actor: value }) })} />
              <Field label="X" value={stringField(actor.x)} onChange={(value) => commitMeta({ ...meta, actors: replaceAt(meta.actors, index, { ...actor, x: integerInRange(value, -10000, 10000, actor.x) }) })} />
              <Field label="Y" value={stringField(actor.y)} onChange={(value) => commitMeta({ ...meta, actors: replaceAt(meta.actors, index, { ...actor, y: integerInRange(value, -10000, 10000, actor.y) }) })} />
              <ComboField label="方向" value={actor.direction} options={STORY_DIRECTION_OPTIONS} onChange={(value) => commitMeta({ ...meta, actors: replaceAt(meta.actors, index, { ...actor, direction: Number(value) }) })} />
              <button type="button" className="secondary" onClick={() => commitMeta({ ...meta, actors: meta.actors.filter((_, itemIndex) => itemIndex !== index) })}>删除</button>
              <MapPreviewPicker title={`${actor.actor || "角色"} 初始位置`} image={eventMapPreview} selected={{ X: actor.x, Y: actor.y }} onPick={(point) => commitMeta({ ...meta, actors: replaceAt(meta.actors, index, { ...actor, x: point.X, y: point.Y }) })} />
            </div>
          ))}
          <button type="button" className="secondary" onClick={() => commitMeta({ ...meta, actors: [...meta.actors, { actor: "ExampleNPC", x: 0, y: 0, direction: 2 }] })}>添加角色位置</button>
        </div>
      </PersistentDetails>

      <PersistentDetails className="story-panel" stateKey={`story:${entry.id}:preconditions`} title={`触发条件 Key Preconditions（${meta.preconditions.length} 条）`} defaultOpen>
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
      </PersistentDetails>

      <PersistentDetails className="story-panel" stateKey={`story:${entry.id}:nodes`} title={`流程节点（${meta.nodes.length} 个节点）`} defaultOpen>
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
              mapPreview={eventMapPreview}
              project={project}
              setProject={setProject}
              itemOptions={itemOptions}
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
      </PersistentDetails>

      <PersistentDetails className="story-panel" stateKey={`story:${entry.id}:branches`} title={`分支 Entries（${meta.branches.length} 个分支）`} defaultOpen>
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
              mapPreview={eventMapPreview}
              project={project}
              setProject={setProject}
              itemOptions={itemOptions}
              i18n={i18n}
              onChange={(nextBranch, i18nPatch) => commitMeta({ ...meta, branches: replaceAt(meta.branches, branchIndex, nextBranch) }, i18nPatch)}
              onRemove={() => commitMeta({ ...meta, branches: meta.branches.filter((item) => item.id !== branch.id) })}
            />
          ))}
        </div>
      </PersistentDetails>

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

function StoryBranchEditor({ branch, meta, mapPreview, project, setProject, itemOptions = [], i18n, onChange, onRemove }: { branch: StoryEventBranch; meta: StoryEventMeta; mapPreview?: MapPreviewImage | null; project: Project; setProject: (project: Project) => void; itemOptions?: ItemOption[]; i18n: Record<string, string>; onChange: (branch: StoryEventBranch, i18nPatch?: Record<string, string>) => void; onRemove: () => void }) {
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
              meta={{ ...meta, eventId: branch.key, i18nPrefix: `${meta.i18nPrefix}.${sanitizeI18nPart(branch.key)}`, nodes: branch.nodes }}
              branches={meta.branches}
              mapPreview={mapPreview}
              project={project}
              setProject={setProject}
              itemOptions={itemOptions}
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

function StoryNodeEditor({ node, index, meta, branches = [], mapPreview, project, setProject, itemOptions = [], i18n, onChange, onCreateBranch, onAddQuestionAnswer, onRemove, onMove }: { node: StoryEventNode; index: number; meta: StoryEventMeta; branches?: StoryEventBranch[]; mapPreview?: MapPreviewImage | null; project: Project; setProject: (project: Project) => void; itemOptions?: ItemOption[]; i18n: Record<string, string>; onChange: (node: StoryEventNode, textPatch?: { key: string; text: string }) => void; onCreateBranch?: (node: StoryEventNode) => void; onAddQuestionAnswer?: (node: StoryEventNode) => void; onRemove: () => void; onMove: (index: number, direction: -1 | 1) => void }) {
  const data = node.data || {};
  const textKey = stringField(data.i18nKey) || storyNodeI18nKey(meta, node);
  const textValue = stringField(i18n[textKey] ?? data.text ?? "");
  const patchData = (patch: JsonDict) => onChange({ ...node, data: { ...data, ...patch } });
  const patchText = (text: string) => onChange({ ...node, data: { ...data, i18nKey: textKey } }, { key: textKey, text });
  const questionAnswers = storyQuestionAnswers(node);
  const actorName = stringField(data.actor) || "farmer";
  const actorPosition = storyActorPositionBefore(meta, index, actorName);
  const moveDelta = node.kind === "move" ? storyMoveDelta(node, storyActorPositionsBeforeNode(meta, index)) : null;
  const targetX = integerInRange(data.targetX, -10000, 10000, actorPosition ? actorPosition.X + integerInRange(data.x, -999, 999, 0) : integerInRange(data.x, -999, 999, 0));
  const targetY = integerInRange(data.targetY, -10000, 10000, actorPosition ? actorPosition.Y + integerInRange(data.y, -999, 999, 0) : integerInRange(data.y, -999, 999, 0));
  const patchQuestion = (prompt: string, answers: StoryQuestionAnswer[]) => {
    const text = buildStoryQuestionText(prompt, answers);
    onChange({ ...node, data: { ...data, i18nKey: textKey, answers, text } }, { key: textKey, text });
  };

  return (
    <div className="story-node">
      <div className="story-node-head">
        <strong>{index + 1}. {node.label || storyNodeLabel(node.kind)}</strong>
        <code>{buildStoryCommandPreview(node, meta, index)}</code>
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
            <DialogueTextareaWithTools label="台词文本" value={textValue} onChange={patchText} stateKey={`dialogue:story-node:${node.kind}`} />
          </>
        )}
        {node.kind === "splitSpeak" && (
          <>
            <Field label="说话角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <Field label="i18n Key" value={textKey} onChange={(i18nKey) => patchData({ i18nKey })} />
            <DialogueTextareaWithTools label="分段台词文本" value={textValue} onChange={patchText} stateKey={`dialogue:story-node:${node.kind}`} />
          </>
        )}
        {node.kind === "textAboveHead" && (
          <>
            <Field label="气泡角色" value={stringField(data.actor)} onChange={(actor) => patchData({ actor })} />
            <Field label="i18n Key" value={textKey} onChange={(i18nKey) => patchData({ i18nKey })} />
            <DialogueTextareaWithTools label="气泡文本" value={textValue} onChange={patchText} stateKey={`dialogue:story-node:${node.kind}`} />
            <div className="notice compact-note">Wiki: textAboveHead 不会把 @ 替换为玩家名；需要玩家名时用 Content Patcher token：{"{{PlayerName}}"}</div>
          </>
        )}
        {node.kind === "message" && (
          <>
            <Field label="i18n Key" value={textKey} onChange={(i18nKey) => patchData({ i18nKey })} />
            <DialogueTextareaWithTools label="消息文本" value={textValue} onChange={patchText} stateKey={`dialogue:story-node:${node.kind}`} />
          </>
        )}
        {node.kind === "question" && (
          <>
            <Field label="fork 标记" value={stringField(data.forkId)} onChange={(forkId) => patchData({ forkId })} />
            <Field label="i18n Key" value={textKey} onChange={(i18nKey) => onChange({ ...node, data: { ...data, i18nKey } }, { key: i18nKey, text: textValue })} />
            <DialogueTextareaWithTools label="问题正文" value={storyQuestionPrompt(textValue)} onChange={(prompt) => patchQuestion(prompt, questionAnswers)} stateKey={`dialogue:story-node:${node.kind}`} />
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
            <DialogueTextareaWithTools label="问题与回答脚本" value={textValue} onChange={patchText} stateKey={`dialogue:story-node:${node.kind}`} />
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
            <BoolField label="按目标坐标计算" value={data.targetMode !== false} onChange={(targetMode) => patchData({ targetMode })} />
            <div className="notice compact-note">
              起点：{actorPosition ? `${actorPosition.X} ${actorPosition.Y}` : "未记录，请先在初始角色位置或前置移动/传送节点中设置"}；
              导出位移：{moveDelta ? `${moveDelta.dx} ${moveDelta.dy}` : `${integerInRange(data.x, -999, 999, 0)} ${integerInRange(data.y, -999, 999, 0)}`}
            </div>
            {data.targetMode !== false ? (
              <>
                <Field label="目标 X" value={stringField(data.targetX ?? targetX)} onChange={(x) => patchData({ targetMode: true, targetX: integerInRange(x, -10000, 10000, targetX) })} />
                <Field label="目标 Y" value={stringField(data.targetY ?? targetY)} onChange={(y) => patchData({ targetMode: true, targetY: integerInRange(y, -10000, 10000, targetY) })} />
                <MapPreviewPicker title="移动目标坐标" image={mapPreview || null} selected={{ X: targetX, Y: targetY }} onPick={(point) => patchData({ targetMode: true, targetX: point.X, targetY: point.Y })} />
              </>
            ) : (
              <>
                <Field label="X 偏移" value={stringField(data.x)} onChange={(x) => patchData({ x: integerInRange(x, -999, 999, 0) })} />
                <Field label="Y 偏移" value={stringField(data.y)} onChange={(y) => patchData({ y: integerInRange(y, -999, 999, 0) })} />
              </>
            )}
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
            <MapPreviewPicker title="传送目标坐标" image={mapPreview || null} selected={{ X: integerInRange(data.x, -10000, 10000, 0), Y: integerInRange(data.y, -10000, 10000, 0) }} onPick={(point) => patchData({ x: point.X, y: point.Y })} />
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
            <EventSpriteFramePicker
              project={project}
              setProject={setProject}
              actorName={stringField(data.actor) || "ExampleNPC"}
              framesText={stringField(data.frames)}
              onChange={(frames) => patchData({ frames })}
            />
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
            <ItemSingleSelect label="物品 ID" options={itemOptions} value={stringField(data.itemId)} onChange={(itemId) => patchData({ itemId })} />
            <Field label="数量 count" value={stringField(data.count)} onChange={(count) => patchData({ count: integerInRange(count, 1, 999, 1) })} />
            <Field label="品质 quality" value={stringField(data.quality)} onChange={(quality) => patchData({ quality: integerInRange(quality, 0, 4, 0) })} />
          </>
        )}
        {node.kind === "removeItem" && (
          <>
            <ItemSingleSelect label="物品 ID" options={itemOptions} value={stringField(data.itemId)} onChange={(itemId) => patchData({ itemId })} />
            <Field label="数量 count" value={stringField(data.count)} onChange={(count) => patchData({ count: integerInRange(count, 1, 999, 1) })} />
          </>
        )}
        {node.kind === "addObject" && (
          <>
            <Field label="X" value={stringField(data.x)} onChange={(x) => patchData({ x: integerInRange(x, -10000, 10000, 64) })} />
            <Field label="Y" value={stringField(data.y)} onChange={(y) => patchData({ y: integerInRange(y, -10000, 10000, 15) })} />
            <ItemSingleSelect label="物品 ID" options={itemOptions} value={stringField(data.itemId)} onChange={(itemId) => patchData({ itemId })} />
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
        {node.kind === "farmerEat" && <ItemSingleSelect label="物品 ID" options={itemOptions} value={stringField(data.objectId)} onChange={(objectId) => patchData({ objectId })} />}
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
                <DialogueTextareaWithTools label="结束后对话文本" value={textValue} onChange={patchText} stateKey={`dialogue:story-node:${node.kind}`} />
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
          <div><strong>{issue.path}</strong><span>{issue.message}</span>{issueHint(issue.path) && <small>{issueHint(issue.path)}</small>}</div>
        </div>
      ))}
    </div>
  );
}

function issueHint(path: string) {
  const patchMatch = path.match(/^patches\[(\d+)\]/);
  if (patchMatch) return `位置：CP 补丁页面，第 ${Number(patchMatch[1]) + 1} 个补丁。`;
  const gameDataMatch = path.match(/^game_data\[(\d+)\]/);
  if (gameDataMatch) return `位置：游戏数据页面，第 ${Number(gameDataMatch[1]) + 1} 个游戏数据条目。`;
  if (path.startsWith("manifest.")) return "位置：模组信息页面。";
  return "";
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

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(message);
    return typeof parsed.detail === "string" ? parsed.detail : message;
  } catch {
    return message;
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function openUploadedProject(file: File): Promise<Project> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/projects/open-upload", { method: "POST", body: form });
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

const FESTIVAL_POSITION_OPTIONS: RulesetOption[] = [
  { label: "春 13 复活节 spring13", value: "spring13" },
  { label: "春 24 花舞节 spring24", value: "spring24" },
  { label: "夏 11 夏威夷宴会 summer11", value: "summer11" },
  { label: "夏 28 月光水母 summer28", value: "summer28" },
  { label: "秋 16 星露谷展览会 fall16", value: "fall16" },
  { label: "秋 27 万灵节 fall27", value: "fall27" },
  { label: "冬 8 冰雪节 winter8", value: "winter8" },
  { label: "冬 25 冬星盛宴 winter25", value: "winter25" }
];

const FESTIVAL_POSITION_PHASE_OPTIONS: RulesetOption[] = [
  { label: "入场站位 Set-Up_additionalCharacters_y1（推荐）", value: "Set-Up_additionalCharacters_y1" },
  { label: "入场站位 Set-Up_additionalCharacters_y2（推荐）", value: "Set-Up_additionalCharacters_y2" },
  { label: "入场/普通站位 Set-Up_additionalCharacters", value: "Set-Up_additionalCharacters" },
  { label: "主事件站位 MainEvent_additionalCharacters_y1（推荐）", value: "MainEvent_additionalCharacters_y1" },
  { label: "主事件站位 MainEvent_additionalCharacters_y2（推荐）", value: "MainEvent_additionalCharacters_y2" },
  { label: "主事件站位 MainEvent_additionalCharacters", value: "MainEvent_additionalCharacters" },
  { label: "主事件站位 Main-Event_additionalCharacters_y1（冰雪节常见，推荐）", value: "Main-Event_additionalCharacters_y1" },
  { label: "主事件站位 Main-Event_additionalCharacters_y2（冰雪节常见，推荐）", value: "Main-Event_additionalCharacters_y2" },
  { label: "主事件站位 Main-Event_additionalCharacters（冰雪节常见）", value: "Main-Event_additionalCharacters" }
];

const FESTIVAL_DIRECTION_OPTIONS: RulesetOption[] = [
  { label: "向下 down", value: "down" },
  { label: "向上 up", value: "up" },
  { label: "向左 left", value: "left" },
  { label: "向右 right", value: "right" }
];

const FESTIVAL_PREVIEW_CANDIDATES: Record<string, string[]> = {
  spring13: ["spring13", "Town-EggFestival", "EggFestival", "Town"],
  spring24: ["spring24", "Forest-FlowerFestival", "Forest-FlowerDance", "FlowerDance", "FlowerFestival", "Forest"],
  summer11: ["summer11", "Beach-Luau", "Luau", "Beach"],
  summer28: ["summer28", "Beach-Jellies", "MoonlightJellies", "Beach"],
  fall16: ["fall16", "Town-Fair", "StardewValleyFair", "Town"],
  fall27: ["fall27", "Town-Halloween", "SpiritEve", "Town"],
  winter8: ["winter8", "Forest-IceFestival", "FestivalOfIce", "Forest"],
  winter25: ["winter25", "Town-Christmas", "FeastOfTheWinterStar", "Town"]
};

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

const OBJECT_TYPE_OPTIONS: RulesetOption[] = [
  { label: "基础物品 Basic", value: "Basic" },
  { label: "鱼 Fish", value: "Fish" },
  { label: "种子 Seeds", value: "Seeds" },
  { label: "烹饪 Cooking", value: "Cooking" },
  { label: "制作材料 Crafting", value: "Crafting" },
  { label: "矿物 Minerals", value: "Minerals" },
  { label: "戒指 Ring", value: "Ring" },
  { label: "鞋 Boots", value: "Boots" },
  { label: "武器 Weapon", value: "Weapon" },
  { label: "饰品 Trinket", value: "Trinket" }
];

const SEASON_LONG_OPTIONS: RulesetOption[] = [
  { label: "春 Spring", value: "Spring" },
  { label: "夏 Summer", value: "Summer" },
  { label: "秋 Fall", value: "Fall" },
  { label: "冬 Winter", value: "Winter" }
];

const CROP_HARVEST_METHOD_OPTIONS: RulesetOption[] = [
  { label: "直接采摘 Grab", value: "Grab" },
  { label: "镰刀 Scythe", value: "Scythe" },
  { label: "巨大作物 GiantCrop", value: "GiantCrop" }
];

const CRAFTING_LOCATION_OPTIONS: RulesetOption[] = [
  { label: "家中 Home", value: "Home" },
  { label: "户外 Field", value: "Field" }
];

const RECIPE_UNLOCK_KIND_OPTIONS: RulesetOption[] = [
  { label: "默认掌握 default", value: "default" },
  { label: "不自动解锁 none", value: "none" },
  { label: "NPC 好感 f <NPC> <hearts>", value: "friendship" },
  { label: "技能等级 s <skill> <level>", value: "skill" },
  { label: "自定义", value: "custom" }
];

const SKILL_OPTIONS: RulesetOption[] = [
  { label: "耕种 Farming", value: "Farming" },
  { label: "采矿 Mining", value: "Mining" },
  { label: "钓鱼 Fishing", value: "Fishing" },
  { label: "采集 Foraging", value: "Foraging" },
  { label: "战斗 Combat", value: "Combat" },
  { label: "幸运 Luck", value: "Luck" }
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

const SCHEDULE_DIRECTION_OPTIONS: RulesetOption[] = [
  { label: "上 0", value: 0 },
  { label: "右 1", value: 1 },
  { label: "下 2", value: 2 },
  { label: "左 3", value: 3 }
];

const SCHEDULE_TIME_OPTIONS: RulesetOption[] = [
  { label: "0 起始点", value: "0" },
  ...Array.from({ length: 41 }, (_, index) => {
    const totalMinutes = 360 + index * 30;
    const stardewHour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const stardewTime = `${String(stardewHour).padStart(2, "0")}${String(minute).padStart(2, "0")}`;
    const displayHour24 = stardewHour >= 24 ? stardewHour - 24 : stardewHour;
    const labelPrefix = stardewHour >= 24 ? "凌晨" : stardewHour < 12 ? "上午" : stardewHour < 18 ? "下午" : "晚上";
    return { label: `${labelPrefix} ${String(displayHour24).padStart(2, "0")}:${String(minute).padStart(2, "0")} / ${stardewTime}`, value: stardewTime };
  })
];

const FALLBACK_SCHEDULE_KEY_FORMATS: ScheduleKeyFormat[] = [
  { id: "green_rain", category: "Special", label: "GreenRain", template: "GreenRain", fields: [] },
  { id: "marriage_weekday", category: "Marriage", label: "marriage_<dayOfWeek>", template: "marriage_<weekday>", fields: [{ name: "weekday", type: "select", options: "days_of_week" }] },
  { id: "marriage_job", category: "Marriage", label: "marriageJob", template: "marriageJob", fields: [] },
  { id: "season_weekday_hearts", category: "Normal", label: "<season>_<dayOfWeek>_<hearts>", template: "<season>_<weekday>_<hearts>", fields: [{ name: "season", type: "select", options: "seasons" }, { name: "weekday", type: "select", options: "days_of_week" }, { name: "hearts", type: "number", min: 0, max: 14 }] },
  { id: "season_weekday", category: "Normal", label: "<season>_<dayOfWeek>", template: "<season>_<weekday>", fields: [{ name: "season", type: "select", options: "seasons" }, { name: "weekday", type: "select", options: "days_of_week" }] },
  { id: "weekday_hearts", category: "Normal", label: "<dayOfWeek>_<hearts>", template: "<weekday>_<hearts>", fields: [{ name: "weekday", type: "select", options: "days_of_week" }, { name: "hearts", type: "number", min: 0, max: 14 }] },
  { id: "weekday", category: "Normal", label: "<dayOfWeek>", template: "<weekday>", fields: [{ name: "weekday", type: "select", options: "days_of_week" }] },
  { id: "season_day", category: "Normal", label: "<season>_<day>", template: "<season>_<day>", fields: [{ name: "season", type: "select", options: "seasons" }, { name: "day", type: "number", min: 1, max: 28 }] },
  { id: "day_hearts", category: "Normal", label: "<day>_<hearts>", template: "<day>_<hearts>", fields: [{ name: "day", type: "number", min: 1, max: 28 }, { name: "hearts", type: "number", min: 0, max: 14 }] },
  { id: "day", category: "Normal", label: "<day>", template: "<day>", fields: [{ name: "day", type: "number", min: 1, max: 28 }] },
  { id: "rain", category: "Normal", label: "rain", template: "rain", fields: [] },
  { id: "rain2", category: "Normal", label: "rain2", template: "rain2", fields: [] },
  { id: "bus", category: "Normal", label: "bus", template: "bus", fields: [] },
  { id: "season", category: "Normal", label: "<season>", template: "<season>", fields: [{ name: "season", type: "select", options: "seasons" }] },
  { id: "default", category: "Normal", label: "default", template: "default", fields: [] },
  { id: "custom", category: "Custom", label: "自定义 key", template: "<customKey>", fields: [{ name: "customKey", type: "text" }] }
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
    schedule: "日程",
    animation: "角色动画",
    shop: "商店",
    event: "事件",
    mail: "信件",
    trigger_action: "触发动作",
    quest: "任务",
    secret_note: "秘密纸条",
    special_order: "特别订单",
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

function createPrimaryItemEntry(project: Project, flow: WorkflowState): GameDataEntry {
  const itemId = normalizeInternalName(flow.itemId || flow.itemName || "ExampleObject");
  const itemName = flow.itemName || itemId;
  const displayNameKey = itemI18nKey(project, "Object", itemId, "Name");
  const descriptionKey = itemI18nKey(project, "Object", itemId, "Description");
  return createWorkflowEntry("item", `${itemName} 物品`, "Data/Objects", itemId, {
    DisplayName: i18nRef(displayNameKey),
    Description: i18nRef(descriptionKey),
    Price: flow.itemPrice,
    Category: flow.itemCategory,
    Edibility: -300,
    ContextTags: []
  });
}

function createPrimaryMapEntry(project: Project, flow: WorkflowState): GameDataEntry {
  const locationId = normalizeInternalName(flow.locationId || flow.locationName || "ExampleLocation");
  const locationName = flow.locationName || locationId;
  const displayNameKey = locationI18nKey(project, locationId, "Name");
  return createWorkflowEntry("custom", `${locationName} 地点`, "Data/Locations", locationId, {
    DisplayName: i18nRef(displayNameKey),
    CreateOnLoad: {
      MapPath: flow.mapPath || `Maps/${locationId}`
    },
    CustomFields: {
      "StardewCPStudio.Todo": "补充地图素材、warp、地点规则。"
    }
  });
}

function createPrimaryFlowI18n(project: Project, flow: WorkflowState): Record<string, string> {
  if (flow.kind === "item") {
    const itemId = normalizeInternalName(flow.itemId || flow.itemName || "ExampleObject");
    const itemName = flow.itemName || itemId;
    return {
      [itemI18nKey(project, "Object", itemId, "Name")]: itemName,
      [itemI18nKey(project, "Object", itemId, "Description")]: `${itemName} 是通过流程模式创建的物品。`
    };
  }
  if (flow.kind === "map") {
    const locationId = normalizeInternalName(flow.locationId || flow.locationName || "ExampleLocation");
    return { [locationI18nKey(project, locationId, "Name")]: flow.locationName || locationId };
  }
  return {};
}

function createWorkflowResultForAction(project: Project, action: FlowAction, flow: WorkflowState): WorkflowResult {
  if (action === "dialogue") return createDialogueWorkflowResult(flow);
  return { entries: createEntriesForFlowAction(project, action, flow), patches: [], i18n: createWorkflowI18nForAction(project, action, flow) };
}

function createDialogueWorkflowResult(flow: WorkflowState): WorkflowResult {
  const npcName = normalizeInternalName(flow.npcName || flow.displayName || "ExampleNPC");
  const displayName = flow.displayName || npcName;
  const format = dialogueFormatById(flow.dialogueKeyType);
  const isMarriage = isMarriageDialogueType(flow.dialogueKeyType);
  const key = buildDialogueKey(flow, npcName);
  const target = dialogueTargetForFlow(flow, npcName);
  const state: DialogueEntryState = {
    npcName,
    isMarriage,
    keyType: format.id,
    textId: "",
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
  const baseEntry = createWorkflowEntry("dialogue", `${displayName} 对话：${key}`, target, key, "");
  const textId = dialogueTextId(baseEntry);
  const i18nKey = dialogueI18nKeyFromParts(npcName, isMarriage, flow.dialogueI18nPrefix, key, textId);
  const entries = [
    withDialogueMetadata({ ...baseEntry, value: i18nRef(i18nKey) }, { ...state, textId }, format, i18nKey)
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

function createWorkflowI18nForAction(project: Project, action: FlowAction, flow: WorkflowState): Record<string, string> {
  const npcName = normalizeInternalName(flow.npcName || flow.displayName || "ExampleNPC");
  const displayName = flow.displayName || npcName;
  if (action === "roommateItem") {
    const itemId = `${npcName}RoommateProposal`;
    return {
      [itemI18nKey(project, "Object", itemId, "Name")]: `${displayName} 的室友信物`,
      [itemI18nKey(project, "Object", itemId, "Description")]: `送给 ${displayName}，提出成为室友。`
    };
  }
  if (action === "customMap") {
    const locationId = `${npcName}Home`;
    return { [locationI18nKey(project, locationId, "Name")]: `${displayName}的住处` };
  }
  if (action === "mapLocation") return createPrimaryFlowI18n(project, flow);
  return {};
}

function createEntriesForFlowAction(project: Project, action: FlowAction, flow: WorkflowState): GameDataEntry[] {
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
      const roommateItemId = `${npcName}RoommateProposal`;
      return [
        createWorkflowEntry("item", `${displayName} 室友提案物品`, "Data/Objects", roommateItemId, {
          DisplayName: i18nRef(itemI18nKey(project, "Object", roommateItemId, "Name")),
          Description: i18nRef(itemI18nKey(project, "Object", roommateItemId, "Description")),
          Price: flow.roommateItemPrice || 5000,
          Category: -2,
          Edibility: -300,
          ContextTags: [roommateContextTag(npcName)]
        })
      ];
    case "customMap":
      const homeLocationId = `${npcName}Home`;
      return [
        createWorkflowEntry("custom", `${displayName} 自定义地点占位`, "Data/Locations", homeLocationId, {
          DisplayName: i18nRef(locationI18nKey(project, homeLocationId, "Name")),
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
    case "mailForItem":
      return [
        createWorkflowEntry("custom", `${itemName} 附件邮件`, "Data/Mail", `${itemId}.RewardMail`, `这是你要的 ${itemName}。^^%item object ${itemId} ${flow.mailQuantity || 1}[#]${itemName}`)
      ];
    case "mapLocation":
      return [
        createPrimaryMapEntry(project, flow)
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

function defaultDialogueEntry(project: Project, npcName: string, isMarriage: boolean): GameDataEntry {
  const normalizedNpc = normalizeInternalName(npcName || "ExampleNPC");
  const target = isMarriage ? `Characters/Dialogue/MarriageDialogue${normalizedNpc}` : `Characters/Dialogue/${normalizedNpc}`;
  const key = nextDialogueKey(project, target, isMarriage ? marriageKeyOptions(normalizedNpc).map((item) => String(item.value)) : normalDialogueKeyCandidates());
  const isWeekdayKey = WEEKDAY_OPTIONS.some((item) => item.value === key);
  const format = dialogueFormatById(isMarriage ? "marriage_key" : (isWeekdayKey ? "weekday" : "normal_custom"));
  const fields = normalizeDialogueFields(format, { weekday: key, key, customKey: key, scene: "Indoor_Day", npc: normalizedNpc }, normalizedNpc);
  const state: DialogueEntryState = {
    npcName: normalizedNpc,
    isMarriage,
    keyType: format.id,
    textId: "",
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
  const entry = createWorkflowEntry("dialogue", dialogueEntryTitle(normalizedNpc, isMarriage ? "婚后/室友对话" : "普通对话", key), target, key, "");
  const textId = dialogueTextId(entry);
  const i18nKey = dialogueI18nKeyFromParts(normalizedNpc, isMarriage, "", key, textId);
  return withDialogueMetadata({ ...entry, value: i18nRef(i18nKey) }, { ...state, textId }, format, i18nKey);
}

function defaultScheduleEntry(npcName: string): GameDataEntry {
  const normalizedNpc = normalizeInternalName(npcName || "ExampleNPC");
  const points: SchedulePoint[] = [
    { ...defaultSchedulePoint(0, "Town"), x: 64, y: 15, direction: 2 },
    { ...defaultSchedulePoint(1, "Town"), time: "2200", x: 64, y: 15, direction: 2 }
  ];
  const meta: ScheduleMeta = {
    npcName: normalizedNpc,
    keyType: "season",
    fields: { season: "spring" },
    initialCommand: "none",
    gotoKey: "spring",
    friendshipNpc: normalizedNpc,
    friendshipHearts: 6,
    mailId: "ExampleMail",
    mailMissingKey: "spring",
    mailReceivedKey: "spring",
    points,
    dialogueEntries: []
  };
  const entry = createWorkflowEntry("schedule", `${normalizedNpc} 基础日程`, `Characters/schedules/${normalizedNpc}`, "spring", buildScheduleScript(meta, normalizedNpc, "spring"));
  return {
    ...entry,
    advanced: {
      ...entry.advanced,
      StardewCPStudio: {
        ...(isObject(entry.advanced.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {}),
        schedule: meta
      }
    }
  };
}

function defaultMailEntry(project: Project): GameDataEntry {
  const baseKey = `${sanitizeI18nPart(project.manifest.UniqueID || "Author.Mod")}.Letter`;
  const used = new Set(project.game_data.filter((entry) => entry.kind === "mail" && entry.target === "Data/Mail").map((entry) => entry.key));
  const key = nextAvailableKey(baseKey, used);
  return createWorkflowEntry("mail", `信件：${key}`, "Data/Mail", key, {
    MailId: key,
    Body: "你好，@！\n这是一封新信件。",
    Title: "新信件",
    BackgroundType: "vanilla",
    BackgroundIndex: 0,
    TextColor: "",
    Attachments: []
  });
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
    const nextDraftId = mapDraftId(next.advanced);
    const index = merged.findIndex((patch) => {
      const patchDraftId = mapDraftId(patch.advanced);
      if (nextDraftId || patchDraftId) return nextDraftId !== "" && nextDraftId === patchDraftId;
      return patch.action === next.action && patch.target === next.target && patch.from_file === next.from_file;
    });
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
          DisplayName: i18nRef("Name.ExampleNPC"),
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
          SpouseGiftJealousy: true,
          SpouseGiftJealousyFriendshipChange: -30,
          SpouseFloors: [],
          SpouseWallpapers: [],
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
          DisplayName: i18nRef("Custom.Object.ExampleObject.Name"),
          Description: i18nRef("Custom.Object.ExampleObject.Description"),
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
    case "schedule":
      return {
        target: "Characters/schedules/ExampleNPC",
        key: "spring",
        value: "900 Town 64 15 2"
      };
    case "animation":
      return {
        target: "Data/animationDescriptions",
        key: "examplenpc_sleep",
        value: "0/1/2"
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
    case "quest":
      return {
        target: "Data/Quests",
        key: "ExampleQuest",
        value: "Basic/{{i18n:Custom.Quest.ExampleQuest.Title}}/{{i18n:Custom.Quest.ExampleQuest.Description}}/{{i18n:Custom.Quest.ExampleQuest.Hint}}/null/-1/0/-1/false/{{i18n:Custom.Quest.ExampleQuest.Reaction}}"
      };
    case "secret_note":
      return {
        target: "Data/SecretNotes",
        key: "ExampleNote",
        value: i18nRef("Custom.SecretNote.ExampleNote")
      };
    case "special_order":
      return {
        target: "Data/SpecialOrders",
        key: "Author.Mod.ExampleOrder",
        value: {
          Name: "[Author_Mod_ExampleOrder_Name]",
          Requester: "Lewis",
          Duration: "TwoWeeks",
          Repeatable: "False",
          RequiredTags: "",
          OrderType: "",
          SpecialRule: "",
          Text: "[Author_Mod_ExampleOrder_Text]",
          Objectives: [],
          Rewards: []
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
  const specialOrderStrings = entry.kind === "special_order" ? specialOrderStringPatchForPreview(entry) : null;
  const patch: JsonDict = {
    Action: "EditData",
    Target: entry.target,
    Entries: storyEntries || {
      [entry.key || "ExampleKey"]: entry.kind === "mail" ? mailValue || entry.value : entry.value
    }
  };
  if (Object.keys(entry.when).length) patch.When = entry.when;
  const patches = [{ ...patch, ...publicAdvanced(entry.advanced) }];
  if (specialOrderStrings) patches.push(specialOrderStrings);
  return patches.length === 1 ? patches[0] : { Changes: patches };
}

function specialOrderStringPatchForPreview(entry: GameDataEntry) {
  const studio = isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  const meta = isObject(studio.specialOrder) ? studio.specialOrder as Partial<SpecialOrderMeta> : null;
  if (!meta) return null;
  const orderId = stringField(meta.orderId || entry.key || "ExampleOrder");
  const entries: Record<string, string> = {
    [specialOrderStringKey(orderId, "Name")]: i18nRef(stringField(meta.nameKey || `Custom.SpecialOrder.${orderId}.Name`)),
    [specialOrderStringKey(orderId, "Text")]: i18nRef(stringField(meta.textKey || `Custom.SpecialOrder.${orderId}.Text`))
  };
  const objectives = Array.isArray(meta.objectives) ? meta.objectives : [];
  objectives.forEach((objective, index) => {
    if (isObject(objective)) entries[specialOrderStringKey(orderId, `Objective_${index + 1}_Text`)] = i18nRef(stringField(objective.textKey || `Custom.SpecialOrder.${orderId}.Objective_${index + 1}_Text`));
  });
  return { Action: "EditData", Target: "Strings/SpecialOrderStrings", Entries: entries };
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

function normalizeItemId(value: string) {
  return value.trim().replace(/\s+/g, "_") || "ExampleObject";
}

function modScopedId(project: Project, suffix: string) {
  const prefix = sanitizeI18nPart(project.manifest.UniqueID || "Custom");
  const cleanSuffix = normalizeItemId(suffix).replace(/^[.]+/, "");
  return `${prefix}.${cleanSuffix}`;
}

function itemModuleKind(entry: GameDataEntry): ItemModuleKind {
  const studio = isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  const itemModule = isObject(studio.itemModule) ? studio.itemModule as JsonDict : {};
  if (itemModule.kind === "crop" || itemModule.kind === "fruitTree" || itemModule.kind === "cooking" || itemModule.kind === "crafting") return itemModule.kind;
  if (entry.target === "Data/Crops") return "crop";
  if (entry.target === "Data/FruitTrees") return "fruitTree";
  if (entry.target === "Data/CookingRecipes") return "cooking";
  if (entry.target === "Data/CraftingRecipes") return "crafting";
  return "object";
}

function isItemStudioEntry(entry: GameDataEntry) {
  const target = entry.target || "";
  return entry.kind === "item" || target === "Data/Objects" || target === "Data/Crops" || target === "Data/FruitTrees" || target === "Data/CookingRecipes" || target === "Data/CraftingRecipes";
}

function withItemModuleAdvanced(advanced: JsonDict = {}, kind: ItemModuleKind, extra: JsonDict = {}) {
  const studio = isObject(advanced.StardewCPStudio) ? advanced.StardewCPStudio as JsonDict : {};
  const existing = isObject(studio.itemModule) ? studio.itemModule as JsonDict : {};
  return {
    ...advanced,
    StardewCPStudio: {
      ...studio,
      itemModule: {
        ...existing,
        kind,
        ...extra
      }
    }
  };
}

function withItemModuleMetadata<T extends { advanced: JsonDict }>(item: T, kind: ItemModuleKind): T {
  return { ...item, advanced: withItemModuleAdvanced(item.advanced, kind) };
}

function defaultItemStudioEntry(project: Project, kind: ItemModuleKind): GameDataEntry {
  const objectId = modScopedId(project, "ExampleObject");
  const seedId = modScopedId(project, "ExampleSeeds");
  const cropId = modScopedId(project, "ExampleCrop");
  const fruitTreeSaplingId = modScopedId(project, "ExampleFruitTreeSapling");
  if (kind === "crop") {
    return {
      id: makeId(),
      kind: "item",
      name: "作物条目",
      target: "Data/Crops",
      key: seedId,
      value: {
        Seasons: ["Spring"],
        DaysInPhase: [1, 2, 2, 2],
        RegrowDays: -1,
        HarvestItemId: cropId,
        HarvestMinStack: 1,
        HarvestMaxStack: 1,
        ExtraHarvestChance: 0,
        Texture: "TileSheets/crops",
        SpriteIndex: 0,
        HarvestMethod: "Grab",
        NeedsWatering: true,
        TrellisCrop: false,
        PaddyCrop: false,
        RaisedSeeds: false
      },
      when: {},
      advanced: withItemModuleAdvanced({}, "crop"),
      editMode: "form"
    };
  }
  if (kind === "fruitTree") {
    return {
      id: makeId(),
      kind: "item",
      name: "果树条目",
      target: "Data/FruitTrees",
      key: fruitTreeSaplingId,
      value: {
        PlantableLocationRules: null,
        DisplayName: i18nRef(itemI18nKey(project, "FruitTree", fruitTreeSaplingId, "Name")),
        Seasons: ["Spring"],
        Fruit: [normalizeFruitTreeFruit({ Id: "Default", ItemId: "(O)638" })],
        Texture: "TileSheets\\fruitTrees",
        TextureSpriteRow: 0,
        CustomFields: null
      },
      when: {},
      advanced: withItemModuleAdvanced({}, "fruitTree"),
      editMode: "form"
    };
  }
  if (kind === "cooking" || kind === "crafting") {
    const meta = defaultRecipeMeta(kind);
    return {
      id: makeId(),
      kind: "item",
      name: kind === "cooking" ? "烹饪配方条目" : "制作配方条目",
      target: kind === "cooking" ? "Data/CookingRecipes" : "Data/CraftingRecipes",
      key: meta.recipeName,
      value: recipeString(meta, kind),
      when: {},
      advanced: withItemModuleAdvanced({}, kind, { recipe: meta }),
      editMode: "form"
    };
  }
  return {
    id: makeId(),
    kind: "item",
    name: "一般物品条目",
    target: "Data/Objects",
    key: objectId,
    value: {
      Name: objectId,
      DisplayName: i18nRef(itemI18nKey(project, "Object", objectId, "Name")),
      Description: i18nRef(itemI18nKey(project, "Object", objectId, "Description")),
      Type: "Basic",
      Category: -2,
      Price: 100,
      Edibility: -300,
      IsDrink: false,
      Texture: "",
      SpriteIndex: 0,
      ContextTags: []
    },
    when: {},
    advanced: withItemModuleAdvanced({}, "object"),
    editMode: "form"
  };
}

function itemTextureTarget(project: Project, objectId: string) {
  return `Mods/${project.manifest.UniqueID || "Author.Mod"}/Objects/${objectId}`;
}

function cropTextureTarget(project: Project, seedId: string) {
  return `Mods/${project.manifest.UniqueID || "Author.Mod"}/Crops/${seedId}`;
}

function fruitTreeTextureTarget(project: Project, saplingId: string) {
  return `Mods/${project.manifest.UniqueID || "Author.Mod"}/FruitTrees/${saplingId}`;
}

function itemI18nKey(project: Project, namespace: "Object" | "FruitTree", itemId: string, field: "Name" | "Description") {
  return `${sanitizeI18nPart(project.manifest.UniqueID || "Custom")}.${namespace}.${sanitizeI18nPart(itemId)}.${field}`;
}

function locationI18nKey(project: Project, locationId: string, field: "Name") {
  return `${sanitizeI18nPart(project.manifest.UniqueID || "Custom")}.Location.${sanitizeI18nPart(locationId)}.${field}`;
}

function i18nKeyFromRef(value: unknown) {
  const match = stringField(value).match(/^\{\{i18n:([^}]+)\}\}$/);
  return match?.[1] || "";
}

function i18nKeyFromBracketRef(value: unknown) {
  const match = stringField(value).match(/^\[([^\]]+)\]$/);
  return match?.[1] || "";
}

function localizedText(project: Project, value: unknown, fallback = "") {
  const key = i18nKeyFromRef(value);
  if (key) return project.i18n[key] ?? "";
  return stringField(value || fallback);
}

function defaultItemStudioI18n(project: Project, entry: GameDataEntry, kind: ItemModuleKind) {
  const value = isObject(entry.value) ? entry.value : {};
  const i18n: Record<string, string> = {};
  if (kind === "object") {
    const nameKey = i18nKeyFromRef(value.DisplayName) || itemI18nKey(project, "Object", entry.key, "Name");
    const descriptionKey = i18nKeyFromRef(value.Description) || itemI18nKey(project, "Object", entry.key, "Description");
    i18n[nameKey] = localizedText(project, value.DisplayName, "示例物品");
    i18n[descriptionKey] = localizedText(project, value.Description, "这是一个新物品。");
  }
  if (kind === "fruitTree") {
    const nameKey = i18nKeyFromRef(value.DisplayName) || itemI18nKey(project, "FruitTree", entry.key, "Name");
    i18n[nameKey] = localizedText(project, value.DisplayName, "示例果树");
  }
  return i18n;
}

function normalizeFruitTreeFruit(value: JsonDict): JsonDict {
  const randomItems = arrayOfStrings(value.RandomItemId);
  const hasRandom = randomItems.length > 0;
  const itemId = hasRandom ? null : setNullableText(stringField(value.ItemId ?? "(O)638"));
  const merged = {
    Season: null,
    Chance: 1,
    ...createWinterStarGift(stringField(value.Id || "Default"), itemId, hasRandom ? randomItems : null),
    MinStack: -1,
    MaxStack: -1,
    ...value
  };
  return {
    ...merged,
    Season: merged.Season === undefined || merged.Season === "" ? null : merged.Season,
    Chance: Number(merged.Chance ?? 1),
    ItemId: itemId,
    RandomItemId: hasRandom ? randomItems : null,
    Condition: merged.Condition === undefined ? null : merged.Condition,
    MaxItems: merged.MaxItems === undefined ? null : merged.MaxItems,
    MinStack: merged.MinStack === undefined ? -1 : merged.MinStack,
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

function pickObjectFields(value: JsonDict, keys: string[]) {
  return Object.fromEntries(keys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
}

function publicAdvancedValue(value: JsonDict, knownKeys: string[]) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !knownKeys.includes(key)));
}

function defaultRecipeMeta(kind: "cooking" | "crafting") {
  return {
    recipeName: kind === "cooking" ? "Example Meal" : "Example Craft",
    ingredients: [{ id: makeId(), itemId: "388", count: 1 }] as RecipeIngredientRow[],
    unusedPair: "1 1",
    craftingLocation: "Home",
    yieldItemId: "388",
    yieldCount: 1,
    bigCraftable: false,
    unlockKind: "default",
    unlockNpc: "Emily",
    unlockSkill: "Farming",
    unlockLevel: 1,
    unlockRaw: "default",
    displayName: ""
  };
}

function recipeMetaFromEntry(entry: GameDataEntry, kind: "cooking" | "crafting") {
  const studio = isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  const module = isObject(studio.itemModule) ? studio.itemModule as JsonDict : {};
  if (isObject(module.recipe)) return normalizeRecipeMeta(module.recipe as JsonDict, entry, kind);
  return parseRecipeString(entry, kind);
}

function normalizeRecipeMeta(value: JsonDict, entry: GameDataEntry, kind: "cooking" | "crafting") {
  const fallback = defaultRecipeMeta(kind);
  return {
    ...fallback,
    ...value,
    recipeName: stringField(value.recipeName || entry.key || fallback.recipeName),
    ingredients: Array.isArray(value.ingredients) ? value.ingredients.filter(isObject).map((row) => ({
      id: stringField(row.id || makeId()),
      itemId: stringField(row.itemId || "388"),
      count: Number(row.count) || 1
    })) : fallback.ingredients,
    yieldCount: Number(value.yieldCount) || 1,
    unlockLevel: Number(value.unlockLevel) || 0,
    bigCraftable: Boolean(value.bigCraftable)
  };
}

function parseRecipeString(entry: GameDataEntry, kind: "cooking" | "crafting") {
  const fallback = defaultRecipeMeta(kind);
  if (typeof entry.value !== "string") return { ...fallback, recipeName: entry.key || fallback.recipeName };
  const parts = entry.value.split("/");
  const ingredients = parseIngredientPairs(parts[0]);
  if (kind === "cooking") {
    return recipeMetaWithUnlock({
      ...fallback,
      recipeName: entry.key || fallback.recipeName,
      ingredients,
      unusedPair: parts[1] || fallback.unusedPair,
      yieldItemId: splitSpaceList(parts[2] || "")[0] || fallback.yieldItemId,
      yieldCount: integerInRange(splitSpaceList(parts[2] || "")[1] || "1", 1, 999, 1),
      displayName: parts[4] || ""
    }, parts[3] || "none");
  }
  return recipeMetaWithUnlock({
    ...fallback,
    recipeName: entry.key || fallback.recipeName,
    ingredients,
    craftingLocation: parts[1] || "Home",
    yieldItemId: splitSpaceList(parts[2] || "")[0] || fallback.yieldItemId,
    yieldCount: integerInRange(splitSpaceList(parts[2] || "")[1] || "1", 1, 999, 1),
    bigCraftable: parts[3] === "true",
    displayName: parts[5] || ""
  }, parts[4] || "none");
}

function parseIngredientPairs(value: string): RecipeIngredientRow[] {
  const parts = splitSpaceList(value);
  const rows: RecipeIngredientRow[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    rows.push({ id: makeId(), itemId: parts[index] || "388", count: integerInRange(parts[index + 1] || "1", 1, 999, 1) });
  }
  return rows.length ? rows : [{ id: makeId(), itemId: "388", count: 1 }];
}

function recipeMetaWithUnlock<T extends ReturnType<typeof defaultRecipeMeta>>(meta: T, unlock: string): T {
  const parts = splitSpaceList(unlock);
  if (unlock === "default" || unlock === "none") return { ...meta, unlockKind: unlock, unlockRaw: unlock };
  if (parts[0] === "f") return { ...meta, unlockKind: "friendship", unlockNpc: parts[1] || "", unlockLevel: integerInRange(parts[2] || "0", 0, 14, 0), unlockRaw: unlock };
  if (parts[0] === "s") return { ...meta, unlockKind: "skill", unlockSkill: parts[1] || "Farming", unlockLevel: integerInRange(parts[2] || "0", 0, 10, 0), unlockRaw: unlock };
  return { ...meta, unlockKind: "custom", unlockRaw: unlock };
}

function recipeUnlockString(meta: ReturnType<typeof defaultRecipeMeta>) {
  if (meta.unlockKind === "default" || meta.unlockKind === "none") return meta.unlockKind;
  if (meta.unlockKind === "friendship") return `f ${meta.unlockNpc || "Emily"} ${meta.unlockLevel}`;
  if (meta.unlockKind === "skill") return `s ${meta.unlockSkill || "Farming"} ${meta.unlockLevel}`;
  return meta.unlockRaw || "none";
}

function recipeString(meta: ReturnType<typeof defaultRecipeMeta>, kind: "cooking" | "crafting") {
  const ingredients = meta.ingredients.map((row) => `${row.itemId} ${row.count}`).join(" ");
  const yieldPart = `${meta.yieldItemId}${meta.yieldCount === 1 ? "" : ` ${meta.yieldCount}`}`;
  const unlock = recipeUnlockString(meta);
  if (kind === "cooking") return `${ingredients}/${meta.unusedPair || "1 1"}/${yieldPart}/${unlock}/${meta.displayName || ""}`;
  return `${ingredients}/${meta.craftingLocation || "Home"}/${yieldPart}/${meta.bigCraftable ? "true" : "false"}/${unlock}/${meta.displayName || ""}`;
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
    move: { actor: "farmer", targetMode: true, x: 0, y: 1, direction: 2, continue: false },
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

function storyActorPositionsFromActors(actors: StoryEventMeta["actors"]) {
  const positions = new Map<string, MapPoint>();
  const safeActors = actors.length ? actors : [{ actor: "farmer", x: -500, y: -500, direction: 2 }];
  for (const actor of safeActors) {
    const name = actor.actor || "farmer";
    positions.set(name, { X: integerInRange(actor.x, -10000, 10000, 0), Y: integerInRange(actor.y, -10000, 10000, 0) });
  }
  return positions;
}

function storyActorPositionsBeforeNode(meta: StoryEventMeta, nodeIndex: number) {
  const positions = storyActorPositionsFromActors(meta.actors);
  for (const node of meta.nodes.slice(0, Math.max(0, nodeIndex))) {
    storyApplyPositionNode(positions, node);
  }
  return positions;
}

function storyActorPositionBefore(meta: StoryEventMeta, nodeIndex: number, actorName: string): MapPoint | null {
  return storyActorPositionsBeforeNode(meta, nodeIndex).get(actorName || "farmer") || null;
}

function storyMoveDelta(node: StoryEventNode, positions: Map<string, MapPoint>) {
  const data = node.data || {};
  const actor = stringField(data.actor) || "farmer";
  const current = positions.get(actor) || null;
  const targetMode = data.targetMode !== false && data.targetX !== undefined && data.targetX !== null && data.targetY !== undefined && data.targetY !== null;
  if (targetMode && current) {
    const targetX = integerInRange(data.targetX, -10000, 10000, current.X);
    const targetY = integerInRange(data.targetY, -10000, 10000, current.Y);
    return { actor, dx: targetX - current.X, dy: targetY - current.Y, target: { X: targetX, Y: targetY } };
  }
  return {
    actor,
    dx: integerInRange(data.x, -999, 999, 0),
    dy: integerInRange(data.y, -999, 999, 1),
    target: current
      ? { X: current.X + integerInRange(data.x, -999, 999, 0), Y: current.Y + integerInRange(data.y, -999, 999, 1) }
      : null
  };
}

function storyApplyPositionNode(positions: Map<string, MapPoint>, node: StoryEventNode) {
  const data = node.data || {};
  const actor = stringField(data.actor) || "farmer";
  if (node.kind === "move") {
    const delta = storyMoveDelta(node, positions);
    if (delta.target) positions.set(actor, delta.target);
    return;
  }
  if (node.kind === "positionOffset") {
    const current = positions.get(actor);
    if (current) positions.set(actor, {
      X: current.X + integerInRange(data.x, -999, 999, 0),
      Y: current.Y + integerInRange(data.y, -999, 999, 0)
    });
    return;
  }
  if (node.kind === "warp") {
    positions.set(actor, {
      X: integerInRange(data.x, -10000, 10000, 0),
      Y: integerInRange(data.y, -10000, 10000, 0)
    });
  }
}

function buildStoryCommands(nodes: StoryEventNode[], meta: Pick<StoryEventMeta, "eventId" | "i18nPrefix" | "actors">) {
  const positions = storyActorPositionsFromActors(meta.actors || []);
  return nodes.flatMap((node) => {
    if (node.kind === "move") {
      const delta = storyMoveDelta(node, positions);
      const data = node.data || {};
      const command = `move ${delta.actor} ${delta.dx} ${delta.dy} ${integerInRange(data.direction, 0, 3, 2)}${data.continue ? " true" : ""}`;
      storyApplyPositionNode(positions, node);
      return command ? [command] : [];
    }
    const command = buildStoryCommand(node, meta);
    storyApplyPositionNode(positions, node);
    return command ? [command] : [];
  });
}

function buildStoryCommandPreview(node: StoryEventNode, meta: StoryEventMeta, index: number) {
  if (node.kind !== "move") return buildStoryCommand(node, meta);
  const positions = storyActorPositionsBeforeNode(meta, index);
  const delta = storyMoveDelta(node, positions);
  const data = node.data || {};
  return `move ${delta.actor} ${delta.dx} ${delta.dy} ${integerInRange(data.direction, 0, 3, 2)}${data.continue ? " true" : ""}`;
}

function buildStoryEventScript(meta: StoryEventMeta) {
  const start = [
    meta.music || "continue",
    `${integerInRange(meta.viewportX, -10000, 10000, -1000)} ${integerInRange(meta.viewportY, -10000, 10000, -1000)}`,
    buildStoryActors(meta.actors)
  ];
  const commands = buildStoryCommands(meta.nodes, meta);
  return [...start, ...commands].join("/");
}

function buildStoryBranchScript(branch: StoryEventBranch, actors: StoryEventMeta["actors"] = []) {
  return buildStoryCommands(branch.nodes, { eventId: branch.key, i18nPrefix: branch.key, actors }).join("/");
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

const COMMON_NPC_OPTIONS: RulesetOption[] = [
  "Abigail", "Alex", "Caroline", "Clint", "Demetrius", "Elliott", "Emily", "Evelyn", "George", "Gus", "Haley", "Harvey", "Jas", "Jodi", "Kent", "Leah", "Lewis", "Linus", "Marnie", "Maru", "Pam", "Penny", "Pierre", "Robin", "Sam", "Sandy", "Sebastian", "Shane", "Vincent", "Willy", "Wizard", "Krobus", "Dwarf", "Leo", "Marlon"
].map((value) => ({ label: value, value }));

const QUEST_TYPE_OPTIONS: RulesetOption[] = [
  { label: "Basic 基础/自定义完成", value: "Basic" },
  { label: "Crafting 制作物品", value: "Crafting" },
  { label: "Location 到达地点", value: "Location" },
  { label: "Building 建造建筑", value: "Building" },
  { label: "ItemDelivery 交付物品", value: "ItemDelivery" },
  { label: "Monster 击杀怪物", value: "Monster" },
  { label: "ItemHarvest 收获物品", value: "ItemHarvest" },
  { label: "LostItem 寻找失物", value: "LostItem" },
  { label: "SecretLostItem 秘密失物", value: "SecretLostItem" },
  { label: "Social 社交", value: "Social" }
];

const QUEST_COUNT_OPTIONS: RulesetOption[] = [
  1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 100
].map((value) => ({ label: `${value}`, value }));

const QUEST_FRIENDSHIP_OPTIONS: RulesetOption[] = [
  { label: "0 点", value: 0 },
  { label: "20 点", value: 20 },
  { label: "50 点", value: 50 },
  { label: "100 点", value: 100 },
  { label: "250 点（1 心）", value: 250 },
  { label: "500 点（2 心）", value: 500 },
  { label: "750 点（3 心）", value: 750 },
  { label: "1000 点（4 心）", value: 1000 }
];

const FALLBACK_BUILDING_TYPE_OPTIONS: RulesetOption[] = [
  "Coop", "Big Coop", "Deluxe Coop", "Barn", "Big Barn", "Deluxe Barn", "Shed", "Big Shed", "Fish Pond", "Stable", "Mill", "Silo", "Well", "Cabin", "Junimo Hut", "Slime Hutch"
].map((value) => ({ label: value, value }));

const FALLBACK_MONSTER_NAME_OPTIONS: RulesetOption[] = [
  "Green_Slime", "Blue_Slime", "Red_Slime", "Purple_Slime", "Dust_Spirit", "Bat", "Frost_Bat", "Lava_Bat", "Rock_Crab", "Lava_Crab", "Iridium_Crab", "Duggy", "Grub", "Fly", "Skeleton", "Ghost", "Shadow_Brute", "Shadow_Shaman", "Squid_Kid", "Serpent", "Mummy", "Pepper_Rex", "Tiger_Slime"
].map((value) => ({ label: value.replace(/_/g, " "), value }));

const SPECIAL_ORDER_DURATION_OPTIONS: RulesetOption[] = [
  { label: "一周 OneWeek", value: "OneWeek" },
  { label: "两周 TwoWeeks", value: "TwoWeeks" },
  { label: "一个月 Month", value: "Month" },
  { label: "无限 None", value: "None" },
  { label: "自定义", value: "" }
];

const SPECIAL_ORDER_TYPE_OPTIONS: RulesetOption[] = [
  { label: "默认", value: "" },
  { label: "Qi 齐先生", value: "Qi" },
  { label: "自定义", value: "Custom" }
];

const SPECIAL_ORDER_RULE_OPTIONS: RulesetOption[] = [
  { label: "无", value: "" },
  { label: "QiChallenge 齐挑战", value: "QiChallenge" },
  { label: "自定义", value: "Custom" }
];

const SPECIAL_ORDER_OBJECTIVE_OPTIONS: RulesetOption[] = [
  { label: "Collect 收集", value: "Collect" },
  { label: "Donate 捐入/投递箱", value: "Donate" },
  { label: "Deliver 交付", value: "Deliver" },
  { label: "Fish 钓鱼", value: "Fish" },
  { label: "Gift 送礼", value: "Gift" },
  { label: "Ship 出货", value: "Ship" },
  { label: "Slay 击杀", value: "Slay" },
  { label: "ReachMineFloor 到达矿层", value: "ReachMineFloor" },
  { label: "JKScore 祝尼魔赛车分数", value: "JKScore" },
  { label: "自定义", value: "custom" }
];

const SPECIAL_ORDER_REWARD_OPTIONS: RulesetOption[] = [
  { label: "Money 金钱", value: "Money" },
  { label: "Gems 齐钻", value: "Gems" },
  { label: "Mail 邮件标记", value: "Mail" },
  { label: "Friendship 好感", value: "Friendship" },
  { label: "ResetEvent 重置事件", value: "ResetEvent" },
  { label: "Object 物品", value: "Object" },
  { label: "自定义", value: "custom" }
];

function isSecretNoteEntry(entry: GameDataEntry) {
  return entry.kind === "secret_note" || entry.target === "Data/SecretNotes";
}

function secretNoteI18nKey(project: Project, noteId: string) {
  return `${sanitizeI18nPart(project.manifest.UniqueID || "Custom")}.SecretNote.${sanitizeI18nPart(noteId || "ExampleNote")}`;
}

function secretNoteTextFromValue(value: unknown) {
  if (typeof value !== "string") return "";
  const key = i18nKeyFromRef(value);
  return key ? "" : value.replace(/\^/g, "\n");
}

function secretNoteMetaFromEntry(project: Project, entry: GameDataEntry): SecretNoteMeta {
  const studio = isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  const stored = isObject(studio.secretNote) ? studio.secretNote as JsonDict : {};
  const noteId = stringField(stored.noteId || entry.key || "ExampleNote");
  return {
    noteId,
    textKey: stringField(stored.textKey || i18nKeyFromRef(entry.value) || secretNoteI18nKey(project, noteId))
  };
}

function defaultSecretNoteEntry(project: Project): GameDataEntry {
  const meta = { noteId: "ExampleNote", textKey: secretNoteI18nKey(project, "ExampleNote") };
  return secretNoteEntryFromMeta({
    id: makeId(),
    kind: "secret_note",
    name: "秘密纸条",
    target: "Data/SecretNotes",
    key: meta.noteId,
    value: "",
    when: {},
    advanced: {},
    editMode: "form"
  }, meta);
}

function secretNoteEntryFromMeta(entry: GameDataEntry, meta: SecretNoteMeta): GameDataEntry {
  return {
    ...entry,
    kind: "secret_note",
    target: "Data/SecretNotes",
    key: meta.noteId || "ExampleNote",
    value: i18nRef(meta.textKey),
    advanced: {
      ...entry.advanced,
      StardewCPStudio: {
        ...(isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {}),
        secretNote: meta
      }
    }
  };
}

function isQuestEntry(entry: GameDataEntry) {
  return entry.kind === "quest" || entry.target === "Data/Quests";
}

function questTextKey(meta: QuestMeta, field: "Title" | "Description" | "Hint" | "Reaction") {
  if (field === "Title") return meta.titleKey;
  if (field === "Description") return meta.descriptionKey;
  if (field === "Hint") return meta.hintKey;
  return meta.reactionKey;
}

function questI18nKey(project: Project, questId: string, field: "Title" | "Description" | "Hint" | "Reaction") {
  return `${sanitizeI18nPart(project.manifest.UniqueID || "Custom")}.Quest.${sanitizeI18nPart(questId || "ExampleQuest")}.${field}`;
}

function defaultQuestMeta(project: Project, questId = modScopedId(project, "ExampleQuest")): QuestMeta {
  const id = normalizeItemId(questId || modScopedId(project, "ExampleQuest"));
  return {
    mode: "builder",
    questId: id,
    type: "Basic",
    titleKey: questI18nKey(project, id, "Title"),
    descriptionKey: questI18nKey(project, id, "Description"),
    hintKey: questI18nKey(project, id, "Hint"),
    reactionKey: questI18nKey(project, id, "Reaction"),
    requirement: defaultQuestRequirement("Basic"),
    nextQuests: [],
    moneyReward: 0,
    rewardDescription: "-1",
    cancellable: false,
    rawValue: ""
  };
}

function defaultQuestRequirement(type: QuestType): JsonDict {
  switch (type) {
    case "Crafting":
      return { itemId: "(O)388", isBigCraftable: false };
    case "Location":
      return { location: "Town" };
    case "Building":
      return { buildingType: "Coop" };
    case "ItemDelivery":
      return { npc: "Abigail", itemId: "(O)66", count: 1 };
    case "Monster":
      return { monster: "Green_Slime", count: 10, npc: "Marlon", ignoreFarmMonsters: false };
    case "ItemHarvest":
      return { itemId: "(O)24", count: 1 };
    case "LostItem":
      return { npc: "Robin", itemId: "(O)788", location: "Forest", x: 110, y: 81 };
    case "SecretLostItem":
      return { npc: "Abigail", itemId: "(O)191", friendship: 100, removeQuestId: "" };
    default:
      return { raw: "" };
  }
}

function defaultQuestEntry(project: Project): GameDataEntry {
  const meta = defaultQuestMeta(project);
  return questEntryFromMeta(project, {
    id: makeId(),
    kind: "quest",
    name: "任务条目",
    target: "Data/Quests",
    key: meta.questId,
    value: "",
    when: {},
    advanced: {},
    editMode: "form"
  }, meta);
}

function defaultQuestI18n(project: Project, meta: QuestMeta) {
  return {
    [questTextKey(meta, "Title")]: "示例任务",
    [questTextKey(meta, "Description")]: "完成这个任务。",
    [questTextKey(meta, "Hint")]: "查看任务目标。",
    [questTextKey(meta, "Reaction")]: ""
  };
}

function questMetaFromEntry(project: Project, entry: GameDataEntry): QuestMeta {
  const studio = isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  if (isObject(studio.quest)) return normalizeQuestMeta(project, studio.quest as Partial<QuestMeta>);
  if (typeof entry.value === "string" && entry.value.includes("/")) return parseQuestString(project, entry.key || modScopedId(project, "ExampleQuest"), entry.value);
  return defaultQuestMeta(project, entry.key || modScopedId(project, "ExampleQuest"));
}

function normalizeQuestMeta(project: Project, value: Partial<QuestMeta>): QuestMeta {
  const fallback = defaultQuestMeta(project, value.questId || modScopedId(project, "ExampleQuest"));
  const type = isQuestType(value.type) ? value.type : fallback.type;
  const questId = normalizeItemId(stringField(value.questId || fallback.questId));
  return {
    ...fallback,
    ...value,
    mode: value.mode === "raw" ? "raw" : "builder",
    questId,
    type,
    titleKey: stringField(value.titleKey || questI18nKey(project, questId, "Title")),
    descriptionKey: stringField(value.descriptionKey || questI18nKey(project, questId, "Description")),
    hintKey: stringField(value.hintKey || questI18nKey(project, questId, "Hint")),
    reactionKey: stringField(value.reactionKey || questI18nKey(project, questId, "Reaction")),
    requirement: isObject(value.requirement) ? value.requirement : defaultQuestRequirement(type),
    nextQuests: Array.isArray(value.nextQuests) ? value.nextQuests.map(normalizeNextQuest).filter((row) => row.questId) : [],
    moneyReward: integerInRange(value.moneyReward, 0, 9999999, fallback.moneyReward),
    rewardDescription: stringField(value.rewardDescription || "-1"),
    cancellable: Boolean(value.cancellable),
    rawValue: stringField(value.rawValue || "")
  };
}

function normalizeNextQuest(value: unknown): QuestNextQuest {
  const source = isObject(value) ? value : {};
  const raw = stringField(source.questId || source.QuestId || source.id || "");
  return {
    id: stringField(source.id || makeId()),
    questId: raw.startsWith("h") ? raw.slice(1) : raw,
    hostOnly: Boolean(source.hostOnly ?? source.HostOnly ?? raw.startsWith("h"))
  };
}

function isQuestType(value: unknown): value is QuestType {
  return QUEST_TYPE_OPTIONS.some((option) => option.value === value);
}

function parseQuestString(project: Project, questId: string, rawValue: string): QuestMeta {
  const parts = rawValue.split("/");
  while (parts.length < 10) parts.push("");
  const type = isQuestType(parts[0]) ? parts[0] : "Basic";
  const textRefs = {
    Title: i18nKeyFromRef(parts[1]),
    Description: i18nKeyFromRef(parts[2]),
    Hint: i18nKeyFromRef(parts[3]),
    Reaction: i18nKeyFromRef(parts[9])
  };
  const canBuild = Boolean(textRefs.Title || parts[1] === "") && Boolean(textRefs.Description || parts[2] === "") && Boolean(textRefs.Hint || parts[3] === "") && Boolean(textRefs.Reaction || parts[9] === "");
  if (!canBuild) return { ...defaultQuestMeta(project, questId), mode: "raw", rawValue };
  return normalizeQuestMeta(project, {
    mode: "builder",
    questId,
    type,
    titleKey: textRefs.Title || questI18nKey(project, questId, "Title"),
    descriptionKey: textRefs.Description || questI18nKey(project, questId, "Description"),
    hintKey: textRefs.Hint || questI18nKey(project, questId, "Hint"),
    reactionKey: textRefs.Reaction || questI18nKey(project, questId, "Reaction"),
    requirement: parseQuestRequirement(type, parts[4]),
    nextQuests: parseNextQuests(parts[5]),
    moneyReward: integerInRange(parts[6], 0, 9999999, 0),
    rewardDescription: parts[7] || "-1",
    cancellable: String(parts[8]).toLowerCase() === "true",
    rawValue
  });
}

function parseNextQuests(value: string): QuestNextQuest[] {
  if (!value || value === "-1") return [];
  return value.split(/\s+/).filter(Boolean).map((questId) => normalizeNextQuest({ questId }));
}

function parseQuestRequirement(type: QuestType, raw: string): JsonDict {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (!raw || raw === "null" || raw === "-1") return defaultQuestRequirement(type);
  if (type === "Crafting") return { itemId: parts[0] || "(O)388", isBigCraftable: parts[1] === "true" };
  if (type === "Location") return { location: parts[0] || "Town" };
  if (type === "Building") return { buildingType: raw || "Coop" };
  if (type === "ItemDelivery") return { npc: parts[0] || "Abigail", itemId: parts[1] || "(O)66", count: integerInRange(parts[2], 1, 9999, 1) };
  if (type === "Monster") return { monster: parts[0] || "Green_Slime", count: integerInRange(parts[1], 1, 9999, 10), npc: parts[2] || "Marlon", ignoreFarmMonsters: parts[3] !== "false" };
  if (type === "ItemHarvest") return { itemId: parts[0] || "(O)24", count: integerInRange(parts[1], 1, 9999, 1) };
  if (type === "LostItem") return { npc: parts[0] || "Robin", itemId: parts[1] || "(O)788", location: parts[2] || "Forest", x: integerInRange(parts[3], 0, 999, 0), y: integerInRange(parts[4], 0, 999, 0) };
  if (type === "SecretLostItem") return { npc: parts[0] || "Abigail", itemId: parts[1] || "(O)191", friendship: integerInRange(parts[2], -9999, 9999, 100), removeQuestId: parts[3] || "" };
  return { raw };
}

function questEntryFromMeta(project: Project, entry: GameDataEntry, meta: QuestMeta): GameDataEntry {
  const normalized = normalizeQuestMeta(project, meta);
  return {
    ...entry,
    kind: "quest",
    target: "Data/Quests",
    key: normalized.questId,
    value: normalized.mode === "raw" ? normalized.rawValue : buildQuestString(normalized),
    advanced: {
      ...entry.advanced,
      StardewCPStudio: {
        ...(isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {}),
        quest: normalized
      }
    }
  };
}

function buildQuestString(meta: QuestMeta) {
  return [
    meta.type,
    i18nRef(meta.titleKey),
    i18nRef(meta.descriptionKey),
    i18nRef(meta.hintKey),
    questRequirementString(meta),
    meta.nextQuests.length ? meta.nextQuests.map((row) => `${row.hostOnly ? "h" : ""}${row.questId}`).join(" ") : "-1",
    String(integerInRange(meta.moneyReward, 0, 9999999, 0)),
    meta.rewardDescription || "-1",
    String(Boolean(meta.cancellable)).toLowerCase(),
    i18nRef(meta.reactionKey)
  ].join("/");
}

function questRequirementString(meta: QuestMeta) {
  const req = meta.requirement || {};
  switch (meta.type) {
    case "Basic":
      return stringField(req.raw || "").trim() || "null";
    case "Crafting":
      return `${stringField(req.itemId || "(O)388")} ${Boolean(req.isBigCraftable)}`;
    case "Location":
      return stringField(req.location || "Town");
    case "Building":
      return stringField(req.buildingType || "Coop");
    case "ItemDelivery": {
      const count = integerInRange(req.count, 1, 9999, 1);
      return `${stringField(req.npc || "Abigail")} ${stringField(req.itemId || "(O)66")}${count > 1 ? ` ${count}` : ""}`;
    }
    case "Monster":
      return `${stringField(req.monster || "Green_Slime").replace(/\s+/g, "_")} ${integerInRange(req.count, 1, 9999, 10)} ${stringField(req.npc || "null")} ${req.ignoreFarmMonsters !== false}`;
    case "ItemHarvest": {
      const count = integerInRange(req.count, 1, 9999, 1);
      return `${stringField(req.itemId || "(O)24")}${count > 1 ? ` ${count}` : ""}`;
    }
    case "LostItem":
      return `${stringField(req.npc || "Robin")} ${stringField(req.itemId || "(O)788")} ${stringField(req.location || "Forest")} ${integerInRange(req.x, 0, 999, 0)} ${integerInRange(req.y, 0, 999, 0)}`;
    case "SecretLostItem": {
      const removeQuestId = stringField(req.removeQuestId || "").trim();
      return `${stringField(req.npc || "Abigail")} ${stringField(req.itemId || "(O)191")} ${integerInRange(req.friendship, -9999, 9999, 100)}${removeQuestId ? ` ${removeQuestId}` : ""}`;
    }
    case "Social":
      return "null";
    default:
      return "null";
  }
}

function questTextValues(meta: QuestMeta, i18n: Record<string, string>) {
  return {
    Title: i18n[meta.titleKey] ?? "",
    Description: i18n[meta.descriptionKey] ?? "",
    Hint: i18n[meta.hintKey] ?? "",
    Reaction: i18n[meta.reactionKey] ?? ""
  };
}

function questSlashWarnings(meta: QuestMeta, i18n: Record<string, string>) {
  const texts = questTextValues(meta, i18n);
  return Object.entries(texts).filter(([, value]) => value.includes("/")).map(([key]) => key);
}

function questOptions(project: Project): RulesetOption[] {
  const values = new Set<string>();
  for (const entry of project.game_data) {
    if (isQuestEntry(entry) && entry.key) values.add(entry.key);
  }
  return [...values].sort().map((value) => ({ label: value, value }));
}

function optionalQuestOptions(options: RulesetOption[]) {
  return [{ label: "不移除其他任务", value: "" }, ...options];
}

function isSpecialOrderEntry(entry: GameDataEntry) {
  return entry.kind === "special_order" || entry.target === "Data/SpecialOrders";
}

function specialOrderOptions(project: Project): RulesetOption[] {
  const values = new Set<string>();
  for (const entry of project.game_data) {
    if (isSpecialOrderEntry(entry) && entry.key) values.add(entry.key);
  }
  return [...values].sort().map((value) => ({ label: value, value }));
}

function specialOrderTextKey(project: Project, orderId: string, field: string) {
  return `${sanitizeI18nPart(project.manifest.UniqueID || "Custom")}.SpecialOrder.${sanitizeI18nPart(orderId || "ExampleOrder")}.${sanitizeI18nPart(field)}`;
}

function specialOrderStringKey(orderId: string, field: string) {
  return `${sanitizeI18nPart(orderId || "ExampleOrder")}_${sanitizeI18nPart(field)}`;
}

function specialOrderStringRef(orderId: string, field: string) {
  return `[${specialOrderStringKey(orderId, field)}]`;
}

function defaultSpecialOrderObjective(project: Project, orderId: string, index: number): SpecialOrderObjective {
  return {
    id: makeId(),
    type: "Donate",
    textKey: specialOrderTextKey(project, orderId, `Objective_${index + 1}_Text`),
    requiredCount: "10",
    data: {
      DropBox: "DropBox",
      DropBoxGameLocation: "Town",
      DropBoxIndicatorLocation: "0 0",
      ItemId: "(O)388",
      AcceptedContextTags: "item_wood"
    }
  };
}

function defaultSpecialOrderReward(type: SpecialOrderRewardType): SpecialOrderReward {
  const defaults: Record<SpecialOrderRewardType, JsonDict> = {
    Money: { Amount: "1000" },
    Gems: { Amount: "10" },
    Mail: { MailReceived: "ExampleMail" },
    Friendship: {},
    ResetEvent: { EventID: "" },
    Object: { ItemId: "(O)388", Amount: "1" },
    custom: {}
  };
  return { id: makeId(), type, data: defaults[type] || {} };
}

function defaultSpecialOrderMeta(project: Project, orderId = modScopedId(project, "ExampleOrder")): SpecialOrderMeta {
  const id = normalizeItemId(orderId || modScopedId(project, "ExampleOrder"));
  return {
    orderId: id,
    nameKey: specialOrderTextKey(project, id, "Name"),
    textKey: specialOrderTextKey(project, id, "Text"),
    requester: "Lewis",
    duration: "TwoWeeks",
    repeatable: false,
    requiredTags: "",
    condition: "",
    orderType: "",
    specialRule: "",
    itemToRemoveOnEnd: "",
    mailToRemoveOnEnd: "",
    objectives: [defaultSpecialOrderObjective(project, id, 0)],
    rewards: [defaultSpecialOrderReward("Money")],
    randomizedElements: [],
    customFields: {}
  };
}

function defaultSpecialOrderEntry(project: Project): GameDataEntry {
  const meta = defaultSpecialOrderMeta(project);
  return specialOrderEntryFromMeta(project, {
    id: makeId(),
    kind: "special_order",
    name: "特殊订单",
    target: "Data/SpecialOrders",
    key: meta.orderId,
    value: {},
    when: {},
    advanced: {},
    editMode: "form"
  }, meta);
}

function defaultSpecialOrderI18n(project: Project, meta: SpecialOrderMeta) {
  const entries: Record<string, string> = {
    [meta.nameKey]: "示例特别订单",
    [meta.textKey]: "完成这份特别订单。"
  };
  meta.objectives.forEach((objective, index) => {
    entries[objective.textKey] = `完成目标 ${index + 1}`;
  });
  return entries;
}

function specialOrderMetaFromEntry(project: Project, entry: GameDataEntry): SpecialOrderMeta {
  const studio = isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  if (isObject(studio.specialOrder)) return normalizeSpecialOrderMeta(project, studio.specialOrder as Partial<SpecialOrderMeta>);
  const raw = isObject(entry.value) ? entry.value as JsonDict : {};
  return normalizeSpecialOrderMeta(project, {
    orderId: entry.key || modScopedId(project, "ExampleOrder"),
    requester: stringField(raw.Requester || "Lewis"),
    duration: stringField(raw.Duration || "TwoWeeks"),
    repeatable: String(raw.Repeatable).toLowerCase() === "true" || raw.Repeatable === true,
    requiredTags: stringField(raw.RequiredTags || ""),
    condition: stringField(raw.Condition || ""),
    orderType: stringField(raw.OrderType || ""),
    specialRule: stringField(raw.SpecialRule || ""),
    itemToRemoveOnEnd: raw.ItemToRemoveOnEnd == null ? "" : stringField(raw.ItemToRemoveOnEnd),
    mailToRemoveOnEnd: raw.MailToRemoveOnEnd == null ? "" : stringField(raw.MailToRemoveOnEnd),
    objectives: Array.isArray(raw.Objectives) ? raw.Objectives.map((objective, index) => normalizeSpecialOrderObjective(project, entry.key || "ExampleOrder", objective, index)) : undefined,
    rewards: Array.isArray(raw.Rewards) ? raw.Rewards.map(normalizeSpecialOrderReward) : undefined,
    customFields: {}
  });
}

function normalizeSpecialOrderMeta(project: Project, value: Partial<SpecialOrderMeta>): SpecialOrderMeta {
  const orderId = normalizeItemId(stringField(value.orderId || modScopedId(project, "ExampleOrder")));
  const fallback = defaultSpecialOrderMeta(project, orderId);
  return {
    ...fallback,
    ...value,
    orderId,
    nameKey: stringField(value.nameKey || specialOrderTextKey(project, orderId, "Name")),
    textKey: stringField(value.textKey || specialOrderTextKey(project, orderId, "Text")),
    requester: stringField(value.requester || fallback.requester),
    duration: stringField(value.duration || fallback.duration),
    repeatable: Boolean(value.repeatable),
    requiredTags: stringField(value.requiredTags || ""),
    condition: stringField(value.condition || ""),
    orderType: stringField(value.orderType || ""),
    specialRule: stringField(value.specialRule || ""),
    itemToRemoveOnEnd: stringField(value.itemToRemoveOnEnd || ""),
    mailToRemoveOnEnd: stringField(value.mailToRemoveOnEnd || ""),
    objectives: Array.isArray(value.objectives) && value.objectives.length ? value.objectives.map((objective, index) => normalizeSpecialOrderObjective(project, orderId, objective, index)) : fallback.objectives,
    rewards: Array.isArray(value.rewards) && value.rewards.length ? value.rewards.map(normalizeSpecialOrderReward) : fallback.rewards,
    randomizedElements: Array.isArray(value.randomizedElements) ? value.randomizedElements.map(normalizeSpecialOrderRandomElement).filter((item) => item.name) : [],
    customFields: isObject(value.customFields) ? value.customFields : {}
  };
}

function normalizeSpecialOrderObjective(project: Project, orderId: string, value: unknown, index: number): SpecialOrderObjective {
  const source = isObject(value) ? value : {};
  const type = SPECIAL_ORDER_OBJECTIVE_OPTIONS.some((option) => option.value === source.type || option.value === source.Type) ? stringField(source.type || source.Type) as SpecialOrderObjectiveType : "custom";
  const textKey = i18nKeyFromBracketRef(source.Text) || stringField(source.textKey || specialOrderTextKey(project, orderId, `Objective_${index + 1}_Text`));
  return {
    id: stringField(source.id || makeId()),
    type,
    customType: type === "custom" ? stringField(source.Type || source.customType || "") : stringField(source.customType || ""),
    textKey,
    requiredCount: stringField(source.requiredCount || source.RequiredCount || "1"),
    data: isObject(source.data) ? source.data as JsonDict : isObject(source.Data) ? source.Data as JsonDict : {}
  };
}

function normalizeSpecialOrderReward(value: unknown): SpecialOrderReward {
  const source = isObject(value) ? value : {};
  const type = SPECIAL_ORDER_REWARD_OPTIONS.some((option) => option.value === source.type || option.value === source.Type) ? stringField(source.type || source.Type) as SpecialOrderRewardType : "custom";
  return {
    id: stringField(source.id || makeId()),
    type,
    customType: type === "custom" ? stringField(source.Type || source.customType || "") : stringField(source.customType || ""),
    data: isObject(source.data) ? source.data as JsonDict : isObject(source.Data) ? source.Data as JsonDict : {}
  };
}

function normalizeSpecialOrderRandomElement(value: unknown): SpecialOrderRandomElement {
  const source = isObject(value) ? value : {};
  const values = Array.isArray(source.values) ? source.values : Array.isArray(source.Values) ? source.Values : [];
  return {
    id: stringField(source.id || makeId()),
    name: stringField(source.name || source.Name || ""),
    values: values.map((row) => {
      const rowSource = isObject(row) ? row : {};
      return { id: stringField(rowSource.id || makeId()), requiredTags: stringField(rowSource.requiredTags || rowSource.RequiredTags || ""), value: stringField(rowSource.value || rowSource.Value || "") };
    })
  };
}

function specialOrderRekey(project: Project, meta: SpecialOrderMeta, orderId: string): Partial<SpecialOrderMeta> {
  const nextId = normalizeItemId(orderId || meta.orderId);
  return {
    orderId: nextId,
    nameKey: specialOrderTextKey(project, nextId, "Name"),
    textKey: specialOrderTextKey(project, nextId, "Text"),
    objectives: meta.objectives.map((objective, index) => ({ ...objective, textKey: specialOrderTextKey(project, nextId, `Objective_${index + 1}_Text`) }))
  };
}

function specialOrderEntryFromMeta(project: Project, entry: GameDataEntry, meta: SpecialOrderMeta): GameDataEntry {
  const normalized = normalizeSpecialOrderMeta(project, meta);
  return {
    ...entry,
    kind: "special_order",
    target: "Data/SpecialOrders",
    key: normalized.orderId,
    value: specialOrderValueFromMeta(normalized),
    advanced: {
      ...entry.advanced,
      StardewCPStudio: {
        ...(isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {}),
        specialOrder: normalized
      }
    }
  };
}

function specialOrderValueFromMeta(meta: SpecialOrderMeta): JsonDict {
  const value: JsonDict = {
    Name: specialOrderStringRef(meta.orderId, "Name"),
    Requester: meta.requester,
    Duration: meta.duration,
    Repeatable: String(Boolean(meta.repeatable)),
    RequiredTags: meta.requiredTags,
    OrderType: meta.orderType,
    SpecialRule: meta.specialRule,
    Text: specialOrderStringRef(meta.orderId, "Text"),
    ItemToRemoveOnEnd: meta.itemToRemoveOnEnd || null,
    MailToRemoveOnEnd: meta.mailToRemoveOnEnd || null,
    RandomizedElements: meta.randomizedElements.length ? meta.randomizedElements.map(specialOrderRandomElementValue) : null,
    Objectives: meta.objectives.map((objective, index) => specialOrderObjectiveValue(meta.orderId, objective, index)),
    Rewards: meta.rewards.map(specialOrderRewardValue)
  };
  if (meta.condition) value.Condition = meta.condition;
  return compactObject({ ...value, ...meta.customFields });
}

function specialOrderObjectiveValue(orderId: string, objective: SpecialOrderObjective, index: number): JsonDict {
  return compactObject({
    Type: objective.type === "custom" ? objective.customType || "Custom" : objective.type,
    Text: specialOrderStringRef(orderId, `Objective_${index + 1}_Text`),
    RequiredCount: objective.requiredCount || "1",
    Data: objective.data || {}
  });
}

function specialOrderRewardValue(reward: SpecialOrderReward): JsonDict {
  return compactObject({
    Type: reward.type === "custom" ? reward.customType || "Custom" : reward.type,
    Data: reward.data || {}
  });
}

function specialOrderRandomElementValue(element: SpecialOrderRandomElement): JsonDict {
  return {
    Name: element.name,
    Values: element.values.map((value) => compactObject({ RequiredTags: value.requiredTags, Value: value.value }))
  };
}

function specialOrderStringEntries(project: Project, meta: SpecialOrderMeta) {
  const entries: Record<string, string> = {
    [specialOrderStringKey(meta.orderId, "Name")]: i18nRef(meta.nameKey),
    [specialOrderStringKey(meta.orderId, "Text")]: i18nRef(meta.textKey)
  };
  meta.objectives.forEach((objective, index) => {
    entries[specialOrderStringKey(meta.orderId, `Objective_${index + 1}_Text`)] = i18nRef(objective.textKey || specialOrderTextKey(project, meta.orderId, `Objective_${index + 1}_Text`));
  });
  return entries;
}

function npcOptions(project: Project): RulesetOption[] {
  const values = new Set<string>(COMMON_NPC_OPTIONS.map((option) => String(option.value)));
  for (const entry of project.game_data) {
    if (entry.target === "Data/Characters" && entry.key) values.add(entry.key);
  }
  return [...values].sort().map((value) => ({ label: value, value }));
}

function buildingTypeOptions(ruleset: Ruleset) {
  const fromRules = rulesetOptions(ruleset, "building_types");
  return fromRules.length ? fromRules : FALLBACK_BUILDING_TYPE_OPTIONS;
}

function monsterNameOptions(ruleset: Ruleset) {
  const fromRules = rulesetOptions(ruleset, "monster_names");
  return fromRules.length ? fromRules : FALLBACK_MONSTER_NAME_OPTIONS;
}

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

function mapLocationOptionsWithResources(project: Project, mapResources: MapResourceEntry[]): RulesetOption[] {
  const values = new Map<string, RulesetOption>();
  const add = (value: string, label = value) => {
    if (!value || values.has(value)) return;
    values.set(value, { label, value });
  };
  for (const option of mapLocationOptions(project)) add(String(option.value), String(option.label));
  for (const map of mapResources) add(map.key, `${map.key}（MapResource/${map.filename}）`);
  return [...values.values()];
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
    const displayName = localizedText(project, objectValue.DisplayName, stringField(objectValue.Name || entry.name || entry.key));
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

function projectObjectOptions(project: Project, catalog: ItemCatalogResponse, mode: "raw" | "qualified" = "raw"): ItemOption[] {
  const options: ItemOption[] = [];
  const seen = new Set<string>();
  const add = (value: string, label: string, source: string) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    options.push({ label, value, source });
  };
  for (const item of catalog.items) {
    const value = mode === "qualified" ? item.qualified_id : item.id;
    const labelName = item.display_name || item.name || value;
    add(value, `${labelName} ${value}`, "vanilla");
  }
  for (const entry of project.game_data) {
    if (entry.target !== "Data/Objects" || !entry.key) continue;
    const value = isObject(entry.value) ? entry.value : {};
    const displayName = localizedText(project, value.DisplayName, stringField(value.Name || entry.key));
    const itemId = mode === "qualified" && !entry.key.startsWith("(") ? `(O)${entry.key}` : entry.key;
    add(itemId, `${displayName} ${itemId}（项目）`, "project");
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

function createFestivalPositionPatch(npcName: string, displayName: string, existingPatches: Patch[] = []): Patch {
  const used = new Set(existingPatches.map((patch) => {
    const meta = festivalPositionMetaFromPatch(patch, npcName);
    return meta ? `${meta.festivalId}::${meta.phaseKey}` : "";
  }));
  const festivalId = String(FESTIVAL_POSITION_OPTIONS.find((option) => !used.has(`${option.value}::Set-Up_additionalCharacters`))?.value || "spring13");
  return festivalPositionPatchFromMeta({
    id: makeId(),
    name: `${displayName || npcName} 节日站位`,
    action: "EditData",
    enabled: true,
    target: `Data/Festivals/${festivalId}`,
    from_file: null,
    when: {},
    fields: {},
    advanced: {}
  }, { npcName, festivalId, phaseKey: "Set-Up_additionalCharacters", x: 0, y: 0, direction: "down" });
}

function festivalPositionPatchFromMeta(patch: Patch, meta: FestivalPositionMeta): Patch {
  const normalized = normalizeFestivalPositionMeta(meta);
  const studio = isObject(patch.advanced?.StardewCPStudio) ? patch.advanced.StardewCPStudio as JsonDict : {};
  const phase = String(FESTIVAL_POSITION_PHASE_OPTIONS.find((option) => option.value === normalized.phaseKey)?.label || normalized.phaseKey);
  return {
    ...patch,
    name: `${normalized.npcName} 节日站位 ${normalized.festivalId} / ${phase}`,
    action: "EditData",
    target: `Data/Festivals/${normalized.festivalId}`,
    from_file: null,
    fields: {
      TextOperations: [
        {
          Operation: "Append",
          Target: ["Entries", normalized.phaseKey],
          Value: festivalPositionValue(normalized),
          Delimiter: "/"
        }
      ]
    },
    advanced: {
      ...patch.advanced,
      StardewCPStudio: {
        ...studio,
        festivalPosition: normalized
      }
    }
  };
}

function normalizeFestivalPositionMeta(meta: Partial<FestivalPositionMeta>): FestivalPositionMeta {
  const festivalId = FESTIVAL_POSITION_OPTIONS.some((option) => option.value === meta.festivalId) ? stringField(meta.festivalId) : "spring13";
  const phaseKey = FESTIVAL_POSITION_PHASE_OPTIONS.some((option) => option.value === meta.phaseKey) ? stringField(meta.phaseKey) : "Set-Up_additionalCharacters";
  const direction = ["up", "down", "left", "right"].includes(stringField(meta.direction)) ? stringField(meta.direction) : "down";
  return {
    npcName: normalizeInternalName(stringField(meta.npcName || "ExampleNPC")),
    festivalId,
    phaseKey,
    x: integerInRange(meta.x ?? 0, 0, 999, 0),
    y: integerInRange(meta.y ?? 0, 0, 999, 0),
    direction
  };
}

function festivalPositionValue(meta: FestivalPositionMeta) {
  return `${meta.npcName} ${meta.x} ${meta.y} ${meta.direction}`;
}

function festivalPositionMetaFromPatch(patch: Patch, npcName = ""): FestivalPositionMeta | null {
  const studio = isObject(patch.advanced?.StardewCPStudio) ? patch.advanced.StardewCPStudio as JsonDict : {};
  const saved = isObject(studio.festivalPosition) ? studio.festivalPosition as JsonDict : null;
  if (saved) {
    const meta = normalizeFestivalPositionMeta(saved as Partial<FestivalPositionMeta>);
    return !npcName || meta.npcName === npcName ? meta : null;
  }
  const festivalId = stringField(patch.target).replace(/^Data\/Festivals\//, "");
  if (!FESTIVAL_POSITION_OPTIONS.some((option) => option.value === festivalId)) return null;
  const operations = Array.isArray(patch.fields?.TextOperations) ? patch.fields.TextOperations : [];
  const operation = operations.find((item) => isObject(item)) as JsonDict | undefined;
  if (!operation) return null;
  const target = Array.isArray(operation.Target) ? operation.Target.map(String) : [];
  const phaseKey = target[0] === "Entries" ? target[1] : "";
  const parts = stringField(operation.Value).trim().split(/\s+/);
  if (parts.length < 4) return null;
  const meta = normalizeFestivalPositionMeta({
    npcName: parts[0],
    festivalId,
    phaseKey,
    x: Number(parts[1]),
    y: Number(parts[2]),
    direction: parts[3]
  });
  return !npcName || meta.npcName === npcName ? meta : null;
}

function isFestivalPositionPatch(patch: Patch, npcName: string) {
  return Boolean(festivalPositionMetaFromPatch(patch, npcName));
}

function festivalPreviewForId(mapResources: MapResourceEntry[], festivalId: string): MapPreviewImage | null {
  const candidates = FESTIVAL_PREVIEW_CANDIDATES[festivalId] || [festivalId];
  for (const candidate of candidates) {
    const resource = mapResources.find((map) => map.key.toLowerCase() === candidate.toLowerCase());
    if (resource) return { url: resource.url, label: `MapResource/${resource.filename}` };
  }
  return null;
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
  const basePath = npcBaseAssetPath(project, normalized, "portrait");
  const baseAsset = previewAssetForPath(project, basePath);
  if (baseAsset) return baseAsset;
  const prefix = `assets/CharacterFiles/Portraits/${normalized}/`;
  const candidates = project.assets.filter((asset) => asset.stored_path.startsWith(prefix) && asset.content_type.startsWith("image/"));
  return assetByPreferredName(candidates, normalized) || candidates[candidates.length - 1] || null;
}

function findNpcSpriteAsset(project: Project, npcName: string) {
  const normalized = normalizeInternalName(npcName || "ExampleNPC");
  const basePath = npcBaseAssetPath(project, normalized, "sprite");
  const baseAsset = previewAssetForPath(project, basePath);
  if (baseAsset) return baseAsset;
  const prefix = `assets/CharacterFiles/OverworldSprites/${normalized}/`;
  const candidates = project.assets.filter((asset) => asset.stored_path.startsWith(prefix) && asset.content_type.startsWith("image/"));
  return assetByPreferredName(candidates, normalized) || candidates[candidates.length - 1] || null;
}

function npcBaseAssetPath(project: Project, npcName: string, kind: "portrait" | "sprite") {
  const npcEntry = project.game_data.find((entry) => entry.target === "Data/Characters" && normalizeInternalName(entry.key) === npcName);
  const studio = isObject(npcEntry?.advanced?.StardewCPStudio) ? npcEntry?.advanced.StardewCPStudio as JsonDict : {};
  const npc = isObject(studio.npc) ? studio.npc as JsonDict : {};
  return stringField(kind === "portrait" ? npc.portraitAssetPath : npc.spriteAssetPath);
}

function assetByPreferredName(candidates: Asset[], npcName: string) {
  const normalized = npcName.toLowerCase();
  return candidates.find((asset) => stripExtension(asset.stored_path.split("/").pop() || "").toLowerCase() === normalized) || null;
}

function isShopModuleEntry(entry: GameDataEntry) {
  return entry.kind === "shop" || entry.target === "Data/Shops";
}

function shopModuleMode(entry: GameDataEntry): ShopModuleMode {
  const studio = isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  const shop = isObject(studio.shop) ? studio.shop as JsonDict : {};
  if (shop.mode === "new" || shop.mode === "editItems") return shop.mode;
  return shopTargetField(entry).length ? "editItems" : "new";
}

function withShopModuleMetadata(entry: GameDataEntry, mode: ShopModuleMode): GameDataEntry {
  const studio = isObject(entry.advanced?.StardewCPStudio) ? entry.advanced.StardewCPStudio as JsonDict : {};
  return {
    ...entry,
    kind: "shop",
    advanced: {
      ...entry.advanced,
      StardewCPStudio: {
        ...studio,
        shop: { mode }
      }
    }
  };
}

function shopTargetField(entry: GameDataEntry) {
  const targetField = publicAdvanced(entry.advanced).TargetField;
  return Array.isArray(targetField) ? targetField.map(String) : [];
}

function defaultShopItem(id: string, itemId: string): JsonDict {
  return {
    Id: id,
    ItemId: itemId,
    IsRecipe: false
  };
}

function defaultShopOwner(shopId: string): JsonDict {
  return {
    Name: "Any",
    Dialogues: [
      {
        Id: `${sanitizeI18nPart(shopId)}_Default`,
        Dialogue: "Welcome!"
      }
    ]
  };
}

function shopIdOptions(project: Project): RulesetOption[] {
  const options = new Map<string, RulesetOption>();
  for (const option of VANILLA_SHOP_OPTIONS) options.set(String(option.value), option);
  for (const entry of project.game_data) {
    if (entry.target === "Data/Shops" && shopModuleMode(entry) === "new" && entry.key) {
      options.set(entry.key, { label: `项目自定义 ${entry.key}`, value: entry.key });
    }
  }
  return [...options.values()];
}

function isShopOpenPatch(patch: Patch) {
  const studio = isObject(patch.advanced?.StardewCPStudio) ? patch.advanced.StardewCPStudio as JsonDict : {};
  return patch.action === "EditMap" && Boolean(studio.shopOpen);
}

function withShopOpenMetadata(patch: Patch): Patch {
  const studio = isObject(patch.advanced?.StardewCPStudio) ? patch.advanced.StardewCPStudio as JsonDict : {};
  return {
    ...patch,
    action: "EditMap",
    advanced: {
      ...patch.advanced,
      StardewCPStudio: {
        ...studio,
        shopOpen: true
      }
    }
  };
}

function shopOpenMapFields(shopId: string, position: MapPoint, direction: string, openTime: string, closeTime: string, ownerArea: MapArea | null): JsonDict {
  return {
    MapTiles: [
      {
        Position: position,
        Layer: "Buildings",
        SetProperties: {
          Action: buildOpenShopAction(shopId, direction, openTime, closeTime, ownerArea)
        }
      }
    ]
  };
}

function buildOpenShopAction(shopId: string, direction: string, openTime: string, closeTime: string, ownerArea: MapArea | null) {
  const parts = ["OpenShop", shopId || "SeedShop"];
  const hasTime = Boolean(openTime || closeTime);
  if (direction || hasTime || ownerArea) parts.push(direction || "down");
  if (hasTime || ownerArea) {
    parts.push(openTime || "0000");
    parts.push(closeTime || "2600");
  }
  if (ownerArea) parts.push(String(ownerArea.X), String(ownerArea.Y), String(ownerArea.Width), String(ownerArea.Height));
  return parts.join(" ");
}

function shopOpenMetaFromPatch(patch: Patch): ShopOpenMeta {
  const mapTile = Array.isArray(patch.fields.MapTiles) && isObject(patch.fields.MapTiles[0]) ? patch.fields.MapTiles[0] as JsonDict : {};
  const position = isObject(mapTile.Position) ? mapTile.Position as JsonDict : {};
  const setProperties = isObject(mapTile.SetProperties) ? mapTile.SetProperties as JsonDict : {};
  const action = stringField(setProperties.Action || "OpenShop SeedShop down");
  const parts = action.split(/\s+/).filter(Boolean);
  const ownerArea = parts.length >= 10 ? {
    X: Number(parts[6] || 0),
    Y: Number(parts[7] || 0),
    Width: Number(parts[8] || 1),
    Height: Number(parts[9] || 1)
  } : null;
  return {
    shopId: parts[1] || "SeedShop",
    mapTarget: patch.target || "Maps/Town",
    position: { X: Number(position.X ?? 0), Y: Number(position.Y ?? 0) },
    direction: parts[2] || "down",
    openTime: parts[3] || "",
    closeTime: parts[4] || "",
    ownerArea
  };
}

function shopTimeLabel(value: string) {
  const hour = Number(value.slice(0, 2));
  const minute = value.slice(2, 4);
  const nextDay = hour >= 24;
  const displayHour = nextDay ? hour - 24 : hour;
  return `${nextDay ? "次日" : "当天"} ${String(displayHour).padStart(2, "0")}:${minute} / ${value}`;
}

function customMapKey(value: string) {
  const cleaned = normalizeInternalName(value || "ExampleMap");
  return cleaned.startsWith("Custom_") ? cleaned : `Custom_${cleaned}`;
}

function mapTargetOptions(project: Project, ruleset: Ruleset): RulesetOption[] {
  const values = new Set<string>();
  for (const option of rulesetOptions(ruleset, "common_maps")) values.add(`Maps/${String(option.value)}`);
  for (const option of mapLocationOptions(project)) values.add(`Maps/${String(option.value)}`);
  for (const patch of project.patches) {
    if (patch.action === "Load" && patch.target.startsWith("Maps/")) values.add(patch.target);
  }
  values.add("Maps/Town");
  values.add("Maps/Farm");
  return [...values].sort().map((value) => ({ label: value, value }));
}

function previewAssetForPath(project: Project, storedPath: string) {
  if (!storedPath) return null;
  return project.assets.find((asset) => asset.stored_path === storedPath && asset.content_type.startsWith("image/")) || null;
}

function assetToMapPreview(asset: Asset | null): MapPreviewImage | null {
  return asset;
}

function previewForMapTarget(project: Project, target: string, mapResources: MapResourceEntry[] = []): MapPreviewImage | null {
  const key = mapNameFromTarget(target);
  const resource = mapResources.find((map) => map.key.toLowerCase() === key.toLowerCase());
  if (resource) return { url: resource.url, label: `MapResource/${resource.filename}` };
  const locationEntry = project.game_data.find((entry) => entry.target === "Data/Locations" && entry.key === key);
  const studio = isObject(locationEntry?.advanced?.StardewCPStudio) ? locationEntry?.advanced.StardewCPStudio as JsonDict : {};
  const mapMeta = isObject(studio.map) ? studio.map as JsonDict : {};
  const savedPreview = previewAssetForPath(project, stringField(mapMeta.previewFile));
  if (savedPreview) return savedPreview;
  const candidates = project.assets.filter((asset) =>
    asset.content_type.startsWith("image/") &&
    (
      asset.stored_path === `assets/Maps/${key}/preview.png` ||
      asset.stored_path.startsWith(`assets/Maps/${key}/`) ||
      asset.stored_path.toLowerCase().includes(`/${key.toLowerCase()}/preview`)
    )
  );
  return candidates[candidates.length - 1] || null;
}

function mapNameFromTarget(target: string) {
  return target.replace(/^Maps\//, "");
}

function isNpcAnimationEntry(entry: GameDataEntry, npcName: string) {
  if (entry.kind !== "animation" || entry.target !== "Data/animationDescriptions") return false;
  const normalized = normalizeInternalName(npcName || "ExampleNPC");
  const meta = animationMetaFromEntry(entry);
  if (normalizeInternalName(meta.npcName || "") === normalized) return true;
  return entry.key === sleepAnimationKey(normalized) || entry.key.startsWith(`${normalized}_`) || entry.key.startsWith(`${normalized}.`) || entry.key.startsWith(`${normalized}-`);
}

function nextDialogueKey(project: Project, target: string, candidates: string[]) {
  const used = new Set(project.game_data.filter((entry) => entry.kind === "dialogue" && entry.target === target).map((entry) => entry.key));
  return candidates.find((key) => !used.has(key)) || `${candidates[0] || "CustomDialogue"}_${used.size}`;
}

function nextAvailableKey(baseKey: string, used: Set<string>) {
  if (!used.has(baseKey)) return baseKey;
  for (let index = 1; index < 1000; index += 1) {
    const candidate = `${baseKey}_${index}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${baseKey}_${makeId().slice(0, 8)}`;
}

function spouseMapShortName(value: string, fallback: string) {
  const trimmed = stringField(value || fallback).trim();
  const lastPart = trimmed.split("/").filter(Boolean).pop() || trimmed;
  return lastPart.replace(/^Maps\//i, "").replace(/^Custom_/i, "") || fallback;
}

function spouseMapAsset(shortName: string) {
  const clean = normalizeInternalName(spouseMapShortName(shortName, "SpouseRoom") || "SpouseRoom");
  return `Custom_${clean}`;
}

function spouseMapLoadTarget(shortName: string) {
  return `Maps/${spouseMapAsset(shortName)}`;
}

function spouseRoomSourceRect() {
  return { X: 0, Y: 0, Width: 6, Height: 9 };
}

function spousePatioSourceRect(rect: unknown = {}) {
  const source = isObject(rect) ? rect : {};
  return {
    X: numberOrText(stringField(source.X ?? 0)),
    Y: numberOrText(stringField(source.Y ?? 0)),
    Width: numberOrText(stringField(source.Width ?? 4)),
    Height: numberOrText(stringField(source.Height ?? 4))
  };
}

function numberListToText(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value.map((item) => String(item)).join(", ");
}

function textToNumberList(text: string) {
  const values = text.split(/[\s,]+/).map((part) => part.trim()).filter(Boolean).map((part) => integerInRange(part, -9999, 9999, 0));
  return values.length ? values : undefined;
}

function normalizeTilesheetName(value: string) {
  return value.trim().replace(/\.png$/i, "").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_") || "Tilesheet";
}

function tilesheetStoredPath(name: string) {
  return `assets/Tilesheets/${normalizeTilesheetName(name)}.png`;
}

function tilesheetLoadTarget(items: { name: string }[]) {
  return items.map((item) => normalizeTilesheetName(item.name)).filter(Boolean).map((name) => `Maps/${name}`).join(", ");
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
    textId: dialogueTextId(entry),
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

function dialogueTextId(entry: GameDataEntry) {
  const stored = dialogueMetadata(entry);
  const storedTextId = typeof stored?.textId === "string" ? stored.textId : "";
  const fallback = entry.id || makeId();
  return sanitizeI18nPart(storedTextId || fallback.slice(0, 8));
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

function normalDialogueKeyCandidates() {
  return [
    ...WEEKDAY_OPTIONS.map((item) => String(item.value)),
    "spring",
    "summer",
    "fall",
    "winter",
    "rain",
    "Introduction",
    "Resort",
    "GreenRain",
    ...Array.from({ length: 50 }, (_, index) => `CustomDialogue_${index + 1}`)
  ];
}

function dialogueI18nKeyFromParts(npcName: string, isMarriage: boolean, prefixOverride: string, key: string, textId = "") {
  const prefix = normalizeI18nPrefix(prefixOverride || npcName);
  const namespace = isMarriage ? "MarriageDialogue" : "CharacterDialogue";
  const safeKey = sanitizeI18nPart(key);
  return textId ? `${prefix}.${namespace}.${safeKey}.${sanitizeI18nPart(textId)}` : `${prefix}.${namespace}.${safeKey}`;
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

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

createRoot(document.getElementById("root")!).render(
  <SafeAppErrorBoundary>
    <App />
  </SafeAppErrorBoundary>
);

