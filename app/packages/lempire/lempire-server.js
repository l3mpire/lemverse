/* eslint-disable import/no-unresolved */
import fs from 'fs';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// handle the error safely
process.on('uncaughtException', Meteor.bindEnvironment(err => { error(err, 'uncaughtException'); }, error));

//
// extend Meteor.settings with secrets
//

try {
  const fileSettings = JSON.parse(fs.readFileSync(`/usr/local/etc/${lp.product()}.json`).toString());
  _.extend(Meteor.settings, fileSettings);
  log('Meteor.settings: extended it with lemverse.json');
} catch (err) {
  if (lp.isProduction()) error('Meteor.settings: lemverse.json cannot read file', { err });
}

Meteor.startup(() => {
  log(`STARTTOKEN: --------------------------- ${lp.name()} started ----------------------------`);
});

lp.ip = obj => ({ ip: obj?.connection?.httpHeaders?.['x-forwarded-for'] || obj?.headers?.['cf-connecting-ip'] || obj?.headers?.['x-forwarded-for'] || '' });

// escape XSS
const { window } = new JSDOM('');
const DOMPurify = createDOMPurify(window);
lp.purify = (str, options = { FORBID_TAGS: ['form', 'input', 'textarea', 'button', 'base'] }) => {
  if (!str) return '';
  if (!/<.*?[a-zA-Z].*?>/.test(str)) return str; // purify only if there's at least a html tag, to don't purify urls or <-> <> strings

  try {
    return DOMPurify.sanitize(str, options);
  } catch (err) {
    error('lp.purify: failed, don\'t purify, could make xss exploit', { str, err });
    return str;
  }
};

lp.route = (path, type, cb) => {
  Picker.route(path, (params, req, res) => {
    try {
      if (type) res.setHeader('Content-Type', type);

      log(`lp.route: ${req.method} ${req.url}`, { _ip: lp.ip(req).ip, params });
      const result = cb(params, req, res);
      if (result) log(`lp.route: ${req.method} ${req.url}`, { _ip: lp.ip(req).ip, params, result });
    } catch (err) {
      const level = err?.errorType === 'Match.Error' ? log : error;
      level(`lp.route: ${req.method} ${req.url}`, { _ip: lp.ip(req).ip, params, body: req.body, err });
    }

    if (!req.finished) {
      let emptyValue = '';
      switch (type) {
        case 'image/gif': emptyValue = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'); break;
        case 'application/json': emptyValue = '{}'; break;
        default:
      }
      res.end(emptyValue);
    }
  });
};

lp.deferStartup = (service, fn, fnName) => {
  if (!fnName) fnName = fn.name;
  if (service && !Meteor.settings.services?.[service]) {
    log(`${service || 'all'}>lp.deferStartup>${fnName}: Not running on this process`);
    return;
  }

  log(`${service || 'all'}>lp.deferStartup>${fnName}: Calling in 1s...`);
  Meteor.startup(() => { lp.timeout(fn, 1, fnName); });
};

lp.deferCron = (service, fn, interval, fnName) => {
  if (!fnName) fnName = fn.name;
  lp.deferStartup(service, () => {
    if (!interval && Meteor.settings.services[service]?.interval) ({ interval } = Meteor.settings.services[service]);
    if (!interval) error(`${service || 'all'}>lp.deferCron>${fnName}: Missing interval in parameters or settings`);
    log(`${service || 'all'}>lp.deferCron>${fnName}: Calling in ${interval}s...`);
    lp.waitingInterval(service, fn, interval, undefined, fnName);
  }, fnName);
};

lp.timeoutPromise = (promise, s) => Promise.await(new Promise((resolve, reject) => {
  const timeoutId = setTimeout(() => { reject(new Error('timeout')); }, s * 1000);
  promise.then(
    res => { clearTimeout(timeoutId); resolve(res); },
    err => { clearTimeout(timeoutId); reject(err); },
  );
}));

//
// check slow tick
//

lp.slowTickInterval = 0.1;
lp.slowTickIntervalMax = 400;
let lastTick = 0;

lp.deferCron('', () => {
  if (!lastTick) lastTick = Date.now();

  const delta = Date.now() - lastTick;
  if (delta > lp.slowTickIntervalMax) log(`lp.slowTick: ${delta}ms`);

  lastTick = Date.now();
  return lp.slowTickInterval;
}, lp.slowTickInterval, 'slowTick');
