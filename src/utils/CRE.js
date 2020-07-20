const request = require("request");
const validate = require("./validate.js");
const log = require("./log");
const fs = require("fs");
const xml = require('./xml')

const CREoptions = JSON.parse(
  fs.readFileSync("conf/CRE.json")
);

const templateXML = fs.readFileSync("template.xml").toString();

const fillTemplate = (propObj, template) => {
  for (var prop in propObj) {
    filledTemplate = template.replace("@" + prop + "@", propObj[prop]);
  }
  return filledTemplate
};

const requestSPEXT = (reqdata, callback) => {
  if (!validate.INN(reqdata.inn)) {
    if (callback) {
      callback("Bad INN", undefined);
    }
  }
  const body = fillTemplate(reqdata,fillTemplate(CREoptions,templateXML))
  const headers = {};
  request({ url, headers, body, timeout}, (error, resp) => {
    if (error) {
      callback(error, undefined);
    }
    if (resp) {
      //   log.timestamp(resp.body.response.state)
      xml.toJSON(resp.body,(err,res)=>{
          if (!res.Envelope.Body.getBusinessout.response['@response']){
            callback("No response",undefined)
          }

      })
      if (!res.Envelope.Body.getBusinessout.response.value) {
        callback("Service Error", undefined, undefined);
      } else {
        xml.toJSON(xml.fixTags(res.Envelope.Body.getBusinessout.response.value),(err,res)=>{
            if (err){
                callback("error parsing",undefined)
            }
            callback(undefined, res);
        })
        
      }
    }
  });
};


module.exports = {
  fillTemplate:fillTemplate,
  requestSPEXT: requestSPEXT,
};
