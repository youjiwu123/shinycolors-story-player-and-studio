# 《偶像大师 闪耀色彩》汉化剧情播放器 & 283 二创剧作台 Studio（本地版）

一套用于在本地浏览器运行《偶像大师 闪耀色彩》（enza 版）的配套工具，包含两个可联动使用的本地 Web 服务：

1. **剧情播放器（`:18899`）**：用于在电脑或同一局域网下的手机/平板中补全官方汉化剧情。
2. **283 二创剧作台 Studio（`:18898/proto/`）**：基于真实 Spine 立绘舞台的网页二创剧本制作器，支持从大纲、台词润色配音到舞台调参并导出成片。

> 本仓库仅包含前端页面、本地 Node 服务脚本、轻量剧情索引快照与人设校验数据，**不包含游戏原始立绘、背景、语音等大型版权资源包**；本地使用时只需在「资源挂载」中指定已准备好的本地 `enza` 资源文件夹路径即可只读读取。

---

## 一、两大工具介绍与界面预览

### 1. 剧情播放器（`http://127.0.0.1:18899/`）

- **定位**：用来补全《闪耀色彩》官方剧情的本地网页播放器，适合刚入坑想了解角色和故事的新人，或用来补看往期活动与培育剧情。
- **剧情汉化与分类**：剧情内容已做全量汉化（支持切换中/日字幕），左侧目录已按**主线、活动、培育、个人、其他**，以及 **8 支队伍**、**培育成长时期**等类别整理分类，选中想要看的组合或活动即可顺序观看。
- **外部资源按需挂载**：首次打开可通过左上角「📂 资源挂载」填入本地 `enza` 资源目录并热重载生效，无需把十余 GB 资源拷贝进本仓库；同一局域网下的手机/平板访问 `http://<本机局域网IP>:18899/` 也可直接观看。

![剧情播放器总览图卡](docs/images/player/card_p0_overview.png)
![剧情播放器分类说明](docs/images/player/card_p1_categories.png)

<details>
<summary>展开查看：剧情播放器实机界面截图（3 张）</summary>

![官方原比例立绘与左侧分类目录](docs/images/player/shot_01_stage_catalog.png)
![多分支选项与回想跳线](docs/images/player/shot_02_branch_choice.png)
![夜曲暗黑皮肤播放效果](docs/images/player/shot_03_nocturne_skin.png)

</details>

---

### 2. 283 二创剧作台 Studio（`http://127.0.0.1:18898/proto/`）

Studio 将二创短剧制作拆分为三个顺序步骤，并附带多人反应合集工作台：

![283 二创剧作台三步创作总览](docs/images/studio/card_s0_overview.png)

- **第 1 步 · 大纲蓝图 (`1 · 大纲蓝图`)**：先规划整部作品分几幕、每幕分几个剧情小段。支持输入想法由 AI 辅助拆成大纲，或直接导入已有文本 / `.scproj.json` 剧本；左侧可按幕勾选出场角色，并设定每幕的开场背景与配乐。

![第 1 步：大纲蓝图与导入剧本](docs/images/studio/card_s1_step1_outline.png)

- **第 2 步 · 台词润色与配音 (`2 · 台词润色`)**：收起舞台调参控件，专注打磨对白。支持逐条编辑「日语 / 中文」，或切到「连写」纯文本模式批量录入后一键同步回卡片；内置 30 位角色称呼矩阵与口癖校验核（OOC 提示），支持单句/全幕语音试听、TTS 读音覆写与整幕「连读」。

![第 2 步：台词润色与防 OOC 配音](docs/images/studio/card_s2_step2_dialogue.png)
![第 2 步补充：文本连写与连续围读](docs/images/studio/card_s3_step2_continuous.png)

- **第 3 步 · 舞台成品与导出 (`3 · 舞台成品`)**：切为「左台词、中舞台、右属性」三栏布局。左栏选句并锁定文本以防误改；中栏查看 Spine 实时舞台与节拍时间线，舞台下方可直接切换背景、BGM、音效或上传本地图片与音频；右栏只调当前这一句的情绪、眼神、动作、Spine 服装/发型与 2D 站位移动，完成后可直接录制 MP4 或打包导出 `.scpack.zip` / `.scproj.json`。
- **附带模式 · 多人反应合集 (`⚡ 反应合集`)**：在顶栏切到合集工作台，编写触发台词并选择参与偶像与反应风格（原作味 / 破防重女 / 直球心动 / 怪文书整活），按单人居中形式依次演出，可批量生成语音并连播导出。

![第 3 步：三栏实时舞台与功能分区](docs/images/studio/card_s4_step3_stage.png)
![第 3 步细节：换装表情与站位音效](docs/images/studio/card_s5_step3_detail.png)
![导出成片与多人反应合集模式](docs/images/studio/card_s6_export_reaction.png)

<details>
<summary>展开查看：283 二创剧作台实机界面截图（8 张）</summary>

| 步骤 / 模块 | 实机截图 |
|---|---|
| Step 1 · 大纲蓝图与导剧本 | ![Step 1 实机](docs/images/studio/shot_01_step1_outline.png) |
| Step 2 · 台词配音与防 OOC | ![Step 2 实机](docs/images/studio/shot_02_step2_dialogue.png) |
| Step 2 · 连写模式与剧本导入 | ![Step 2 连写实机](docs/images/studio/shot_06_step2_continuous.png) |
| Step 3 · 三栏分工与真 Spine 舞台 | ![Step 3 舞台实机](docs/images/studio/shot_03_step3_stage.png) |
| Step 3 · 换装换背景与 8 情绪表情 | ![换装表情实机](docs/images/studio/shot_04_costume_expr.png) |
| Step 3 · 站位运镜与音效设置 | ![站位音效实机](docs/images/studio/shot_07_step3_pos_sfx.png) |
| 多人反应 / 怪文书合集工作台 | ![反应合集实机](docs/images/studio/shot_05_reaction_workbench.png) |
| 导出工程与录制 MP4 菜单 | ![导出菜单实机](docs/images/studio/shot_08_export_menu.png) |

