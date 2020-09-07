
const fs = require("fs");
const csv = require("csv-parser")
const yargs = require("yargs");
const chalk = require("chalk");
const log = require("./utils/log")
const pgsql = require("./utils/PGSQL")
const EFRSB = require("./utils/EFRSB")

//=======================================================
const {processtext,grabCount,cooldown,interval,clsInterval,resdir} = JSON.parse(fs.readFileSync("conf/service.json").toString());
if (!fs.existsSync(resdir)){fs.mkdirSync(resdir)}
yargs.command({
  command: "run",
  describe: "Run a worker",
  builder: {
    workerName: {
      describe: "Worker Name.",
      demandOption: true,
      type: "string",
    },
  },
  handler() {
   

    //worker = new worker(yargs.argv.workerName,yargs.argv.workerName+'.log');
    run(yargs.argv.workerName);
    
  },
});

yargs.command({
  command: "single",
  describe: "Single request with inn supplied",
  builder: {
    inn: {
      describe: "INN.",
      demandOption: true,
      type: "string",
    },
  },
  handler() {
    log.timestamp("Single request: " + chalk.green(yargs.argv.inn));

    //worker = new worker(yargs.argv.workerName,yargs.argv.workerName+'.log');
    single(yargs.argv.inn);
    
  },
});

yargs.command({
  command: "manual",
  describe: "Custom list check",
  builder: {
    json: {
      describe: "Path to JSON input file. File contains INN array.",
      type: "string"
    },
    csv: {
      describe: "Path to csv input file. File contains INN array.",
      type: "string"
    },
  },
  handler() {
    if (yargs.argv.json){
      log.timestamp("Manual check for JSON: " + chalk.green(yargs.argv.json));
      try{
      inns = JSON.parse(fs.readFileSync(yargs.argv.json).toString()).inns;
    } catch(error){
      log.timestamp("input file not found");
    }
      if (inns){
        log.timestamp(inns);
        manual(inns);
        } else{
          log.timestamp("No Data!");
        }
    }
    
    if (yargs.argv.csv){
      log.timestamp("Manual check for CSV: " + chalk.green(yargs.argv.csv));
      
      var inns =[];
      fs.createReadStream(yargs.argv.csv).pipe(csv())
        .on('data',(data)=>inns.push(data['0']))
        .on('end',()=>{
      
      log.timestamp(inns);
      manual(inns);
    });
    }
    
  },
});

yargs.command({
  command: "insert",
  describe: "Custom list insert to database",
  builder: {
    json: {
      describe: "Path to JSON input file. File contains INN array.",
      type: "string"
    },
    csv: {
      describe: "Path to csv input file. File contains INN array.",
      type: "string"
    },
  },
  handler() {
    if (yargs.argv.json){
      log.timestamp("Insert for JSON: " + chalk.green(yargs.argv.json));
      try{
      requests = JSON.parse(fs.readFileSync(yargs.argv.json).toString()).requests;
    } catch(error){
      log.timestamp("input file not found");
    }
      if (requests){
        log.timestamp(requests);
        pgsql.insertQueries("INSERT",requests);
        } else{
          log.timestamp("No Data!");
        }
    }
    
    if (yargs.argv.csv){
      log.timestamp("Insert for CSV: " + chalk.green(yargs.argv.csv));
      
      var requests =[];
      var reqlist=[]
      fs.createReadStream(yargs.argv.csv).pipe(csv({ separator: ';' }))
        .on('data',(data)=>requests.push(data))
        .on('end',()=>{
      
     
          requests.forEach((request)=>{
            reqlist.push(request)
          })
      console.log(requests)
      pgsql.insertQueries("INSERT",reqlist);
    

    });
    }
    if (!yargs.argv.csv && !yargs.argv.json){
      yargs.showHelp()
    }
  },
});


yargs.command({
  command: "test",
  describe: "Testing current developement routine",

  handler() {
    loopstep("test")
  }
})


yargs.command({
  command: "stats",
  describe: "Service stats",

  handler() {
    pgsql.getStats((stats)=>{
      pgsql.printStats(stats)
    })
    
  },
});
yargs.command({
  command: "init",
  describe: "init database tables",
 
  handler() {
    pgsql.backup(()=>{
      pgsql.init()
    });
  },
});

yargs.command({
  command: '*',
  handler() {
    yargs.showHelp()
  }
})

//===========================================================================================

const loopstep = (workerName) =>{
  pgsql.grabRequests(workerName,grabCount,()=>{
    pgsql.getUnfinishedRequests(workerName,cooldown,(requests)=>{
      if (requests)
      {
        requests.forEach((request)=>{
          EFRSB.getMessages(request,(error,result)=>{
            if (error || !result){
              log.timestamp("ERROR:\t"+chalk.redBright(request.source+"-"+request.id))
              fs.writeFile(resdir+"\\"+request.source+request.id+".json",error.toString(),()=>{})
              log.timestamp("Error for Source:"+request.source+",ID:"+request.id + " "+ error)
              pgsql.logError("Error for Source:"+request.source+",ID:"+request.id + " "+ error)
            }
            if (result){
              log.timestamp("Response\t\t"+chalk.greenBright(request.source+"-"+request.id))
              fs.writeFile(resdir+"\\"+request.source+request.id+".json",JSON.stringify(result),()=>{})
               pgsql.submitResponse(request.source,request.id,result,()=>{
              })
            }
          })
        })
      }
    })
  });
pgsql.pingWorker(workerName)
// pgsql.getStats();
}

const run = (workerName,callback) =>{
  if (workerName){
  process.title = processtext + " - " + workerName
  pgsql.registerWorker(workerName)
  log.cls(processtext,workerName);
  setInterval(()=>{
    loopstep(workerName)
  },interval);
  setInterval(()=>{
    log.cls(processtext,workerName)
    pgsql.getStats((stats)=>{
      pgsql.printStats(stats)
    })
  },clsInterval)
  }
}


const single = (inn,callback)=>{
  CRE.requestSPEXT(inn, (error, response) => {
    log.timestamp(
      chalk.underline.blueBright(
        "Результат для ИНН " + chalk.yellow(inn) + ":"
      )
    );

    if (response.lists) {
      if (response.lists.list.length > 0) {
        response.lists.list.forEach((list) => {
          log.timestamp(list);
        });
      } else if (response.lists.list) {
        log.timestamp(response.lists.list);
      }
    } else {
      log.timestamp({ found: "N" });
    }
  });
}

const manual = (inns, callback) => {
  
  log.timestamp(inns);

  
    inns.forEach((inn) => {
      CRE.requestSPEXT(inn, (error, response) => {
        log.timestamp(
          chalk.underline.blueBright(
            "Результат для ИНН " + chalk.yellow(inn) + ":"
          )
        );

        if (response.lists) {
          if (response.lists.list.length > 0) {
            response.lists.list.forEach((list) => {
              log.timestamp(list);
            });
          } else if (response.lists.list) {
            log.timestamp(response.lists.list);
          }
        } else {
          log.timestamp({ found: "N" });
        }
      });
    });
  
};

yargs.parse();
