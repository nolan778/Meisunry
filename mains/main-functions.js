const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

/* Save data to preferencesData */
function saveAppData() {
  const userDataPath = app.getPath('userData');
  const dataFilePath = path.join(userDataPath, 'appdata.json');
  const serializedData = JSON.stringify(global.preferencesData, null, 2);
  fs.writeFileSync(dataFilePath, serializedData);
}

/* Load preferencesData on disk */
function loadData() {
  const userDataPath = app.getPath('userData');
  const dataFilePath = path.join(userDataPath, 'appdata.json');

  try {
    const fileContents = fs.readFileSync(dataFilePath, 'utf-8');
    const loadedData = JSON.parse(fileContents);
    // Ensure the folder location uses the correct path separator
    if (loadedData.folderLocation) {
      loadedData.folderLocation = path.normalize(loadedData.folderLocation);
    }
    return loadedData;
  } catch (error) {
    /* Default json */
    const baseData = {
      folderLocation: process.platform === 'win32' ? "C:\\" : require('os').homedir(),
      sortMode: "date",
      recursion: 0,
      loadSpeed: 'medium',
    }
    const serializedData = JSON.stringify(baseData, null, 2);
    fs.writeFileSync(dataFilePath, serializedData);
    console.log(`${error}`);
    return baseData;
  }
}

/* Load a folder from a path, save to preferencesData on disk, and refresh browser window */
function loadFolder (browserWindow, selectedFolderPath) {
  console.log('Selected folder:', selectedFolderPath);
  // Normalize the path to use correct separators
  global.preferencesData.folderLocation = path.normalize(selectedFolderPath);
  saveAppData();
  loadIndex(browserWindow);
}

function truncateFilePathToNearestFolder(filePath) {
  if (filePath === `./mains/main.js` || filePath.toLowerCase().includes("meisunry")) {
    return global.preferencesData.folderLocation;
  }

  // Use path.parse to handle paths in a platform-agnostic way
  const parsed = path.parse(filePath);
  
  // If it's a file (has an extension), return its directory
  if (parsed.ext) {
    return parsed.dir + path.sep;
  }
  
  // If it's already a directory, return it with trailing separator
  return filePath + (filePath.endsWith(path.sep) ? '' : path.sep);
}

function loadIndex(browserWindow) {
  const parentDir = path.join(__dirname, '..');
  browserWindow.loadURL(`file://${parentDir}/renderers/index.html`);
}

function refreshGrid (browserWindow) {
  browserWindow.webContents.send('refresh-grid-update'); 
}
module.exports = { saveAppData, truncateFilePathToNearestFolder, loadFolder, loadData, loadIndex, refreshGrid };
