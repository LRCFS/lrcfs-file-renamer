/*

This is the default configuration options for LRCF File Renamer.

Changing the values here will change the default values that are loaded on first launch.

Any changes by the user are saved to:
"C:\Users\Username\AppData\Roaming\LRCFS File Renamer\config.json"

*/

'use strict';
console.log("Loaded: /config.js");

const Store = require('electron-store');

module.exports = new Store({
	defaults: {
		createCopies: true,
		renamer: '',
		helpLinks: {
			win32: {
				fileExtensions:	'https://www.howtogeek.com/205086/beginner-how-to-make-windows-show-file-extensions/',
				showHiddenFiles:	'https://www.howtogeek.com/howto/windows-vista/show-hidden-files-and-folders-in-windows-vista/',
			},
			darwin: {
				fileExtensions:	'https://support.apple.com/en-gb/guide/mac-help/mchlp2304/mac',
				showHiddenFiles:	'https://www.macworld.co.uk/how-to/show-hidden-files-mac-3520878/',
			}
		}
	}
});
