function json2html(json) {
    result = "<table style='margin:10px;' class='mdl-data-table mdl-js-data-table mdl-shadow--2dp'>";
    result += "<tr>";
    headers = Object.getOwnPropertyNames(json[0])
    headers.forEach((header) => {
      result += "<th>" + header + "</th>";
    });
    json.forEach((row) => {
      result += "<tr>";
      properties = Object.getOwnPropertyNames(row)
      properties.forEach((property) => {
        result += "<td>" + row[property] + "</td>";
      });
      result += "</tr>";
    });
    result += "</table>";
    return result;

}