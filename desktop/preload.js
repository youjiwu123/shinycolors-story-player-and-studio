'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// 播放器本身不依赖这个桥；保留给桌面壳状态展示或后续升级 UI 使用。
contextBridge.exposeInMainWorld('enzaDesktop', {
  isDesktop: true,
  platform: process.platform,
  getAppInfo: () => ipcRenderer.invoke('enza:app-info')
});
