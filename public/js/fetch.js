function json2html(json) {
  result = "<table style='margin:10px; width:90%' class='mdl-data-table mdl-js-data-table mdl-shadow--2dp'>";
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

const Form = document.querySelector("form");
Form.addEventListener("submit", (e) => {
  e.preventDefault();
  document.querySelector("#fetch-resdata").style.display = "none";
  document.querySelector("#fetch-msg").textContent = "Loading...";

  var source = document.querySelector("#fetch-source").value;
  var id = document.querySelector("#fetch-id").value;

  if (!source || !id)
    document.querySelector("#fetch-msg").textContent = "Specify source and ID";
  if (source && id) {
    fetch("/FBR_Lists/getResponseData?source=" + source + "&id=" + id).then(
      (response) => {
        response.json().then((resdata) => {
          if (resdata.error) {
            document.querySelector("#fetch-msg").textContent = resdata.error;
          } 
          if (resdata.result.length>0) {
            // console.log(resdata);
            document.querySelector("#fetch-resdata").style.display = "block";
            document.querySelector("#fetch-resdata").innerHTML= json2html(resdata.result)         ;
            document.querySelector("#fetch-msg").textContent = "";
          } else{
            document.querySelector("#fetch-msg").textContent = "Not found!";
          }
        });
      }
    );
  }
});
