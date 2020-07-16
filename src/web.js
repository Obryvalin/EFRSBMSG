const express = require ('express')
const hbs=require('hbs')
const fs = require("fs")
const path=require('path')
const log = require("./utils/log")
const pgsql = require("./utils/pgsql")
const CRE = require("./utils/CRE")
var timeout = require('connect-timeout'); //express v4



const {processtext} = JSON.parse(fs.readFileSync("conf/service.json").toString());

const port = 80;

webserver = express()
webserver.set("view engine", "hbs"); // без этого hbs на express не работает
webserver.set("views", path.join(__dirname, "../templates/views")); // где hbs лежат
webserver.use(express.static(path.join(__dirname, "../public")));

hbs.registerPartials(path.join(__dirname, "../templates/partials"));
log.timestamp("Root Directory "+path.join(__dirname, "../public"))

webserver.get ('/'+processtext,(req,res)=>{
    log.timestamp('Web Call: '+req.ip)
    if (!req.query.inn) {
        return res.render(processtext,{ error: "No INN!" });
      }
    const{inn} = req.query
    FBR24.check(inn,(err,response)=>{
        const respdata ={found:"",lists:[]} ;
        if (response) {
            if (response.lists.list.length > 0) {
              response.lists.list.forEach((list) => {
                respdata.found ="Y"
                respdata.lists.push(list.name);
              });
            } else if (response.lists.list) {
                respdata.found ="Y"
                respdata.lists[0] = response.lists.list;
            }
          } else {
            respdata.found ="N" ;
          }
        res.render(processtext,{inn,error:err,response:respdata.lists,processtext})
    })
    
})
webserver.get ('/'+processtext+'/API',(req,res)=>{
  log.timestamp('API Call: '+req.ip)
    if (!req.query.inn) {
        return res.send({ error: "No INN!" });
      }
    const {source,id,inn} = req.query
    FBR24.check(inn,(err,response)=>{
        const respdata ={found:"",lists:[]} ;
        if (response) {
            if (response.lists.list.length > 0) {
              response.lists.list.forEach((list) => {
                respdata.found ="Y"
                respdata.lists.push(list.name);
              });
            } else if (response.lists.list) {
                respdata.found ="Y"
                respdata.lists[0] = response.lists.list;
            }
          } else {
            respdata.found ="N" ;
          }
          
        res.send({source,id,inn,error:err,result:respdata,processtext})
    })
    
})



webserver.get ('/'+processtext+'/getResponseData',(req,res)=>{
  const {source,id} = req.query
  log.timestamp('getResponse from '+req.ip+': \n\tSource: '+ source +"\n\tID:"+id)
  
  if (!source) {
    return res.send({ error: "No Source!" });
  }
  if (!id) {
    return res.send({ error: "No id!" });
  }
  pgsql.getResponseData(source,id,(resdata)=>{
    res.send({processtext,source,id,result:resdata.rows})
  });
  
})

webserver.get ('/'+processtext+'/Request',(req,res)=>{
  
  const {source,id} = req.query
  log.timestamp('Request from '+req.ip+': \n\tSource: '+ source +"\n\tID:"+id)
  if (!source) {
    return res.send({ error: "No Source!" });
  }
  if (!id) {
    return res.send({ error: "No id!" });
  }
  if (!reqdata) {
    return res.send({ error: "No reqdata!" });
  }
  pgsql.insertRequest(source,id,reqdata,(result)=>{
    res.send({processtext,source,id,result})
  });
  
})

webserver.get ('/'+processtext+'/stats',(req,res)=>{
  log.timestamp('Stats call: '+req.ip)
  pgsql.getStats((stats)=>{
    res.render('stats',{processtext,stats})
  });
  
})

webserver.get ('/'+processtext+'/getstats',(req,res)=>{
  // console.log('Stats call')
  pgsql.getStats((stats)=>{
    res.render('getstats',{processtext,stats})
  });
  
})
webserver.get('*',(req,res)=>{
  res.render('404')}
)
const launch = (port) => {
  
  webserver.listen(port, () => {
    log.cls(processtext, "WEB Server");
    log.timestamp("WEB Server launched on port " + port);
  }).on('error',()=>{
    // console.log(error);
    port += 1;
    launch(port);
  });

};
launch(port);