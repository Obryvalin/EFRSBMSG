const chalk = require("chalk");
const{Pool} = require("pg");
const fs = require("fs");
const validate = require("./validate");
const path = require('path')
const log = require('./log')
const jp = require('jsonpath');
const mapFactory = require("map-factory")


const pgoptions = JSON.parse(fs.readFileSync("conf/pg.json").toString());
const { dropQueries, createQueries, backupdir, dataStructure} = pgoptions;

if (!fs.existsSync(backupdir)){fs.mkdirSync(backupdir)};
//log.timestamp(pgoptions);
pool = new Pool(pgoptions)

const query = (sql,callback) =>{
  // log.timestamp(sql);
  pool.query(sql, (err, res) => {
    if (err) {
      logError("PGSQL query error for request: "+chalk.greenBright(sql))
      logError(chalk.red(err));
      if (callback){callback(err,undefined)}
    }
    if (!err) {
      
      if (callback){callback(undefined,res);}
    }
    
  });
}

const multiquery = (queries, callback) => {
  const qcnt = queries.length;
  var endedPool;
  if (qcnt == 0) {
    callback();
  }
  var donecnt = 0;
  
  queries.forEach((query) => {
    
    pool.query(query, (err, res) => {
      if (err) {
        log.timestamp(chalk.red(err))
        log.timestamp("Query was: "+query)
        logError(chalk.red(err));
      }
      donecnt = donecnt + 1;
    });
  });
  const intid = setInterval(() => {
    
    if (donecnt == qcnt) {
      clearInterval(intid);
    
      callback();
    }
    if (donecnt > qcnt){
      console.log("Multiquery error! Donecnt:"+donecnt+", qcnt:"+qcnt)
    }
    
  }, 50);
};

const backup = (callback) => {
  date = new Date();
  datedir = "" + date.getFullYear() + (date.getMonth() + 1) + date.getDate();
  const backup = path.join(__dirname, backupdir,"\\",datedir);
  try {
    if (!fs.existsSync(backupdir)){fs.mkdirSync(backupdir)};
    if (!fs.existsSync(backup)){fs.mkdirSync(backup)};
  } catch (e) {
    log.timestamp(e)
  }
  log.timestamp("BACKUP to: " + backup);
  //fs.copyFileSync('/data/*',backup)
    
  const sqls = [];
  query(
    "select tablename from pg_tables where schemaname = 'public'",
    (error, result) => {
      if (error || !result){
        log.timestamp("DB ERROR: "+error)
        if (callback){callback()}
      }
      log.timestamp("Backuping Database");
      log.timestamp(result.rows);
      result.rows.forEach((row) => {
        sqls.push(
          "COPY " + row.tablename + " TO '" + backup + "\\" + row.tablename + ".csv' DELIMITER ';' CSV HEADER;"
        );
      }); 
      multiquery(sqls, () => {
        log.timestamp("Backup complete!");
        if (callback) {
          callback();
        }
      });
    }
  );
};

const init = () => {
  log.timestamp(chalk.underline.bold("Initializing database tables"))
 

  multiquery(dropQueries,() => {
    log.timestamp("Tables droped!")
    multiquery(createQueries,()=>{
      log.timestamp("Tables created!")
      pool.end();
      log.timestamp("Init completed!")});
  });

  
};

const registerWorker = (workerName,callback) =>{
  
  sql = "INSERT INTO workers(workerName,updated) values('"+workerName+"',CURRENT_TIMESTAMP)";
  query(sql,()=>{
    if(callback){callback();}
  });
}
  

const pingWorker = (workerName,callback) =>{
  
  sql = "UPDATE workers set updated=CURRENT_TIMESTAMP where workerName='"+workerName+"'";
  query(sql,()=>{
    if(callback){callback();}
  });
}

const grabRequests = (workerName,grabCount,callback) =>{
  
  sql = "UPDATE log set worker = '"+workerName+"' where id in (SELECT id from log where (worker is null or worker = '"+workerName+"') and rep is null order by id limit "+grabCount+" )"
  query(sql,()=>{
    if(callback){callback();}
  });
  
}

