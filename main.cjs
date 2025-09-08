// main.js - Electron main process
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

// Start the Express server
function startServer() {
  console.log('Starting ExaMark server...');
  
  serverProcess = spawn('node', ['app.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' }
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });
  
  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
    if (code !== 0 && !app.isQuitting) {
      console.log('Server crashed, attempting restart...');
      setTimeout(startServer, 2000); // Restart after 2 seconds
    }
  });
}

function createWindow() {
  // Create the browser window
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
      webSecurity: true
    },
    titleBarStyle: 'default',
    show: false // Don't show until ready
  });

  // Wait for server to start, then load the app
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:8080');
  }, 3000); // Give server 3 seconds to start

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Focus on the window
    if (process.platform === 'darwin') {
      app.dock.show();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  // Set up menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'ExaMark',
      submenu: [
        {
          label: 'About ExaMark',
          click: () => {
            // You can add an about dialog here
          }
        },
        { type: 'separator' },
        {
          label: 'Quit ExaMark',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
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
      label: 'Window',
      submenu: [
        { role: 'minimize' },
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
    }
  });
});

app.on('window-all-closed', () => {
  // Kill server process when app closes
  if (serverProcess) {
    console.log('Gracefully shutting down server...');
    app.isQuitting = true;
    
    // Send SIGTERM for graceful shutdown
    serverProcess.kill('SIGTERM');
    
    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        console.log('Force killing server process...');
        serverProcess.kill('SIGKILL');
      }
    }, 5000);
  }
  
  // On macOS, apps typically stay active until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Clean up server process
  app.isQuitting = true;
  if (serverProcess) {
    console.log('App quitting - shutting down server...');
    serverProcess.kill('SIGTERM');
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, url) => {
    event.preventDefault();
    require('electron').shell.openExternal(url);
  });
});
