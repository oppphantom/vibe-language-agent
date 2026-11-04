'use strict';

function fail(message, code='INVALID_INPUT') {
  throw Object.assign(new Error(message), {code});
}

module.exports={fail};
