'use strict';
console.log("index.js")

const { app, dialog } = require('electron').remote;
const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path')
const _ = require('underscore');

const config = require('../config');

var renamers;
var selectedRenamerConfig;
var createCopies;
var metadata;
var metadataFilePath;
var metadataDirectory;
var outputDirectory;

(async () => {
	debugger
	await app.whenReady();
		
	$("#btnFileSelect").click(function() {
		OpenFileDialog();
	});

	$("#btnRename").click(function () {
		StartProcessing();
	});

	await GetRenamers();

	$("#selectRenamer").change(function () {
		SaveSelectedRenamer($("#selectRenamer option:selected").text());
		UpdateSelectedRenamer($("#selectRenamer").val());
	});

	$("#chkCreateCopies").change(function () {
		SaveCreateCopies($("#chkCreateCopies").is(":checked"));
		UpdateCreateCopies($("#chkCreateCopies").is(":checked"));
	});

	$("#selectRenamer").niceSelect();

	await SetConfigs();

})();

function SetConfigs() {
	UpdateCreateCopies(config.get('createCopies'));
	if (!config.get('createCopies')) {
		$('#chkCreateCopies').bootstrapToggle('off')
	}
}

function StartProcessing() {

	$.each(metadata, function (key, metadataItem) {
		var originalFilename = metadataItem[selectedRenamerConfig.originalFilenameColumn];
		var newFilename = GetNewFilename(metadataItem);

		if (createCopies) {
			fs.copyFile(path.join(metadataDirectory, originalFilename), path.join(metadataDirectory, newFilename), (err) => {
				if (err) throw err;
				console.log("Copied file:" + originalFilename + "->" + newFilename);
			});
		} else {

			fs.rename(path.join(metadataDirectory, originalFilename), path.join(metadataDirectory, newFilename), (err) => {
				if (err) throw err;
				console.log("Renamed file:" + originalFilename + "->" + newFilename);
			});
		}
	})
	
}

function GetNewFilename(metdataItem){
	var newFilename = ""

	var i = 0;
	$.each(selectedRenamerConfig.filenameColumns, function (oldPropertyName, newPropertyName) {
		var propertyValue = metdataItem[oldPropertyName];
		if (i != 0) {
			newFilename += selectedRenamerConfig.propertySeperator;
		}
		newFilename += newPropertyName + selectedRenamerConfig.valueSeperator + propertyValue;
		i++
	})

	//Get extension from old file name and add it on the end
	newFilename += path.extname(metdataItem[selectedRenamerConfig.originalFilenameColumn]);

	return (newFilename);
}

function SaveSelectedRenamer(value)
{
	config.set('renamer', value);
}

function UpdateCreateCopies(value) {
	createCopies = value;

	console.log("createCopies:" + createCopies);
}

