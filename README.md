# Stardew CP Studio

Stardew CP Studio 是一个本地运行的星露谷 Content Patcher 内容包制作工具。它把角色、物品、地图、对话、日程、信件、任务、商店等内容做成表单化编辑界面，并在导出时生成可安装的 Content Patcher 模组结构。

当前规则集以 Content Patcher `2.9.0` 为目标。

## 启动方式

首次使用先安装依赖：

```powershell
cd path\to\stardew-cp-studio
.\setup.ps1
```

启动程序：

```powershell
.\run_app.ps1
```

Windows 日常使用可以直接双击 `run_app.bat`。程序默认使用 `http://127.0.0.1:8877/`，如果端口被占用会自动使用下一个可用端口，并把实际地址写入 `current-url.txt`。

使用时请保持启动窗口开启。关闭窗口会停止本地服务。

## 平板局域网协同使用

启动后，程序会同时监听本机和局域网地址：

- 电脑本机继续自动打开 `http://127.0.0.1:<端口>/`。
- `current-url.txt` 会额外写入形如 `http://192.168.x.x:<端口>/` 的局域网地址。
- 平板与电脑连接同一个 Wi-Fi 后，在平板浏览器打开这个局域网地址即可操作同一个工程。

电脑和平板共享当前工程会话。任一设备修改表单文字、选择项、地图坐标、添加或删除条目后，另一台设备会同步更新。同步范围包含工程数据、保存路径和导出路径；当前页面、滚动位置、侧边栏收起状态等纯界面状态不会同步。

保存仍由电脑上的后端服务写入电脑磁盘。因此平板点击“保存”时，会保存到工程管理页里的 `.cpgen` 路径。平板可以拖入或上传 `.cpgen` 工程文件，确认打开后电脑页面也会同步到该工程。

首次通过平板访问时，Windows 防火墙可能弹出提示。请选择允许“专用网络”访问，否则同一 Wi-Fi 下的平板可能无法连接。

## 工程文件

工程保存为 `.cpgen` 文件。它本质上是一个压缩包，内部包含：

- `project.json`：工程主体数据。
- `ruleset.json`：当前规则集。
- `assets/...`：导入的图片、地图文件等资源。

可以在“工程管理”里保存、打开、拖入预览工程文件、校验并导出内容包。

## 导出结构

导出后会生成标准 Content Patcher 内容包，主要包含：

- `manifest.json`
- `content.json`
- `i18n/default.json`
- `assets/`
- `code/`

较大的功能模块会被拆到 `code/` 下，再由 `content.json` 使用 `Include` 载入。例如角色相关代码、物品代码、任务代码、商店代码等会分别聚合，便于多角色和多功能维护。

用户在表单中输入的显示文本、对话、任务文本等会尽量写入 `i18n/default.json`，导出的游戏数据中使用 `{{i18n:...}}` 引用。

## 左侧导航

左侧侧边栏可以收起。主要页面包括：

- 模组信息
- 游戏数据
  - 角色 / 通用数据
  - 对话模块
  - 剧情事件
  - 日程模块
  - 信件模块
  - 物品添加
  - 地图添加
  - 商店功能
  - 任务功能
  - 特殊订单
- CP 补丁
- 素材库
- 工程管理
- 规则库

游戏数据下的独立模块都采用类似“物品添加”的布局：左侧是固定的添加按钮区，不会随右侧内容滚动；右侧是当前工程中的条目列表。对话、剧情事件、日程、信件等条目卡片支持收起/展开、上移、下移和删除。收起状态会保存到 `.cpgen` 工程中；上移/下移会调整底层 `game_data` 顺序，导出时也按这个顺序输出。

## 模组信息

这里编辑 `manifest.json` 的基础字段：

- 模组名称
- 作者
- UniqueID
- 版本
- 简介
- 依赖项

注意：`manifest.Description` 会直接写入 `manifest.json`，不会进入 `i18n/default.json`。

## 角色 / 通用数据

这个页面用于管理通用 `GameDataEntry`，并提供角色组块编辑器。

