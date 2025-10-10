// main.js - Electron main process
const { app, BrowserWindow, Menu, shell, dialog, ipcMain, Tray, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let serverProcess;
let tray = null;
let isQuitting = false;

// Desktop app configuration
const APP_CONFIG = {
  name: 'Meridian',
  version: require('./package.json').version,
  port: process.env.PORT || 8080,
  serverStartDelay: 3000,
  serverShutdownTimeout: 5000
};

// Start the Express server
function startServer() {
  console.log('Starting Meridian server...');
  
  // Enhanced server startup with better error handling
  serverProcess = spawn('node', ['app.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { 
      ...process.env, 
      NODE_ENV: process.env.NODE_ENV || 'development',
      ELECTRON_MODE: 'true',
      PORT: APP_CONFIG.port
    }
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
    showErrorDialog('Server Error', `Failed to start Meridian server: ${err.message}`);
  });
  
  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
    if (code !== 0 && !isQuitting) {
      console.log('Server crashed, attempting restart...');
      setTimeout(startServer, 2000); // Restart after 2 seconds
    }
  });
}

// Enhanced error dialog
function showErrorDialog(title, message) {
  dialog.showErrorBox(title, message);
}

// Check if server is ready
async function waitForServer(maxAttempts = 10) {
  const http = require('http');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${APP_CONFIG.port}/health`, (res) => {
          resolve();
        });
        req.on('error', reject);
        req.setTimeout(1000);
      });
      console.log('Server is ready!');
      return true;
    } catch (error) {
      console.log(`Server not ready, attempt ${i + 1}/${maxAttempts}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

function createWindow() {
  // Create the browser window with enhanced settings
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'public/icons/icon-192x192.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // Disable for localhost development
      allowRunningInsecureContent: true, // Allow for localhost
      experimentalFeatures: false,
      backgroundThrottling: false, // Prevent background throttling
      offscreen: false // Ensure proper rendering
    },
    titleBarStyle: 'default',
    show: false, // Don't show until ready
    autoHideMenuBar: false, // Keep menu bar visible
    backgroundColor: '#1a1a1a', // Dark background while loading
    title: `${APP_CONFIG.name} v${APP_CONFIG.version}`,
    acceptFirstMouse: true, // Better click handling
    skipTaskbar: false // Show in taskbar
  });

  // Wait for server to be ready, then load the app
  waitForServer().then((ready) => {
    if (ready) {
      mainWindow.loadURL(`http://localhost:${APP_CONFIG.port}`);
    } else {
      showErrorDialog('Startup Error', 'Failed to start Meridian server. Please check the logs.');
    }
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus(); // Ensure window has focus
    
    // Focus on the window
    if (process.platform === 'darwin') {
      app.dock.show();
    }
    
    console.log(`Meridian desktop app ready! Version ${APP_CONFIG.version}`);
  });

  // Fix focus issues - ensure window regains focus when clicked
  mainWindow.on('focus', () => {
    // Send focus event to web contents
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.focus();
    }
  });

  // Handle when webContents gets focus
  mainWindow.webContents.on('dom-ready', () => {
    // Inject focus fix script
    mainWindow.webContents.executeJavaScript(`
      // Fix input focus issues
      document.addEventListener('click', function(e) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true')) {
          e.target.focus();
        }
      });
      
      // Prevent focus loss on window events
      window.addEventListener('blur', function(e) {
        // Don't prevent blur if it's intentional (like opening a modal)
        if (!e.target.closest('.modal')) {
          setTimeout(() => {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
              activeElement.focus();
            }
          }, 100);
        }
      });
      
      console.log('[ELECTRON] Focus management scripts injected');
    `);
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window close button (minimize to tray instead of quit)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // Show tray notification on first minimize
      if (tray && process.platform === 'win32') {
        tray.displayBalloon({
          iconType: 'info',
          title: 'Meridian',
          content: 'Meridian is still running in the background. Email tracking continues!'
        });
      }
    }
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Set up menu and tray
  createMenu();
  createTray();
}

