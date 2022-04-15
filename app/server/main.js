import stringify from 'fast-json-stable-stringify';
import bodyParser from 'body-parser';

Picker.middleware(bodyParser.json({ limit: '5mb' }));

Meteor.methods({
  remote(str) {
    check(str, String);
    if (!lp.isGod()) return '🤬';

    log('eval from method', { userId: Meteor.userId(), str });
    let res;
    try {
      res = Promise.await(eval(str));
      if (res && res.fetch) res = res.fetch();
      if (res && res.toArray) res = Promise.await(res.toArray());
      if (res && typeof res.toJSON === 'function') res = res.result || res.toJSON();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('eval from method FAILED:', { err });
      return err.stack;
    }
    log('eval from method succeed');
    return stringify(res, { cycles: true });
  },
});

//
// http-bind proxy because jitsi.lemverse.com don't accept CORS
//

if (Meteor.settings.public.lowlevelJitsi) {
  Picker.route('/http-bind', (params, req, res) => {
    let content = '';
    req.on('data', chunk => { content += chunk; });

    req.on('end', Meteor.bindEnvironment(() => {
      const page = HTTP.call(req.method, `https://${Meteor.settings.public.meet.serverURL}/http-bind`, { content });
      // res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.writeHead(page.statusCode);
      res.end(page.content);
    }));
  });
}