左侧的“添加游戏数据”按钮会按类型创建条目。大多数常用类型已经有专用表单；暂时没有专用表单覆盖的内容，可以使用高级 JSON 或 CP 补丁页面保留原始结构。

通用条目支持：

- 添加条目。
- 删除条目。
- 收起或展开条目。
- 调整部分专用页面里的条目顺序。
- 编辑 Target、Key、Value。
- 设置 When 条件。
- 查看当前条目会导出的 `EditData` 预览。

建议：角色基础资料仍优先在“角色 / 通用数据”的角色组块中编辑；对话、剧情、日程、信件数量较多时，优先进入各自独立页面维护，界面会更清爽。

### 角色基础信息

角色条目写入 `Data/Characters`。

可编辑：

- 内部名 Key
- 显示名 DisplayName
- 生日季节与日期
- 性别、年龄、礼貌、社交焦虑、乐观程度
- 是否可恋爱
- 是否室友路线
- 是否显示在日历、社交页
- 可社交、可收礼、可访问姜岛等条件
- 家庭地点 Home
- 外观 Appearance
- 配偶房 SpouseRoom
- 冬日星盛宴礼物 WinterStarGifts

显示名会写入 i18n，`Data/Characters.<NPC>.DisplayName` 使用 `{{i18n:Name.<NPC>}}`。

### 角色素材

可导入：

- 头像 Portrait
- 行走图 Sprite
- 外观切换用头像与行走图
- 配偶房贴图

头像会按 `64x64` 切分编号，行走图会按 `16x32` 切分编号。对话和动画相关编辑器会使用这些编号按钮。

### 普通对话

普通对话既可以在角色组块里添加，也可以在左侧“游戏数据 > 对话模块”中集中维护。独立对话页左侧可填写默认 NPC 内部名，并提供“普通对话”“婚后/室友对话”“邀请后对话”“特殊雨天对话”“节日对话”五类添加按钮。

普通对话会聚合导出到：

```text
assets/CharacterFiles/Dialogue/<NPC>/dialogue.json
```

并在代码中生成对应 `Load`。

对话正文写入 `i18n/default.json`，导出的 Entries 只写：

```json
"Mon": "{{i18n:...}}"
```

Key Builder 会按 Wiki 规则提供结构化选择，例如：

- 星期
- 季节
- 日期
- 好感心数
- 第一年/后续年份
- 特殊事件
- 自定义 Key

每条普通对话和婚后/室友对话都会保存独立文本 ID，i18n key 会包含最终 dialogue key 和该文本 ID。这样修改一个条目的正文不会影响其他条目；即使两个条目暂时使用相同最终 Key，也只会在校验中提示导出覆盖风险，不会把正文串在一起。

### 特殊对话

支持的特殊对话包括：

- 邀请后对话：`Data/EngagementDialogue`
- 雨天特殊对话：`Characters/Dialogue/rain`
- 节日对话：`Data/Festivals/<festival id>`

节日目标包括：

- `spring13`
- `spring24`
- `summer11`
- `summer28`
- `fall16`
- `fall27`
- `winter8`
- `winter25`

特殊对话同样可以在独立“对话模块”中维护。条目卡片支持收起/展开和排序，适合同时制作多个角色的节日或雨天文本。

### 婚后 / 室友对话

婚后或室友对话会聚合导出到：

```text
assets/CharacterFiles/Dialogue/<NPC>/MarriageDialogue.json
```

随机 Key 会展开成真实 Key，不使用抽象的 `xxx_n`。例如：

- `Rainy_Day_0` 到 `Rainy_Day_4`
- `Rainy_Night_0` 到 `Rainy_Night_5`
- `Indoor_Night_0` 到 `Indoor_Night_4`
- `Outdoor_0` 到 `Outdoor_4`
- `Good_0` 到 `Good_9`
- `Neutral_0` 到 `Neutral_9`
- `Bad_0` 到 `Bad_9`

也支持：

- `patio_<NPC>`
- `spouseRoom_<NPC>`
- `funLeave_<NPC>`
- `funReturn_<NPC>`
- `jobLeave_<NPC>`
- `jobReturn_<NPC>`
- `<season>_<NPC>`
- `<season>_<day>`

