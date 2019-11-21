'use strict';
var debug = false;

var lineNumberColumnName = 'Line&nbsp;No.&nbsp;';

debugLog("'Index.js' - Loaded index.js");

const { app, dialog } = require('electron').remote;
const XLSX = require('xlsx');
const csv = require('csv-parser');
const stripBomStream = require('strip-bom-stream');
const fs = require('fs');
const path = require('path')
const _ = require('underscore');
const {parse} = require('json2csv');

const config = require('../config');

var renamers;
var selectedRenamerConfig;
var createCopies;

var metadataPath;
var metadataDirectory;
var metadataFilename;
var metadataColumnNames;
var metadata;

var newMetadataColumnNames;
var newMetadata;

var filenamesOld = [];
var filenamesNew = [];

var isValidPre;
var validationResults_currentFilenameColumnDoesNotExist;
var validationResults_missingColumns;

var isValidPost;
var validationResults_currentFileDoesNotExist;
var validationResults_newFilenameExists;
var validationResults_sameCurrentFilename;
var validationResults_sameNewFilename;
var outputPath;

(async () => {
	debugger
	await app.whenReady();

	//Bind events
	$("#btnFileSelect").click(async function() {
		OpenFileDialog();
		await ProcessMetadata();
		UpdateDisplay();
	});

	$("#btnRefershMetadata").click(async function() {
		await ProcessMetadata();
		UpdateDisplay();
	});

	$("#selectRenamer").change(async function () {
		SaveSelectedRenamer($("#selectRenamer option:selected").text());
		UpdateSelectedRenamer($("#selectRenamer").val());
		await ProcessMetadata();
		UpdateDisplay();
	});

	$("#chkCreateCopies").change(async function () {
		SaveCreateCopies($("#chkCreateCopies").is(":checked"));
		UpdateCreateCopies($("#chkCreateCopies").is(":checked"));
		await ProcessMetadata();
		UpdateDisplay();
	});

	$("#btnRename").click(async function () {
		$('#btnRename').attr('disabled','disabled');
		StartProcessing();
		$('#successModal').modal('show');
	});

	//Load setup "data"
	await GetRenamers();

	//Make things look nice
	$("#selectRenamer").niceSelect();

	await SetConfigs();

})();

function UpdateDisplay(){
	AllowProcessing();
	ShowMetadataTable("htmlout", newMetadataColumnNames, newMetadata);
}

function ResetErrors(){
	validationResults_currentFilenameColumnDoesNotExist = false;
	validationResults_missingColumns = []

	validationResults_currentFileDoesNotExist = [];
	validationResults_newFilenameExists = [];
	validationResults_sameCurrentFilename = [];
	validationResults_sameNewFilename = [];
}

async function GetRenamers()
{
	/*Check if there's a renamers file next to the executable*/
	var renamersFilename = "renamers.json";
	var renamersPath = "";
	var internalRenamersPath = path.join(__dirname, '../', renamersFilename);
	debugLog("'GetRenamers' - 'internalRenamersPath'...", internalRenamersPath);

	debugLog("'GetRenamers' - 'process.env.INIT_CWD'...", process.env.INIT_CWD);
	debugLog("'GetRenamers' - 'process.env.PORTABLE_EXECUTABLE_FILE'...", process.env.PORTABLE_EXECUTABLE_FILE);
	debugLog("'GetRenamers' - 'app.getPath('exe')'...", app.getPath('exe'));
	debugLog("'GetRenamers' - 'process.execPath'...", process.execPath);

	var externalRenamersPath = ""
	var isWin = process.platform === "win32";
	//If it's windows
	if(isWin)
	{
		//If it's a built application then use the process.env.PORTABLE_EXECUTABLE_FILE
		if(process.env.PORTABLE_EXECUTABLE_FILE != undefined)
		{
			externalRenamersPath = path.join(path.dirname(process.env.PORTABLE_EXECUTABLE_FILE), renamersFilename)
		}
		//Else, we're still developing/debugging so just ignore and set to null value so we use the internal file
		else{
			externalRenamersPath = null;
		}
	}
	else{
		//If we're not using windows then do app.getPath('exe')
		if(app.getPath('exe') != undefined)
		{
			externalRenamersPath = path.join(path.dirname(app.getPath('exe')), renamersFilename)
		}
		else{
			externalRenamersPath = null
		}
		
	}
	debugLog("'GetRenamers' - 'externalRenamersPath'...", externalRenamersPath);

	//If we find an external renamer then use that, otherwise use the built in renamer
	if(externalRenamersPath == null || !fs.existsSync(externalRenamersPath)){
		renamersPath = internalRenamersPath;
	}
	else{
		renamersPath = externalRenamersPath;
	}

	var configRenamer = config.get('renamer');
	let dropdown = $('#selectRenamer');

	dropdown.empty();
	dropdown.append('<option selected="true" disabled>Select renamer configuration...</option>');
	dropdown.prop('selectedIndex', 0);

	renamers = await LoadRenamersJson(renamersPath);

	$.each(renamers, function (key, renamer) {
		var dropdownOption = $('<option></option>').attr('value', key).text(renamer.name);
		if (renamer.name == configRenamer) {
			dropdownOption.attr('selected', 'selected');
			UpdateSelectedRenamer(key);
		}
		dropdown.append(dropdownOption);
	})
}