</details>

---

## 二、快速启动（Windows 本地）

### 环境要求

- **必需**：[Node.js](https://nodejs.org/)（建议 `>= 18`，需确保终端可执行 `node -v`）
- **可选**：若需使用 Studio 导出视频转码功能，建议本机已安装 `ffmpeg` 并加入 `PATH`

### 启动方式

1. **仅启动剧情播放器（`:18899`）**  
   双击根目录下的 `启动_剧情播放器(浏览器+局域网版).bat`，会自动启动播放器后端并打开浏览器访问 `http://127.0.0.1:18899/`。
2. **同时启动剧情播放器（`:18899`）与二创剧作台 Studio（`:18898`）**  
   双击根目录下的 `启动_二创制作器Studio.bat`，会后台拉起 `:18899` Spine 舞台引擎与 `:18898` Studio 服务，并自动打开 `http://127.0.0.1:18898/proto/`。
3. **挂载本地 `enza` 资源目录**  
   在播放器左上角点击「📂 资源挂载」，填入本机 `enza` 根目录路径（例如 `D:\enza`），点击「保存并热重载挂载」即可。该配置仅保存在本机 `data/mount-config.json`（已加入 `.gitignore`，不会提交到 Git）。

### AI 模型与语音接口配置（可选）

Studio 的 AI 辅助编剧与语音合成配置请直接在界面右上角「🔌 接口与语音」中填写（保存在本机运行配置或本地密钥文件中，已在 `.gitignore` 屏蔽）。**切勿将任何 API Key 或服务账号私钥提交到 Git 仓库。**

---

## 三、目录结构一览

- `tmp/`：本地剧情播放器前端与服务端（`enza-player.html`、`enza-server.js`）
- `studio-proto/`：283 二创剧作台 Studio 前端、工程引擎与本地网关
- `studio/`：30 人人设校验核（`lib/polisher-core.js`）、人物称呼/口癖数据与辅助工具
- `tools/`：Windows 一键启动脚本与 Studio 本地服务端（`studio_portable_server.js` 等）
- `data/`：轻量剧情目录索引快照、中文标题表与 Spine 动画白名单
- `projects_workspace/`：内置示例创作工程包（`.scpack`）
- `examples/` & `schema/`：`.scproj` 剧本格式规范与示例包
- `desktop/`：Electron 桌面外壳工程文件（`npm install && npm start`）
- `docs/images/`：README 展示用图卡与实机截图
- `ui-mockups/`：早期间隔/皮肤外观静态原型页

---

## 四、项目资源来源与开源致谢

### 资源来源说明

- **官方游戏资源（需用户自行在本地按需挂载）**：剧情播放器所需的官方剧本 JSON、角色 Spine 动态立绘、背景与 CG、BGM 与原版语音均由用户在本地通过「资源挂载」只读读取（对应标准 `enza` 目录结构，可通过 `ShinyColorsDB` 等开源资源管线准备），**本仓库自身不打包、不分发任何游戏原始版权媒体资源**。
- **公开音效资源来源**：Studio 中用到的部分**公开音效资源与音效集成规范参考自 [Eidolon-SC](https://github.com/Sallyn0225/eidolon-sc) 项目**（与官方 `enza` 本地音效目录配合使用）。
- **内置轻量数据**：仓库自带 `data/` 下的章节时序目录索引快照、中文标题对照表、Spine 动画白名单，以及 `studio/` 下的角色人设校对数据与示例工程包（不含游戏重型贴图和音频本体）。

### 参考工程与开源致谢

- **播放器舞台架构**：参考并改造自 [ShinyColorsDB-EventViewer](https://github.com/ShinyColorsDB/ShinyColorsDB-EventViewer)（`ShinyColorsDB`）
- **剧情中文汉化文本**：来自 [SCTranslationData](https://github.com/ShinyGroup/SCTranslationData) 与 [biuuu/ShinyColors](https://github.com/biuuu/ShinyColors)
- **公开音效、角色设定、读音词典与 AI 语音接入参考**：来自 [Eidolon-SC](https://github.com/Sallyn0225/eidolon-sc)（包含公开音效来源、`characters.toml` / `readings.toml` 词典、Fish Audio 角色参考音色映射及角色头像适配结构）
- **合集模式设计灵感**：参考 B 站全员反应合集视频形态（`BV14JJ16dEiN`）及同人剧情制作器交互设计
- **前端与媒体依赖**：PixiJS、`pixi-spine`、`pixi-sound`、GSAP、FontFaceObserver、Electron、Fish Audio、FFmpeg

## 五、版权与免责声明

《偶像大师 闪耀色彩》（THE iDOLM@STER SHINY COLORS）原作角色、剧情、立绘、音乐及语音版权均归 **©Bandai Namco Entertainment Inc.** 所有。  
本项目仅为非商业性质的粉丝向本地工具与代码整理，**不分发任何游戏原始版权资源本体**，请勿将本工具或衍生输出用于任何商业用途。
