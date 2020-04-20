'use strict';
console.log('Loaded: /main.js');
var showDebug = false;

const path = require('path');
const {app, BrowserWindow, Menu, ipcMain} = require('electron');
/// const {autoUpdater} = require('electron-updater');
const {is} = require('electron-util');
const unhandled = require('electron-unhandled');
const debug = require('electron-debug');
const contextMenu = require('electron-context-menu');
const config = require('./app/config');
const menu = require('./app/controllers/menu');

unhandled();
//debug();
contextMenu();


// Note: Must match `build.appId` in package.json
app.setAppUserModelId('com.company.AppName');

// Uncomment this before publishing your first version.
// It's commented out as it throws an error if there are no published versions.
// if (!is.development) {
// 	const FOUR_HOURS = 1000 * 60 * 60 * 4;
// 	setInterval(() => {
// 		autoUpdater.checkForUpdates();
// 	}, FOUR_HOURS);
//
// 	autoUpdater.checkForUpdates();
// }

// Prevent window from being garbage collected
let mainWindow, workerWindow;

//Function to create and configure the main main
const createMainWindow = async () => {
	const win = new BrowserWindow({
		title: app.getName(),
		show: false,
		width: 1250,
		height: 850,
		webPreferences: {
			nodeIntegration: true
		}
	});

	win.on('ready-to-show', () => {
		win.show();
	});

	win.on('closed', () => {
		// Dereference the window
		// For multiple windows store them in an array
		mainWindow = undefined;
	});

	await win.loadFile(path.join(__dirname, '/app/pages/index.html'));

	return win;
};

//Function to definte and create the worker window (used for the renaming process)
const createWorkerWindow = async () => {
	// create hidden worker window
	const win = new BrowserWindow({
		show: false,
		webPreferences: { nodeIntegration: true }
	});

	win.on('ready-to-show', () => {
		//win.show();
	});

	win.on('closed', () => {
		// Dereference the window
		// For multiple windows store them in an array
		workerWindow = undefined;
	});
	await win.loadFile(path.join(__dirname, '/app/pages/worker.html'));

	return win;
};





(async () => {
	//Wait for app to be ready
	await app.whenReady();

	//Assign main menu
	if(showDebug)
	{
		Menu.setApplicationMenu(menu)
	}
	else
	{
		Menu.setApplicationMenu(null);
	}
	
	//Create windows
	mainWindow = await createMainWindow();
	workerWindow = await createWorkerWindow();

	//Register listeners for sending data between windows
	ipcMain.on('w2r-UpdateProgressPercentage', (event, arg) => {
		sendWindowMessage(mainWindow, 'w2r-UpdateProgressPercentage', arg);
	});
	ipcMain.on('r2w-StartWorkerProcessing', (event, arg) => {
		sendWindowMessage(workerWindow, 'r2w-StartWorkerProcessing', arg);
	});
	ipcMain.on('r2w-CancelWorkerProcessing', (event, arg) => {
		console.log("r2w-CancelWorkerProcessing");
		sendWindowMessage(workerWindow, 'r2w-CancelWorkerProcessing', arg);
	});

})();

//If all windows are closed, then quite the application
app.on('window-all-closed', () => {
	app.quit();
});

//If you reactive the application then recreate if needed
app.on('activate', async () => {
	if (!mainWindow) {
		mainWindow = await createMainWindow();
	}
	if (!workerWindow) {
		workerWindow = await createWorkerWindow();
	}
});

//If there's a second instance of the appliction then restore if minimized
app.on('second-instance', () => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}

		mainWindow.show();
	}
});

//helper function used to send messages between windows
function sendWindowMessage(targetWindow, message, payload) {
	if(typeof targetWindow === 'undefined') {
		console.log('Target window does not exist');
		return;
	}
	targetWindow.webContents.send(message, payload);
}
