const mapFactory = require("map-factory")

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
  

const transform = (report) =>{
    const mapper=mapFactory()
      // console.log("Report transform")
      if (report.ArbitrationCases){
        if (Array.isArray(report.ArbitrationCases.Year)){
          report.ArbitrationCases.Year.forEach((year)=>{
            mapper.map("Plaintiff[@CasesNumber]").to("Plaintiff_CaseNumber")
            mapper.map("Plaintiff[@Sum]").to("Plaintiff_Sum")
            mapper.map("Defendant[@CasesNumber]").to("Defendant_CasesNumber")
            mapper.map("Defendant[@Sum]").to("Defendant_Sum")
            mapper.map("ThirdOrOtherPerson[@CasesNumber]").to("ThirdOrOtherPerson_CasesNumber")
            year = Object.assign(year,mapper.execute(year))
          })
        } else{
          mapper.map("Plaintiff[@CasesNumber]").to("Plaintiff_CaseNumber")
          mapper.map("Plaintiff[@Sum]").to("Plaintiff_Sum")
          mapper.map("Defendant[@CasesNumber]").to("Defendant_CasesNumber")
          mapper.map("Defendant[@Sum]").to("Defendant_Sum")
          mapper.map("ThirdOrOtherPerson[@CasesNumber]").to("ThirdOrOtherPerson_CasesNumber")
          report.ArbitrationCases.Year = Object.assign(report.ArbitrationCases.Year,mapper.execute(report.ArbitrationCases.Year))
        }
      }
      if (report.BoardOfDirectors){
        report.BoardOfDirectors.Member = injectToArray(report.BoardOfDirectors.Member,"ActualDate",report.BoardOfDirectors['@ActualDate'])
        if(Array.isArray(report.BoardOfDirectors.Member)){
          report.BoardOfDirectors.Member.forEach((member)=>{

          mapper.map("Position[@Name]").to("PositionName")
          mapper.map("Position[@Code]").to("PositionCode")
          member = Object.assign(member,mapper.execute(member))
        }
      )}else{
        mapper.map("Position[@Name]").to("PositionName")
        mapper.map("Position[@Code]").to("PositionCode")
        report.BoardOfDirectors.Member = Object.assign( report.BoardOfDirectors.Member,mapper.execute( report.BoardOfDirectors.Member))
      }}
      if (report.ExecutiveBody){
        report.ExecutiveBody.Member = injectToArray(report.ExecutiveBody.Member,"ActualDate",report.ExecutiveBody['@ActualDate'])
        if(Array.isArray(report.ExecutiveBody.Member)){
          report.ExecutiveBody.Member.forEach((member)=>{
            mapper.map("Position[@Name]").to("PositionName")
            mapper.map("Position[@Code]").to("PositionCode")
            member = Object.assign(member,mapper.execute(member))
          })
        }
        else{
          mapper.map("Position[@Name]").to("PositionName")
          mapper.map("Position[@Code]").to("PositionCode")
          report.ExecutiveBody.Member = Object.assign(report.ExecutiveBody.Member,mapper.execute(report.ExecutiveBody.Member))
        }
      }
      if(report.Finance)
      { if (Array.isArray(report.Finance.FinPeriod)){
        report.Finance.FinPeriod.forEach((period)=>{
          if (period.StringList){
            period.StringList.String = injectToArray(period.StringList.String,"BalanceType",report.Finance['@BalanceType'])
            period.StringList.String = injectToArray(period.StringList.String,"PeriodName",period['@PeriodName'])
            period.StringList.String = injectToArray(period.StringList.String,"DateBegin",period['@DateBegin'])
            period.StringList.String = injectToArray(period.StringList.String,"DateEnd",period['@DateEnd'])
          }
      })}
      else{
        report.Finance.FinPeriod.StringList.String = injectToArray(report.Finance.FinPeriod.StringList.String,"BalanceType",report.Finance['@BalanceType'])
        report.Finance.FinPeriod.StringList.String = injectToArray(report.Finance.FinPeriod.StringList.String,"PeriodName",report.Finance.FinPeriod['@PeriodName'])
        report.Finance.FinPeriod.StringList.String = injectToArray(report.Finance.FinPeriod.StringList.String,"DateBegin",report.Finance.FinPeriod['@DateBegin'])
        report.Finance.FinPeriod.StringList.String = injectToArray(report.Finance.FinPeriod.StringList.String,"DateEnd",report.Finance.FinPeriod['@DateEnd'])
      }
    }
        
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
    if (report.ExecutiveBody) {
      if (Array.isArray(report.ExecutiveBody.Member)) {
        report.ExecutiveBody.Member.forEach(member => {
          mapper.map("Position[@Code]").to("PositionCode");
          mapper.map("Position[@Name]").to("PostionName");

          member = Object.assign(member, mapper.execute(member));
        });
      } else {
        mapper.map("Position[@Code]").to("PositionCode");
        mapper.map("Position[@Name]").to("PostionName");

        report.ExecutiveBody.Member = Object.assign( report.ExecutiveBody.Member, mapper.execute(report.ExecutiveBody.Member));
      }
    }
    }
      if(report.PersonsWithoutWarrant){
        report.PersonsWithoutWarrant.Person = injectToArray(report.PersonsWithoutWarrant.Person,"ActualDate",report.PersonsWithoutWarrant['@ActualDate'])
      }
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
      return report
}

module.exports = {
    transform:transform
}