### 室友提案物品

室友路线可生成提案物品，写入 `Data/Objects`。

会自动写入：

- 物品 ID
- 内部名
- 显示名 i18n
- 描述 i18n
- 价格
- 贴图资源
- `propose_roommate_<NPC>` context tag

送出该物品后，游戏可将 NPC 作为室友候选。

### 礼物喜好

角色组块内可以创建 `Data/NPCGiftTastes` 条目。

支持：

- 最爱 Love
- 喜欢 Like
- 普通 Neutral
- 不喜欢 Dislike
- 讨厌 Hate

物品选择器可选择多个项目，包括：

- 原版物品
- 项目中新建物品
- 物品类别负数 ID
- 自定义模组物品 ID

礼物喜好输出为游戏使用的 slash 字符串格式。

### 电影观感

写入：

```text
Data/MoviesReactions
```

每个反应可设置：

- 电影 Tag，例如 `spring_movie_0`
- 观感：`love`、`like`、`dislike`
- 白名单
- 观影前 BeforeMovie
- 观影中 DuringMovie
- 观影后 AfterMovie
- Script
- Text

文本输入区提供停顿、中断和头像编号按钮。

### 日程

角色组块内可以创建日程条目，也可以在独立“日程模块”中集中编辑。独立日程页左侧可填写默认 NPC 内部名，并用“新增日程条目”创建该 NPC 的基础日程。

无 `When` 条件的日程会聚合导出到：

```text
assets/CharacterFiles/Schedules/<NPC>/Schedule.json
```

带 `When` 的日程会作为单独 `EditData` 导出，避免污染聚合文件。

日程支持：

- 多个时间点
- 多个地点
- 坐标
- 朝向
- 动画
- 日程台词
- 初始命令：`GOTO`、`NOT friendship`、`MAIL`

时间选择按半小时显示，内部转换为星露谷四位时间。

每个日程条目右侧卡片可收起、重命名、删除、上移或下移。日程点位内部也支持添加、删除和排序；点位地图坐标可通过 `MapResource` 预览图点击选择。

### 角色动画

写入：

```text
Data/animationDescriptions
```

睡眠动画 Key 使用：

```text
<lowercase npc name>_sleep
```

行走图会按 `16x32` 切帧，从左到右、从上到下编号。动画编辑器以一个编号一个格子的形式编辑帧序列，并提供实时预览。导出时转换为游戏需要的：

```text
0/1/2
```

## 物品添加

物品页面分为：

- 一般物品
- 作物
- 果树
- 烹饪配方
- 制作配方

### 一般物品

写入：

```text
Data/Objects
```

可编辑：

- 物品 ID
- 内部名 Name
- 显示名 DisplayName
- 描述 Description
- 类型 Type
- 类别 Category
- 价格 Price
- 可食用值 Edibility
- 是否饮料
- 贴图 Texture
- SpriteIndex
- ContextTags

显示名和描述会写入 i18n。

物品 ID 默认使用 `UniqueID` 前缀，减少和其他模组冲突。

### 作物

写入：

```text
Data/Crops
```

可编辑：

- 种子 ID
- 收获物 HarvestItemId
- 生长季节
- 各阶段天数
- 是否可再生
- 最小/最大收获数量
- 额外收获概率
- 贴图
- 收获方式
- 是否需要浇水
- 是否棚架作物
- 是否水田作物

种子 ID 和作物 ID 会从项目新物品中选择。

### 果树

写入：

```text
Data/FruitTrees
```

可编辑：

- 果树树苗 ID
- 显示名
- 生长季节
- 产物 Fruit
- 贴图
- 贴图行
- 可种植地点规则

果树显示名写入 i18n。

### 配方

烹饪配方写入：

```text
Data/CookingRecipes
```

制作配方写入：

```text
Data/CraftingRecipes
```

可编辑：

- 配方名
- 目标产物
- 材料物品
- 材料数量
- 解锁条件
- 是否大物件
- 产出数量

目标产物优先从项目新物品里选择，材料可从完整物品列表中选择。

