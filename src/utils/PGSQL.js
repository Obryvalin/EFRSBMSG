const chalk = require("chalk");
const{Pool} = require("pg");
const fs = require("fs");
const validate = require("./validate");
const path = require('path')
const log = require('./log')
const jp = require('jsonpath')

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
  
const submitResponse = (source,id,response,callback) =>{
  var resparray=[];
  

  if (response) {
  report = response.Response.Data.Report
    if(report){
      //Edit ftw
      if (report.ArbitrationCases){
      report.ArbitrationCases.Year.forEach((year)=>{
        year.Plaintiff_CasesNumber = year.Plaintiff['@CasesNumber']
        year.Plaintiff_Sum = year.Plaintiff['@Sum']
        year.Defendant_CasesNumber = year.Defendant['@CasesNumber']
        year.Defendant_Sum = year.Defendant['@Sum']
        year.ThirdOrOtherPerson_CasesNumber = year.ThirdOrOtherPerson['@CasesNumber']
      })}
      if (report.BoardOfDirectors){
      report.BoardOfDirectors.Member = injectToArray(report.BoardOfDirectors.Member,ActualDate,report.BoardOfDirectors['@ActualDate'])
      report.BoardOfDirectors.Member.forEach((member)=>{
          member.PositionName = member.Position['@Name']
          member.PositionCode = member.Position['@Code']
      })}
      if (report.ExecutiveBody){
      report.ExecutiveBody.Member = injectToArray(report.ExecutiveBody.Member,ActualDate,report.ExecutiveBody['@ActualDate'])
      report.ExecutiveBody.Member.forEach((member)=>{
          member.PositionName = member.Position['@Name']
          member.PositionCode = member.Position['@Code']
      })
      }
      if (report.Finance){
      report.Finance.FinPeriod.StringList.String = (report.Finance.FinPeriod.StringList.String,BalanceType,report.Finance['@BalanceType'])
      report.Finance.FinPeriod.forEach((finperiod)=>{
        finperiod.StringList.String.forEach((string)=>{
          string.PeriodName = finperiod["@PeriodName"]
          string.DateBegin = finperiod["@DateBegin"]
          string.DateEnd = finperiod["@DateEnd"]
        })
      })}
      report.PersonsWithoutWarrant.Person = injectToArray(report.PersonsWithoutWarrant.Person,ActualDate,report.PersonsWithoutWarrant['@ActualDate'])
      report.Status = report.Status['@Type']
      report.OKOPF_New = report.OKOPF['@CodeNew']
      report.AdjustAddress = report.AdjustAddress['@Address']
      report.CreditRiskValue = report.CreditRisk['@CreditRiskValue']
      report.CreditRiskDesc = report.CreditRisk['@CreditRiskDesc']
      report.FailureScoreValue = report.FailureScore['@FailureScoreValue']
      report.FailureScoreDesc = report.FailureScore['@FailureScoreDesc']
      report.PaymentIndexValue = report.PaymentIndex['@PaymentIndexValue']
      report.PaymentIndexDesc = report.PaymentIndex['@PaymentIndexDesc']
      report.CompanySizeRevenue = report.CompanySize['@Revenue']
      report.CompanySizeDescription = report.CompanySize['@Description']
      report.SamePhone =  report.CompanyWithSameInfo.TelephoneCount
      report.SameAddress =  report.CompanyWithSameInfo.AddressCount
      report.SameManagerCountry =  report.CompanyWithSameInfo.ManagerCountInCountry
      report.SameManagerRegion =  report.CompanyWithSameInfo.ManagerCountInRegion
      report.IndexOfDueDiligenceIndex = report.IndexOfDueDiligence['@Index']
      report.IndexOfDueDiligenceIndexDesc = report.IndexOfDueDiligence['@Index']
      report.OKATORegionName = report.OKATO['@RegionName']
      report.OKATORegionCode = report.OKATO['@RegionCode']
      report.OKATO = report.OKATO['@Code']
      report.OKOGUCode = report.OKOGU['@Code']
      report.OKOGUName = report.OKOGU['@Name']
      report.OKFSCode = report.OKFS['@Code']
      report.OKFSName = report.OKFS['@Name']
      report.StatusDate = report.Status['@Date']
      report.OKOPFCode = report.OKOPF['@Code']
      report.OKOPFName = report.OKOPF['@Name']
      if (report.StateContracts.FederalLaw223){
      report.StateContracts.FederalLaw223.Year.forEach((year)=>{
        year.AdmittedNumber = year.Tenders["@AdmittedNumber"]
        year.NotAdmittedNumber = year.Tenders["@NotAdmittedNumber"]
        year.WinnerNumber = year.Tenders["@WinnerNumber"]
        year.SignedNumber = year.Contracts["@SignedNumber"]
        year.Sum = year.Contracts["@Sum"]
      })}
      if(report.StateContracts.FederalLaw94){
      report.StateContracts.FederalLaw94.Year.forEach((year)=>{
        year.AdmittedNumber = year.Tenders["@AdmittedNumber"]
        year.NotAdmittedNumber = year.Tenders["@NotAdmittedNumber"]
        year.WinnerNumber = year.Tenders["@WinnerNumber"]
        year.SignedNumber = year.Contracts["@SignedNumber"]
        year.Sum = year.Contracts["@Sum"]
      })}
      dataStructure.forEach((entity)=>{
        rows = jp.query(report,entity.path)
        if (rows){
          if (Array.isArray(rows)){
            for (row=0;row++;row<rows.length){
              res = "INSERT INTO "+ entity.name+" ("
              entity.structure.forEach((attr)=>{
                if (attr.name!=entity.structure[entity.structure.length-1]){
                res+=attr.name+","
                } else(res+=attr.name)
              })
              res+=") values("
              entity.structure.forEach((attr)=>{
                if (attr.name!=entity.structure[entity.structure.length-1]){
                res+=jp.query(report,entity.path+"["+row+"]["+attr.path+"]")+","
                } else{
                  res+=jp.query(report,entity.path[attr.path])
                }
              })
              res+=")"
              console.log(res)
              resparray.push(res)
            }
          }
      
        }
        else{

        }
      })

     } else {
    
    result = "not found";
  }}
  multiquery(resparray,()=>{
    log.timestamp("Response: " + chalk.greenBright(source+"-"+id))
    logResponse(source,id,result);
  })
  
}

const insertQueries = (source, inns, callback) => {
  var reqid = 0;
  inns.forEach((inn) => {
    if (INN.validateINN(inn)) {
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