'use strict';
console.log("index.js")

const { app, dialog } = require('electron').remote;
const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path')
const config = require('../config');

var renamers;
var selectedRenamer;
var createCopies;
var metadata;
var metadataFilePath;

(async () => {
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

	var metadataDirectory = path.dirname(metadataFilePath);

	$.each(metadata, function (key, metadataItem) {
		var originalFilename = metadataItem[selectedRenamer.originalFilenameColumn];
		var originalFilenameExtension = path.extname(originalFilename);
		var newFilename = GetNewFilename(metadataItem) + originalFilenameExtension;

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
	$.each(selectedRenamer.filenameColumns, function (oldPropertyName, newPropertyName) {
		var propertyValue = metdataItem[oldPropertyName];
		if (i != 0) {
			newFilename += selectedRenamer.propertySeperator;
		}
		newFilename += newPropertyName + propertyValue;
	})

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
	selectedRenamer = renamers[renamerId];

	$("#renamerName").html(selectedRenamer.name);
	$("#renamerDesc").html(selectedRenamer.description);
	$("#renamerUrl").attr('href',selectedRenamer.url);
	$("#renamerOriginalFilenameColumn").html(selectedRenamer.originalFilenameColumn);
	$("#renamerFilenameOldColumn").html(selectedRenamer.filenameOldColumn);
	$("#renamerFilenameNewColumn").html(selectedRenamer.filenameNewColumn);
	$("#renamerValueSeperator").html(selectedRenamer.valueSeperator);
	$("#renamerPropertySeperator").html(selectedRenamer.propertySeperator);

	$("#renamerColumns").html("");
	$.each(selectedRenamer.filenameColumns, function (key, filenameColumn) {
		var existingText = $("#renamerColumns").html();
		$("#renamerColumns").html(existingText + key + ": " + filenameColumn + "<br />");
	})

	console.log("selectedRenamer...");
	console.log(selectedRenamer);
}


function OpenFileDialog(){
	dialog.showOpenDialog({
		title: 'Select a file',
		filters: [{
			name: "Spreadsheets",
			extensions: "xls|xlsx|xlsm|csv".split("|")
		}],
		properties: ['openFile']
	}, function (files) { ReadFiles(files); });
}

function ReadFiles(files) {
	if (files !== undefined && files.length > 0) {
		var file = files[0];
		metadataFilePath = file;
		var fileExtension = path.extname(file);
		if (fileExtension == ".csv") {
			LoadMetadataCsv(file);
		} else {
			LoadMetadataExcel(file);
		}
	}
}

function LoadMetadataExcel(file) {
	var workbook = XLSX.readFile(file);
	console.log("Loaded EXCEL file...");
	console.log(workbook);

	var HTMLOUT = document.getElementById('htmlout');
	
	HTMLOUT.innerHTML = "";
	workbook.SheetNames.forEach(function (sheetName) {
		var htmlstr = XLSX.write(workbook, { sheet: sheetName, type: 'string', bookType: 'html' });
		HTMLOUT.innerHTML += htmlstr;
	});


	var results = {};
	results = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
	//Remove whitespace from values
	results = JSON.parse(JSON.stringify(results).replace(/"\s+|\s+"/g, '"'));
	metadata = results;
	console.log("EXCEL as new metadata...");
	console.log(metadata);
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

