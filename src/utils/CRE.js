const request = require("easy-soap-request");
const validate = require("./validate.js");
const log = require("./log");
const fs = require("fs");
const xml = require("./xml");

const CREoptions = JSON.parse(fs.readFileSync("conf/CRE.json"));
const { url, wsdl, timeout } = CREoptions;
const templateXML = fs.readFileSync("template.xml").toString();

const fillTemplate = (propObj, template) => {
  for (var prop in propObj) {
    template = template.replace("@" + prop + "@", propObj[prop]);
  }
  return template;
};

const makeRequest = async (url, headers, body, timeout) => {
  result = await request({ url, headers, xml: body, timeout });
  return result.response;
};

const requestSPEXT = (reqdata, callback) => {
  if (!validate.INN(reqdata.inn)) {
    if (callback) {
      callback("Bad INN", undefined);
    }
  }

  const body = fillTemplate(reqdata, fillTemplate(CREoptions, templateXML));
  // console.log(body);
  const headers = {
    "Content-Type": "text/xml;charset=UTF-8",
    soapAction: "urn:getBusiness"
  };

  resp = makeRequest(url, headers, body, timeout)
    .then(soapedRes => {
      if (soapedRes.statusCode != 200) {
        callback("Error statusCode " + soapedRes.statusCode, undefined);
      }
      if (soapedRes.body) {
        // console.log("RESP BODY\n" + resp.body)
        xml.toJSON(soapedRes.body, (err, soapedJSON) => {
          if (err) {
            console.log("err\n" + err);
            callback(err, undefined);
          }
          if (!err) {
            const response = soapedJSON.Envelope.Body.getBusinessout;
            response.response.value = xml.fixTags(response.response.value);
            xml.toJSON(response.response.value, (err, JSON) => {
              response.response.JSON = JSON;
              // console.log("Response:")
              // console.log(response)
              callback(undefined, response);
            });
          }
        });
      }
    })
    .catch(error => {
      console.log("err\n" + error);
      callback(error, undefined);
    });
};

module.exports = {
  fillTemplate: fillTemplate,
  requestSPEXT: requestSPEXT
};
