console.log("main.js")
'use strict';
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

const createMainWindow = async () => {
	const win = new BrowserWindow({
		title: app.getName(),
		show: false,
		width: 1300,
		height: 1100,
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

app.on('second-instance', () => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}

		mainWindow.show();
	}
});

app.on('window-all-closed', () => {
	app.quit();
});

app.on('activate', async () => {
	if (!mainWindow) {
		mainWindow = await createMainWindow();
	}
	if (!workerWindow) {
		workerWindow = await createWorkerWindow();
	}
});

app.on('ready', async () => {
	ipcMain.on('update-processing-progress', (event, arg) => {
		sendWindowMessage(mainWindow, 'update-processing-progress', arg);
	});
	ipcMain.on('start-worker-processing', (event, arg) => {
		sendWindowMessage(workerWindow, 'start-worker-processing', arg);
	});
});

(async () => {
	await app.whenReady();
	Menu.setApplicationMenu(menu);
	//Set menu to null for published application
	//Menu.setApplicationMenu(null);
	mainWindow = await createMainWindow();
	workerWindow = await createWorkerWindow();
})();



function sendWindowMessage(targetWindow, message, payload) {
	if(typeof targetWindow === 'undefined') {
		console.log('Target window does not exist');
		return;
	}
	targetWindow.webContents.send(message, payload);
}
