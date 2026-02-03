const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1366, // Standard laptop
        height: 768,
        autoHideMenuBar: true, // Skjuler filmeny
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
}

function startPythonBackend() {
    pythonProcess = spawn('python', ['backend/app.py']);
    pythonProcess.stdout.on('data', (data) => console.log(`Python: ${data}`));
    pythonProcess.stderr.on('data', (data) => console.error(`Python Error: ${data}`));
}

app.on('ready', () => {
    startPythonBackend();
    createWindow();
});

app.on('will-quit', () => {
    if (pythonProcess) pythonProcess.kill();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});