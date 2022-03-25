/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-unresolved */
import pluralize from 'pluralize';
import s from 'underscore.string';

Match.SafeString = Match.Where(str => {
  check(str, String);

  if (str.length > 400) {
    log('Match.SafeString: too long', { len: str.length, str });
    throw new Meteor.Error(403, 'Text is too long');
  }
  if (/<.+>/.test(str)) {
    log('Match.SafeString: potential xss', { str });
    throw new Meteor.Error(403, 'Don\'t use "<" or ">" characters');
  }
  return true;
});

Match.Id = Match.Where(id => {
  check(id, String);
  if (!/^[a-z]{3}_[a-zA-Z0-9]{17}$/.test(id)) { log('Match.Id: malformed id', { id }); return false; }
  return true;
});

//
// lp
//

lp = {};

lp.pluralize = pluralize;
lp.s = s;

// getVal(obj, 'a.b.c')
lp.getVal = (obj, key) => {
  obj = _.isObject(obj) ? obj : {};
  return Meteor._get.apply(null, [obj].concat(key.split && key.split('.')));
};

lp.isProduction = () => Meteor.settings.public.lp.production;
lp.isStaging = () => Meteor.settings.public.lp.staging;

lp.product = () => Meteor.settings.public.lp.product;
lp.process = () => Meteor.settings.public.lp.process;
lp.env = () => lp.envSwitch('production', 'staging', 'dev');
lp.name = () => `${lp.env()}-${lp.product()}-${lp.process()}`;

lp.envSwitch = (prod, staging, dev) => {
  if (lp.isProduction()) return lp.isStaging() ? staging : prod;
  else return dev;
};

lp.syncApi = (fn, self, ...args) => Meteor.wrapAsync(fn, self)(...args);

if (Meteor.isClient) {
  lp.wait = time => new Promise(resolve => lp.timeout(resolve, time));
} else {
  lp.wait = Meteor.wrapAsync((time, cb) => { lp.timeout(cb, time); });
}

// rename keys with . with _ (for mongo)
lp.renameDotAndDollarKeys = object => {
  Object.keys(object).forEach(k => {
    if (k[0] === '$') {
      object[k.replace(/^[$]/g, '_')] = object[k];
      delete object[k];
      k = k.replace(/^[$]/g, '_');
    }

    if (k.indexOf('.') !== -1) {
      object[k.replace(/\./g, '_')] = object[k];
      delete object[k];
    }
  });
};

lp.mapToObject = map => {
  const objects = {};
  map.forEach((v, k) => { objects[k] = v; });
  return objects;
};

lp.timeout = (fn, timeout, fnName) => Meteor.setTimeout(() => {
  if (!fnName) fnName = fn.name;
  try {
    log(`lp.timeout${fnName ? `>${fnName}` : ''}: Started`);

    const before = Date.now();
    fn();
    log(`lp.timeout${fnName ? `>${fnName}` : ''}: Ended in ${Date.now() - before}ms`);
  } catch (err) {
    error(`lp.timeout${fnName ? `>${fnName}` : ''}: Exception`, { err, name: fnName || fn?.toString()?.substr(0, 1000) });
  }
}, timeout * 1000);

lp.defer = (fn, fnName) => Meteor.setTimeout(() => {
  if (!fnName) fnName = fn.name;
  try {
    fn();
  } catch (err) {
    error(`lp.defer${fnName ? `>${fnName}` : ''}: Exception`, { err, name: fnName || fn?.toString()?.substr(0, 1000) });
  }
}, 0);

lp.interval = (fn, delay, fnName) => Meteor.setInterval(() => {
  if (!fnName) fnName = fn.name;
  try {
    if (delay > 10) log(`lp.interval${fnName ? `>${fnName}` : ''}: Started`);

    const before = Date.now();
    fn();

    if (delay > 10) log(`lp.interval${fnName ? `>${fnName}` : ''}: Ended in ${Date.now() - before}ms`);
  } catch (err) {
    error(`lp.interval${fnName ? `>${fnName}` : ''}: Exception`, { err, name: fnName || fn?.toString()?.substr(0, 1000) });
  }
}, delay * 1000);

lp.waitingInterval = (service, fn, delay, timeout, fnName) => Meteor.setTimeout(() => {
  if (!fnName) fnName = fn.name;
  try {
    if (delay > 10) log(`${service}>lp.waitingInterval>${fnName}: Started`, { delay, timeout });

    const before = Date.now();
    timeout = fn();

    if (delay > 10) log(`${service}>lp.waitingInterval>${fnName}: Ended in ${Date.now() - before}ms`, { delay, timeout });
  } catch (err) {
    error(`${service}>lp.waitingInterval>${fnName}: Exception`, { err, delay, timeout });
  }

  lp.waitingInterval(service, fn, delay, timeout, fnName);
}, (timeout === undefined ? delay : timeout) * 1000);

lp.up = poly => (typeof poly === 'string' ? (Meteor.isServer ? Promise.await : doc => doc)(lp.collection(poly).findOne({ _id: poly })) : poly);
