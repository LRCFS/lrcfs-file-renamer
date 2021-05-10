[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.4745515.svg)](https://doi.org/10.5281/zenodo.4745515)

# LRCFS File Renamer

Get the latest release of the LRCFS File Renamer:

**Download: https://github.com/LRCFS/lrcfs-file-renamer/releases/latest**

|Windows|MacOS|
|-|-|
|Windows v7+|macOS v10.10+|
|`LRCFS.File.Renamer-#.#.#-Windows.exe`|`LRCFS.File.Renamer-#.#.#-Mac.dmg`|

Also included is an example data file (`LRCFS.File.Renamer-Example.Data.zip`) which can be extracted and tested to confirm the application works correctly on your computer.

# Overview

The LRCFS File Renamer has been created as a way of managing part of the process of file management, to ensure all files conform to a strict naming schema and that metadata is in an expected format.

By creating a folder that contains all the appropriate files (such as images from a camera) and a metadata CSV that contains information about each file (one record for each file) this application can quickly validate that:

1. All required columns, based on a specific project, in the metadata exist
2. All files in the folder are referenced in the metadata (highlighting any missing files)
3. All files in the metadata are referenced only once (highlighting any duplicate rows)
4. All metadata column data adhere to their data types and validate correctly (i.e. check that dates are in a specified format, numbers are within a given range and that text is no longer than a maximum length)

Once the data has been validated all the files can then be copied and renamed automatically, along with creating an updated metadata CSV file that contains both the original filename and new filename. **None of the original files are changed**.

 ![](https://i.imgur.com/tWiJyKJ.png)

## Example usage

1. First download the latest version of the LRCFS File Renamer from our releases page: https://github.com/LRCFS/lrcfs-file-renamer/releases/latest (macOS v10.10+, Windows v7+)

2. If you haven't already, optionally create a empty metadata file in the correct format for your project by opening the LRCFS File Renamer, selecting the appropriate project and under the **"Show/Hide Metadata Requirements"** option select **"Create Blank Metadata File"**
   
3. Create a folder that **just contains your images and your metadata**, e.g.:
```
c:\project\image_001.jpg
c:\project\image_002.jpg
c:\project\image-data.csv
```
> NOTE: The LRCFS File Renamer will tell you if there are any unexpected files or folders but it best to ensure that only the metadata file itself and all images referenced by the metadata are in the folder. Any additional files should be removed. Also make sure there are not hidden files in the folder as well ([Viewing hidden files on Mac](https://www.macworld.co.uk/how-to/show-hidden-files-mac-3520878/) | [Viewing hidden files on Windows](https://www.howtogeek.com/howto/windows-vista/show-hidden-files-and-folders-in-windows-vista/))

The `image-data.csv` is the metadata file that contains all the information we want to use to validate and rename our files in a [CSV format](https://en.wikipedia.org/wiki/Comma-separated_values). For the Transfer & Persistence project this requires metadata that has the following columns, but the content would change based on the exact data collection parameters you were using for each image taken. These requirements can be seen in the LRCFS File Renamer under the **"Show/Hide Metadata Requirements"** section after you have a selected a project.

**Example `image-data.csv` contents:**
|Filename|Date|Experiment|Replicate|Substrate|SubstrateType|ObservationType|EvidenceType|Mass (g)|TransferTime (s)|PersistenceTime (min)|Temperature (DegC)|Humidity (%)|
|-|-|-|-|-|-|-|-|-|-|-|-|-|
|image_001.jpg|20200101|1|1|Sub|SubT|ObT|EvT|50|30|15|NA|NA|
|image_002.jpg|20200102|2|1|Sub|SubT|ObT|EvT|50|30|15|NA|NA|

4. Once you are happy that all your files and metadata are complete, open the LRCFS File Renamer.

5. Select the appropriate project that is relevant for your data collection (e.g. `Transfer & Persistence`)
   
6. Next, load your metadata by pressing the **"Select Metadata File (.csv)"** button.
   
7. Select your metadata file (in our case `image-data.csv`) and click open.
   
8. The LRCFS File Renamer will automatically validate your files and metadata as well as [show you any errors and how to fix them](#SolvingPossibleErrors).

9. If you make any changes to the files or metadata in an attempt to resolve these errors, press **"Refresh"** to reload and check if they have been fixed correctly.

> NOTE: This is might be as far as you want to take the process. It can be helpful to use the LRCFS File Renamer purely to validate files and their metadata

10. Optionally change the **"output"** directory by selecting **"Change Output Directory"**. By default an output directory will be created in the same folder you loaded your metadata from.

11. Once all errors have been resolved, press "Process" to start renaming all your files.

The output from the renamer, by default, will be placed in a newly created `output` folder.
```
c:\project\output\20200101_EX1_RP1_SBSub_STSubT_OTObT_EVEvT_MA50_TT30_PT15_TPNA_HMNA.jpg
c:\project\output\20200102_EX2_RP1_SBSub_STSubT_OTObT_EVEvT_MA50_TT30_PT15_TPNA_HMNA.jpg
c:\project\output\image-data.csv
```
Where the newly created metadata file  (`output\image-data.csv`) now contains the following CSV data:
|Filename|OriginalFilename|Date|Experiment|Replicate|Substrate|SubstrateType|ObservationType|EvidenceType|Mass (g)|TransferTime (s)|PersistenceTime (min)|Temperature (DegC)|Humidity (%)|
|-|-|-|-|-|-|-|-|-|-|-|-|-|-|
|20200101_EX1_RP1_SBSub_STSubT_OTObT_EVEvT_MA50_TT30_PT15_TPNA_HMNA.jpg|image_001.jpg|20200101|1|1|Sub|SubT|ObT|EvT|50|30|15|NA|NA|
|20200102_EX2_RP1_SBSub_STSubT_OTObT_EVEvT_MA50_TT30_PT15_TPNA_HMNA.jpg|image_002.jpg|20200102|2|1|Sub|SubT|ObT|EvT|50|30|15|NA|NA|

12.  Once processed, because the Transfer & Persistence project is collecting data from external participants, you will be presented with the option to **"Submit Your Data Online"**.

# Quick reminder/example
1. Start the LRCFS File Renamer and generate a "Blank Metadata File" for your project.
2. Generate your data and create a folder with just your files and associated metadata (no extra files or folders)
3. Start the LRCFS File Renamer and select the correct project.
4. Select your metadata CSV file.
5. Check that your data validates correctly or fix any errors ("refresh" after any changes to your files or metadata)
6. Select "Start Processing"
7. Check the output directory for your updated files and metadata.
8. Submit your data to the project.

# What makes a valid metadata file?
The LRCFS File Renamer can't take any metadata file and rename your files. It needs to know what columns to use, what order to put them in and how it should use them to rename your file.

As such, the LRCFS File Renamer relies on a `renamers.json` file that describes what metadata to expect and how it is then used to both validate and rename the files. Within the application you can see how the renamer associated with the project informs the user about the fields required in their metadata. This example below is for the Transfer & Persistence project:
![](https://i.imgur.com/X2eV25S.png)

The `renamers.json` file can contain many different expected formats for the metadata but it currently only supports one expected format for our Transfer & Persistence project. If you'd like to use this application to rename your files to different formats make sure to read [Creating a custom renamer config](https://github.com/LRCFS/lrcfs-file-renamer#creating-a-custom-renamer-config) below.

# Solving possible errors<a name="SolvingPossibleErrors"></a>

The LRCFS File Renamer is as much a metadata/file validator as it is a renamer for your files.

While using the LRCFS File Renamer you will likely see errors if your data collection has involved any manual steps.

Possible errors and details for how to fix them have been outlined below.

> NOTE: A quick way to resolve many of these issues is to use the **"Create Blank Metadata File"** option within the LRCFS File Renamer **"Show/Hide Metadata Requirements"** section. This automatically creates a file that conforms to these standard requirement before you start collecting your data.

## **There are problems with the headings in your metadata**
Headings are the column names in your metadata. It's important to note that the checks are case sensitive, so any difference in capitalisation of the column headers can result in errors. Please ensure they match the renamer configuration you have selected in Step 1.

### **Malformed Columns Headings**
Your headers contain single quotes around your headings. Please use double quotes to enclose all data if required.
Please check that your following metadata headers do not use single quotes or use double quotes instead:</p>
> NOTE: Not being able to correctly recognise your headers may results in more errors. Please resolve this first before reloading your data to check for further errors.
### **Duplicate Column Headings**
Your selected metadata includes duplicate column names/headings.
Please remove/rename/replace all duplicate column headings listed as no two columns can have the same heading.				
### **Missing Filename Column Heading**
Your selected Project requires a heading that specifies your filenames in your metadata, but it appears to be missing. Add a filename column with the corresponding name required by the renamer configuration (typically "Filename")

### **Missing Columns Heading**
Your selected Project has some required headers for renaming your files, but the following headers are missing from your metadata. Please check that your metadata contains the listed headers


## **There are problems with your metadata**

### **Filename Capitalisation/Accent Errors**
The LRCFS File Renamer will do its best to try and notify you if file names do not exactly match how you reference them in your metadata.

If you receive the following error ensure that all the files listed in your metadata exactly match the naming (including capitalisation) of the file on your computer.


### **Files Missing**
The listed files are missing and can not be found in the same folder as your metadata.

> NOTE: Filenames, including extensions, are **case sensitive** and must match exactly. Use this guide to [view filenames (including extensions) on windows](https://www.howtogeek.com/205086/beginner-how-to-make-windows-show-file-extensions/) or [view filenames (including extension) on mac](https://support.apple.com/en-gb/guide/mac-help/mchlp2304/mac) and ensure that all the files listed in your metadata are in the same folder as your metadata CSV file.

### **Extra Files**
The listed files/folders have been found alongside your metadata that are not referenced by your metadata.
You must ensure that only files associated with the metadata are stored alongside it so that the LRCFS File Renamer can correctly validate all files are accounted for.

You should either remove the listed files from the directory OR include references in your metadata if they are valid files that have simply been forgotten.

It can also be helpful to [view hidden files on Windows](https://www.howtogeek.com/howto/windows-vista/show-hidden-files-and-folders-in-windows-vista/) or [view hidden files on Mac](https://www.macworld.co.uk/how-to/show-hidden-files-mac-3520878/) and remove them if necessary.

### **New Filename Exists**
When the LRCFS File Renamer renames your files it will put them in the output directory specified. Before this, it will check if files with those names already exist so that you don't overwrite anything.

This is typically only an error you will see if you try and run the process twice.

### **Metadata output file already exists**
When the LRCFS File Renamer renames your files it will put them in the output directory specified. This error means that your specified output directory already exists in the output folder.

Instead of overwriting your file the LRCFS File Renamer requires that you save your output to a directory that does not have a file already in it with the same name as your metadata.

Either change the output directory or remove the existing file.

### **Same Current Filename**
The LRCFS File Renamer assume that there is only one row per file in the metadata, as such, you cannot have two lines in your metadata csv file that reference the same filename. Either remove the duplicate row/rows from your metadata or correct the filename reference to an original file.

### **Same New Filename**
The LRCFS File Renamer creates filenames based on the metadata supplied. If two rows in the metadata have the same values this can result in two filenames that would be the same. Ensure that all the required columns for the listed files differ so that unique filenames will be generated.

This can often be caused by incorrectly duplicating the Experiment or Replicate number.

### **Missing Data**
Some columns in the metadata are required, some are not. For any line in your metadata listed here ensure that the required columns have data specified.

### **Text too long**
Text felids can have a maximum length defined in the metadata requirements. The listed lines in your metadata have text that is too long for one of these columns.

### **Empty/Null Data Errors**
The specified lines in your metadata are missing data that is required by the metadata requirements.

### **Date Errors**
The specified lines have date columns that are not specified in the correct format. Ensure that they match the format specified in the metadata requirements.

### **Integer Number Errors**
The specified lines have integer (whole number) columns that have errors. Ensure that the listed lines contain whole numbers in the specified columns and are within the allowable range as defined in the metadata requirements.

### **Float Number Errors**
The specified lines have float (numbers with decimals places) columns that have errors. Ensure that the specified lines contain only decimal numbers and are within the allowable range as defined in the metadata requirements.

# Creating a custom renamer config
The [renamers.json](https://github.com/LRCFS/lrcfs-file-renamer/blob/master/app/renamers.json) file contains the definitions of all possible renamer configurations.

Currently, only one renamer definition exists for our Transfer & Persistence project but serves as a good example.

To create a new renamer configuration simply modify or add your config to the array of configurations defined in this file and place this file alongside the LRCFS-File-Renamer-v##.exe.

The application will automatically pick up this modified `renamers.json` file and you will be able to use it as required.

In it's simplest form the `renamers.json` specifies the required columns, their expected type/format as well the order and display of these values in your new filenames.

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
- `filenamePropertySeparator` - The string that will be placed between properties (columns from the metadata) that are used in the filename (suggested value: `"_"`)
- `filenameValueSeparator` - The string that will be placed between the property name and it's value in the filename (suggested value: `"-"`)
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
- `type` - date/int/float/text - determines the validators required for that column
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
    "EvidenceType":				{"useInFilename": true,	"renameTo": "ET",	"type": "text",	"allowNull": false,	"maxTextLength": 100},
    "Mass (g)":					{"useInFilename": true,	"renameTo": "MA",	"type": "int",	"allowNull": false, "minValue": 0, "maxValue": 9999},
    "TransferTime (s)":			{"useInFilename": true,	"renameTo": "TT",	"type": "int",	"allowNull": false, "minValue": 0, "maxValue": 9999},
    "PersistenceTime (min)":	{"useInFilename": true,	"renameTo": "PT",	"type": "int",	"allowNull": false, "minValue": 0, "maxValue": 99999},
    "Temperature (DegC)":		{"useInFilename": true,	"renameTo": "TP",	"type": "int",	"allowNull": true, "minValue": -50, "maxValue": 300, "useInFilenameIfNull": true},
    "Humidity (%)":				{"useInFilename": true,	"renameTo": "HM",	"type": "int",	"allowNull": true, "minValue": 0, "maxValue": 100,  "useInFilenameIfNull": true}
}
```

Please see the full [renamers.json](https://github.com/LRCFS/lrcfs-file-renamer/blob/master/app/renamers.json) for a complete example of how a renamers configuration is formed.

# Development and Customisation
This application has been built with [Electron](https://electronjs.org) to enable a cross platform to be created.
## Run from code

To start development and to run the application from code, first install Install [Node.js (v15+)](https://nodejs.org/en/), then run:
```
$ npm install
$ npm run start
```

## Creating a new distribution

This application has been tested on Windows and MacOS. To build both versions run each command on the corresponding operating systems.

```
$ npm run distwin
$ npm run distmac
```
