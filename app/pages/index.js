'use strict';
console.log('Loaded: /app/pages/index.js');
var showDebug = false;

var lineNumberColumnName = 'Line&nbsp;No.&nbsp;';
var absMinValue = -2147483648; //Limits of MySQL database (signed int)
var absMaxValue = 2147483647;

const { remote, ipcRenderer, shell } = require('electron');
const { app, dialog } = remote;
const XLSX = require('xlsx');
const csv = require('csv-parser');
const stripBomStream = require('strip-bom-stream');
const fs = require('fs');
const path = require('path');
const _ = require('underscore');
const {parse} = require('json2csv');
const moment = require('moment');

const config = require('../config');

var renamers;
var selectedRenamerConfig;
var createCopies;

var defaultOutputPath = "./output";
var metadataPath = "";
var metadataDirectory; //The directory that the metadata is in
var metadataFilename; //The name of the metadata file
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
var validationResults_headerColumsnNotFromattedCorrectly;

var isValidPost;
var validationResults_currentFileDoesNotExist;
var validationResults_extraFileInDirectory;
var validationResults_newFilenameExists;
var validationResults_sameCurrentFilename;
var validationResults_sameNewFilename;

class validationResults_typeError{
	illegalNull = [];
	dateErrors = [];
	intErrors = [];
	floatErrors = [];
	textErrors = [];
	textMaxLengthErrors = [];
}
var validationResults_typeErrors = new validationResults_typeError();

var outputPath;

ipcRenderer.on('w2r-UpdateProgressPercentage', (event, arg) => {
	let payload = arg.payload;
	SetProcessingProgress(payload.percentage)
});

let SendStartProcessing = (command, payload) => {
	ipcRenderer.send('r2w-StartWorkerProcessing', {
		command: command, payload: payload
	});
}

let SendCancelProcessing = (command, payload) => {
	console.log("SendCancelProcessing");
	ipcRenderer.send('r2w-CancelWorkerProcessing', {
		command: command, payload: payload
	});
}

(async () => {
	debugger
	await app.whenReady();

	await debugDelay();

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
		//ScrollToGettingStarted(); // Instead of going straight to getting started lets show the renamer config
		$('#renamerInfoCollapsible').collapse('show');
		ScrollToRenamerInfo();
	});


	$("#showMetadataRequirements").click(function (e) {
		e.preventDefault();
		$('#renamerInfoCollapsible').collapse('show');
		ScrollToRenamerInfo();
	});

	$("#chkCreateCopies").change(async function () {
		SaveCreateCopies($("#chkCreateCopies").is(":checked"));
		UpdateCreateCopies($("#chkCreateCopies").is(":checked"));
		await ProcessMetadata();
		UpdateDisplay();
	});

	$("#btnRename").click(async function () {
		$('#btnRename').attr('disabled','disabled');
		await StartProcessing();
	});

	$("#btnSelectOutputDir").click(async function () {
		if(SelectOutputDir())
		{
			//If the selected directory has changed
			await ProcessMetadata();
			UpdateDisplay();
		}
	});

	$("#btnCancelProcessing").click(async function () {
		CancelProcessing();
	});

	$("#linkScrollToRenamerInfo").click(function (e) {
		e.preventDefault();
		ScrollToRenamerInfo();
	});

	$("#linkScrollToResults").click(function (e) {
		e.preventDefault();
		ScrollToResults();
	});

	//Bind to modal events to scoll to position
	$('#metadataFine').on('hidden.bs.modal', function (e) {
		ScrollToOperations();
	})

	$('#errorModalPre').on('hidden.bs.modal', function (e) {
		ScrollToErrorListPre();
	})

	$('#errorModalPost').on('hidden.bs.modal', function (e) {
		ScrollToErrorList();
	})


	//Bind show project settings to scroll to position after shown
	$('#renamerInfoCollapsible').on('shown.bs.collapse', function (e) {
		ScrollToRenamerInfo();
	})
	

	//Load setup "data"
	await GetRenamers();

	//Make things look nice
	$("#selectRenamer").niceSelect();

	await SetConfigs();

	UpdateDisplay();

})();

function CancelProcessing(){
	SendCancelProcessing('stopWorker', { stop: true });
}

