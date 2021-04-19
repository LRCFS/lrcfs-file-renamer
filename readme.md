# LRCFS File Renamer

The LRCFS File Renamer has been created as a way of managing part of the process of file management, to ensure all files conform to a strict naming schema and that metadata is in the correct format.

By having a folder that contains all the appropriate files (such as images from a camera) and a metadata CSV that contains one record for each file, this application can quickly validate that:

1. All columns in the metadata exist
2. All files in the folder are referenced in the metadata (highlighting any missing files)
3. All files in the meta data are referenced only once (highlighting any duplicate rows)
4. All metadata column data adhere to their data types and validate correctly (i.e. check that dates are in a specified format, numbers are within a given range and that text is no longer than a maximum length)

Once the data has been validate all the files can then be copied and renamed automatically, along with an updated metadata CSV file that contains both the original filename and new filename.

## Example
Imagine the following file structure:
```
c:\project\image_001.jpg
c:\project\image_002.jpg
c:\project\image-data.csv
```
Where `image-data.csv` contains the following CSV data:
|Filename|DateTaken|ParticleCount|
|-|-|-|
|image_001.jpg|20210101|5|
|image_002.jpg|20210102|6|

With one click you can validate that all your files are valid, and with a second click you rename your files and update your metadata to the following:
```
c:\project\output\20210101_PCount-5.jpg
c:\project\output\20210101_PCount-6.jpg
c:\project\output\image-data.csv
```
Where `output\image-data.csv` contains the following CSV data:
|Filename|DateTaken|ParticleCount|OriginalFilename|
|-|-|-|-|
|20210101_PCount-5.jpg|20210101|5|image_001.jpg|
|20210102_PCount-6.jpg|20210102|6|image_002.jpg|