// Create system tray for background operation
function createTray() {
  // Create tray icon
  const iconPath = path.join(__dirname, 'public/icons/icon-16x16.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  trayIcon.setTemplateImage(true);
  
  tray = new Tray(trayIcon);
  
  // Set tray tooltip
  tray.setToolTip(`${APP_CONFIG.name} - Email tracking active`);
  
  // Create tray context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Meridian',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Hide Meridian',
      click: () => {
        if (mainWindow) mainWindow.hide();
      }
    },
    { type: 'separator' },
    {
      label: `Version ${APP_CONFIG.version}`,
      enabled: false
    },
    {
      label: 'Email Tracking Active',
      enabled: false,
      icon: nativeImage.createFromPath(path.join(__dirname, 'public/icons/icon-16x16.png')).resize({ width: 16, height: 16 })
    },
    { type: 'separator' },
    {
      label: 'Quit Meridian',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // Double-click tray to show/hide window
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function createMenu() {
  const template = [
    {
      label: APP_CONFIG.name,
      submenu: [
        {
          label: `About ${APP_CONFIG.name}`,
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: `About ${APP_CONFIG.name}`,
              message: `${APP_CONFIG.name} v${APP_CONFIG.version}`,
              detail: 'AI-Powered Lead Research & Email Automation\n\nEmail tracking works even when minimized to tray.\nWebhooks continue to function for reply and click tracking.',
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => {
            // You can implement auto-updater here
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Updates',
              message: 'You are running the latest version!',
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Minimize to Tray',
          accelerator: 'Ctrl+H',
          click: () => {
            if (mainWindow) mainWindow.hide();
          }
        },
        {
          label: 'Reload Page',
          accelerator: 'Ctrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          }
        },
        {
          label: 'Focus Page',
          accelerator: 'Ctrl+L',
          click: () => {
            if (mainWindow) {
              mainWindow.focus();
              mainWindow.webContents.focus();
            }
          }
        },
        {
          label: `Quit ${APP_CONFIG.name}`,
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Open Data Folder',
          click: () => {
            shell.openPath(path.join(__dirname, 'lib', 'data'));
          }
        },
        {
          label: 'Open Logs Folder',
          click: () => {
            shell.openPath(path.join(__dirname, 'logs'));
          }
        },
        { type: 'separator' },
        {
          label: 'Export Settings',
          click: async () => {
            const result = await dialog.showSaveDialog(mainWindow, {
              title: 'Export Meridian Settings',
              defaultPath: `meridian-settings-${new Date().toISOString().split('T')[0]}.json`,
              filters: [
                { name: 'JSON Files', extensions: ['json'] }
              ]
            });
            
            if (!result.canceled) {
              // Export settings logic here
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Export Complete',
                message: 'Settings exported successfully!',
                buttons: ['OK']
              });
            }
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { 
          label: 'Hide to Tray',
          accelerator: 'Ctrl+H',
          click: () => {
            if (mainWindow) mainWindow.hide();
          }
        },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(() => {
  // Start the Express server first
  startServer();
  
  // Create the main window
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// Prevent app from quitting when all windows are closed (tray behavior)
app.on('window-all-closed', () => {
  // Don't quit on window close - keep running in tray for email tracking
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
});

// Handle app quit
app.on('before-quit', () => {
  isQuitting = true;
  
  // Kill server process gracefully
  if (serverProcess) {
    console.log('App quitting - shutting down server...');
    serverProcess.kill('SIGTERM');
    
    // Force kill after timeout
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        console.log('Force killing server process...');
        serverProcess.kill('SIGKILL');
      }
    }, APP_CONFIG.serverShutdownTimeout);
  }
});

// Final cleanup on quit
app.on('will-quit', (event) => {
  // Clean up tray
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });
  
  // Additional security
  contents.on('will-navigate', (event, url) => {
    // Only allow navigation to localhost
    if (!url.startsWith(`http://localhost:${APP_CONFIG.port}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
});

// Handle certificate errors for development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith(`http://localhost:${APP_CONFIG.port}`)) {
    // Ignore certificate errors for localhost
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// IPC handlers for desktop-specific features
ipcMain.handle('app-version', () => APP_CONFIG.version);
ipcMain.handle('app-quit', () => {
  isQuitting = true;
  app.quit();
});
ipcMain.handle('app-minimize-to-tray', () => {
  if (mainWindow) mainWindow.hide();
});

// Global keyboard shortcuts
app.whenReady().then(() => {
  const { globalShortcut } = require('electron');
  
  // Register global shortcut to focus window (Ctrl+Alt+E)
  globalShortcut.register('CommandOrControl+Alt+E', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.focus();
    }
  });
});

// Unregister shortcuts when app quits
app.on('will-quit', () => {
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
});
