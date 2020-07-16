//
//
// ASYNC_UPDATE(indata,"http://sasdm2/cgi-bin/gets/getrozn.pl",3000);
// cooldown = ms
//

function ASYNC_UPDATE(id, url, cooldown) {
  var xhttp;
  xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function () {
    if (this.readyState === 4 && this.status === 200) {
      if (this.responseText != null) {
        document.getElementById(id).innerHTML = this.responseText;
      }
      setTimeout(function () {
        ASYNC_UPDATE(id, url, cooldown);
      }, cooldown);
    }
  };
  xhttp.open("GET", url, true);
  xhttp.send();
}

function ASYNC_WHILE(id, url, cooldown, placeholder) {
  var xhttp;
  xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function () {
    if (this.readyState === 4 && this.status === 200) {
      //console.log(this.responseText);
      if (this.responseText != null) {
        document.getElementById(id).innerHTML = this.responseText;
      }
      if (this.responseText == "") {
        document.getElementById(id).innerHTML = placeholder;
        setTimeout(function () {
          ASYNC_WHILE(id, url, cooldown, placeholder);
        }, cooldown);
      }
    }
  };
  xhttp.open("GET", url, true);
  xhttp.send();
}

function ASYNC_REQUEST(url) {
  var xhttp;
  xhttp = new XMLHttpRequest();

  xhttp.onreadystatechange = function () {
    if (this.readyState === 4 && this.status === 200) {
      // alert('Запрос успешно отправлен!');
    }
  };
  xhttp.open("GET", url, true);
  xhttp.send();
}
function ASYNC_UPDATE_LISTJS(id, url, cooldown, list, listid, listobj) {
  var xhttp;
  xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function () {
    if (this.readyState === 4 && this.status === 200) {
      if (this.responseText != "") {
        document.getElementById(id).innerHTML = this.responseText;
        var list = new List(listid, listobj);
      }
      setTimeout(function () {
        ASYNC_UPDATE(id, url, cooldown);
      }, cooldown);
    }
  };
  xhttp.open("GET", url, true);
  xhttp.send();
}
