
const fastxml = require("fast-xml-parser");
const log = require("./log");

const xmloptions = {
  attributeNamePrefix: "@",
  textNodeName: "value",
  ignoreAttributes: false,
  ignoreNameSpace:true,
  allowBooleanAttributes: true,
  parseNodeValue: true,
  parseAttributeValue: true,
};



const fixTags = (xml)=>{
   console.log(xml)
   xml = xml.replace(/&amp;amp;/g,'&') 
   xml = xml.replace(/&lt;/g,"<")
   xml = xml.replace(/&gt;/g,">")
   xml = xml.replace(/&quot;/g,'"')
   xml = xml.replace(/&apos;/g,"'")
      console.log(xml)
      return xml
}
 

const validate = (xml) => {
  if (!fastxml.validate(xml)) {
    return false;
  } else {
    return true;
  }
};

const toJSON = (xml, callback) => {
  if (!fastxml.validate(xml)) {
    callback("Validation Failed", undefined);
  }
  log.timestamp("valid");
  json = fastxml.parse(xml, xmloptions);
  callback(undefined, json);
};

module.exports = {
  fixTags: fixTags,
  validate: validate,
  toJSON: toJSON,
};
