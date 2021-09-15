Template.registerHelper('user', userId => userId && Meteor.users.findOne(userId) || 'unknown');
Template.registerHelper('userProfileName', userId => userId && Meteor.users.findOne(userId).profile.name || 'unknown');
Template.registerHelper('get', (obj, propName) => obj && obj[propName]);
Template.registerHelper('eq', (a, b) => /* eslint-disable eqeqeq */ a == b /* eslint-enable eqeqeq */);
Template.registerHelper('neq', (a, b) => /* eslint-disable eqeqeq */ a != b /* eslint-enable eqeqeq */);
Template.registerHelper('gt', (a, b) => a > b);
Template.registerHelper('gte', (a, b) => a >= b);
Template.registerHelper('lt', (a, b) => a < b);
Template.registerHelper('lte', (a, b) => a <= b);
Template.registerHelper('and', (a, b) => a && b);
Template.registerHelper('or', (a, b) => a || b);
Template.registerHelper('not', a => !a);
Template.registerHelper('num', a => a || 0);
Template.registerHelper('min', (a, b) => Math.min(a, b));
Template.registerHelper('max', (a, b) => Math.max(a, b));
Template.registerHelper('int', a => +a);
Template.registerHelper('env', (prod, staging, dev) => lp.envSwitch(prod, staging, dev));
Template.registerHelper('add', (a, b) => Number(a || 0) + Number(b || 0));
Template.registerHelper('sub', (a, b) => Number(a || 0) - Number(b || 0));
Template.registerHelper('concat', (...args) => { args.pop(); return args.join(''); });
Template.registerHelper('substr', (str, length) => str && str.substr && str.substr(0, length) || '');
Template.registerHelper('stringify', obj => obj && JSON.stringify(obj, null, '    ') || '');
Template.registerHelper('slugify', str => str && lp.s.slugify(str) || '');
Template.registerHelper('purify', str => lp.purify(str)); // escape xss
Template.registerHelper('instance', () => Template.instance());
Template.registerHelper('Session', a => Session.get(a));
Template.registerHelper('randomId', () => Random.id());
Template.registerHelper('percentage', (n1, n2) => `${n1 && n2 && Math.min(100, parseInt(n1 * 100 / n2, 10)) || 0}%`);
Template.registerHelper('lowercase', text => text && text.toLowerCase());
Template.registerHelper('uppercase', text => text && text.toUpperCase());
Template.registerHelper('escapeHtml', text => text && text.replace(/</g, '&lt;'));
Template.registerHelper('length', a => a && a.length);
Template.registerHelper('first', a => a && a.length && a[0]);
Template.registerHelper('last', a => a && a.length && a[a.length - 1]);
Template.registerHelper('settings', () => Meteor.settings);
Template.registerHelper('md5', txt => CryptoJS.MD5(txt).toString());
Template.registerHelper('gravatar', email => `//www.gravatar.com/avatar/${CryptoJS.MD5(email).toString()}?s=128&d=blank`);
Template.registerHelper('gravatarUrl', email => `//www.gravatar.com/avatar/${CryptoJS.MD5(email).toString()}`);
Template.registerHelper('contains', (arr, value) => arr && arr.length && _.contains(arr, value) || false);
Template.registerHelper('encodeURIComponent', toEncode => encodeURIComponent(toEncode));
Template.registerHelper('absoluteUrl', path => {
  if (path) return Meteor.absoluteUrl(path);
  return Meteor.absoluteUrl().substr(0, Meteor.absoluteUrl().length - 1);
});

// overridable if exists
ov = (obj, key, def) => obj && obj.override && lp.getVal(obj.override, key) || obj && lp.getVal(obj, key) || def;
Template.registerHelper('ov', ov);

// moment related
Meteor.setInterval(() => Session.set('now', new Date()), 1000);
Template.registerHelper('fromNow', date => date && moment(date).from(Session.get('now')) || 'now');
Template.registerHelper('smallDate', date => moment(date).format('MM-DD-YY HH:mm:ss'));
Template.registerHelper('moment', date => moment(date));
Template.registerHelper('formatDate', (date, format) => moment(date).format(format));

// log
Template.registerHelper('l', (...args) => l({ args }));

Template.registerHelper('s', (method, text) => s[method](text));
Template.registerHelper('pluralize', (text, n) => text && lp.pluralize(text, n));

// admin
Template.registerHelper('isGod', lp.isGod);
Template.registerHelper('isReallyProduction', () => lp.isProduction() && !lp.isStaging());
Template.registerHelper('isProduction', () => lp.isProduction());
Template.registerHelper('isStaging', () => lp.isStaging());

// flow router
Template.registerHelper('isActiveRoute', r => r === FlowRouter.getRouteName());
Template.registerHelper('getParam', r => FlowRouter.getParam(r));
Template.registerHelper('queryParam', param => FlowRouter.getQueryParam(param));