# Usage
1. First download the appropriate version from our releases page: https://github.com/LRCFS/lrcfs-file-renamer/releases  (**macOS** v10.10+, **Windows** v7+)
2. Ensure that files and metadata are sitting side-by-side in the same folder (with no extra folders or files)
3. Start the renamer and select the renamer configuration (currently we only have one renamer configuration created for our [Transfer & Persistence project](https://www.dundee.ac.uk/leverhulme/projects/details/transfer-and-persistence.php), but you can create custom ones for your own project using the information provided below.)
4. Select your metadata CSV file. This file can be called anything but must exist alongside your files you want validated/renamed.
5. Check that your data validates correctly or fix any errors (you'll need to refresh the validation using the "Refresh" button if you change any files or your metadata)
6. Optionally "Start Processing" your data to copy all your data and rename your files into the "output" directory.

# Creating a custom renamer config
The [renamers.json](https://github.com/LRCFS/lrcfs-file-renamer/blob/master/app/renamers.json) file contains the definitions of all possible renamer configurations.

Currently, only one renamer definition exists for our Transfer & Persistence project but serves as a good example.

To create a new renamer configuration simply modify or add your config to the array of configurations defined in this file and place this file alongside the LRCFS-File-Renamer-v##.exe.

The application will automatically pick up this modified renamers.json file and you will be able to use it as required.

**Renamers.json definition**

A renamer configuration consists of:
- `name` - The name of the renamer as it will appear in the application (e.g. `"Transfer & Persistence"`)
- `description` - The description of the renamer as it will appear in the application (e.g. `"Super exiciting project"`)
- `url` - The URL that can be clicked for more information about the associated project or renamer configuration (e.g. `"https://www.dundee.ac.uk/leverhulme/project"`)
- `submissionUrl` - The URL that the user will be directed to in order to submit any renamed files (e.g. `"https://www.dundee.ac.uk/leverhulme/project/submission"`)
- `submissionInfo` - More information specifically about the data submission process (e.g. `"Please submit your data to our project to help."`)
- `nullDataTagRegex` - The regex used to identify "null" data in the metadata CSV (suggested value: `"^[Nn][Aa]$"`)
- `nullDataTagDisplay` - The string that should be displayed to represent null data in the application (suggest value: `"NA"`)
- `metadataCurrentFilenameColumn` - The case sensitive name of the column that contains the filename in the metadata (suggested value: `"Filename"`)
- `metadataOldFilenameColumn` - Once renamed, the name of the column that will contain the previous filename (suggest value: `"OriginalFilename"`)
- `metadataNewFilenameColumn` - Once renamed, the name of the column that will contain the new filename (suggested value: `"Filename"`)
- `filenamePropertySeperator` - The string that will be placed between properties (columns from the metadata) that are used in the filename (suggested value: `"_"`)
- `filenameValueSeperator` - The string that will be placed between the property name and it's value in the filename (suggested value: `"-"`)
- `replaceSpacesInFilenameWith` - The string used in place of spaces in the filename(suggested value: `" "`)
- `replaceInvalidCharactersInFilenameWith` - Where a non alpha numeric character is contained in a property name or value this sting will replace it (suggested value: `""`)
- `trimHeadersAndData` - true/false value to determine whether when creating the new metadata file (with new filenames) whether the values should have white space characters (i.e. spaces and tabs) removed from the header names and values (suggested value: `true`)
- `ignoreFoldersInInputDirectory` - true/false value whether folders should be ignored in the input folder. Setting this to false will mean that files will be checked in all sub directories potentially resulting in an excess amount of errors (suggested value: `true`)
- `ignoreOutputFolderInInputDirectory` - true/false value that will determine wether if the output directory, that matches the name chosen by the user, should automatically be ignored (suggested value: `true`)
- `filesAndFoldersToIgnoreInInputDirectory` - Array of regex strings that can be used to automatically ignore common hidden files so the user isn't given errors for them (example below)
- `metadataRequiredColumns` - An object containing the names of the required columns and their renaming properties (as defined below)

Example `filesAndFoldersToIgnoreInInputDirectory`:
```
"filesAndFoldersToIgnoreInInputDirectory": [
    "^\\.DS_Store$",
    "^[Tt]emp$",
    "^[Tt]humbs\\.db$",
    "^\\.gitignore$",
    "^\\.gitattributes$",
    "^\\.git$",
    "^\\.\\_",
    "^\\~\\$",
    "^\\.Trashes$",
    "^\\.Spotlight-V100$",
    "^\\.fseventsd$",
    "\\.url$",
    "\\.lnk$"
]
```

## `metadataRequiredColumns` Object
A `metadataRequiredColumns` object has a string name, then is defined as the following:
- `useInFilename` -  true/false value determining whether this property should be used in the filename of the renamed file
- `renameTo` - This is the value that will be used in the new filename for that property.
- `allowNull` - true/false value to determine whether "null" values should be allowed (the string of which is determined by `nullDataTagRegex`)
- `type` - date/int/text - determines the validators required for that column
- `dateFormatJs` - string that validates the `date` type property with [Momentjs](https://momentjs.com/)
- `dateFormatPhp` - Not required for the LRCFS File Renamer, but allows us to use the same renamer.json for both this application and the LRCFS File Uploader, so can be ignored
- `minValue` - Number that represents the minimum value for an `int` type column
- `maxValue` - Number that represents the maximum value for an `int` type column
- `maxTextLength` - Number that represents the maximum number of characters for a `text` type column

Example `metadataRequiredColumns`:
```
"metadataRequiredColumns":
{
    "Date":						{"useInFilename": true,	"renameTo": "",		"type": "date",	"allowNull": false,	"dateFormatJs": "YYYYMMDD",	"dateFormatPhp": "Ymd"},
    "Experiment":				{"useInFilename": true,	"renameTo": "EX",	"type": "int",	"allowNull": false, "minValue": 1, "maxValue": 100},
    "Replicate":				{"useInFilename": true,	"renameTo": "RP",	"type": "int",	"allowNull": false, "minValue": 1, "maxValue": 100},
    "Substrate":				{"useInFilename": true,	"renameTo": "SB",	"type": "text",	"allowNull": false,	"maxTextLength": 100},
    "SubstrateType":			{"useInFilename": true,	"renameTo": "ST",	"type": "text",	"allowNull": false,	"maxTextLength": 100},
    "ObservationType":			{"useInFilename": true,	"renameTo": "OT",	"type": "text",	"allowNull": false,	"maxTextLength": 100},
    "Mass (g)":					{"useInFilename": true,	"renameTo": "MA",	"type": "int",	"allowNull": false, "minValue": 0, "maxValue": 9999},
    "TransferTime (s)":			{"useInFilename": true,	"renameTo": "TT",	"type": "int",	"allowNull": false, "minValue": 0, "maxValue": 9999},
    "PersistenceTime (min)":	{"useInFilename": true,	"renameTo": "PT",	"type": "int",	"allowNull": false, "minValue": 0, "maxValue": 99999},
    "Temperature (DegC)":		{"useInFilename": true,	"renameTo": "TP",	"type": "int",	"allowNull": true, "minValue": -50, "maxValue": 300, "useInFilenameIfNull": true},
    "Humidity (%)":				{"useInFilename": true,	"renameTo": "HM",	"type": "int",	"allowNull": true, "minValue": 0, "maxValue": 100,  "useInFilenameIfNull": true}
}
```

# Development and Customisation
This application has been built with [Electron](https://electronjs.org) to enable a cross platform to be created.
## Run from code

To start development and to run the application from code, first install Install [Node.js (v15+)](https://nodejs.org/en/), then run:
```
$ npm install
$ npm start
```

## Creating a new distribution

This application has been tested on Windows and MacOS. To build both versions run each command on the corresponding operating systems.

```
$ npm distwin
$ npm distmac
```