function LoadRenamersJson(renamersFilePath) {
	return new Promise((resolve, reject) => {
		$.getJSON({
			url: renamersFilePath,
			success(renamers) {
				resolve(renamers)
			},
			error: reject,
		})
	})
}

function UpdateSelectedRenamer(renamerId) {
	selectedRenamerConfig = renamers[renamerId];

	$("#renamerName").html(selectedRenamerConfig.name);
	$("#renamerDesc").html(selectedRenamerConfig.description);
	$("#renamerUrl").attr('href',selectedRenamerConfig.url);
	$("#renamerFilenameCurrentColumnName").html(selectedRenamerConfig.filenameCurrentColumnName);
	$("#renamerFilenameOldColumnName").html(selectedRenamerConfig.filenameOldColumnName);
	$("#renamerFilenameNewColumnName").html(selectedRenamerConfig.filenameNewColumnName);
	$("#renamerValueSeperator").html(selectedRenamerConfig.valueSeperator);
	$("#renamerPropertySeperator").html(selectedRenamerConfig.propertySeperator);
	$("#renamerTrimHeadersAndData").html(selectedRenamerConfig.trimHeadersAndData);

	$("#renamerColumns").html("");
	$.each(selectedRenamerConfig.filenameColumns, function (key, filenameColumn) {
		var existingText = $("#renamerColumns").html();
		$("#renamerColumns").html(existingText + key + ": " + filenameColumn + "<br />");
	})

	debugLog("'UpdateSelectedRenamer' - 'selectedRenamerConfig'...", selectedRenamerConfig);
}

function OpenFileDialog(){
	var files = dialog.showOpenDialogSync({
		title: 'Select a file',
		filters: [{
			name: "Spreadsheets",
			extensions: "csv".split("|")
		}],
		properties: ['openFile']
	});
	metadataPath = files[0];
	metadataFilename = path.basename(metadataPath);
}

async function ProcessMetadata(){
	ResetErrors();
	if (metadataPath !== undefined) {
		await LoadMetadata();
		await ValidateMetadataPre();
		if(isValidPre)
		{
			await StoreCurrentFilenames();
			await GenerateNewFilenames();
			await GenerateNewMetadata();
			ValidateMetadataPost();
		}
		ShowValidation();
	}
}

async function LoadMetadata() {
	metadataDirectory = path.dirname(metadataPath);
	outputPath = path.join(path.dirname(metadataPath), $("#txtOutputDir").val());
	var fileExtension = path.extname(metadataPath);

	if (fileExtension == ".csv") {
		await LoadMetadataCsv();
	} else {
		//LoadMetadataExcel();
	}
}

async function LoadMetadataCsv() {
	var lineNumber = 2;
	metadataColumnNames = [];
	metadata = [];
	return new Promise((loadedData) => {
		fs.createReadStream(metadataPath, { encoding: 'utf8' })
		.pipe(stripBomStream())
		.pipe(csv())
		.on('headers', (headers) => {
			metadataColumnNames = headers;
		  })
		.on('data', (row) => {
			row[lineNumberColumnName] = lineNumber;
			metadata.push(row);
			lineNumber++;
		})
		.on('end', () => {
			if(selectedRenamerConfig.trimHeadersAndData)
			{
				metadataColumnNames = metadataColumnNames.map(e => e.trim()); //trim whitespace from header rows
				metadata = JSON.parse(JSON.stringify(metadata).replace(/"\s+|\s+"/g, '"')); //trim whitespace from data rows
			}
			debugLog("'LoadMetadataCsv' - 'metadataColumnNames'...", metadataColumnNames);
			debugLog("'LoadMetadataCsv' - 'metadata'...", metadata);
			debugLog("CSV file successfully processed");
			loadedData("csv");
		});
	})
}

