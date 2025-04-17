import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      removeAlpha: (files: { name: string; path: string }[]) =>
        ipcRenderer.invoke('removeAlpha', files)
    })
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = {
    ...electronAPI,
    removeAlpha: (files: { name: string; path: string }[]) =>
      ipcRenderer.invoke('removeAlpha', files)
  }
  // @ts-ignore (define in dts)
  window.api = api
}
