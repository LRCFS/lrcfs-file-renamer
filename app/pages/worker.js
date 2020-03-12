'use strict';
console.log('worker.js');

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const fs = require('fs');
const path = require('path');

ipcRenderer.on('start-worker-processing', (event, arg) => {
    let payload = arg.payload;
    let metadata = payload.metadata;
    let filenamesNew = payload.filenamesNew;
    let selectedRenamerConfig = payload.selectedRenamerConfig;
    let metadataDirectory = payload.metadataDirectory;
    let outputPath = payload.outputPath;
    let createCopies = payload.createCopies;

    console.log(metadata);
    console.log(filenamesNew);
    console.log(selectedRenamerConfig);
    console.log(metadataDirectory);
    console.log(outputPath);
    console.log(createCopies);
    
    var progressCount = 0;
    for(var i = 0; i < metadata.length; i++)
    {
        var currentFilename = metadata[i][selectedRenamerConfig.metadataCurrentFilenameColumn];
        var newFilename = filenamesNew[i];

        if (createCopies) {
            fs.copyFileSync(path.join(metadataDirectory, currentFilename), path.join(outputPath, newFilename), (err) => {
                if (err) throw err;
                console.log("Copied file:" + currentFilename + "->" + newFilename);
            });
        } else {
            fs.renameSync(path.join(metadataDirectory, currentFilename), path.join(outputPath, newFilename), (err) => {
                if (err) throw err;
                console.log("Renamed file:" + currentFilename + "->" + newFilename);
            });
        }
        progressCount++;
        message2UI('helloMain', { percentage: progressCount/metadata.length});
    }
});

let message2UI = (command, payload) => {
  ipcRenderer.send('update-processing-progress', {
    command: command, payload: payload
  });
}