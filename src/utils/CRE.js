const request = require('request')
const validate = require("./validate.js")
const log = require('./log')
const fs = require('fs')

const {url,user,password,timeout} = JSON.parse(fs.readFileSync('conf/CRE.json'))

const templateXML = fs.readFileSync('../template.xml').toString()

const requestSPEXT = (inn,callback) =>{
    if (!validate.INN(inn)){
        if (callback){callback("Bad INN",undefined)}
    }
    request({ url, body, timeout }, (error, resp) => {
        if (error) {
            callback(error,undefined);
        }
        if (resp) {
        //   log.timestamp(resp.body.response.state)
        if (!resp.body.response.state.root.response.status) {
          callback("Service Error",undefined,undefined);
        }else{
         callback(undefined,resp.body.response.state);
        }

         }
      });
} 

module.exports = {
    requestSPEXT:requestSPEXT
}