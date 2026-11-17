========================================================================
  闪耀色彩 (ShinyColors) 剧情播放器 & 283 二创剧作台 Studio · 本地轻量版
========================================================================

【架构特性：仅分发剧情结构与索引快照，游戏资源按需只读挂载】
  1. 本仓库内置剧情时序目录快照、中文化标题对照表、角色服装与 Spine 动画白名单、
     30 人润色与 OOC 校准核，不包含游戏原始立绘、背景与音频等重资源。
  2. 即使尚未挂载外部资源，也可直接导入 `.scproj.json` 或 `.scpack` 二创剧本
     预览章节顺序、分支结构与角色站位编排。
  3. 在界面左上角「📂 资源挂载」中填入外部资源目录后，无需重启服务，
     全量官方剧情、Spine 动态立绘、背景 CG 与语音即刻自动读取。

【两种资源包，按需二选一】
  A. 完整版 `enza-story-resources.zip`
     • 解压十余 GB，含官方剧情全量、Spine 立绘、背景、BGM/SE、原版语音与全量翻译。
     • 适合：用播放器补全官方全语音剧情。
     • 百度网盘：https://pan.baidu.com/s/1ehLeZrIhxQWKkqBK-siGZQ  提取码：enza

  B. Studio 精简完美版 `ShinyColors-Studio-Assets-2026-11-17.zip`
     • 解压 4.45 GB（下载约 2.2 GB），含：
       - 2,643 套 Spine 骨架：2,509 套服装、2,377 套发型全覆盖，
         另含觉醒 / 进化皮肤 / 支援卡 / 联动 / 活动骨架
       - 1,116 张背景、102 张前景 CG、对话框与选项框贴图、角色圆形头像
       - 全量 BGM 2,106 个、SE 3,392 个、演出视频、游戏原字体、pixi-spine 运行时
     • 表情 / 动作随骨架内置：常规立绘每套 32~87 条动画（face_* / eye_* / lip_* / arm_* 及
       anger / smile / sad / hello 等组合表情）；Q 版小人（cb / cb_costume）按游戏原始素材
       只有简易表情，不含 face_*，并非裁剪丢失。
     • 不含：原版语音（约 11.4 GB）与全量翻译（约 5.3 GB）。
       编辑器的配音由 TTS 生成，只有播放官方剧情才需要原版语音。
     • 适合：只做二创、需要完整换装 / 背景 / 配乐与实机录制。
     • 百度网盘：<分享链接待补，上传后填入>  提取码：enza

【B 包怎么装】
  1. 下载 `ShinyColors-Studio-Assets-2026-11-17.zip`，解压到任意目录，
     得到 `enza-editor-assets/`（内含 `assets/`、`MANIFEST.json`、`使用说明.txt`）。
  2. 启动 `启动_二创制作器Studio.bat`，打开 http://127.0.0.1:18898/proto/ 。
  3. 顶栏「📂 资源挂载」→ 填入 `enza-editor-assets` 目录 →「保存并热重载挂载」。
     也可直接改 `data/mount-config.json` 的 `enzaRoot` 为该目录。
  4. 校验：`MANIFEST.json` 记录了每个分类的文件数与体积；`使用说明.txt` 有同样的说明。
     全量核对可跑 `node tools/check_editor_coverage.js --pack <解压目录>`：
     服装 2,509/2,509、发型 2,377/2,377 全部命中。

【A 包怎么装】
  解压后得到标准 `enza/` 目录（含 `assets/`、`voice/`、`translations/`），
  在「📂 资源挂载」里填 `enza` 根目录即可。

【快速启动方式】
  • 方式 A · 剧情播放器（浏览器 + 局域网手机/平板横屏观看）：
    双击运行 `启动_剧情播放器(浏览器+局域网版).bat`，自动打开 http://127.0.0.1:18899/
  • 方式 B · 283 二创剧作台 Studio（制作二创短剧与导出视频）：
    双击运行 `启动_二创制作器Studio.bat`，自动起用 :18899 与 :18898 并打开 http://127.0.0.1:18898/proto/
  • 方式 C · Electron 桌面端开发环境：
    进入 `desktop/` 目录运行 `npm install && npm start`。

【自己生成 B 包（可选）】
  资源包由本地脚本从自己的 `enza` 目录裁剪，不需要的材料不会进包：
    node tools/build_editor_assets.js --enza D:\enza --out output\enza-editor-assets
  校验：
    node tools/verify_editor_assets.js --pack output\enza-editor-assets
