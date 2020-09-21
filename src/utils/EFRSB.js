const request = require("request");
const validate = require("./validate.js");
const log = require("./log");
const fs = require("fs");
const xml = require("./xml");
const dateformat = require("date-format");

const { login, password, url, timeout } = JSON.parse(
  fs.readFileSync("conf/EFRSB.json")
);
const templateXML = fs.readFileSync("template.xml").toString();

const fillTemplate = (propObj, template) => {
  for (var prop in propObj) {
    template = template.replace("@" + prop + "@", propObj[prop]);
  }
  return template;
};

const getMessages = (reqdata, callback) => {
  if (!reqdata.bankruptid) {
    if (callback) {
      callback("Bad bankruptId", undefined);
    }
  }
  reqdata.startdate = dateformat("yyyy-MM-dd", reqdata.startdate);

  // console.log(body);
  const options = {
    url,
    auth: {
      user: login,
      password,
      sendImmediately: false,
    },
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      SOAPAction:
        "http://tempuri.org/IMessageService/GetDebtorMessagesContentForPeriodByIdBankrupt",
    },
    timeout,
  };
  options.body = fillTemplate(reqdata, templateXML);

  request(options, (error, response) => {
    // console.log(response.body)
    if (!response || !response.statusCode || response.statusCode != 200) {
      callback("Error statusCode " + response.statusCode, undefined);
    }
    if (error) {
      callback(error, undefined);
    }
    else {
      // console.log("RESP BODY\n" + response.body)
      xml.toJSON(response.body, (err, soapedJSON) => {
        if (err) {
          console.log("err\n" + err);
          callback(err, undefined);
        }
        if (soapedJSON.Envelope.Body) {
          const response =
            soapedJSON.Envelope.Body
              .GetDebtorMessagesContentForPeriodByIdBankruptResponse
              .GetDebtorMessagesContentForPeriodByIdBankruptResult;
          // console.log(xml.fixTags(response))

          xml.toJSON(xml.fixTags(response), (err, JSON) => {
            // console.log(JSON)
            // response.response.JSON = JSON;
            // console.log("Response:")
            // console.log(response)
          if (err){
            callback(err,undefined)
          }
            callback(undefined, JSON.Messages);
          });
        }
      });
    }
  });
};

const analyzeMessageInfo = (messageData) => {
  let EFRSBResponse = {
    messages: [],
    creditors: [],
  };
  let URL = ""
  if (messageData.MessageURLList && messageData.MessageURLList.MessageURL && messageData.MessageURLList.MessageURL["@URL"]){
    URL = messageData.MessageURLList.MessageURL["@URL"];
  }
  EFRSBResponse.messages.push({
    type: messageData.MessageInfo["@MessageType"],
    messageId: messageData.Id,
    date: messageData.PublishDate,
    URL:URL
  });
  if (messageData.MessageInfo.StartOfExtrajudicialBankruptcy) {
    obligations =
      messageData.MessageInfo.StartOfExtrajudicialBankruptcy
        .CreditorsNonFromEntrepreneurship.MonetaryObligations
        .MonetaryObligation;
    if (obligations) {
      if (Array.isArray(obligations)) {
        obligations.forEach((obligation) => {
          EFRSBResponse.creditors.push({
            name: obligation.CreditorName,
            sum: obligation.TotalSum,
            debt: obligation.DebtSum,
          });
        });
      } else {
        EFRSBResponse.creditors.push({
          name: obligations.CreditorName,
          sum: obligations.TotalSum,
          debt: obligations.DebtSum,
        });
      }
    }
  }
  if (messageData.MessageInfo.TerminationOfExtrajudicialBankruptcy) {
  }
  return EFRSBResponse;
};

module.exports = {
  fillTemplate: fillTemplate,
  getMessages: getMessages,
  analyzeMessageInfo: analyzeMessageInfo,
};