function trimStrings(key, value) {
	if (typeof value === 'string') {
	  return value.trim();
	}
	
	return value;
  }

async function ValidateMetadataPre(){
	//Check for filename column
	validationResults_currentFilenameColumnDoesNotExist = !CheckColumnExists(selectedRenamerConfig.filenameCurrentColumnName);
	debugLog("'ValidateMetadataPre' - 'validationResults_currentFilenameColumnDoesNotExist'...", validationResults_currentFilenameColumnDoesNotExist);

	//Check for renamer columns
	validationResults_missingColumns = [];
	$.each(selectedRenamerConfig.filenameColumns, function (key) {
		if(!CheckColumnExists(key))
		{
			validationResults_missingColumns.push(key);
		}
	})
	debugLog("'ValidateMetadataPre' - 'validationResults_missingColumns'...", validationResults_missingColumns);

	ShowHideErrorsPre();
}

function CheckColumnExists(columnName){
	if(_.contains(metadataColumnNames, columnName))
	{
		return(true);
	}else{
		return(false);
	}
}

function ShowHideErrorsPre(){
	isValidPre = true;

	var errorsMissingFilenameColumn = $("#errorsMissingFilenameColumn");
	errorsMissingFilenameColumn.html('');
	if(validationResults_currentFilenameColumnDoesNotExist)
	{
		errorsMissingFilenameColumn.append("<li>" + selectedRenamerConfig.filenameCurrentColumnName + "</li>");
		isValidPre = false;
	}

	var errorsMissingColumns = $("#errorsMissingColumns");
	errorsMissingColumns.html('');
	if(validationResults_missingColumns.length > 0)
	{
		$.each(validationResults_missingColumns, async function (key, value) {
			errorsMissingColumns.append("<li>" + value + "</li>");
		})
		isValidPre = false;
	}

	if(!isValidPre)
	{
		$('#errorModalPre').modal('show');
	}
}

async function StoreCurrentFilenames(){
	filenamesOld = [];
	$.each(metadata, function (key, metadataItem) {
		filenamesOld.push(metadataItem[selectedRenamerConfig.filenameCurrentColumnName]);
	})
	debugLog("'StoreCurrentFilenames' - Current filenames stored in 'filenamesOld'...", filenamesOld);
}

async function GenerateNewFilenames() {
	filenamesNew = [];
	$.each(metadata, function (key, metadataItem) {
		filenamesNew.push(GetNewFilename(metadataItem));
	})
	debugLog("'GenerateNewFilenames' - New filenames generates and stored in 'filenamesNew'...", filenamesNew);
}

async function GenerateNewMetadata(){
	//Generate new metadata colun names
	//###################################
	var newFilenameColumnNames = [lineNumberColumnName];

	//Add on the column for the new filename
	newFilenameColumnNames.push(selectedRenamerConfig.filenameNewColumnName);

	//If we're going to store the old filename then add that column
	if(StoreOldFilename())
	{
		newFilenameColumnNames.push(selectedRenamerConfig.filenameOldColumnName);
	}

	//Get all the old columns without the filename
	var oldMetadataColumnNames = _.without(metadataColumnNames, selectedRenamerConfig.filenameCurrentColumnName);
	//Addd it to the new column names array
	newMetadataColumnNames = newFilenameColumnNames.concat(oldMetadataColumnNames);

	debugLog("'GenerateNewMetadata' - New metdata column names 'newMetadataColumnNames'...", newMetadataColumnNames);


	//Generate the new metadata
	//###################################
	newMetadata = [];

	//For each row in the metadata
	var metadataRowNum;
	for(metadataRowNum = 0; metadataRowNum < metadata.length; metadataRowNum++)
	{
		var newMetadataRow = [];
		newMetadataRow[lineNumberColumnName] = metadataRowNum + 2;

		//Add on the filename column data
		newMetadataRow[selectedRenamerConfig.filenameNewColumnName] = filenamesNew[metadataRowNum];

		//Add the old filename if we're saving it
		if(StoreOldFilename())
		{
			newMetadataRow[selectedRenamerConfig.filenameOldColumnName] = filenamesOld[metadataRowNum];
		}

		//Add the old data for each of the column names we found above (i.e. minus the filename column)
		_.each(oldMetadataColumnNames, function(metadataColumnName){
			var rowData = metadata[metadataRowNum][metadataColumnName];
			if(rowData == undefined)
			{
				rowData = "";
			}
			newMetadataRow[metadataColumnName] = rowData;
			//newMetadataRow.push(metadata[metadataRowNum][metadataColumnName])
		});

		newMetadata.push(newMetadataRow);
	}

	debugLog("'GenerateNewMetadata' - New metadata ready for saving 'newMetadata'...", newMetadata);
}