const getUnfinishedRequests = (workerName,cooldown,callback)=>{
  sql = "select reqdata.* from reqdata inner join log on reqdata.source=log.source and reqdata.id=log.id where log.worker = '"+workerName+"' and log.rep is null and (log.snd is null or EXTRACT(EPOCH FROM current_timestamp-log.snd) > "+cooldown+")";
  
  pool.query(sql, (err, requestsToSend) => {
    if (err) {
      log.timestamp(chalk.red(err));
    }
    if (!err) {
     
      requestsToSend.rows.forEach((row)=>{
        log.timestamp("Request :" + chalk.yellowBright(row.source+"-"+row.id))
        logSend(row.source,row.id)
      })
    
      callback(requestsToSend.rows);
    }
    
  });
 
}

const logSend = (source,id,callback) =>{
  sql = "Update log set snd = current_timestamp where source = '"+source+"' and id = '"+id+"'";
  query(sql,()=>{
    if(callback){callback();}
  });
}

const logResponse = (source,id,result,callback) =>{
  
  sql = "Update log set rep = current_timestamp, result='"+result+"' where source = '"+source+"' and id = '"+id+"'";
  console.log("logResponse  "+sql)
  query(sql,()=>{
    if(callback){callback();}
  });
}
const logError = (error) =>{
  if(error) query("INSERT into errorlog(error,datetime) values('"+error+"',CURRENT_TIMESTAMP)");
}


const getStats = (callback) => {
  var statscnt = 0;
  stats = {}
  query("Select count(id) as count from log where rep is null",(err,res)=>{
    
    stats.unfinished = res.rows[0].count
    statscnt = statscnt+1;
  })
  query("Select count(id) as count from log where EXTRACT(EPOCH FROM current_timestamp-log.snd) <60*60",(err,res)=>{
   
    stats.lastHour = res.rows[0].count;
    statscnt = statscnt+1;
  })
  query("Select count(id) as count from log where snd::date = current_date",(err,res)=>{
    
    stats.today= res.rows[0].count;
    statscnt = statscnt+1;
  })
  query("Select EXTRACT(epoch FROM avg(rep-snd)) as avg from log where rep is not null",(err,res)=>{
  
    stats.avg= res.rows[0].avg;
    statscnt = statscnt+1;
  })
  query("Select EXTRACT(epoch FROM max(rep-snd)) as max from log where rep is not null",(err,res)=>{
   
    stats.max= res.rows[0].max;
    statscnt = statscnt+1;
  })

  query("Select extract(hour from snd) as x, count(extract(hour from snd)) as y from log where snd::date = current_date group by x order by x",(err,res)=>{
    stats.cntByHour = res.rows;
    statscnt = statscnt+1;
  })
  const intid = setInterval(()=>{
    
    if (statscnt==6){
      
      clearInterval(intid)
      if(callback){callback(stats)}

    }
  },100);
}
const printStats = (stats)=>{
      console.log(stats)
     
}
const getResponseData = (source,id,callback)=>{
  query("Select * from resdata where source='"+source+"' and id='"+id+"'",(err,res)=>{
    if (!res) callback({error:"Not found! "+ err})
    callback(res);
  })
}
//=====================================

    
const injectToArray = (VarArray,name,value) =>{
  if(!VarArray){return undefined}
if(!value){return VarArray}
  if(Array.isArray(VarArray)){
    VarArray.forEach((item)=>{
         item[name] = value; 
      })
      return VarArray;
  }
  if(VarArray){
    VarArray[name]=value;
  }
  return VarArray;
}


  
  // return jp.query(obj,"$."+path+'[0]')

  