## 地图添加

地图页面分为：

- 自定义新地图
- 修改原有地图
- 添加传送点

地图预览图按 `16x16` 像素为一格，左上角为 `0 0`。有坐标选择的位置提供锁定开关，防止误点。

### 自定义新地图

会生成：

```json
{
  "Action": "EditData",
  "Target": "Data/Locations",
  "Entries": {
    "Custom_Example": {
      "CreateOnLoad": {
        "MapPath": "Maps/Custom_Example"
      }
    }
  }
}
```

并生成：

```json
{
  "Action": "Load",
  "Target": "Maps/Custom_Example",
  "FromFile": "assets/Maps/Custom_Example/Custom_Example.tmx"
}
```

操作步骤：

1. 输入地图 Key。程序会自动加 `Custom_` 前缀。
2. 导入 `.tmx` 或 `.tbin` 地图文件。
3. 可选导入预览图。
4. 设置地点类型、默认到达点、是否可种植、是否 AlwaysActive 等。
5. 点击生成/更新。

新地图 Key 会自动进入 NPC 住处、日程地点、地图修改和商店 OpenShop 等地点选项。

### 修改原有地图

用于生成 `EditMap` 区域替换。

操作步骤：

1. 选择目标地图。
2. 导入用于覆盖的 `.tmx` 或 `.tbin`。
3. 导入覆盖来源预览图。
4. 左侧框选来源区域。
5. 右侧在目标地图预览中选择放置区域。
6. 选择 PatchMode。
7. 确认生成。

目标地图预览优先使用项目内 `MapResource` 文件夹中的图片。

### 添加传送点

用于生成 `EditMap` 的 `AddWarps` 或 `AddNpcWarps`。

操作步骤：

1. 选择出发地图。
2. 选择目标地图。
3. 选择玩家传送或 NPC 传送。
4. 在两张地图预览图中点击坐标。
5. 确认生成。

生成语句格式类似：

```text
fromX fromY TargetMap toX toY
```

## 商店功能

商店页面分为：

- 自定义新商店
- 修改已有商店商品
- 地图 OpenShop 点

### 自定义新商店

写入：

```text
Data/Shops
```

可编辑：

- 新商店 ID
- 货币 Currency
- 打开音效 OpenSound
- 购买音效 PurchaseSound
- 关闭消息 ClosedMessage
- 商店主题 Theme
- 店主 Owners
- 出售商品 Items

店主 Owners 可设置：

- Name：NPC 名或 `Any`
- Condition
- ClosedMessage
- Dialogues

商品 Items 可设置：

- Id
- ItemId
- Price
- Condition
- AvailableStock
- AvailableStockLimit
- Stack
- TradeItemId
- TradeItemAmount
- IsRecipe
- 高级字段

### 修改已有商店商品

按 Wiki 的 `TargetField` 写法导出：

```json
{
  "Action": "EditData",
  "Target": "Data/Shops",
  "TargetField": [ "FishShop", "Items" ],
  "Entries": {
    "Example.ModId_Pufferfish": {
      "Id": "Example.ModId_Pufferfish",
      "ItemId": "(O)128",
      "Price": 2000
    }
  }
}
```

可执行：

- 添加商品
- 替换商品
- 删除商品
- 使用 `MoveEntries` 调整排序

Shop ID 下拉包含 Wiki 的 Vanilla shop IDs，并自动加入当前项目中新建商店 ID。

### 地图 OpenShop 点

用于在地图 Buildings 层添加交互属性：

```text
Action: OpenShop <shop id> [from direction] [open time] [close time] [owner tile area]
```

操作步骤：

1. 选择 Shop ID。
2. 选择目标地图。
3. 点击地图预览选择格子坐标。
4. 选择玩家相对方向。
5. 选择开门时间和关门时间。
6. 可选写入 owner tile area。
7. 可选添加 When 条件。

时间在界面中按正常时间显示，内部导出为四位数 26 小时制：

- `0000` 表示当天 00:00。
- `0600` 表示当天 06:00。
- `2400` 表示次日 00:00。
- `2600` 表示次日 02:00。