function ValidateMetadataPost() {
	ValidateCurrentFilenameExists();
	ValidateNewFilenameExists();
	ValidateSameCurrentFilename();
	ValidateSameNewFilename();

	ShowHideErrorsPost();
}

function ShowHideErrorsPost(){
	if(validationResults_currentFilenameColumnDoesNotExist == false &&
		validationResults_missingColumns.length == 0 &&

		validationResults_currentFileDoesNotExist.length == 0 &&
		validationResults_newFilenameExists.length == 0 &&
		validationResults_sameCurrentFilename.length == 0 &&
		validationResults_sameNewFilename.length == 0)
		{
			isValidPost = true;
			$('#errorLists').hide();
		}
		else{
			isValidPost = false;
			$('#errorLists').show();
			$('#errorModalPost').modal('show');
		}
}

function ValidateCurrentFilenameExists() {
	validationResults_currentFileDoesNotExist = [];
	$.each(metadata, function (key, metadataItem) {
		var currentFilePath = path.join(metadataDirectory, metadataItem[selectedRenamerConfig.filenameCurrentColumnName]);
		debugLog("'ValidateCurrentFilenameExists' - Path to check 'currentFilePath'...", currentFilePath);
		var fileExists = fs.existsSync(currentFilePath);
		if (!fileExists) {
			validationResults_currentFileDoesNotExist.push(metadataItem);
		}
	})
	debugLog("'ValidateCurrentFilenameExists' - 'validationResults_currentFileDoesNotExist'...'", validationResults_currentFileDoesNotExist);
}

function ValidateNewFilenameExists() {
	validationResults_newFilenameExists = [];
	for(var i = 0; i < newMetadata.length; i++)
	{
		var newFilePath = path.join(outputPath, newMetadata[i][selectedRenamerConfig.filenameNewColumnName]);
		debugLog("'ValidateNewFilenameExists' - Path to check 'newFilePath'...", newFilePath);
		var fileExists = fs.existsSync(newFilePath);
		if (fileExists) {
			validationResults_newFilenameExists.push(newMetadata[i]);
		}
	}
	debugLog("'ValidateNewFilenameExists' - 'validationResults_newFilenameExists'...'", validationResults_newFilenameExists);
}

function ValidateSameCurrentFilename() {
	validationResults_sameCurrentFilename = _.groupBy(metadata, selectedRenamerConfig.filenameCurrentColumnName);

	//Because we're only interested in old filenames that occur more than once, filter to only include those with more than one result
	validationResults_sameCurrentFilename = _.filter(validationResults_sameCurrentFilename, function (item) { return item.length > 1; });

	debugLog("'ValidateSameCurrentFilename' - 'validationResults_sameCurrentFilename'...'", validationResults_sameCurrentFilename);
}

function ValidateSameNewFilename() {
	validationResults_sameNewFilename = _.groupBy(newMetadata, selectedRenamerConfig.filenameNewColumnName);

	//Because we're only interested in new filenames that occur more than once, filter to only include those with more than one result
	validationResults_sameNewFilename = _.filter(validationResults_sameNewFilename, function (item) { return item.length > 1; });

	debugLog("'ValidateSameNewFilename' - 'validationResults_sameNewFilename'...'", validationResults_sameNewFilename);
}

function GetNewFilename(metdataItem){
	var newFilename = "";

	var i = 0;
	$.each(selectedRenamerConfig.filenameColumns, function (oldPropertyName, newPropertyName) {
		var propertyValue = metdataItem[oldPropertyName];
		if (i != 0) {
			newFilename += selectedRenamerConfig.propertySeperator;
		}
		newFilename += newPropertyName + selectedRenamerConfig.valueSeperator + propertyValue;
		newFilename = newFilename.replace(" ", selectedRenamerConfig.replaceSpacesInFilenameWith)
		i++
	})

	//Get extension from old file name and add it on the end
	newFilename += path.extname(metdataItem[selectedRenamerConfig.filenameCurrentColumnName]);

	return (newFilename);
}

function StoreOldFilename(){
	return !selectedRenamerConfig.filenameOldColumnName == "";
}

function SaveSelectedRenamer(value)
{
	config.set('renamer', value);
	debugLog("'SaveSelectedRenamer' - 'renamer': " + config.get('renamer'));
}