const submitResponse = (source,id,response,callback) =>{
  var resparray=[];
  

  if (response) {
  report = response.Response.Data.Report
  resultInfo = response.Response.ResultInfo
    if(report){
      const mapper=mapFactory()
      // console.log("Report transform")
      if (report.ArbitrationCases){
        report.ArbitrationCases.Year.forEach((year)=>{
          mapper.map("Plaintiff[@CasesNumber]").to("Plaintiff_CaseNumber")
          mapper.map("Plaintiff[@Sum]").to("Plaintiff_Sum")
          mapper.map("Defendant[@CasesNumber]").to("Defendant_CasesNumber")
          mapper.map("Defendant[@Sum]").to("Defendant_Sum")
          mapper.map("ThirdOrOtherPerson[@CasesNumber]").to("ThirdOrOtherPerson_CasesNumber")
          year = Object.assign(year,mapper.execute(year))
        }
      )}
      if (report.BoardOfDirectors){
        report.BoardOfDirectors.Member = injectToArray(report.BoardOfDirectors.Member,"ActualDate",report.BoardOfDirectors['@ActualDate'])
        report.BoardOfDirectors.Member.forEach((member)=>{

          mapper.map("Position[@Name]").to("PositionName")
          mapper.map("Position[@Code]").to("PositionCode")
          member = Object.assign(member,mapper.execute(member))
        }
      )}
      if (report.ExecutiveBody){
        report.ExecutiveBody.Member = injectToArray(report.ExecutiveBody.Member,"ActualDate",report.ExecutiveBody['@ActualDate'])
        report.ExecutiveBody.Member.forEach((member)=>{
          mapper.map("Position[@Name]").to("PositionName")
          mapper.map("Position[@Code]").to("PositionCode")
          member = Object.assign(member,mapper.execute(member))
      })
      }
      report.Finance.FinPeriod.forEach((period)=>{
        if (period.StringList){
          period.StringList.String = injectToArray(period.StringList.String,"BalanceType",report.Finance['@BalanceType'])
          period.StringList.String = injectToArray(period.StringList.String,"PeriodName",period['@PeriodName'])
          period.StringList.String = injectToArray(period.StringList.String,"DateBegin",period['@DateBegin'])
          period.StringList.String = injectToArray(period.StringList.String,"DateEnd",period['@DateEnd'])
        }
      })
      
      if (report.StateContracts){
        if(report.StateContracts.FederalLaw223){
          if (Array.isArray(report.StateContracts.FederalLaw223.Year)){
          report.StateContracts.FederalLaw223.Year.forEach((year)=>{
            mapper.map("Tenders[@AdmittedNumber]").to("AdmittedNumber")
            mapper.map("Tenders[@NotAdmittedNumber]").to("NotAdmittedNumber")
            mapper.map("Tenders[@WinnerNumber]").to("WinnerNumber")
            mapper.map("Contracts[@SignedNumber]").to("SignedNumber")
            mapper.map("Contracts[@Sum]").to("Sum")
            year = Object.assign(year,mapper.execute(year))
          }
        )}
    
        else{
          
          mapper.map("Tenders[@AdmittedNumber]").to("AdmittedNumber")
          mapper.map("Tenders[@NotAdmittedNumber]").to("NotAdmittedNumber")
          mapper.map("Tenders[@WinnerNumber]").to("WinnerNumber")
          mapper.map("Contracts[@SignedNumber]").to("SignedNumber")
          mapper.map("Contracts[@Sum]").to("Sum")
          report.StateContracts.FederalLaw223.Year = Object.assign(report.StateContracts.FederalLaw223.Year,mapper.execute(report.StateContracts.FederalLaw223.Year))
        }
      }
      if(report.StateContracts.FederalLaw94){
        if (Array.isArray(report.StateContracts.FederalLaw94.Year)){
          report.StateContracts.FederalLaw94.Year.forEach((year)=>{
            mapper.map("Tenders[@AdmittedNumber]").to("AdmittedNumber")
            mapper.map("Tenders[@NotAdmittedNumber]").to("NotAdmittedNumber")
            mapper.map("Tenders[@WinnerNumber]").to("WinnerNumber")
            mapper.map("Contracts[@SignedNumber]").to("SignedNumber")
            mapper.map("Contracts[@Sum]").to("Sum")
            year = Object.assign(year,mapper.execute(year))
      })}
      else{
        mapper.map("Tenders[@AdmittedNumber]").to("AdmittedNumber")
        mapper.map("Tenders[@NotAdmittedNumber]").to("NotAdmittedNumber")
        mapper.map("Tenders[@WinnerNumber]").to("WinnerNumber")
        mapper.map("Contracts[@SignedNumber]").to("SignedNumber")
        mapper.map("Contracts[@Sum]").to("Sum")
        report.StateContracts.FederalLaw94.Year = Object.assign(report.StateContracts.FederalLaw94.Year,mapper.execute(report.StateContracts.FederalLaw94.Year))
      }
    }
    if(report.ExecutiveBody){
      if (Array.isArray(report.ExecutiveBody.Member)){
        report.ExecutiveBody.Member.forEach((member)=>{
          mapper.map("Position[@Code]").to("PositionCode")
          mapper.map("Position[@Name]").to("PostionName")
         
          member = Object.assign(member,mapper.execute(member))
    })}
    else{
      mapper.map("Tenders[@AdmittedNumber]").to("AdmittedNumber")
      mapper.map("Tenders[@NotAdmittedNumber]").to("NotAdmittedNumber")
      mapper.map("Tenders[@WinnerNumber]").to("WinnerNumber")
      mapper.map("Contracts[@SignedNumber]").to("SignedNumber")
      mapper.map("Contracts[@Sum]").to("Sum")
      report.StateContracts.FederalLaw94.Year = Object.assign(report.StateContracts.FederalLaw94.Year,mapper.execute(report.StateContracts.FederalLaw94.Year))
    }
  }
    }
      report.PersonsWithoutWarrant.Person = injectToArray(report.PersonsWithoutWarrant.Person,"ActualDate",report.PersonsWithoutWarrant['@ActualDate'])
      mapper.map("Status[@Type]").to("Status")
      mapper.map("OKOPF[@CodeNew]").to("OKOPF_New")
      mapper.map("AdjustAddress[@Address]").to("AdjustAddress")
      mapper.map("CreditRisk[@CreditRiskValue]").to("CreditRiskValue")
      mapper.map("CreditRisk[@CreditRiskDesc]").to("CreditRiskDesc")
      mapper.map("FailureScore[@FailureScoreValue]").to("FailureScoreValue")
      mapper.map("FailureScore[@FailureScoreDesc]").to("FailureScoreDesc")
      mapper.map("PaymentIndex[@PaymentIndexValue]").to("PaymentIndexValue")
      mapper.map("PaymentIndex[@PaymentIndexDesc]").to("PaymentIndexDesc")
      mapper.map("CompanySize[@Revenue]").to("CompanySizeRevenue")
      mapper.map("CompanySize[@Description]").to("CompanySizeDescription")
      mapper.map("CompanyWithSameInfo.AddressCount").to("SameAddress")
      mapper.map("CompanyWithSameInfo.ManagerCountInCountry").to("SameManagerCountry")
      mapper.map("CompanyWithSameInfo.ManagerCountInCountry").to("SameManagerCountry")
      mapper.map("CompanyWithSameInfo.ManagerCountInRegion").to("SameManagerRegion")

      mapper.map("IndexOfDueDiligence[@Index]").to("IndexOfDueDiligenceIndex")
      mapper.map("IndexOfDueDiligence[@Index]").to("IndexOfDueDiligenceIndexDesc")
      mapper.map("OKATO[@RegionName]").to("OKATORegionName")
      mapper.map("OKATO[@RegionCode]").to("OKATORegionCode")
      mapper.map("OKATO[@Code]").to("OKATO")
      mapper.map("OKOGU[@Code]").to("OKOGUCode")
      mapper.map("OKOGU[@Name]").to("OKOGUName")
      mapper.map("OKFS[@Code]").to("OKFSCode")
      mapper.map("OKFS[@Name]").to("OKFSName")
      mapper.map("Status[@Date]").to("StatusDate")
      mapper.map("OKOPF[@Name]").to("OKOPFName")
      report = Object.assign(report,mapper.execute(report))
      // console.log("Report:")
      //  report.Finance.FinPeriod.forEach((period)=>{
      //    console.log(period.StringList.String)
      //  })
      log.timestamp("Creating queries for "+source+"-"+id)
      dataStructure.forEach((entity)=>{
        rows = jp.query(report,entity.path)
        rows = rows[0]
        // console.log("Rows "+entity.name+": ")
        // console.log(rows)
        
        if (rows){
          if (Array.isArray(rows)){
            for (row=0;row<rows.length;row++){
              res = "INSERT INTO "+ entity.name+" (source,id,"
              entity.structure.forEach((attr)=>{
             
                res+=attr.name+","
             
              })
              res+=") values('"+source+"','"+id+"',"
              entity.structure.forEach((attr)=>{
                let value = jp.query(rows[row] || {},"$['"+attr.path+"']")
                value = value[0]
                // console.log("attr.name:\t"+attr.name+"\tattr.path\t"+attr.path+"\tvalue:\t"+value)
                if (attr.type=="date"){
                  if (!value) {
                    value = "null"
                    res+=value+","
                  }
                  else{
                    res+="'"+value+"',"
                  }
                }
                if (attr.type =="double precision" ){
                  if (!value) value = "null"
                  res+=value+","
                }
                if (attr.type!="date" && attr.type!="double precision"){
                  value = value ||""
                  value = value.toString().replace(/[\'\"\t]/g," ")
                  res+="'"+value+"',"
                }
              })
              res+=")"
              res = res.replace(/\,\)/g,")")
              // console.log("Res:")
              // console.log(res)
              resparray.push(res)
            }
          } else{
            res = "INSERT INTO "+ entity.name+" (source,id,"
              entity.structure.forEach((attr)=>{
               
                res+=attr.name+","
               
              })
              res+=") values('"+source+"','"+id+"',"
              entity.structure.forEach((attr)=>{
                let value = jp.query(rows || {},"$['"+attr.path+"']")
                value = value[0]
                // console.log("attr.name:\t"+attr.name+"\tattr.path\t"+attr.path+"\tvalue:\t"+value)
                if (attr.type=="date"){
                  if (!value) {
                    value = "null"
                    res+=value+","
                  }
                  else{
                    res+="'"+value+"',"
                  }
                }
                if (attr.type =="double precision" ){
                  if (!value) value = "null"
                  res+=value+","
                }
                if (attr.type!="date" && attr.type!="double precision"){
                  value = value ||""
                  value = value.toString().replace(/[\'\"\t]/g," ")
                  res+="'"+value+"',"
                }
              })
              res+=")"
              res = res.replace(/\,\)/g,")")
              // console.log("Res:")
              // console.log(res)
              resparray.push(res)
              
          }
          result = "Found"
        } 
        
      })

     }else{
       result = "Not Found"
      }
    }
  // console.log("RespArray: " +source+"-"+id)
  // console.log(resparray)
  multiquery(resparray,()=>{
    log.timestamp("Response: " + chalk.greenBright(source+"-"+id))
    logResponse(source,id,result);
  })
  
}

const insertQueries = (source, inns, callback) => {
  var reqid = 0;
  inns.forEach((inn) => {
    if (validate.INN(inn)) {
      log.timestamp("inserting "+inn)
      insertRequest(source, reqid, inn);
    } else {
      logError("Invalid INN [" + inn + "]");
    }
    reqid = reqid + 1;
  })
  ;
  const intid = setInterval(()=>{
    if (reqid==inns.length){
      pool.end();
      clearInterval(intid);
      log.timestamp("Inserted!")
    }
  },500);
 
};

const insertRequest = (source, id, inn, callback) => {
  var sql ="Insert into reqdata(source,id,inn) values ('" +source +"','" + id + "','" + inn + "')";
  var sql2 = "Insert into log(source,id) values ('" + source + "','" + id + "')";
  // log.timestamp(sql)
  
 
  pool.query(sql, (err, res) => {
    if (err) {
      logError(err);
    }
    if (!err) {
      
      // log.timestamp(sql2)
      pool.query(sql2, (err, res) => {
        if (err) {
          logError(err)
        }
        if (!err) {
            if(callback){callback()};
         }
      });


  }});
};



module.exports={
  backup : backup,  
  init : init,
  grabRequests : grabRequests,
  getUnfinishedRequests : getUnfinishedRequests,
  submitResponse : submitResponse,
  insertQueries : insertQueries,
  insertRequest : insertRequest,
  getStats : getStats,
  printStats : printStats,
  logError : logError,
  registerWorker : registerWorker,
  pingWorker : pingWorker,
  getResponseData : getResponseData
}