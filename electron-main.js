/*
 * File: electron-main.js
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Electron entry point for packaging the standalone desktop application.
 * Copyright © 2025 Cipher Intelligence Labs
 */

// @ts-nocheck
'use strict';

const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const isDev = process.env.NODE_ENV === 'development';

/**
 * Main window reference - prevent garbage collection
 */
let mainWindow;

/**
 * Application settings
 */
let appSettings = {
  useLocalModel: false,
  apiKey: '',
  localModelPath: '',
  windowSize: {
    width: 1200,
    height: 800
  }
};

/**
 * Path to settings file
 */
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

/**
 * Creates the main application window
 */
function createMainWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: appSettings.windowSize.width,
    height: appSettings.windowSize.height,
    minWidth: 800,
    minHeight: 600,
    title: 'VSCode AI Code Generator',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: false, // Don't show until ready
    backgroundColor: '#f5f5f5',
    icon: path.join(__dirname, 'resources/icon.png')
  });

  // Load the app
  const startUrl = isDev
    ? 'http://localhost:3000' // Dev server URL
    : `file://${path.join(__dirname, './src/front/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Show window when ready to prevent flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Open dev tools in development mode
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Save window size on close
  mainWindow.on('close', () => {
    const { width, height } = mainWindow.getBounds();
    appSettings.windowSize = { width, height };
    saveSettings();
  });
  
  // Clear the reference when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Set up the application menu
  setupMenu();
}

/**
 * Creates the application menu
 */
function setupMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Session',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('new-session')
        },
        {
          label: 'Save Chat Log...',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('save-chat')
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => showSettingsDialog()
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Command+Q' : 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'AI',
      submenu: [
        {
          label: 'Use Local Model',
          type: 'checkbox',
          checked: appSettings.useLocalModel,
          click: (menuItem) => {
            appSettings.useLocalModel = menuItem.checked;
            saveSettings();
            mainWindow.webContents.send('toggle-model', { useLocalModel: appSettings.useLocalModel });
          }
        },
        {
          label: 'Select Local Model Path...',
          click: () => selectLocalModelPath()
        },
        { type: 'separator' },
        {
          label: 'Configure API Key...',
          click: () => configureApiKey()
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            require('electron').shell.openExternal('https://cipherintelligence.com/docs');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            require('electron').shell.openExternal('https://github.com/cipherintelligence/vscode-ai-codegen/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => showAboutDialog()
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Shows the settings dialog
 */
function showSettingsDialog() {
  // In a real app, this would open a native dialog or send a message to render a settings UI
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Settings',
    message: 'Settings dialog would appear here',
    detail: `Current settings:\nUse Local Model: ${appSettings.useLocalModel}\nLocal Model Path: ${appSettings.localModelPath || 'Not set'}`,
    buttons: ['OK']
  });
}

/**
 * Shows dialog to select local model path
 */
function selectLocalModelPath() {
  dialog.showOpenDialog(mainWindow, {
    title: 'Select Local Model Directory',
    properties: ['openDirectory']
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      appSettings.localModelPath = result.filePaths[0];
      saveSettings();
      
      mainWindow.webContents.send('model-path-changed', { path: appSettings.localModelPath });
    }
  });
}

/**
 * Shows dialog to configure API key
 */
function configureApiKey() {
  // In a real app, this would open a secure input dialog
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'API Key',
    message: 'API Key configuration dialog would appear here',
    detail: 'This would be a secure dialog to enter and save your API key.',
    buttons: ['OK']
  });
}

/**
 * Shows the about dialog
 */
function showAboutDialog() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About VSCode AI Code Generator',
    message: 'VSCode AI Code Generator',
    detail: `Version: 1.0.0\nCopyright © 2025 Cipher Intelligence Labs\n\nAn advanced AI code generator with chat functionality.`,
    buttons: ['OK']
  });
}

/**
 * Loads application settings from disk
 */
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      const loadedSettings = JSON.parse(data);
      appSettings = { ...appSettings, ...loadedSettings };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

/**
 * Saves application settings to disk
 */
function saveSettings() {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(appSettings, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

/**
 * Set up IPC handlers for main process
 */
function setupIpcHandlers() {
  ipcMain.handle('get-settings', () => {
    return appSettings;
  });
  
  ipcMain.handle('save-settings', (event, newSettings) => {
    appSettings = { ...appSettings, ...newSettings };
    saveSettings();
    return appSettings;
  });
  
  ipcMain.handle('select-model-path', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Local Model Directory',
      properties: ['openDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      appSettings.localModelPath = result.filePaths[0];
      saveSettings();
      return appSettings.localModelPath;
    }
    
    return null;
  });
  
  ipcMain.handle('save-chat-log', async (event, chatData) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Chat Log',
      defaultPath: path.join(app.getPath('documents'), 'chat-log.json'),
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      try {
        fs.writeFileSync(result.filePath, JSON.stringify(chatData, null, 2), 'utf8');
        return true;
      } catch (error) {
        console.error('Failed to save chat log:', error);
        return false;
      }
    }
    
    return false;
  });
}

// App lifecycle events
app.whenReady().then(() => {
  loadSettings();
  setupIpcHandlers();
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

// IPC handlers for AI functionality
ipcMain.handle('ai:startChat', async (event, ...args) => {
  // Handle chat start
});

ipcMain.handle('ai:generateCode', async (event, ...args) => {
  // Handle code generation
});

ipcMain.handle('ai:explainCode', async (event, ...args) => {
  // Handle code explanation
});

ipcMain.handle('ai:improveCode', async (event, ...args) => {
  // Handle code improvement
});
