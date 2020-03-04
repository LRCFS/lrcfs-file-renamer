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
const ProgressBar = require('electron-progressbar');
const moment = require('moment');

const config = require('../config');

var renamers;
var selectedRenamerConfig;
var createCopies;

var defaultOutputPath = "./output";
var metadataPath = "";
var metadataDirectory;
var metadataFilename;
var metadataColumnNames;
var metadata;

var newMetadataColumnNames;
var newMetadata;

var filenamesOld = [];
var filenamesNew = [];

var isValidPre;
var validationResults_duplicateColumnName;
var validationResults_currentFilenameColumnDoesNotExist;
var validationResults_missingColumns;

var isValidPost;
var validationResults_currentFileDoesNotExist;
var validationResults_newFilenameExists;
var validationResults_sameCurrentFilename;
var validationResults_sameNewFilename;

class validationResults_typeError{
	dateErrors = [];
	intErrors = [];
	floatErrors = [];
	textErrors = [];
}
var validationResults_typeErrors = new validationResults_typeError();

var outputPath;

(async () => {
	debugger
	await app.whenReady();

	$('#txtOutputDir').val(defaultOutputPath);

	//Bind events
	$("#btnDownloadExampleCsv").click(async function() {
		DownloadExampleCsv();
	});

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
		ScrollToGettingStarted();
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

	$("#btnSelectOutputDir").click(async function () {
		if(SelectOutputDir())
		{
			//If the selected directory has changed
			await ProcessMetadata();
			UpdateDisplay();
		}
	});

	$("#linkScrollToRenamerInfo").click(function (e) {
		e.preventDefault();
		ScrollToRenamerInfo();
	});

	//Bind to modal events to scoll to position
	$('#errorModalPre').on('hidden.bs.modal', function (e) {
		ScrollToErrorListPre();
	})

	//Bind to modal events to scoll to position
	$('#errorModalPost').on('hidden.bs.modal', function (e) {
		ScrollToErrorList();
	})
	

	//Load setup "data"
	await GetRenamers();

	//Make things look nice
	$("#selectRenamer").niceSelect();

	await SetConfigs();

	UpdateDisplay();

})();

function UpdateDisplay(){
	AllowProcessing();
	ShowMetadataTable("htmlout", newMetadataColumnNames, newMetadata);
	ShowOperationsPanel();
	ShowRenamerInfoPanel();
	ShowExampleDataDownload();
	UpdateMetadataPath();
}

function ResetErrors(){
	validationResults_duplicateColumnName = [];
	validationResults_currentFilenameColumnDoesNotExist = false;
	validationResults_missingColumns = [];

	validationResults_currentFileDoesNotExist = [];
	validationResults_newFilenameExists = [];
	validationResults_sameCurrentFilename = [];
	validationResults_sameNewFilename = [];

	validationResults_typeErrors = new validationResults_typeError();
}

async function DownloadExampleCsv()
{
	//Create headers from required filename columns
	var csvHeaders = "";
	var i = 0
	$.each(selectedRenamerConfig.filenameColumns, function (key, filenameColumn) {
		if(i == 0){
			csvHeaders = key;
		}
		else{
			csvHeaders += "," + key;
		}
		i++;
	})
	debugLog("Created CSV Header Row", csvHeaders, true);
	
	//Open a file dialog to ask them where to save to
	var savePath = dialog.showSaveDialogSync({
		title : "Blank Project CSV",
		filters: [
			{ name: 'CSV', extensions: ['csv'] },
			{ name: 'All Files', extensions: ['*'] }
		]
	});
	if(savePath != null)
	{
		fs.writeFileSync(savePath,csvHeaders + "\n", function (err) {
			if (err) throw err;
			debugLog("Error saving file", savePath, true);
		});
	}
}

