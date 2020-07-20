const chalk = require("chalk");
const{Pool} = require("pg");
const fs = require("fs");
const validate = require("./validate");
const path = require('path')
const log = require('./log')

const pgoptions = JSON.parse(fs.readFileSync("conf/pg.json").toString());
const { dropQueries, createQueries, backupdir} = pgoptions;
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

const submitResponse = (source,id,response,callback) =>{
  var resparray=[];
  

  if (response) {
   
    if(response.lists){
    if (response.lists.list.length > 1) {
      response.lists.list.forEach((list) => {
        // log.timestamp("insert into resdata(source,id,found,list) values('"+source+"','"+id+"','"+"Y"+"','"+list.name+"')")
        resparray.push("INSERT INTO ACCESSIBLEFINDATA( SOURCE,ID,IDPERIOD,NAME,ENDDATE) values( SOURCE,ID,IDPERIOD,NAME,ENDDATE)")
        resparray.push("INSERT INTO ADJUSTADDRESSES( SOURCE,ID,POSTCODE,ADDRESS,REGION,AREA,CITY,STREET,HOUSE,FIASCODE,FIASREGION,FIASAREA,FIASCITY,FIASPLACE,FIASSTREET,ACTUALDATE) values( SOURCE,ID,POSTCODE,ADDRESS,REGION,AREA,CITY,STREET,HOUSE,FIASCODE,FIASREGION,FIASAREA,FIASCITY,FIASPLACE,FIASSTREET,ACTUALDATE)")
        resparray.push("INSERT INTO ARBITRATIONCASES( SOURCE,ID,YEAR,NUMBERPLAINTIFF,SUMPLAINTIFF,NUMBERDEFENDANT,SUMDEFENDANT,NUMBERTHIRD) values( SOURCE,ID,YEAR,NUMBERPLAINTIFF,SUMPLAINTIFF,NUMBERDEFENDANT,SUMDEFENDANT,NUMBERTHIRD)")
        resparray.push("INSERT INTO ATTR( SOURCE,ID,RESULTTYPE,EXECUTIONTIME) values( SOURCE,ID,RESULTTYPE,EXECUTIONTIME)")
        resparray.push("INSERT INTO BANKRUPTCYMESSAGE( SOURCE,ID,DATE,TYPE,CASENUMBER,IDTYPE) values( SOURCE,ID,DATE,TYPE,CASENUMBER,IDTYPE)")
        resparray.push("INSERT INTO BOARDOFDIRECTORS( SOURCE,ID,ACTUALDATE,NAME,BIRTHDAYYEAR,CODE,POS,SHAREPART,INN) values( SOURCE,ID,ACTUALDATE,NAME,BIRTHDAYYEAR,CODE,POS,SHAREPART,INN)")
        resparray.push("INSERT INTO EVENTSLIST( SOURCE,ID,EVENTTYPEID,TYPE,DATE) values( SOURCE,ID,EVENTTYPEID,TYPE,DATE)")
        resparray.push("INSERT INTO EXECUTIVEBODY( SOURCE,ID,ACTUALDATE,NAME,BIRTHDAYYEAR,CODE,POS,SHAREPART,INN) values( SOURCE,ID,ACTUALDATE,NAME,BIRTHDAYYEAR,CODE,POS,SHAREPART,INN)")
        resparray.push("INSERT INTO FAXLIST( SOURCE,ID,CODE,NUMBER,STATUS) values( SOURCE,ID,CODE,NUMBER,STATUS)")
        resparray.push("INSERT INTO FEDERALTAXREGISTRATION( SOURCE,ID,REGDATE,REGAUTHORITY,REGAUTHORITYADDRESS) values( SOURCE,ID,REGDATE,REGAUTHORITY,REGAUTHORITYADDRESS)")
        resparray.push("INSERT INTO FINANCE( SOURCE,ID,BALANCETYPE,PERIODNAME,DATEBEGIN,DATEEND,FORM,SECTION,NAME,CODE,VALUE,IDFINPOK) values( SOURCE,ID,BALANCETYPE,PERIODNAME,DATEBEGIN,DATEEND,FORM,SECTION,NAME,CODE,VALUE,IDFINPOK)")
        resparray.push("INSERT INTO INCLUDEINLIST( SOURCE,ID,LISTNAME) values( SOURCE,ID,LISTNAME)")
        resparray.push("INSERT INTO LEADERLIST( SOURCE,ID,FIO,POSITION,ACTUALDATE,INN) values( SOURCE,ID,FIO,POSITION,ACTUALDATE,INN)")
        resparray.push("INSERT INTO LEGALADDRESSES( SOURCE,ID,POSTCODE,ADDRESS,REGION,AREA,CITY,STREET,HOUSE,FIASCODE,FIASREGION,FIASAREA,FIASCITY,FIASPLACE,FIASSTREET,ACTUALDATE) values( SOURCE,ID,POSTCODE,ADDRESS,REGION,AREA,CITY,STREET,HOUSE,FIASCODE,FIASREGION,FIASAREA,FIASCITY,FIASPLACE,FIASSTREET,ACTUALDATE)")
        resparray.push("INSERT INTO LOG( SOURCE,ID,WORKER,SND,REP,RESULT) values( SOURCE,ID,WORKER,SND,REP,RESULT)")
        resparray.push("INSERT INTO LOGERR( DATETIME,SYSCC,ERRMSG) values( DATETIME,SYSCC,ERRMSG)")
        resparray.push("INSERT INTO OKVEDLIST( SOURCE,ID,CODE,NAME,ISMAIN) values( SOURCE,ID,CODE,NAME,ISMAIN)")
        resparray.push("INSERT INTO PERSONSWITHOUTWARRANT( SOURCE,ID,ACTUALDATE,NAME,POS,INN) values( SOURCE,ID,ACTUALDATE,NAME,POS,INN)")
        resparray.push("INSERT INTO PHONELIST( SOURCE,ID,CODE,NUMBER,STATUS) values( SOURCE,ID,CODE,NUMBER,STATUS)")
        resparray.push("INSERT INTO PREVIOUSADDRESSES( SOURCE,ID,POSTCODE,ADDRESS,REGION,AREA,CITY,STREET,HOUSE,FIASCODE,FIASREGION,FIASAREA,FIASCITY,FIASPLACE,FIASSTREET,ACTUALDATE) values( SOURCE,ID,POSTCODE,ADDRESS,REGION,AREA,CITY,STREET,HOUSE,FIASCODE,FIASREGION,FIASAREA,FIASCITY,FIASPLACE,FIASSTREET,ACTUALDATE)")
        resparray.push("INSERT INTO REPORT( SOURCE,ID,STATUS,EGRPOINCLUDED,EGRULLIKVIDATION,ISACTING,DATEFIRSTREG,SHORTNAMERUS,SHORTNAMEEN,FULLNAMERUS,NORMNAME,INN,KPP,OGRN,OKPO,FCSMCODE,RTS,OKATO,OKOGU,OKFS,OKOPF,OKOPF_NEW,CHARTERCAPITAL,EMAIL,WWW,WORKERSRANGE,ADDRESS,CREDITRISKVALUE,CREDITRISKDESC,FAILURESCOREVALUE,FAILURESCOREDESC,PAYMENTINDEXVALUE,PAYMENTINDEXDESC,COMPANYSIZE_REVENUE,COMPANYSIZE,SAMETELEPHONECOUNT,SAMEADDRESSCOUNT,SAMEMANAGERCOUNTINCOUNTRY,SAMEMANAGERCOUNTINREGION,INDEXOFDUEDILIGENCE,OKATO_REGIONNAME,OKATO_REGIONCODE,OKOGUNAME,OKFSNAME,STATUSDATE,INDEXOFDUEDILIGENCEDESC,OKOPF_NAME) values( SOURCE,ID,STATUS,EGRPOINCLUDED,EGRULLIKVIDATION,ISACTING,DATEFIRSTREG,SHORTNAMERUS,SHORTNAMEEN,FULLNAMERUS,NORMNAME,INN,KPP,OGRN,OKPO,FCSMCODE,RTS,OKATO,OKOGU,OKFS,OKOPF,OKOPF_NEW,CHARTERCAPITAL,EMAIL,WWW,WORKERSRANGE,ADDRESS,CREDITRISKVALUE,CREDITRISKDESC,FAILURESCOREVALUE,FAILURESCOREDESC,PAYMENTINDEXVALUE,PAYMENTINDEXDESC,COMPANYSIZE_REVENUE,COMPANYSIZE,SAMETELEPHONECOUNT,SAMEADDRESSCOUNT,SAMEMANAGERCOUNTINCOUNTRY,SAMEMANAGERCOUNTINREGION,INDEXOFDUEDILIGENCE,OKATO_REGIONNAME,OKATO_REGIONCODE,OKOGUNAME,OKFSNAME,STATUSDATE,INDEXOFDUEDILIGENCEDESC,OKOPF_NAME)")
        resparray.push("INSERT INTO REQDATA( SOURCE,ID,INN) values( SOURCE,ID,INN)")
        resparray.push("INSERT INTO STATECONTRACTS_FL223( SOURCE,ID,YEAR,ADMITTEDNUMBER,NOTADMITTEDNUMBER,WINNERNUMBER,SIGNEDNUMBER,SUM) values( SOURCE,ID,YEAR,ADMITTEDNUMBER,NOTADMITTEDNUMBER,WINNERNUMBER,SIGNEDNUMBER,SUM)")
        resparray.push("INSERT INTO STATECONTRACTS_FL94( SOURCE,ID,YEAR,ADMITTEDNUMBER,NOTADMITTEDNUMBER,WINNERNUMBER,SIGNEDNUMBER,SUM) values( SOURCE,ID,YEAR,ADMITTEDNUMBER,NOTADMITTEDNUMBER,WINNERNUMBER,SIGNEDNUMBER,SUM)")
        resparray.push("INSERT INTO STRUCTUREINFO( SOURCE,ID,COUNTCOOWNERFCSM,COUNTCOOWNERROSSTAT,COUNTCOOWNEREGRUL,COUNTBRANCH,COUNTBRANCHROSSTAT,COUNTAFFILIATEDCOMPANYFCSM,COUNTAFFILIATEDCOMPANYROSSTAT,COUNTAFFILIATEDCOMPANYEGRUL,NONPROFITORGANIZATIONROSSTAT) values( SOURCE,ID,COUNTCOOWNERFCSM,COUNTCOOWNERROSSTAT,COUNTCOOWNEREGRUL,COUNTBRANCH,COUNTBRANCHROSSTAT,COUNTAFFILIATEDCOMPANYFCSM,COUNTAFFILIATEDCOMPANYROSSTAT,COUNTAFFILIATEDCOMPANYEGRUL,NONPROFITORGANIZATIONROSSTAT)")
        resparray.push("INSERT INTO TABLES( TABLE_NAME,TABLE_DESCRIPTION) values( TABLE_NAME,TABLE_DESCRIPTION)")
        resparray.push("INSERT INTO VESTNIKMESSAGE( SOURCE,ID,DATE,TYPE,CASENUMBER,IDTYPE,TEXT) values( SOURCE,ID,DATE,TYPE,CASENUMBER,IDTYPE,TEXT)")
        
       
      });
      result = "found";
    } else if (response.lists.list) {
      list = response.lists;
      // log.timestamp("insert into resdata(source,id,found,list) values('"+source+"','"+id+"','"+"Y"+"','"+response.lists.list.name+"')");
      resparray.push("INSERT INTO ACCESSIBLEFINDATA( SOURCE,ID,IDPERIOD,NAME,ENDDATE) values( SOURCE,ID,IDPERIOD,NAME,ENDDATE)")
      resparray.push("INSERT INTO ADJUSTADDRESSES( SOURCE,ID,POSTCODE,ADDRESS,REGION,AREA,CITY,STREET,HOUSE,FIASCODE,FIASREGION,FIASAREA,FIASCITY,FIASPLACE,FIASSTREET,ACTUALDATE) values( SOURCE,ID,POSTCODE,ADDRESS,REGION,AREA,CITY,STREET,HOUSE,FIASCODE,FIASREGION,FIASAREA,FIASCITY,FIASPLACE,FIASSTREET,ACTUALDATE)")
      resparray.push("INSERT INTO ARBITRATIONCASES( SOURCE,ID,YEAR,NUMBERPLAINTIFF,SUMPLAINTIFF,NUMBERDEFENDANT,SUMDEFENDANT,NUMBERTHIRD) values( SOURCE,ID,YEAR,NUMBERPLAINTIFF,SUMPLAINTIFF,NUMBERDEFENDANT,SUMDEFENDANT,NUMBERTHIRD)")
      resparray.push("INSERT INTO ATTR( SOURCE,ID,RESULTTYPE,EXECUTIONTIME) values( SOURCE,ID,RESULTTYPE,EXECUTIONTIME)")
      resparray.push("INSERT INTO BANKRUPTCYMESSAGE( SOURCE,ID,DATE,TYPE,CASENUMBER,IDTYPE) values( SOURCE,ID,DATE,TYPE,CASENUMBER,IDTYPE)")
      resparray.push("INSERT INTO BOARDOFDIRECTORS( SOURCE,ID,ACTUALDATE,NAME,BIRTHDAYYEAR,CODE,POS,SHAREPART,INN) values( SOURCE,ID,ACTUALDATE,NAME,BIRTHDAYYEAR,CODE,POS,SHAREPART,INN)")
      resparray.push("INSERT INTO EVENTSLIST( SOURCE,ID,EVENTTYPEID,TYPE,DATE) values( SOURCE,ID,EVENTTYPEID,TYPE,DATE)")
      resparray.push("INSERT INTO EXECUTIVEBODY( SOURCE,ID,ACTUALDATE,NAME,BIRTHDAYYEAR,CODE,POS,SHAREPART,INN) values( SOURCE,ID,ACTUALDATE,NAME,BIRTHDAYYEAR,CODE,POS,SHAREPART,INN)")
      resparray.push("INSERT INTO FAXLIST( SOURCE,ID,CODE,NUMBER,STATUS) values( SOURCE,ID,CODE,NUMBER,STATUS)")
      resparray.push("INSERT INTO FEDERALTAXREGISTRATION( SOURCE,ID,REGDATE,REGAUTHORITY,REGAUTHORITYADDRESS) values( SOURCE,ID,REGDATE,REGAUTHORITY,REGAUTHORITYADDRESS)")
      resparray.push("INSERT INTO FINANCE( SOURCE,ID,BALANCETYPE,PERIODNAME,DATEBEGIN,DATEEND,FORM,SECTION,NAME,CODE,VALUE,IDFINPOK) values( SOURCE,ID,BALANCETYPE,PERIODNAME,DATEBEGIN,DATEEND,FORM,SECTION,NAME,CODE,VALUE,IDFINPOK)")
      resparray.push("INSERT INTO INCLUDEINLIST( SOURCE,ID,LISTNAME) values( SOURCE,ID,LISTNAME)")
      resparray.push("INSERT INTO LEADERLIST( SOURCE,ID,FIO,POSITION,ACTUALDATE,INN) values( SOURCE,ID,FIO,POSITION,ACTUALDATE,INN)")
      resparray.push("INSERT INTO LEGALADDRESSES( SOURCE,ID,POSTCODE,ADDRESS,REGION,AREA,CITY,STREET,HOUSE,FIASCODE,FIASREGION,FIASAREA,FIASCITY,FIASPLACE,FIASSTREET,ACTUALDATE) values( SOURCE,ID,POSTCODE,ADDRESS,REGION,AREA,CITY,STREET,HOUSE,FIASCODE,FIASREGION,FIASAREA,FIASCITY,FIASPLACE,FIASSTREET,ACTUALDATE)")
      resparray.push("INSERT INTO LOG( SOURCE,ID,WORKER,SND,REP,RESULT) values( SOURCE,ID,WORKER,SND,REP,RESULT)")
      resparray.push("INSERT INTO LOGERR( DATETIME,SYSCC,ERRMSG) values( DATETIME,SYSCC,ERRMSG)")
      resparray.push("INSERT INTO OKVEDLIST( SOURCE,ID,CODE,NAME,ISMAIN) values( SOURCE,ID,CODE,NAME,ISMAIN)")
      resparray.push("INSERT INTO PERSONSWITHOUTWARRANT( SOURCE,ID,ACTUALDATE,NAME,POS,INN) values( SOURCE,ID,ACTUALDATE,NAME,POS,INN)")
      resparray.push("INSERT INTO PHONELIST( SOURCE,ID,CODE,NUMBER,STATUS) values( SOURCE,ID,CODE,NUMBER,STATUS)")
      resparray.push("INSERT INTO PREVIOUSADDRESSES( SOURCE,ID,POSTCODE,ADDRESS,REGION,AREA,CITY,STREET,HOUSE,FIASCODE,FIASREGION,FIASAREA,FIASCITY,FIASPLACE,FIASSTREET,ACTUALDATE) values( SOURCE,ID,POSTCODE,ADDRESS,REGION,AREA,CITY,STREET,HOUSE,FIASCODE,FIASREGION,FIASAREA,FIASCITY,FIASPLACE,FIASSTREET,ACTUALDATE)")
      resparray.push("INSERT INTO REPORT( SOURCE,ID,STATUS,EGRPOINCLUDED,EGRULLIKVIDATION,ISACTING,DATEFIRSTREG,SHORTNAMERUS,SHORTNAMEEN,FULLNAMERUS,NORMNAME,INN,KPP,OGRN,OKPO,FCSMCODE,RTS,OKATO,OKOGU,OKFS,OKOPF,OKOPF_NEW,CHARTERCAPITAL,EMAIL,WWW,WORKERSRANGE,ADDRESS,CREDITRISKVALUE,CREDITRISKDESC,FAILURESCOREVALUE,FAILURESCOREDESC,PAYMENTINDEXVALUE,PAYMENTINDEXDESC,COMPANYSIZE_REVENUE,COMPANYSIZE,SAMETELEPHONECOUNT,SAMEADDRESSCOUNT,SAMEMANAGERCOUNTINCOUNTRY,SAMEMANAGERCOUNTINREGION,INDEXOFDUEDILIGENCE,OKATO_REGIONNAME,OKATO_REGIONCODE,OKOGUNAME,OKFSNAME,STATUSDATE,INDEXOFDUEDILIGENCEDESC,OKOPF_NAME) values( SOURCE,ID,STATUS,EGRPOINCLUDED,EGRULLIKVIDATION,ISACTING,DATEFIRSTREG,SHORTNAMERUS,SHORTNAMEEN,FULLNAMERUS,NORMNAME,INN,KPP,OGRN,OKPO,FCSMCODE,RTS,OKATO,OKOGU,OKFS,OKOPF,OKOPF_NEW,CHARTERCAPITAL,EMAIL,WWW,WORKERSRANGE,ADDRESS,CREDITRISKVALUE,CREDITRISKDESC,FAILURESCOREVALUE,FAILURESCOREDESC,PAYMENTINDEXVALUE,PAYMENTINDEXDESC,COMPANYSIZE_REVENUE,COMPANYSIZE,SAMETELEPHONECOUNT,SAMEADDRESSCOUNT,SAMEMANAGERCOUNTINCOUNTRY,SAMEMANAGERCOUNTINREGION,INDEXOFDUEDILIGENCE,OKATO_REGIONNAME,OKATO_REGIONCODE,OKOGUNAME,OKFSNAME,STATUSDATE,INDEXOFDUEDILIGENCEDESC,OKOPF_NAME)")
      resparray.push("INSERT INTO REQDATA( SOURCE,ID,INN) values( SOURCE,ID,INN)")
      resparray.push("INSERT INTO STATECONTRACTS_FL223( SOURCE,ID,YEAR,ADMITTEDNUMBER,NOTADMITTEDNUMBER,WINNERNUMBER,SIGNEDNUMBER,SUM) values( SOURCE,ID,YEAR,ADMITTEDNUMBER,NOTADMITTEDNUMBER,WINNERNUMBER,SIGNEDNUMBER,SUM)")
      resparray.push("INSERT INTO STATECONTRACTS_FL94( SOURCE,ID,YEAR,ADMITTEDNUMBER,NOTADMITTEDNUMBER,WINNERNUMBER,SIGNEDNUMBER,SUM) values( SOURCE,ID,YEAR,ADMITTEDNUMBER,NOTADMITTEDNUMBER,WINNERNUMBER,SIGNEDNUMBER,SUM)")
      resparray.push("INSERT INTO STRUCTUREINFO( SOURCE,ID,COUNTCOOWNERFCSM,COUNTCOOWNERROSSTAT,COUNTCOOWNEREGRUL,COUNTBRANCH,COUNTBRANCHROSSTAT,COUNTAFFILIATEDCOMPANYFCSM,COUNTAFFILIATEDCOMPANYROSSTAT,COUNTAFFILIATEDCOMPANYEGRUL,NONPROFITORGANIZATIONROSSTAT) values( SOURCE,ID,COUNTCOOWNERFCSM,COUNTCOOWNERROSSTAT,COUNTCOOWNEREGRUL,COUNTBRANCH,COUNTBRANCHROSSTAT,COUNTAFFILIATEDCOMPANYFCSM,COUNTAFFILIATEDCOMPANYROSSTAT,COUNTAFFILIATEDCOMPANYEGRUL,NONPROFITORGANIZATIONROSSTAT)")
      resparray.push("INSERT INTO TABLES( TABLE_NAME,TABLE_DESCRIPTION) values( TABLE_NAME,TABLE_DESCRIPTION)")
      resparray.push("INSERT INTO VESTNIKMESSAGE( SOURCE,ID,DATE,TYPE,CASENUMBER,IDTYPE,TEXT) values( SOURCE,ID,DATE,TYPE,CASENUMBER,IDTYPE,TEXT)")

      result = "found";
    }
  } else {
    resparray.push("insert into resdata(source,id,found,listname) values('"+source+"','"+id+"','"+"N"+"','"+""+"')")
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