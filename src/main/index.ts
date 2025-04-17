import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // removeAlpha IPC: 렌더러로부터 파일 목록을 받아 변환 실행
  ipcMain.handle('removeAlpha', async (_event, files) => {
    const sharp = require('sharp')
    const fs = require('fs')
    const path = require('path')
    const os = require('os')
    const archiver = require('archiver')
    const { dialog } = require('electron')
    try {
      if (!Array.isArray(files) || files.length === 0) throw new Error('파일이 없습니다')
      const outputDir = os.homedir()
      const outFiles: string[] = []
      for (const file of files) {
        let image: any
        let base: string
        if (file.path) {
          image = sharp(file.path)
          base = path.basename(file.path, path.extname(file.path))
        } else if (file.data) {
          const buffer = Buffer.from(file.data)
          image = sharp(buffer)
          base = path.basename(file.name, path.extname(file.name))
        } else {
          throw new Error(`Invalid file input for ${file.name}`)
        }
        const { channels } = await image.metadata()
        const processed = channels === 4 ? image.removeAlpha() : image
        const outPath = path.join(outputDir, `${base}-alpha.png`)
        await processed.png().toFile(outPath)
        outFiles.push(outPath)
      }
      let resultPath = ''
      if (outFiles.length === 1) {
        const saveName = path.basename(outFiles[0])
        const { canceled, filePath: savePath } = await dialog.showSaveDialog({
          title: 'PNG 저장',
          defaultPath: saveName,
          filters: [{ name: 'PNG Image', extensions: ['png'] }]
        })
        if (canceled || !savePath) throw new Error('사용자가 저장을 취소했습니다')
        await fs.promises.copyFile(outFiles[0], savePath)
        resultPath = savePath
      } else {
        resultPath = path.join(outputDir, `alpha_removed_${Date.now()}.zip`)
        const output = fs.createWriteStream(resultPath)
        const archive = archiver('zip', { zlib: { level: 9 } })
        archive.pipe(output)
        for (const f of outFiles) {
          archive.file(f, { name: path.basename(f) })
        }
        await new Promise<void>((resolve, reject) => {
          archive.on('error', reject)
          output.on('close', resolve)
          archive.finalize()
        })
        const saveName = path.basename(resultPath)
        const { canceled, filePath: savePath } = await dialog.showSaveDialog({
          title: 'ZIP 저장',
          defaultPath: saveName,
          filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
        })
        if (canceled || !savePath) throw new Error('사용자가 저장을 취소했습니다')
        await fs.promises.copyFile(resultPath, savePath)
        resultPath = savePath
      }
      return { success: true, path: resultPath }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      return { success: false, error: err.message }
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
