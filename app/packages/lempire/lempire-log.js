/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
import stringify from 'fast-json-stable-stringify';

let logFibersId = 0;

const logToServer = (type, p1, p2) => {
  let object = {
    _type: type,
    _localDateMs: Date.now(),
    _source: `${lp.product()}-${lp.process()}`,
  };

  if (typeof p1 === 'string') object._message = p1;
  else if (p1 && p1.stack) { // case for Meteor.bindEnvironment that pass the exception in first param
    object._stack = p1.stack.split('\n');
    object._message = p1.toString();
    object.err = p1.toString();
  } else object = _.extend(object, p1);

  if (p2) object = _.extend(object, p2);

  if (p2 && p2.err && p2.err.stack && p2.err.stack.split) {
    object._stack = p2.err.stack.split('\n');
    // manage http error
    if (object.err && object.err.response && object.err.response.statusCode) {
      if (!object.statusCode) object.statusCode = object.err.response.statusCode;
      object.err = `Request failed with statusCode ${object.err.response.statusCode}`;
    }

    object.err = object.err.toString();
  } else if (!object._stack) {
    try { object._stack = (new Error()).stack.split('\n').splice(2); } catch (err) {}
  }

  // console log in compact mode (stringified to be more readable in console)
  const args = [];
  try {
    if (Meteor.isClient) args.push(p1);
    else if (type === 'error') args.push(typeof p1 === 'string' ? p1 : JSON.stringify(p1));
    else args.push(typeof p1 === 'string' ? `\x1b[0;33m${p1}\x1b[0;m` : JSON.stringify(p1));
  } catch (e) {
    args.push(p1);
  }

  if (Meteor.isServer) {
    // eslint-disable-next-line global-require
    const fibers = require('fibers');
    fibers.current._id = fibers.current._id || logFibersId++;
    object._FID = `fid_${fibers.current._id}`;
    args.push(`_FID${fibers.current._id}`);

    const ddp = DDP._CurrentMethodInvocation.get() || DDP._CurrentPublicationInvocation.get();
    if (ddp?.connection?.httpHeaders?.['x-forwarded-for']) object._ip = ddp.connection.httpHeaders['x-forwarded-for'];
  }

  try {
    object._userId = Meteor.userId();
  } catch (e) {}

  if (p2) {
    try {
      if (Meteor.isClient) args.push(p2);
      else args.push(typeof p2 === 'string' ? p2 : JSON.stringify(p2));
    } catch (e) {
      args.push(p2);
    }
  }

  if (object.err) {
    args.push(object.err);
    args.push(object._stack.join('\n'));
  }

  // args.push(object);
  if (type === 'debug') {
    args.unshift('\x1b[0;34m');
    // eslint-disable-next-line no-console
    console.log.apply(null, args);
  } else if (console) {
    // eslint-disable-next-line no-console
    console[type].apply(null, args);
  }
};

log = logToServer.bind(null, 'log');
error = logToServer.bind(null, 'error');
// eslint-disable-next-line no-undef
debug = logToServer.bind(null, 'debug');

l = (...p) => {
  if (Meteor.isClient) log('**********************', p);
  else log(`\x1b[0;31m**********************\x1b`, p);
};
