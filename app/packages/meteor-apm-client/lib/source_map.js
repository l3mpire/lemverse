const path = Npm.require('path');
const send = Npm.require('send');

const pathJoin = path.join;


JsonRoutes.add("get", "/app.js.map", function (req, res, next) {
  const sourceMapPath = pathJoin(__meteor_bootstrap__.serverDir, '../web.browser/app.js.map');
  const loginToken = req.headers['x-auth-token'];
  console.log('Source map download request with authHeaders: ', loginToken);
  if (loginToken === Meteor.settings.kadira.appSecret) {
    send(req, sourceMapPath).on('error', function (error) {
      console.log('Source map download request error:', error.message);
      res.writeHead(404);
      res.end();

    }).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }

});