async function SelectOutputDir()
{
	var outputDir = dialog.showOpenDialogSync({
		title : "Output Directory",
		properties : ['openDirectory', 'createDirectory']
	});
	if(outputDir != null)
	{
		//The selected directory HAS changed
		$('#txtOutputDir').val(outputDir);
		return true;
	}else{
		//The selected directory has not changed
		return false;
	}

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
	$("#renamerMissingDataTag").html(selectedRenamerConfig.missingDataTag);

	$("#renamerColumns").html("");
	$.each(selectedRenamerConfig.filenameColumns, function (key, filenameColumn) {
		var existingText = $("#renamerColumns").html();
		$("#renamerColumns").html(existingText + "<strong>" + key + "</strong>: " + filenameColumn.renameTo + " (" + filenameColumn.type + ")<br />");
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
	if(files != null)
	{
		metadataPath = files[0];
	}

	metadataFilename = path.basename(metadataPath);
}

async function ProcessMetadata(){
	if(metadataPath != null && fs.existsSync(metadataPath))
	{
		var progressBar = new ProgressBar({
			title: 'Loading Metadata',
			text: 'Loading and parsing metadata...',
			detail: 'Please wait...'
		}, app);

		progressBar
			.on('completed', function() {
				console.info(`completed...`);
				progressBar.detail = 'Load completed.';
			})
			.on('aborted', function() {
				console.info(`aborted...`);
			});

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

		progressBar.setCompleted();
	}
}

async function LoadMetadata() {
	metadataDirectory = path.dirname(metadataPath);
	var selectedOutDir = $("#txtOutputDir").val();
	if(selectedOutDir == defaultOutputPath)
	{
		outputPath = path.join(path.dirname(metadataPath), $("#txtOutputDir").val());
	}
	else{
		outputPath = selectedOutDir;
	}
	
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
			//Check if the row has data
			var hasData = false
			$.each(row, function (key,value) {
				if(value)
				{
					hasData = true;
					//Break out of loop with return false
					return false;
				}
			});
			//If it does, then add it
			if(hasData)
			{
				row[lineNumberColumnName] = lineNumber;
				metadata.push(row);
				lineNumber++;
			}
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
	//Check for duplicate column names
	var duplicateHeaderCheck = [];
	$.each(metadataColumnNames, function(i){
		if (duplicateHeaderCheck.indexOf(metadataColumnNames[i]) == -1)
		{
			duplicateHeaderCheck.push(metadataColumnNames[i]);
		}
		else
		{
			validationResults_duplicateColumnName.push(metadataColumnNames[i]);
			debugLog("Duplicate column name", metadataColumnNames[i], true);
		}
	});

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

	var errorsDuplicateColumn = $("#errorsDuplicateColumn");
	errorsDuplicateColumn.html('');
	if(validationResults_duplicateColumnName.length > 0)
	{
		$.each(validationResults_duplicateColumnName, async function (key, value) {
			errorsDuplicateColumn.append("<li>" + value + "</li>");
		})
		$("#errorsDuplicateColumnHeading").show();
		isValidPre = false;
	}
	else{
		$("#errorsDuplicateColumnHeading").hide();
	}

	var errorsMissingFilenameColumn = $("#errorsMissingFilenameColumn");
	errorsMissingFilenameColumn.html('');
	if(validationResults_currentFilenameColumnDoesNotExist)
	{
		errorsMissingFilenameColumn.append("<li>" + selectedRenamerConfig.filenameCurrentColumnName + "</li>");
		$("#errorsMissingFilenameColumnHeading").show();
		isValidPre = false;
	}
	else{
		$("#errorsMissingFilenameColumnHeading").hide();
	}

	var errorsMissingColumns = $("#errorsMissingColumns");
	errorsMissingColumns.html('');
	if(validationResults_missingColumns.length > 0)
	{
		$.each(validationResults_missingColumns, async function (key, value) {
			errorsMissingColumns.append("<li>" + value + "</li>");
		})
		$("#errorsMissingColumnsHeading").show();
		isValidPre = false;
	}
	else{
		$("#errorsMissingColumnsHeading").hide();
	}

	if(!isValidPre)
	{
		$('#errorModalPre').modal('show');
		$('#errorListPre').show();
	}
	else{
		$('#errorListPre').hide();
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
	ValidateTypes();

	ShowHideErrorsPost();
}

function ShowHideErrorsPost(){
	if(validationResults_currentFilenameColumnDoesNotExist == false &&
		validationResults_missingColumns.length == 0 &&

		validationResults_currentFileDoesNotExist.length == 0 &&
		validationResults_newFilenameExists.length == 0 &&
		validationResults_sameCurrentFilename.length == 0 &&
		validationResults_sameNewFilename.length == 0 &&
		
		validationResults_typeErrors.dateErrors.length == 0 &&
		validationResults_typeErrors.intErrors.length == 0 &&
		validationResults_typeErrors.floatErrors.length == 0 &&
		validationResults_typeErrors.textErrors.length == 0)
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

function ValidateTypes(){
	debugLog("Validate Types", "");

	//For each metadata item
	for(var i = 0; i < newMetadata.length; i++)
	{
		//Get all the renamer columns we're interested in
		$.each(selectedRenamerConfig.filenameColumns, function (filenameColumnKey, filenameColumn) {

			//Get the data from that column
			var columnData = newMetadata[i][filenameColumnKey];
			var columnDataType = filenameColumn.type;

			debugLog("'columnData' 'columnDataType'", columnData + " - " + columnDataType);

			if(columnData == selectedRenamerConfig.missingDataTag)
			{
				debugLog("Data is recognised as missing", newMetadata[i]);
			}
			else
			{
				var columnName = filenameColumnKey;
				var columnFormat = filenameColumn.format;
				var rowData = newMetadata[i];
				switch(columnDataType) {
					case "date":
						//Use "moment" to parse date with strict parsing set to true - https://momentjs.com/docs/
						if(!columnData || moment(columnData, columnFormat, true).isValid() == false)
						{
							debugLog("Date is invalid", newMetadata[i]);
							validationResults_typeErrors.dateErrors.push({"columnName": columnName, "columnData": columnData, "columnFormat": columnFormat, "rowData": rowData})		
						}
						break;
					case "int":
						if(!columnData || isNaN(Number(columnData)) && !columnData.includes('.'))
						{
							debugLog("Int is invalid", newMetadata[i]);
							validationResults_typeErrors.intErrors.push({"columnName": columnName, "columnData": columnData, "rowData": rowData})		
						}
						break;
					case "float":
						if(!columnData || isNaN(Number(columnData)))
						{
							debugLog("Float is invalid", newMetadata[i]);
							validationResults_typeErrors.floatErrors.push({"columnName": columnName, "columnData": columnData, "rowData": rowData})		
						}
						break;
					default:
						//assume "text"
						if(!columnData)
						{
							debugLog("Required text feild is missing", newMetadata[i]);
							validationResults_typeErrors.textErrors.push({"columnName": columnName, "columnData": columnData, "rowData": rowData})		
						}
						break;
				}
			}
		});
	}

	debugLog("validationResults_types", validationResults_typeErrors)
}

function GetNewFilename(metdataItem){
	var newFilename = "";

	var i = 0;
	$.each(selectedRenamerConfig.filenameColumns, function (oldPropertyName, newPropertyName) {
		var propertyValue = metdataItem[oldPropertyName];
		if (i != 0) {
			newFilename += selectedRenamerConfig.propertySeperator;
		}
		newFilename += newPropertyName.renameTo + selectedRenamerConfig.valueSeperator + propertyValue;
		//Replace spaces if needed
		newFilename = newFilename.replace(" ", selectedRenamerConfig.replaceSpacesInFilenameWith)
		//Replace invalid filename characters
		newFilename = newFilename.replace(/[\<\>\:\"\/\\\|\?\*]/g, selectedRenamerConfig.replaceInvalidCharactersInFilenameWith)
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

function AllowProcessing(forceStatus = null){
	//if we've set a status then we want to force it
	if(forceStatus != null)
	{
		if(forceStatus)
		{
			$('#btnRename').removeAttr('disabled');
			$('#btnRenameBottom').removeAttr('disabled');
		}
		else{
			$('#btnRename').attr('disabled','disabled');
			$('#btnRenameBottom').attr('disabled','disabled');
		}
	}
	//Else, try and work out what status it should be
	else
	{
		if(isValidPost && isValidPre){
			ScrollToOperations();
			$('#btnRename').removeAttr('disabled');
			$('#btnRenameBottom').removeAttr('disabled');
		}
		else
		{
			$('#btnRename').attr('disabled','disabled');
			$('#btnRenameBottom').attr('disabled','disabled');
		}
	}
}

function ShowOperationsPanel(){
	if($('#selectRenamer').prop('selectedIndex') != 0)
	{
		$('#operations').show();
	}else{
		$('#operations').hide();
	}
}

function ShowRenamerInfoPanel(){
	if($('#selectRenamer').prop('selectedIndex') != 0)
	{
		$('#renamerInfo').show();
	}else{
		$('#renamerInfo').hide();
	}
}

function ShowExampleDataDownload()
{
	if($('#selectRenamer').prop('selectedIndex') != 0)
	{
		$('#exampleDataDownload').show();
	}else{
		$('#exampleDataDownload').hide();
	}
}

function UpdateMetadataPath()
{
	if(metadataPath != null && metadataPath.length > 0)
	{
		$('#selectedMetadataPath').show();
		$('#selectedMetadataPath').val(metadataPath);
	}else{
		$('#selectedMetadataPath').hide();
	}
	
}

function ShowValidation(){
	//add folder text to error messages
	$('#errorFilesMissingFolder').html(metadataDirectory);
	$('#errorOutputFolder').html(outputPath);
	$('#errorEmptyData').html(selectedRenamerConfig.missingDataTag)

	$('#errorFilesMissing').hide();
	errorFilesMissing
	var errorList = $('#e1');
	errorList.html('');
	$.each(validationResults_currentFileDoesNotExist, function (key, item) {
		errorList.append("<li><strong>Line " + item[lineNumberColumnName] + ":</strong> " + item[selectedRenamerConfig.filenameCurrentColumnName] + "</li>");
		$('#errorFilesMissing').show();
	})

	$('#errorFilenameExists').hide();
	var errorList = $('#e2');
	errorList.html('');
	$.each(validationResults_newFilenameExists, function (key, item) {
		errorList.append("<li><strong>Line " + item[lineNumberColumnName] + ":</strong> " + item[selectedRenamerConfig.filenameNewColumnName] + "</li>");
		$('#errorFilenameExists').show();
	})

	$('#errorSameCurrentFilename').hide();
	errorList = $('#e3');
	errorList.html('');
	$.each(validationResults_sameCurrentFilename, function (key, item) {
		var string = "";
		$.each(item, function (key, subitem) {
			string += "<strong>Line " + subitem[lineNumberColumnName] + ":</strong> " + subitem[selectedRenamerConfig.filenameCurrentColumnName] + "<br />";
		})
		errorList.append("<li>" + string + "</li>");
		$('#errorSameCurrentFilename').show();
	})

	$('#errorSameNewFilename').hide();
	errorList = $('#e4');
	errorList.html('');
	$.each(validationResults_sameNewFilename, function (key, item) {
		var string = "";
		$.each(item, function (key, subitem) {
			string += "<strong>Line " + subitem[lineNumberColumnName] + ":</strong> " + subitem[selectedRenamerConfig.filenameNewColumnName] + "<br />";
		})
		errorList.append("<li>" + string + "</li>");
		$('#errorSameNewFilename').show();
	})

	//Type errors

	$('#errorText').hide();
	errorList = $('#eText');
	errorList.html('');
	$.each(validationResults_typeErrors.textErrors, function (key, item) {
		var string = "";
		errorList.append("<li><strong>Line " + item.rowData[lineNumberColumnName] + ":</strong> '" + item.columnName + "' is required</li>");
		$('#errorText').show();
	})

	$('#errorDate').hide();
	errorList = $('#eDate');
	errorList.html('');
	$.each(validationResults_typeErrors.dateErrors, function (key, item) {
		var string = "";
		errorList.append("<li><strong>Line " + item.rowData[lineNumberColumnName] + ":</strong> " + item.columnName + ": '" + item.columnData + "' does not match format '" + item.columnFormat + "'</li>");
		$('#errorDate').show();
	})

	$('#errorInt').hide();
	errorList = $('#eInt');
	errorList.html('');
	$.each(validationResults_typeErrors.intErrors, function (key, item) {
		var string = "";
		errorList.append("<li><strong>Line " + item.rowData[lineNumberColumnName] + ":</strong> " + item.columnName + ": '" + item.columnData + "' is not a valid integer</li>");
		$('#errorInt').show();
	})

	$('#errorFloat').hide();
	errorList = $('#eFloat');
	errorList.html('');
	$.each(validationResults_typeErrors.floatErrors, function (key, item) {
		var string = "";
		errorList.append("<li><strong>Line " + item.rowData[lineNumberColumnName] + ":</strong> " + item.columnName + ": '" + item.columnData + "' is not a valid float</li>");
		$('#errorFloat').show();
	})
}


function StartProcessing() {

	var progressBar = new ProgressBar({
		indeterminate: false,
        title: 'Saving Files',
		text: 'Renaming your files...',
		detail: 'Please wait...',
		maxValue: metadata.length
	});

	progressBar
		.on('completed', function() {
			console.info(`completed...`);
			progressBar.detail = 'Task completed. Exiting...';
		})
		.on('aborted', function(value) {
			console.info(`aborted... ${value}`);
		})
		.on('progress', function(value) {
			progressBar.detail = `Completed ${value} out of ${progressBar.getOptions().maxValue}...`;
		});


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

		if(!progressBar.isCompleted()){
			progressBar.value += 1;
		}
	}

	progressBar.setCompleted();
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

	if(data != null && isValidPre)
	{
		$('#results').show();
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
	else{
		$('#results').hide();
	}
}

/*Scroll to functions*/
function ScrollToGettingStarted()
{
	ScrollToElement('gettingStarted');
}

function ScrollToOperations()
{
	ScrollToElement('operations');
}

function ScrollToRenamerInfo()
{
	ScrollToElement('renamerInfo');
}

function ScrollToErrorListPre()
{
	ScrollToElement('errorListPre');
}

function ScrollToErrorList()
{
	ScrollToElement('errorLists');
}

function ScrollToElement(elementId)
{
	document.getElementById(elementId).scrollIntoView({ behavior:'smooth'});
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

