import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI & {
      removeAlpha: (files: { name: string; path: string }[]) => Promise<{ success: boolean; path?: string; error?: string }>
    }
    api: unknown
  }
}