## 任务功能

任务写入：

```text
Data/Quests
```

导出格式：

```text
Type/Title/Description/Hint/Requirement/Next Quests/Money Reward/Reward Description/Cancellable/Reaction Text
```

任务标题、描述、目标提示、完成反应文本写入 i18n。

支持任务类型：

- Basic
- Crafting
- Location
- Building
- ItemDelivery
- Monster
- ItemHarvest
- LostItem
- SecretLostItem
- Social

重点完成条件已表单化：

- `ItemDelivery`: 选择 NPC、物品、数量。
- `LostItem`: 选择 NPC、物品、地点，并通过地图预览点击 X/Y。
- `SecretLostItem`: 选择 NPC、物品、友情点数、可选移除任务 ID。

任务 ID 默认使用 `UniqueID` 前缀防冲突。

## 特殊订单

特殊订单写入：

```text
Data/SpecialOrders
```

页面支持创建、编辑和删除多个特殊订单，并导出到 `code/Other/SpecialOrders.json`。文本会写入 i18n。

可编辑：

- 订单 ID
- 名称 Name
- 请求人 Requester
- 时长 Duration
- 是否可重复 Repeatable
- RequiredTags
- OrderType
- SpecialRule
- 正文 Text
- 结束时移除的物品或邮件标记
- 随机元素 RandomizedElements
- 目标 Objectives
- 奖励 Rewards

目标和奖励提供常用字段表单，同时保留高级 JSON，便于补充 Wiki 中较少见的字段。

## 信件

信件既可以从通用数据添加，也可以在独立“信件模块”中维护。独立信件页左侧固定“新增信件”按钮，右侧每封信都可以收起、重命名、上移、下移或删除。

信件写入：

```text
Data/Mail
```

支持：

- 信件 ID
- 标题
- 正文
- 原版信纸
- 自定义信纸贴图
- 文字颜色
- 附加物品
- 金钱
- 任务
- 配方
- 特殊订单
- Trigger Action 附件

正文输入中的换行会在导出时转换为星露谷信件格式需要的 `^`。

邮件发送逻辑通过 `Data/TriggerActions` 实现，例如：

```json
{
  "Action": "EditData",
  "Target": "Data/TriggerActions",
  "Entries": {
    "give_ExampleLetter": {
      "Id": "ExampleLetter",
      "Trigger": "DayStarted",
      "Actions": [
        "AddMail Current ExampleLetter"
      ]
    }
  }
}
```

发送信件不写在信件正文尾部。请单独创建 Trigger Action，并在其中使用：

```text
AddMail <player> <mail ID> [now|tomorrow|received|all]
```

常用写法：

```text
AddMail Current ExampleLetter
AddMail Current ExampleLetter now
AddMail Current ExampleLetter received
```

Trigger Action 可配合 When 条件限制触发日期、天气、季节、好感等。

## 剧情事件

剧情事件页面用于制作 `Data/Events/<Location>`。左侧固定“新增剧情事件”按钮，右侧事件卡片支持收起、重命名、删除、上移和下移。

功能包括：

- 事件 Key 与前置条件
- 好感度条件，界面按心数选择，内部转换为友情点
- 时间条件，界面按秒输入，内部转换为毫秒
- 节点式事件脚本
- 对话节点
- 角色气泡 `textAboveHead`
- 停顿
- 农夫移动
- NPC 移动
- 发信标记相关节点：`mail`、`mailToday`、`mailReceived`

流程模式目前隐藏，后续继续扩展。

## 秘密纸条

秘密纸条写入：

```text
Data/SecretNotes
```

并归档导出到：

```text
code/Other/SecretNotes.json
```

支持：

- 非数字 Key。
- 正文写入 i18n。
- 使用类似信件的文本格式。
- 换行可按秘密纸条格式使用 `^`。

秘密纸条可从“角色 / 通用数据”的添加类型中创建。

## CP 补丁

CP 补丁页面提供原始 Content Patcher Patch 编辑能力。

支持动作包括：

- `Load`
- `EditData`
- `EditImage`
- `EditMap`
- `Include`

