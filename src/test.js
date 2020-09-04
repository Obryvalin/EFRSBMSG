var request = require('request');
var options = {
  'method': 'POST',
  'url': 'http://bankrot.fedresurs.ru/MessageService/WebService.svc',
  auth:{
      user: 'Obrivalin1',
      password:'DRNAZ6',
      sendImmediately: false
  },
  'headers': {
    'SOAPAction': 'http://tempuri.org/IMessageService/GetDebtorMessagesContentForPeriodByIdBankrupt',
    'Content-Type': 'text/xml',
    // 'Authorization': 'Digest username="Obrivalin1", realm="http://bankrot.fedresurs.ru/MessageService/WebService.svc", nonce="", uri="/MessageService/WebService.svc", algorithm="MD5", qop=auth, nc=00000001, cnonce="", response="e77ab6a812b105c9a7ebde43deb13a87"',
   
  },
  body: "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\"\r\n    xmlns:tem=\"http://tempuri.org/\">\r\n    <soapenv:Header/>\r\n    <soapenv:Body>\r\n        <tem:GetDebtorMessagesContentForPeriodByIdBankrupt>\r\n            <tem:idBankrupt>171829</tem:idBankrupt>\r\n            <tem:startDate>2020-01-01</tem:startDate>\r\n        </tem:GetDebtorMessagesContentForPeriodByIdBankrupt>\r\n    </soapenv:Body>\r\n</soapenv:Envelope>"

};
request(options, function (error, response) {
  if (error) throw new Error(error);
  console.log(response.body);
});
