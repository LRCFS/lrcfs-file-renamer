'use strict';
console.log('Loaded: /app/pages/worker.js');
var showDebug = false;

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const fs = require('fs');
const path = require('path');
const _ = require('underscore');

var metadata;
var newMetadata;
var filenamesNew;
var selectedRenamerConfig;
var metadataDirectory;
var metadataFilename;
var newMetadataColumnNames;
var lineNumberColumnName;
var outputPath;
var createCopies;

var progressCount = 0;
var i = 0;
var stopProcessing = false;

ipcRenderer.on('r2w-CancelWorkerProcessing', (event, arg) => {
    console.log("r2w-CancelWorkerProcessing Received");
    SetStopProcessing(arg);
});

ipcRenderer.on('r2w-StartWorkerProcessing', (event, arg) => {
    console.log("r2w-StartWorkerProcessing - Received");
    StartProcessing(arg);
});

let SendProgressPercentage = (command, payload) => {
    console.log("w2r-UpdateProgressPercentage - Sent");
    ipcRenderer.send('w2r-UpdateProgressPercentage', {
        command: command, payload: payload
    });
}

function SetStopProcessing(arg)
{
    let payload = arg.payload;
    stopProcessing = payload.stop;
    console.log("stopProcessing set to:", stopProcessing);
}

function StartProcessing(arg)
{ 
    let payload = arg.payload;
    metadata = payload.metadata;
    newMetadata = payload.newMetadata;
    filenamesNew = payload.filenamesNew;
    selectedRenamerConfig = payload.selectedRenamerConfig;
    metadataDirectory = payload.metadataDirectory;
    metadataFilename = payload.metadataFilename;
    newMetadataColumnNames = payload.newMetadataColumnNames;
    lineNumberColumnName = payload.lineNumberColumnName;
    outputPath = payload.outputPath;
    createCopies = payload.createCopies;

    //Create the output directory if required
    MakeOutputDir();
    
    //Copy the metadata to the new location with the updated filename columns
    CopyMetadata();

    //Move/copy files to new location with new name
    ProcessFiles();
}


function MakeOutputDir(){
	if(!fs.existsSync(outputPath))
	{
		fs.mkdirSync(outputPath);
	}
}

function CopyMetadata(){
	var outputFile = path.join(outputPath,metadataFilename);

	//Check if the metadata exists and delete it if it does
	//This is probably a bad idea and should be fixed
	if(fs.existsSync(outputFile))
	{
		fs.unlinkSync(outputFile, function(err){
			if(err){
				return console.log(err);
			}
			debugLog('Deleted file: ' + outputFile);
	   });
	}

	//Remove linenumber column from column names list
	var newMetadataColumnNamesToSave = _.without(newMetadataColumnNames, lineNumberColumnName);

    //Add header row to csv writer
    var metadataWriter = newMetadataColumnNamesToSave  + "\n";
	
	//Add each metadata row to csv writer
    var columnCount = 1;
	$.each(newMetadata, function(key, newMetadataItem){
		var line = "";
		var columnCount = 1; //Keep track of the column count and have a varialbe for the seperator so we don't add it on the last element
		var columnSeperator = ",";

		$.each(newMetadataColumnNamesToSave, function(id,columnName){
			if(columnCount == newMetadataColumnNamesToSave.length) columnSeperator = "";
			line += "\"" +newMetadataItem[columnName] + "\"" + columnSeperator;
			columnCount++;
		});
        line += "\n";
        
        //store line in writer
        metadataWriter += line;
    });

    //Write to file
    fs.appendFileSync(outputFile,metadataWriter, function (err) {
        if (err) throw err;
    });
}

function ProcessFiles(){
    stopProcessing = false;
    progressCount = 0;
    i = 0;
    (function step(){

        var currentFilename = metadata[i][selectedRenamerConfig.metadataCurrentFilenameColumn];
        var newFilename = filenamesNew[i];

        if (createCopies) {
            fs.copyFileSync(path.join(metadataDirectory, currentFilename), path.join(outputPath, newFilename), (err) => {
                if (err) throw err;
            });
        } else {
            fs.renameSync(path.join(metadataDirectory, currentFilename), path.join(outputPath, newFilename), (err) => {
                if (err) throw err;
            });
        }
        progressCount++;
        SendProgressPercentage('helloMain', { percentage: progressCount/metadata.length});

        if (i < metadata.length && !stopProcessing)
        {
            i++;
            setImmediate(step);
        }
        else if(stopProcessing)
        {
            SendProgressPercentage('helloMain', { percentage: -1});
        }
    })();
}


function debugLog(message, property, ignoreDebugSetting){
	if(showDebug == true || ignoreDebugSetting == true)
	{
		console.log(message);
		if(property != null)
		{
			console.log(property); 
		}
	}
}