function SaveCreateCopies(value) {
	config.set('createCopies', value);
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

async function GetRenamers()
{
	var configRenamer = config.get('renamer');
	var renamersFilePath = path.join(__dirname, '../', 'renamers.json')
	let dropdown = $('#selectRenamer');

	dropdown.empty();
	dropdown.append('<option selected="true" disabled>Select renamer configuration...</option>');
	dropdown.prop('selectedIndex', 0);

	renamers = await LoadRenamersJson(renamersFilePath);

	$.each(renamers, function (key, renamer) {
		var dropdownOption = $('<option></option>').attr('value', key).text(renamer.name);
		if (renamer.name == configRenamer) {
			dropdownOption.attr('selected', 'selected');
			UpdateSelectedRenamer(key);
		}
		dropdown.append(dropdownOption);
	})
}

function UpdateSelectedRenamer(renamerId) {
	selectedRenamerConfig = renamers[renamerId];

	$("#renamerName").html(selectedRenamerConfig.name);
	$("#renamerDesc").html(selectedRenamerConfig.description);
	$("#renamerUrl").attr('href',selectedRenamerConfig.url);
	$("#renamerOriginalFilenameColumn").html(selectedRenamerConfig.originalFilenameColumn);
	$("#renamerFilenameOldColumn").html(selectedRenamerConfig.filenameOldColumn);
	$("#renamerFilenameNewColumn").html(selectedRenamerConfig.filenameNewColumn);
	$("#renamerValueSeperator").html(selectedRenamerConfig.valueSeperator);
	$("#renamerPropertySeperator").html(selectedRenamerConfig.propertySeperator);

	$("#renamerColumns").html("");
	$.each(selectedRenamerConfig.filenameColumns, function (key, filenameColumn) {
		var existingText = $("#renamerColumns").html();
		$("#renamerColumns").html(existingText + key + ": " + filenameColumn + "<br />");
	})

	console.log("selectedRenamer...");
	console.log(selectedRenamerConfig);
}

function OpenFileDialog(){
	dialog.showOpenDialog({
		title: 'Select a file',
		filters: [{
			name: "Spreadsheets",
			extensions: "xls|xlsx|xlsm|csv".split("|")
		}],
		properties: ['openFile']
	}, function (files) {
			LoadMetadata(files[0]);
			AddRowNumbers();
			GenerateNewFilenames();
			ValidateMetadata();
			ShowMetadata();
	});
}

function LoadMetadata(file) {
	if (file !== undefined) {
		metadataFilePath = file;
		metadataDirectory = path.dirname(metadataFilePath);
		outputDirectory = path.join(path.dirname(metadataFilePath), $("#txtOutputDir").val());
		var fileExtension = path.extname(file);

		if (fileExtension == ".csv") {
			LoadMetadataCsv(file);
		} else {
			LoadMetadataExcel(file);
		}
	}
}

function AddRowNumbers() {
	$.each(metadata, function (key, metadataItem) {
		metadataItem['id'] = key;
	})
}

function GenerateNewFilenames() {
	$.each(metadata, function (key, metadataItem) {
		metadataItem[selectedRenamerConfig.filenameNewColumn] = GetNewFilename(metadataItem);
	})
}

function ValidateMetadata() {
	ValidateOriginalFilenameExists();
	ValidateNewFilenameExists();
	ValidateSameOldFilename();
	ValidateSameNewFilename();
}

function ValidateOriginalFilenameExists() {
	var validationResults_originalFileDoesNotExist = [];
	$.each(metadata, function (key, metadataItem) {
		var fileExists = fs.existsSync(path.join(metadataDirectory, metadataItem[selectedRenamerConfig.originalFilenameColumn]));
		if (!fileExists) {
			validationResults_originalFileDoesNotExist.push(metadataItem);
		}
	})
	console.log("validationResults_originalFileDoesNotExist...");
	console.log(validationResults_originalFileDoesNotExist);
}

function ValidateNewFilenameExists() {
	var validationResults_newFilenameExists = [];
	$.each(metadata, function (key, metadataItem) {
		var fileExists = fs.existsSync(path.join(outputDirectory, metadataItem[selectedRenamerConfig.filenameNewColumn]));
		if (fileExists) {
			validationResults_newFilenameExists.push(metadataItem);
		}
	})
	console.log("validationResults_newFilenameExists...");
	console.log(validationResults_newFilenameExists);
}

function ValidateSameOldFilename() {
	var validationResults_sameOldFilename = _.groupBy(metadata, selectedRenamerConfig.originalFilenameColumn);

	//Because we're only interested in old filenames that occur more than once, filter to only include those with more than one result
	validationResults_sameOldFilename = _.filter(validationResults_sameOldFilename, function (item) { return item.length > 1; });

	console.log("validationResults_sameOldFilename...");
	console.log(validationResults_sameOldFilename);
}

function ValidateSameNewFilename() {
	var validationResults_sameNewFilename = _.groupBy(metadata, selectedRenamerConfig.filenameNewColumn);

	//Because we're only interested in new filenames that occur more than once, filter to only include those with more than one result
	validationResults_sameNewFilename = _.filter(validationResults_sameNewFilename, function (item) { return item.length > 1; });

	console.log("validationResults_sameNewFilename...");
	console.log(validationResults_sameNewFilename);
}



function LoadMetadataExcel(file) {
	var workbook = XLSX.readFile(file);
	console.log("Loaded EXCEL file...");
	console.log(workbook);

	var results = {};
	results = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
	//Remove whitespace from values
	results = JSON.parse(JSON.stringify(results).replace(/"\s+|\s+"/g, '"'));
	metadata = results;
	console.log("EXCEL as new metadata...");
	console.log(metadata);
}

function ShowMetadata() {
	CreateTableFromJSON("htmlout", metadata);
}

function CreateTableFromJSON(elementId, data) {

	// EXTRACT VALUE FOR HTML HEADER. 
	// ('Book ID', 'Book Name', 'Category' and 'Price')
	var col = [];
	for (var i = 0; i < data.length; i++) {
		for (var key in data[i]) {
			if (col.indexOf(key) === -1) {
				col.push(key);
			}
		}
	}

	// CREATE DYNAMIC TABLE.
	var table = document.createElement("table");

	// CREATE HTML TABLE HEADER ROW USING THE EXTRACTED HEADERS ABOVE.
	var tr = table.insertRow(-1);                   // TABLE ROW.

	for (var i = 0; i < col.length; i++) {
		var th = document.createElement("th");      // TABLE HEADER.
		th.innerHTML = col[i];
		tr.appendChild(th);
	}

	// ADD JSON DATA TO THE TABLE AS ROWS.
	for (var i = 0; i < data.length; i++) {

		tr = table.insertRow(-1);

		for (var j = 0; j < col.length; j++) {
			var tabCell = tr.insertCell(-1);
			tabCell.innerHTML = data[i][col[j]];
		}
	}

	// FINALLY ADD THE NEWLY CREATED TABLE WITH JSON DATA TO A CONTAINER.
	var divContainer = document.getElementById(elementId);
	divContainer.innerHTML = "";
	divContainer.appendChild(table);
}


function LoadMetadataCsv(file) {
	fs.createReadStream(file)
		.pipe(csv())
		.on('data', (row) => {
			console.log(row);
		})
		.on('end', () => {
			console.log('CSV file successfully processed');
		});
}