async function SetConfigs() {
	UpdateCreateCopies(config.get('createCopies'));
	if (!config.get('createCopies')) {
		$('#chkCreateCopies').bootstrapToggle('off');
	}
}

function UpdateCreateCopies(value) {
	createCopies = value;
	debugLog("'UpdateCreateCopies' - 'createCopies': " + createCopies);
}

function SaveCreateCopies(value) {
	config.set('createCopies', value);
	debugLog("'SaveCreateCopies' - 'config.get('createCopies')': " + config.get('createCopies'));
}

function AllowProcessing(){
	if(isValidPost){
		$('#btnRename').removeAttr('disabled');
	}else{
		$('#btnRename').attr('disabled','disabled');
	}
}

function ShowValidation(){

	var errorList = $('#e1');
	errorList.html('');
	$.each(validationResults_currentFileDoesNotExist, function (key, item) {
		errorList.append("<li><strong>" + item[lineNumberColumnName] + ":</strong> " + item[selectedRenamerConfig.filenameCurrentColumnName] + "</li>");
	})

	var errorList = $('#e2');
	errorList.html('');
	$.each(validationResults_newFilenameExists, function (key, item) {
		errorList.append("<li><strong>" + item[lineNumberColumnName] + ":</strong> " + item[selectedRenamerConfig.filenameNewColumnName] + "</li>");
	})

	errorList = $('#e3');
	errorList.html('');
	$.each(validationResults_sameCurrentFilename, function (key, item) {
		var string = "";
		$.each(item, function (key, subitem) {
			string += "<strong>" + subitem[lineNumberColumnName] + ":</strong> " + subitem[selectedRenamerConfig.filenameCurrentColumnName] + "<br />";
		})
		errorList.append("<li>" + string + "</li>");
	})

	errorList = $('#e4');
	errorList.html('');
	$.each(validationResults_sameNewFilename, function (key, item) {
		var string = "";
		$.each(item, function (key, subitem) {
			string += "<strong>" + subitem[lineNumberColumnName] + ":</strong> " + subitem[selectedRenamerConfig.filenameNewColumnName] + "<br />";
		})
		errorList.append("<li>" + string + "</li>");
	})
}


function StartProcessing() {
	//Create the output directory if required
	MakeOutputDir();

	//Copy the metadata file to new output location
	CopyMetadata();

	//Copy/rename every file
	for(var i = 0; i < metadata.length; i++)
	{
		var currentFilename = metadata[i][selectedRenamerConfig.filenameCurrentColumnName];
		var newFilename = filenamesNew[i];

		if (createCopies) {
			fs.copyFileSync(path.join(metadataDirectory, currentFilename), path.join(outputPath, newFilename), (err) => {
				if (err) throw err;
				debugLog("Copied file:" + currentFilename + "->" + newFilename);
			});
		} else {
			fs.renameSync(path.join(metadataDirectory, currentFilename), path.join(outputPath, newFilename), (err) => {
				if (err) throw err;
				debugLog("Renamed file:" + currentFilename + "->" + newFilename);
			});
		}
	}
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

	//Add header row to csv
	fs.appendFileSync(outputFile,newMetadataColumnNamesToSave + "\n", function (err) {
		if (err) throw err;
		debugLog('Saved header: ',newMetadataColumnNames);
	});
	
	//Add each metadata row to csv
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

		//write line to file
		fs.appendFileSync(outputFile,line, function (err) {
			if (err) throw err;
		});
	});


}

function ShowMetadataTable(elementId, columnNames, data) {

	// Create table
	var table = document.createElement("table");

	// Add header row using the column names
	var tr = table.insertRow(-1);   
	$.each(columnNames, function(id,columnName){
		var th = document.createElement("th");
		th.innerHTML = columnName;
		tr.appendChild(th);
	});    

	// Add data to the table as rows
	//For each row in the metadata
	for (var rowNum = 0; rowNum < data.length; rowNum++) {
		tr = table.insertRow(-1);
		//For each column
		$.each(columnNames, function(id,columnName){
			var tabCell = tr.insertCell(-1);
			tabCell.innerHTML = data[rowNum][columnName];
		});
	}

	// FINALLY ADD THE NEWLY CREATED TABLE WITH JSON DATA TO A CONTAINER.
	var divContainer = document.getElementById(elementId);
	divContainer.innerHTML = "";
	divContainer.appendChild(table);
}

function debugLog(message, property, ignoreDebugSetting){
	if(debug == true || ignoreDebugSetting == true)
	{
		console.log(message);
		if(property != null)
		{
			console.log(property); 
		}
	}
}