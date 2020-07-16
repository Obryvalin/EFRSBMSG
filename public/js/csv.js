//
//
// 	csv_ExportByName(tableid, "table.csv");
//
//
function csv_download(csv, filename) {
    var csvFile;
    var downloadLink;

    // CSV FILE
    csvFile = new Blob([csv], {type: "text/csv"});

    // Download link
    downloadLink = document.createElement("a");

    // File name
    downloadLink.download = filename;

    // We have to create a link to the file
    downloadLink.href = window.URL.createObjectURL(csvFile);

    // Make sure that the link is not displayed
    downloadLink.style.display = "none";

    // Add the link to your DOM
    document.body.appendChild(downloadLink);

    // Lanzamos
    downloadLink.click();
}

function csv_ExportByName(rowName, filename,dlm) {
	var csv = [];
	var rows = document.getElementsByName(rowName);
	
    for (var i = 0; i < rows.length; i++) {
		var row = [], cols = rows[i].querySelectorAll("td, th");
		
        for (var j = 0; j < cols.length; j++) 
            row.push(cols[j].innerText);
        
		csv.push(row.join(dlm));		
	}

    // Download CSV
    csv_download(csv.join("\n"), filename);
	
}

function csv_ExportByClass(classname, filename,dlm) {
	var csv = [];
	var rows = document.getElementsByClassName(classname);
	
    for (var i = 0; i < rows.length; i++) {
		var row = [], cols = rows[i].querySelectorAll("td, th");
		
        for (var j = 0; j < cols.length; j++) 
            row.push(cols[j].innerText);
        
		csv.push(row.join(dlm));		
	}

    // Download CSV
    csv_download(csv.join("\n"), filename);
	
}



function csv_ExportById(id, filename,dlm) {
	var csv = [];
	var table = document.getElementById(id);
	var rows = table.querySelectorAll("tr");
	
    for (var i = 0; i < rows.length; i++) {
		var row = [], cols = rows[i].querySelectorAll("td, th");
		
        for (var j = 0; j < cols.length; j++) 
            row.push(cols[j].innerText);
        
		csv.push(row.join(dlm));		
	}


    // Download CSV
    csv_download(csv.join("\n"), filename);
	
}