每个补丁可以设置：

- Target
- FromFile
- Entries / Fields / MapTiles 等字段
- When 条件
- 高级 JSON

适合处理当前表单尚未覆盖的特殊补丁。

## When 条件构建器

多个模块都复用 When 条件构建器。

支持常用 Content Patcher Token，例如：

- Day
- DayOfWeek
- Season
- Weather
- Year
- Time
- Hearts
- Relationship
- HasFlag
- HasReadLetter
- HasSeenEvent
- HasVisitedLocation
- SkillLevel
- FarmType
- FarmCave
- IsCommunityCenterComplete

条件可以用选项创建，也可以保留自定义值。

## 素材库

素材库显示当前工程导入的资源。

常见资源包括：

- 头像 PNG
- 行走图 PNG
- 物品贴图
- 果树贴图
- 地图 `.tmx` / `.tbin`
- 地图预览图
- 信纸贴图

导入资源会保存在 `.cpgen` 内，导出时写入内容包的 `assets/`。

## 工程管理

工程管理页用于处理整个 `.cpgen` 工程和最终导出。

可执行：

- 新建工程。
- 保存当前工程到 `.cpgen`。
- 从路径打开已有 `.cpgen`。
- 选择工程文件打开。
- 将 `.cpgen` 拖入页面进行预览，再确认打开。
- 校验当前工程。
- 导出 Content Patcher 内容包。

拖入工程时会先显示工程名、UniqueID、条目数量等预览信息；确认后才会替换当前打开的工程。

工程管理页也承载工程总览、校验导出和 AI 相关入口。AI 功能只作为辅助生成或检查建议，最终内容仍以表单和导出预览为准。

## 规则库

规则库是内置的 Stardew / Content Patcher 数据说明。

包含：

- 数据目标
- 字段说明
- 枚举选项
- 物品类别
- 原版物品目录
- 常用地图
- 任务、邮件、事件、商店等格式参考

后续可以通过更新规则库扩展更多游戏版本和数据表。

## 校验与导出

工程管理中可以执行：

- 校验
- 保存 `.cpgen`
- 打开 `.cpgen`
- 拖入工程预览
- 导出 Content Patcher 内容包

校验会区分错误和警告：

- 错误会阻止导出。
- 警告用于提示潜在问题，但不会强制阻止高级用户继续。

导出时会统一处理 i18n：

- 用户输入的角色名、物品名、物品描述、对话、信件、任务文本等会写入 `i18n/default.json`。
- 游戏数据里使用 `{{i18n:...}}` 引用这些文本。
- 手动 i18n 编辑页已经隐藏，避免和表单数据产生两套来源。

当前校验还会提示：

- 必填 Target / Key 是否缺失。
- `Load`、`EditImage`、`Include` 等是否缺少 `FromFile`。
- `EditMap` 是否确实需要 `FromFile`，如果已经使用 `MapTiles`、`AddWarps` 等内联字段则不会误报。
- 同一 `Characters/Dialogue/<NPC>` 或 `MarriageDialogue<NPC>` 下是否有重复 dialogue key。重复 key 允许保存，但导出时后者可能覆盖前者。

## 开发与测试

后端单元测试：

```powershell
.\.venv\Scripts\python.exe -m unittest backend.tests.test_core
```

前端生产构建：

```powershell
cd frontend
$env:NODE_PATH='E:\Codex\stardew-cp-studio\frontend\node_modules'
& 'C:\Users\zyq\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'E:\Codex\stardew-cp-studio\frontend\node_modules\vite\bin\vite.js' build --outDir dist --emptyOutDir
```

## 注意事项

- `.cpgen` 是工程文件，不是最终安装到游戏里的模组。
- 导出的文件夹才是 Content Patcher 内容包。
- 自定义 ID 推荐使用 `UniqueID` 前缀，减少冲突。
- 地图坐标统一按 tile 坐标填写，左上角为 `0 0`。
- 角色头像编号按 `64x64` 切分。
- 角色行走图编号按 `16x32` 切分。
- 不确定字段时，可以先使用高级 JSON 保留原始结构。
