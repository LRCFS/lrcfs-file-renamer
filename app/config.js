/*

This is the default configuration options for LRCF File Renamer.

Changing the values here will change the default values that are loaded on first launch.

Any changes by the user are saved to:
"C:\Users\Username\AppData\Roaming\LRCFS File Renamer\config.json"

*/

'use strict';
console.log("config.js");

const Store = require('electron-store');

module.exports = new Store({
	defaults: {
		favoriteAnimal: '🦄',
		createCopies: true,
		renamer: 'Transfer & Persistance'
	}
});
