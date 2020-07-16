
const INN = (inn) => {
    // INN validation
    if (
      [10, 12].includes(inn.length) &&
      !["0000000000", "0000000000", "0000000000"].includes(inn)
    ) {
      return true;
    } else return false;
  };

  module.exports.INN = INN;