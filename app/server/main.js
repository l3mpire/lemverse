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
