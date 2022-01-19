/* eslint-disable import/no-unresolved */
import fs from 'fs';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const { RateLimiterMemory } = require('rate-limiter-flexible');

const rateLimiters = {};

rateLimiters.default = new RateLimiterMemory({
  points: 20, // 20 requests
  duration: 2, // per 2 seconds
});

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

const commonHeaders = (res, rateLimiter, rateLimiterRes) => {
  res.setHeader('Retry-After', rateLimiterRes.msBeforeNext / 1000);
  res.setHeader('X-RateLimit-Limit', rateLimiter.points);
  res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
  res.setHeader('X-RateLimit-Reset', +(new Date(Date.now() + rateLimiterRes.msBeforeNext)));
};

const searchApiKey = (params, req) => {
  let apiKey;

  if (params?.query?.access_token) apiKey = params.query.access_token;
  else if (req.body && req.body.access_token) apiKey = req.body.access_token;
  else if (req.headers && req.headers.authorization) {
    // find the api key in the header auth https://segment.com/docs/partners/direct-integration/
    const auth = req.headers.authorization.substr(6); // remove // Basic
    ({ 1: apiKey } = Buffer.from(auth || '', 'base64').toString('utf8').split(':'));
  }

  if (typeof apiKey !== 'string' || !apiKey) return false;

  return apiKey;
};

const routeWrapper = (path, type, cb, params, req, res) => {
  const before = Date.now();
  try {
    if (type) res.setHeader('Content-Type', type);

    const result = cb(params, req, res);
    const durationMs = Date.now() - before;
    log(`lp.route: ${req.method} ${path} end in ${durationMs}ms`, { _ip: lp.ip(req).ip, params, result });
    if (durationMs > 10000 && path.startsWith('/api/stripe')) {
      error(`lp.route: ${req.method} ${path} end in ${durationMs}ms`, { _ip: lp.ip(req).ip, params, result });
    }
  } catch (err) {
    const level = err?.errorType === 'Match.Error' ? log : error;
    level(`lp.route: ${req.method} ${path} end in ${Date.now() - before}ms with an error`, { _ip: lp.ip(req).ip, params, body: req.body, err });
  }

  if (!res.finished) {
    let emptyValue = '';
    switch (type) {
      case 'image/gif': emptyValue = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'); break;
      case 'application/json': emptyValue = '{}'; break;
      default:
    }
    res.end(emptyValue);
  }
};

lp.route = (path, type, rateLimitType = 'none', cb) => {
  const route = routeWrapper.bind(undefined, path, type, cb);

  Picker.route(path, (params, req, res) => {
    const apiKey = searchApiKey(params, req);
    log(`lp.route: ${req.method} ${path} start`, { _ip: lp.ip(req).ip, params, apiKey });

    let rateLimitBy;

    switch (rateLimitType) {
      case 'api':
        rateLimitBy = apiKey;
        break;
      case 'ip':
      case 'image-templates':
        rateLimitBy = lp.ip(req).ip;
        break;
      case 'none':
        break;
      default:
        error('lp.route: Unimplemented type of rate limit', { rateLimitType });
    }

    if (!rateLimitBy) {
      if (rateLimitType !== 'none') log(`lp.route: Impossible to get value for '${rateLimitType}'`, { rateLimitType });
      route(params, req, res);
      return;
    }

    const rateLimiter = rateLimiters[rateLimitType] || rateLimiters.default;

    try {
      const rateLimiterRes = Promise.await(rateLimiter.consume(rateLimitBy));
      commonHeaders(res, rateLimiter, rateLimiterRes);
    } catch (err) {
      log(`lp.route: ${req.method} ${path} end with 429`, { _ip: lp.ip(req).ip, params, apiKey });

      commonHeaders(res, rateLimiter, err);
      res.writeHead(429);

      let emptyValue = 'Too Many Requests';
      switch (type) {
        case 'image/gif': emptyValue = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'); break;
        case 'application/json': emptyValue = '{ error: }'; break;
        default:
      }

      res.end(emptyValue);
      return;
    }

    route(params, req, res);
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