function UpdateDisplay(){
	ShowMetadataTable("htmlout", newMetadataColumnNames, newMetadata);
	ShowOperationsPanel();
	ShowRenamerInfoPanel();
	ShowExampleDataDownload();
	UpdateMetadataPath();
	AllowProcessing();
}

function ResetErrors(){
	validationResults_duplicateColumnName = [];
	validationResults_currentFilenameColumnDoesNotExist = false;
	validationResults_missingColumns = [];
	validationResults_headerColumsnNotFromattedCorrectly = [];

	validationResults_currentFileDoesNotExist = [];
	validationResults_extraFileInDirectory = [];
	validationResults_newFilenameExists = [];
	validationResults_sameCurrentFilename = [];
	validationResults_sameNewFilename = [];

	validationResults_typeErrors = new validationResults_typeError();
}

async function DownloadExampleCsv()
{
	//Create headers from required filename columns
	var csvHeaders = '"' + selectedRenamerConfig.metadataNewFilenameColumn + '"';
	$.each(selectedRenamerConfig.metadataRequiredColumns, function (metadataRequiredColumnName, metadataRequiredColumnProperties) {
		csvHeaders += ',"' + metadataRequiredColumnName + '"';
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
	renamers = await LoadRenamersJson(renamersPath);

	var configRenamer = config.get('renamer');
	let dropdown = $('#selectRenamer');

	dropdown.empty();
	dropdown.append('<option selected="true" disabled>Select project configuration...</option>');
	dropdown.prop('selectedIndex', 0);

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
	$("#renamerMetadataCurrentFilenameColumn").html(selectedRenamerConfig.metadataCurrentFilenameColumn);
	$("#renamerMetadataOldFilenameColumn").html(selectedRenamerConfig.metadataOldFilenameColumn);
	$("#renamerMetadataNewFilenameColumn").html(selectedRenamerConfig.metadataNewFilenameColumn);
	$("#renamerTrimHeadersAndData").html(selectedRenamerConfig.trimHeadersAndData);
	$("#renamerNullDataTag").html("'" + selectedRenamerConfig.nullDataTagDisplay + "'");

	if(selectedRenamerConfig.filenamePropertySeperator != "")
	{
		$("#renamerFilenamePropertySeperator").html("<p><strong><acronym title='The character that will be placed between each property (e.g. EXP1"+selectedRenamerConfig.filenamePropertySeperator+"REP1.ext) in the renamed files'>Property Seperator</acronym>:</strong> " + selectedRenamerConfig.filenamePropertySeperator + "</p>");
	}

	if(selectedRenamerConfig.filenameValueSeperator != "")
	{
		$("#renamerFilenameValueSeperator").html("<p><strong><acronym title='The character that will be placed between each property and it's value (e.g. EXP"+selectedRenamerConfig.filenameValueSeperator+"1.ext) in the renamed files'>Value Seperator</acronym>:</strong> " + selectedRenamerConfig.filenameValueSeperator + "</p>");
	}

	$("#renamerColumns").html("<strong>\"" + selectedRenamerConfig.metadataCurrentFilenameColumn + "\"</strong><br />");

	var exampleFilename = "";
	$.each(selectedRenamerConfig.metadataRequiredColumns, function (requiredColumnName, requiredColumnAttributes) {
		if(exampleFilename != "")
		{
			exampleFilename = exampleFilename + selectedRenamerConfig.filenamePropertySeperator;
		}
		var existingText = $("#renamerColumns").html();
		var renameTo = requiredColumnAttributes.renameTo;
		if(renameTo == null || renameTo == "")
		{
			renameTo = ""
		}
		var canBeNa = "/'" + selectedRenamerConfig.nullDataTagDisplay + "'";
		if(requiredColumnAttributes.allowNull == null || requiredColumnAttributes.allowNull == false)
		{
			canBeNa = "";
		}
		
		if(requiredColumnAttributes.dateFormatJs != null && requiredColumnAttributes.dateFormatJs != "")
		{
			$("#renamerColumns").html(existingText + "<strong>\"" + requiredColumnName + "\"</strong>  (" + requiredColumnAttributes.type + ": e.g. " + requiredColumnAttributes.dateFormatJs + canBeNa + ")<br />");
			exampleFilename = exampleFilename + "<acronym title='" + requiredColumnName + "'>" + renameTo + selectedRenamerConfig.filenameValueSeperator + requiredColumnAttributes.dateFormatJs + "</acronym>";
		}
		else if(requiredColumnAttributes.minValue != null || requiredColumnAttributes.maxValue != null)
		{
			var minValue = absMinValue;
			if(requiredColumnAttributes.minValue != null)
			{
				minValue = requiredColumnAttributes.minValue;
			}
			var maxValue = absMaxValue;
			if(requiredColumnAttributes.maxValue != null)
			{
				maxValue = requiredColumnAttributes.maxValue;
			}

			$("#renamerColumns").html(existingText + "<strong>\"" + requiredColumnName + "\"</strong> (" + requiredColumnAttributes.type + ": " + minValue + " to " + maxValue + canBeNa + ")<br />");

			exampleFilename = exampleFilename + "<acronym title='" + requiredColumnName + "'>" + renameTo + selectedRenamerConfig.filenameValueSeperator + maxValue + "</acronym>";
		}
		else if(requiredColumnAttributes.maxTextLength != null)
		{
			$("#renamerColumns").html(existingText + "<strong>\"" + requiredColumnName + "\"</strong> (" + requiredColumnAttributes.type + ": max " + requiredColumnAttributes.maxTextLength + canBeNa + ")<br />");

			exampleFilename = exampleFilename + "<acronym title='" + requiredColumnName + "'>" + renameTo + selectedRenamerConfig.filenameValueSeperator + "text</acronym>";
		}
		else
		{
			$("#renamerColumns").html(existingText + "<strong>\"" + requiredColumnName + "\"</strong> (" + requiredColumnAttributes.type + canBeNa + ")<br />");

			exampleFilename = exampleFilename + "<acronym title='" + requiredColumnName + "'>" + renameTo + selectedRenamerConfig.filenameValueSeperator + "value</acronym>";
		}
	})



	$("#exampleFilename").html(exampleFilename + ".ext");

	debugLog("'UpdateSelectedRenamer' - 'selectedRenamerConfig'...", selectedRenamerConfig,);
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
		await SetMetdataLoadProgress(2);
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
		await SetMetdataLoadProgress(-1);
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

	await LoadMetadataCsv();
}

async function LoadMetadataCsv() {
	var lineNumber = 2;
	return new Promise((loadedData) => {
		fs.createReadStream(metadataPath, { encoding: 'utf8' })
		.pipe(stripBomStream())
		.pipe(csv())
		.on('headers', (headers) => {
			metadataColumnNames = [];
			metadata = [];
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
			else
			{
				//Add a line number anyway to make sure the increment matches the line in the CSV
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
	validationResults_headerColumsnNotFromattedCorrectly = [];

	var duplicateHeaderCheck = [];
	$.each(metadataColumnNames, async function(i){

		//Check headers don't contain single quotes
		if(!CheckColumnFormattedCorrectly(metadataColumnNames[i]))
		{
			validationResults_headerColumsnNotFromattedCorrectly.push(metadataColumnNames[i]);
		}
		debugLog("'ValidateMetadataPre' - 'validationResults_headerColumsnNotFromattedCorrectly'...", validationResults_headerColumsnNotFromattedCorrectly);

		//Check to find any duplicate headers
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
	validationResults_currentFilenameColumnDoesNotExist = !CheckColumnExists(selectedRenamerConfig.metadataCurrentFilenameColumn);
	debugLog("'ValidateMetadataPre' - 'validationResults_currentFilenameColumnDoesNotExist'...", validationResults_currentFilenameColumnDoesNotExist);

	//Check for renamer columns
	validationResults_missingColumns = [];
	$.each(selectedRenamerConfig.metadataRequiredColumns, function (key) {
		if(!CheckColumnExists(key))
		{
			validationResults_missingColumns.push(key);
		}
	})
	debugLog("'ValidateMetadataPre' - 'validationResults_missingColumns'...", validationResults_missingColumns);

	ShowHideErrorsPre();
}

function CheckColumnFormattedCorrectly(columnName){

	if(columnName.startsWith("'") && columnName.startsWith("'"))
	{
		return false;
	}
	else
	{
		return true;
	}
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
		errorsMissingFilenameColumn.append("<li>" + selectedRenamerConfig.metadataCurrentFilenameColumn + "</li>");
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

	var errorsMalformedColumns = $("#errorsMalformedColumns");
	errorsMalformedColumns.html('');
	if(validationResults_headerColumsnNotFromattedCorrectly.length > 0)
	{
		$.each(validationResults_headerColumsnNotFromattedCorrectly, async function (key, value) {
			errorsMalformedColumns.append("<li>" + value + "</li>");
		})
		$("#errorsMalformedColumnsHeading").show();
		isValidPre = false;
	}
	else{
		$("#errorsMalformedColumnsHeading").hide();
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
		filenamesOld.push(metadataItem[selectedRenamerConfig.metadataCurrentFilenameColumn]);
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
	newFilenameColumnNames.push(selectedRenamerConfig.metadataNewFilenameColumn);

	//If we're going to store the old filename then add that column
	if(StoreOldFilename())
	{
		newFilenameColumnNames.push(selectedRenamerConfig.metadataOldFilenameColumn);
	}

	//Get all the old columns without the filename
	var oldMetadataColumnNames = _.without(metadataColumnNames, selectedRenamerConfig.metadataCurrentFilenameColumn);
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
		var newMetadataRow = new Object();
		newMetadataRow[lineNumberColumnName] = metadata[metadataRowNum][lineNumberColumnName];

		//Add on the filename column data
		newMetadataRow[selectedRenamerConfig.metadataNewFilenameColumn] = filenamesNew[metadataRowNum];

		//Add the old filename if we're saving it
		if(StoreOldFilename())
		{
			newMetadataRow[selectedRenamerConfig.metadataOldFilenameColumn] = filenamesOld[metadataRowNum];
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
	var allFilesInMetadataFolder = fs.readdirSync(metadataDirectory);	

	ValidateCurrentFilenameExists(allFilesInMetadataFolder);
	ValidateErrorExtraFiles(allFilesInMetadataFolder);
	ValidateNewFilenameExists();
	ValidateSameCurrentFilename();
	ValidateSameNewFilename();
	ValidateTypes();

	ShowHideErrorsPost();
}

function ShowHideErrorsPost(){
	if(validationResults_currentFilenameColumnDoesNotExist == false &&
		validationResults_missingColumns.length == 0 &&
		validationResults_headerColumsnNotFromattedCorrectly.length == 0 &&

		validationResults_currentFileDoesNotExist.length == 0 &&
		validationResults_extraFileInDirectory.length == 0 &&
		validationResults_newFilenameExists.length == 0 &&
		validationResults_sameCurrentFilename.length == 0 &&
		validationResults_sameNewFilename.length == 0 &&
		
		validationResults_typeErrors.illegalNull.length == 0 &&
		validationResults_typeErrors.dateErrors.length == 0 &&
		validationResults_typeErrors.intErrors.length == 0 &&
		validationResults_typeErrors.floatErrors.length == 0 &&
		validationResults_typeErrors.textErrors.length == 0 &&
		validationResults_typeErrors.textMaxLengthErrors.length == 0 )
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

function ValidateCurrentFilenameExists(allFilesInMetadataFolder) {
	validationResults_currentFileDoesNotExist = [];

	$.each(metadata, function (key, metadataItem) {
		var currentFilePath = path.join(metadataDirectory, metadataItem[selectedRenamerConfig.metadataCurrentFilenameColumn]);
		debugLog("'ValidateCurrentFilenameExists' - Path to check 'currentFilePath'...", currentFilePath);
		var fileExists = fs.existsSync(currentFilePath);
		if (!fileExists) {
			validationResults_currentFileDoesNotExist.push(metadataItem);
		}
		else{
			var filename = path.basename(currentFilePath);
			if (allFilesInMetadataFolder.indexOf(filename) == -1) {
				validationResults_currentFileDoesNotExist.push(metadataItem);
			}
		}
	})
	debugLog("'ValidateCurrentFilenameExists' - 'validationResults_currentFileDoesNotExist'...'", validationResults_currentFileDoesNotExist);
}

//Verify that every file we can find is included in the metadata
function ValidateErrorExtraFiles(allFilesInMetadataFolder)
{
	validationResults_extraFileInDirectory = [];

	$.each(allFilesInMetadataFolder, function (index, filename) {
		if (filenamesOld.indexOf(filename) == -1 && filename != metadataFilename) {
			debugLog("'ValidateErrorExtraFiles' - Extra file found in metadata directory...", filename);
			validationResults_extraFileInDirectory.push(filename);
		}
	})


}

function ValidateNewFilenameExists() {
	validationResults_newFilenameExists = [];
	for(var i = 0; i < newMetadata.length; i++)
	{
		var newFilePath = path.join(outputPath, newMetadata[i][selectedRenamerConfig.metadataNewFilenameColumn]);
		debugLog("'ValidateNewFilenameExists' - Path to check 'newFilePath'...", newFilePath);
		var fileExists = fs.existsSync(newFilePath);
		if (fileExists) {
			validationResults_newFilenameExists.push(newMetadata[i]);
		}
	}
	debugLog("'ValidateNewFilenameExists' - 'validationResults_newFilenameExists'...'", validationResults_newFilenameExists);
}

function ValidateSameCurrentFilename() {
	validationResults_sameCurrentFilename = _.groupBy(metadata, selectedRenamerConfig.metadataCurrentFilenameColumn);

	//Because we're only interested in old filenames that occur more than once, filter to only include those with more than one result
	validationResults_sameCurrentFilename = _.filter(validationResults_sameCurrentFilename, function (item) { return item.length > 1; });

	debugLog("'ValidateSameCurrentFilename' - 'validationResults_sameCurrentFilename'...'", validationResults_sameCurrentFilename);
}

function ValidateSameNewFilename() {
	validationResults_sameNewFilename = _.groupBy(newMetadata, selectedRenamerConfig.metadataNewFilenameColumn);

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
		$.each(selectedRenamerConfig.metadataRequiredColumns, function (filenameColumnKey, filenameColumn) {

			//Get the data from that column
			var columnData = newMetadata[i][filenameColumnKey];
			var columnDataType = filenameColumn.type;

			debugLog("'columnData' 'columnDataType'", columnData + " - " + columnDataType);

			var rowData = newMetadata[i];
			var columnName = filenameColumnKey;
			var columnDateFormat = filenameColumn.dateFormatJs;
			var columnMaxTextLength = filenameColumn.maxTextLength;
			var columnAllowsNulls = filenameColumn.allowNull;
			var columnMinValue = filenameColumn.minValue;
			var columnMaxValue = filenameColumn.maxValue;
			if(columnMinValue == null)
				columnMinValue = absMinValue;
			if(columnMaxValue == null)
				columnMaxValue = absMaxValue;

			//Check if the column data is the nullDataTag and if it's not allowed to be null
			//OR
			//if the column is empty, the nullDataTag isn't "empty" and it can't be null
			if((columnData.match(selectedRenamerConfig.nullDataTagRegex) && !columnAllowsNulls) ||
				(columnData == "" && selectedRenamerConfig.nullDataTagRegex != "" && !columnAllowsNulls)
			)
			{
				debugLog("Data can not be NULL", newMetadata[i]);
				validationResults_typeErrors.illegalNull.push({"columnName": columnName, "columnData": columnData, "rowData": rowData})
			}
			else
			{
				//Check if the data is null and allowed to be null - if it is we're going to ignore it
				if(!DataIsNullAndIsAllowedToBe(columnData, selectedRenamerConfig.nullDataTagRegex, columnAllowsNulls))
				{
					//else lets check it fits our types
					switch(columnDataType) {
						case "date":
							//Use "moment" to parse date with strict parsing set to true - https://momentjs.com/docs/
							if(!columnData || moment(columnData, columnDateFormat, true).isValid() == false)
							{
								debugLog("Date is invalid", newMetadata[i]);
								validationResults_typeErrors.dateErrors.push({"columnName": columnName, "columnData": columnData, "columnDateFormat": columnDateFormat, "rowData": rowData, "columnAllowsNulls": columnAllowsNulls})		
							}
							break;
						case "int":
							if(!columnData || isNaN(Number(columnData)) || columnData.includes('.') || columnData < columnMinValue || columnData > columnMaxValue)
							{
								debugLog("Int is invalid", newMetadata[i]);
								validationResults_typeErrors.intErrors.push({"columnName": columnName, "columnData": columnData, "rowData": rowData, "columnAllowsNulls": columnAllowsNulls, "columnMinValue": columnMinValue, "columnMaxValue": columnMaxValue})		
							}
							break;
						case "float":
							if(!columnData || isNaN(Number(columnData)))
							{
								debugLog("Float is invalid", newMetadata[i]);
								validationResults_typeErrors.floatErrors.push({"columnName": columnName, "columnData": columnData, "rowData": rowData, "columnAllowsNulls": columnAllowsNulls})	
							}
							break;
						default:
							//assume "text"
							if(!columnData)
							{
								debugLog("Required text feild is missing", newMetadata[i]);
								validationResults_typeErrors.textErrors.push({"columnName": columnName, "columnData": columnData, "rowData": rowData, "columnAllowsNulls": columnAllowsNulls})	
							}
							else if(columnMaxTextLength != null && columnData.length > columnMaxTextLength)
							{
								debugLog("Text feild exceeds maxium length of " + columnMaxTextLength + " characters", newMetadata[i]);
								validationResults_typeErrors.textMaxLengthErrors.push({"columnName": columnName, "columnData": columnData, "columnMaxTextLength": columnMaxTextLength, "rowData": rowData, "columnAllowsNulls": columnAllowsNulls})	
							}
							break;
					}
				}
			}
		});
	}

	debugLog("validationResults_types", validationResults_typeErrors)
}

//Returns true if there's data OR if it's allowed to be NULL
function DataIsNullAndIsAllowedToBe(data, nullDataTagRegex, allowNull)
{
	if(data.match(nullDataTagRegex) && allowNull)
	{
		return true;
	}

	return false;
}

function GetNewFilename(metdataItem){
	var newFilename = "";

	var i = 0;
	$.each(selectedRenamerConfig.metadataRequiredColumns, function (requiredColumnName, requiredColumnAttributes) {
		//Get the value we want to add
		var propertyValue = metdataItem[requiredColumnName];
		if(UseValueInFilename(propertyValue, selectedRenamerConfig.nullDataTagRegex, requiredColumnAttributes))
		{
			//Add a seperator between the properties
			if (i != 0) {
				newFilename += selectedRenamerConfig.filenamePropertySeperator;
			}
			newFilename += requiredColumnAttributes.renameTo + selectedRenamerConfig.filenameValueSeperator + propertyValue;
			//Replace spaces if needed
			newFilename = newFilename.replace(" ", selectedRenamerConfig.replaceSpacesInFilenameWith)
			//Replace invalid filename characters
			newFilename = newFilename.replace(/[\<\>\:\"\/\\\|\?\*]/g, selectedRenamerConfig.replaceInvalidCharactersInFilenameWith)
			i++
		}
	})

	//Get extension from old file name and add it on the end
	newFilename += path.extname(metdataItem[selectedRenamerConfig.metadataCurrentFilenameColumn]);

	return (newFilename);
}

//Determines if a value should be used in genrating the filename
function UseValueInFilename(requiredColumnValue, nullDataTagRegex, requiredColumnAttributes)
{
	if(requiredColumnValue != null)
	{
		//Only add the property if it's "used in the filename"
		if(requiredColumnAttributes.useInFilename)
		{
			//If we do want to use it, but the value is null...
			if(requiredColumnValue.match(nullDataTagRegex))
			{
				if(requiredColumnAttributes.useInFilenameIfNull == undefined ||  requiredColumnAttributes.useInFilenameIfNull)
				{
					//If we allow NULLs then return true
					return true;
				}
				else
				{
					//else return false
					return false;
				}
			}
			else
			{
				return true;
			}
		}
		else
		{
			//We don't want to use it so return false
			return false;
		}
	}
	return false;
}

function StoreOldFilename(){
	return !selectedRenamerConfig.metadataOldFilenameColumn == "";
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
			$('#btnRename').removeAttr('disabled');
			$('#btnRenameBottom').removeAttr('disabled');
			$('#metadataFine').modal('show');
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
		$('#btnShowProjectSettings').show();
	}else{
		$('#exampleDataDownload').hide();
		$('#btnShowProjectSettings').hide();
	}
}

function UpdateMetadataPath()
{
	if(metadataPath != null && metadataPath.length > 0)
	{
		$('#selectedMetadataPath').show();
		$('#selectedMetadataPath').val(metadataPath);
		$('#btnRefershMetadata').removeAttr('disabled');
	}else{
		$('#selectedMetadataPath').hide();
		$('#btnRefershMetadata').attr('disabled','disabled');
	}
	
}

function ShowValidation(){
	var allowNullString = ". If missing/empty/or no data recorded use '" + selectedRenamerConfig.nullDataTagDisplay + "'";
	//add folder text to error messages
	$('#errorFilesMissingFolder').html(metadataDirectory);
	$('#errorExtraFilesFolder').html(metadataDirectory);
	$('#errorOutputFolder').html(outputPath);

	$('#errorFilesMissing').hide();
	var errorList = $('#e1');
	errorList.html('');
	$.each(validationResults_currentFileDoesNotExist, function (key, item) {
		errorList.append("<li><strong>Line " + item[lineNumberColumnName] + ":</strong> " + item[selectedRenamerConfig.metadataCurrentFilenameColumn] + "</li>");
		$('#errorFilesMissing').show();
	})

	$('#errorExtraFiles').hide();
	var errorList = $('#errorExtraFilesList');
	errorList.html('');
	$.each(validationResults_extraFileInDirectory, function (key, item) {
		errorList.append("<li>" + item + "</li>");
		$('#errorExtraFiles').show();
	})


	$('#errorFilenameExists').hide();
	var errorList = $('#e2');
	errorList.html('');
	$.each(validationResults_newFilenameExists, function (key, item) {
		errorList.append("<li><strong>Line " + item[lineNumberColumnName] + ":</strong> " + item[selectedRenamerConfig.metadataNewFilenameColumn] + "</li>");
		$('#errorFilenameExists').show();
	})

	$('#errorSameCurrentFilename').hide();
	errorList = $('#e3');
	errorList.html('');
	$.each(validationResults_sameCurrentFilename, function (key, item) {
		var string = "";
		$.each(item, function (key, subitem) {
			string += "<strong>Line " + subitem[lineNumberColumnName] + ":</strong> " + subitem[selectedRenamerConfig.metadataCurrentFilenameColumn] + "<br />";
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
			string += "<strong>Line " + subitem[lineNumberColumnName] + ":</strong> " + subitem[selectedRenamerConfig.metadataNewFilenameColumn] + "<br />";
		})
		errorList.append("<li>" + string + "</li>");
		$('#errorSameNewFilename').show();
	})

	//Type errors

	$('#errorText').hide();
	errorList = $('#eText');
	errorList.html('');
	$.each(validationResults_typeErrors.textErrors, function (key, item) {
		var allowNullStringAddon = "";
		if(item.columnAllowsNulls)
		{
			allowNullStringAddon = allowNullString
		}
		errorList.append("<li><strong>Line " + item.rowData[lineNumberColumnName] + ":</strong> '" + item.columnName + "' is required" + allowNullStringAddon + "</li>");
		$('#errorText').show();
	})

	$('#errorTextOverMaxLength').hide();
	errorList = $('#eTextMaxLength');
	errorList.html('');
	$.each(validationResults_typeErrors.textMaxLengthErrors, function (key, item) {
		var allowNullStringAddon = "";
		if(item.columnAllowsNulls)
		{
			allowNullStringAddon = allowNullString
		}
		errorList.append("<li><strong>Line " + item.rowData[lineNumberColumnName] + ":</strong> '" + item.columnName + "' value is longer than " + item.columnMaxTextLength + " characters" + allowNullStringAddon + "</li>");
		$('#errorTextOverMaxLength').show();
	})

	$('#errorNull').hide();
	errorList = $('#eNull');
	errorList.html('');
	$.each(validationResults_typeErrors.illegalNull, function (key, item) {
		var allowNullStringAddon = "";
		if(item.columnAllowsNulls)
		{
			allowNullStringAddon = allowNullString
		}
		errorList.append("<li><strong>Line " + item.rowData[lineNumberColumnName] + ":</strong> '" + item.columnName + "' is a required field. Can not be missing/empty or '" + selectedRenamerConfig.nullDataTagDisplay + "'</li>");
		$('#errorNull').show();
	})

	$('#errorDate').hide();
	errorList = $('#eDate');
	errorList.html('');
	$.each(validationResults_typeErrors.dateErrors, function (key, item) {
		var allowNullStringAddon = "";
		if(item.columnAllowsNulls)
		{
			allowNullStringAddon = allowNullString
		}
		var exampleDate = moment().format(item.columnDateFormat);
		errorList.append("<li><strong>Line " + item.rowData[lineNumberColumnName] + ":</strong> " + item.columnName + ": '" + item.columnData + "' does not match format '" + item.columnDateFormat + "' (e.g. " + exampleDate + ")" + allowNullStringAddon + "</li>");
		$('#errorDate').show();
	})

	$('#errorInt').hide();
	errorList = $('#eInt');
	errorList.html('');
	$.each(validationResults_typeErrors.intErrors, function (key, item) {
		var allowNullStringAddon = "";
		if(item.columnAllowsNulls)
		{
			allowNullStringAddon = allowNullString
		}
		errorList.append("<li><strong>Line " + item.rowData[lineNumberColumnName] + ":</strong> " + item.columnName + ": '" + item.columnData + "' is not a valid whole number or is outwith range " + item.columnMinValue + " to " + item.columnMaxValue + allowNullStringAddon + "</li>");
		$('#errorInt').show();
	})

	$('#errorFloat').hide();
	errorList = $('#eFloat');
	errorList.html('');
	$.each(validationResults_typeErrors.floatErrors, function (key, item) {
		var allowNullStringAddon = "";
		if(item.columnAllowsNulls)
		{
			allowNullStringAddon = allowNullString
		}
		errorList.append("<li><strong>Line " + item.rowData[lineNumberColumnName] + ":</strong> " + item.columnName + ": '" + item.columnData + "' is not a valid float" + allowNullStringAddon + "</li>");
		$('#errorFloat').show();
	})
}


async function StartProcessing() {

	$('#outputDir').html(outputPath);
	$("#outputDir").click(function (e) {
		e.preventDefault();
		shell.showItemInFolder(outputPath);
	});
	
	await ShowProcessProgress();

	SendStartProcessing('helloWorker', { metadata: metadata,
		newMetadata: newMetadata,
		filenamesNew: filenamesNew,
		selectedRenamerConfig: selectedRenamerConfig,
		metadataDirectory: metadataDirectory,
		metadataFilename: metadataFilename,
		newMetadataColumnNames: newMetadataColumnNames,
		lineNumberColumnName: lineNumberColumnName,
		outputPath: outputPath,
		createCopies: createCopies});
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

function ScrollToResults()
{
	ScrollToElement('results');
}

function ScrollToElement(elementId)
{
	document.getElementById(elementId).scrollIntoView({ behavior:'smooth'});
}


/* Set between 0 and 1 for percentage
   Set to 2 to show infinite loading
   Set to -1 to close
   */
async function SetMetdataLoadProgress(progress)
{
	if(progress > 0)
	{
		//$('#myModal').css("display", "block");
		$('#progressLoadingMetadata').modal('show');
	}
	else
	{
		//$('#myModal').css("display", "none");
		$('#progressLoadingMetadata').modal('hide');
	}
	remote.getCurrentWindow().setProgressBar(progress);
}

async function ShowProcessProgress()
{
	await SetProcessingProgress(2);
}

/* Set between 0 and 1 for percentage
   Set to 2 to show infinite loading
   Set to 1 to close and success
   Set to -1 to close and error
   */
async function SetProcessingProgress(progress)
{
	if(progress > 0 && progress != 1)
	{
		$('#progressProcessing').modal('show');

		if(progress == 2)
		{
			$('#processingProgressBar').css("width", "0%");
			$('#processingProgressBarPercentage').html("0%");
		}
		else
		{
			$('#processingProgressBar').css("width", progress * 100 + "%");
			$('#processingProgressBarPercentage').html(Math.round(progress * 100) + "%");
		}

		remote.getCurrentWindow().setProgressBar(progress);
	}
	else
	{
		$('#progressProcessing').modal('hide');
		remote.getCurrentWindow().setProgressBar(-1);

		if(progress == 1)
			$('#successModal').modal('show');
		else
			$('#cancelModal').modal('show');
	}
}

async function debugDelay(milliseconds = 500)
{
	const date = Date.now();
	let currentDate = null;
	do {
	  currentDate = Date.now();
	} while (currentDate - date < milliseconds);
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

