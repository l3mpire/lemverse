const getLevel = (params, req, res) => {
  let apiKey;

  if (params?.query?.access_token) apiKey = params.query.access_token;
  else if (req.body && req.body.access_token) apiKey = req.body.access_token;
  else if (req.headers && req.headers.authorization) {
    // find the api key in the header auth https://segment.com/docs/partners/direct-integration/
    const auth = req.headers.authorization.substr(6); // remove // Basic
    ({ 1: apiKey } = Buffer.from(auth || '', 'base64').toString('utf8').split(':'));
  }

  if (typeof apiKey !== 'string' || !apiKey) {
    log('getLevel: wrong request');
    res.writeHead(400);
    res.end('');
    return {};
  }

  log('getLevel: start', { _ip: lp.ip(req).ip });

  const level = Levels.findOne({ apiKey });
  if (!level) {
    log('getLevel: level not found', { apiKey });
    res.writeHead(401);
    res.end('The authentication you supplied is incorrect');
    return {};
  }

  log('getLevel: levelId', { levelId: level._id });
  return { level, levelId: level._id };
};

lp.route('/api/entities/:entityId', 'application/json', 'api', (params, req, res) => {
  try { check(params.entityId, Match.SafeString); } catch (err) { return 'Invalid entity id'; }
  if (!req.body) return 'no body';
  if (req.method !== 'PUT') return 'bad method';

  const { state } = req.body;
  try { check(state, Boolean); } catch (err) { return 'Invalid state'; }

  const { level, levelId } = getLevel(params, req, res);
  if (!level) return 'bad level';

  const updated = Promise.await(Entities.update({ levelId, _id: params.entityId }, { $set: { state } }));
  if (!updated) return 'not updated';

  return '';
});

lp.route('/api/hooks', 'application/json', 'api', (params, req, res) => {
  const { levelId, level } = getLevel(params, req, res);
  if (!levelId) return 'bad level id';

  if (!req.body) return 'no body';

  if (req.method === 'GET') {
    res.end(JSON.stringify(level.hooks || []));
    return 'returned hooks';
  }

  const { targetUrl } = req.body;
  if (!targetUrl) return 'no target url';
  if (!/^https?:\/\//.test(targetUrl)) return 'Invalid targetUrl, must start with http:// or https://';

  if (level.hooks && level.hooks.find(h => h.targetUrl === targetUrl)) { res.writeHead(409); return 'duplicate hooks'; }

  const hook = {
    _id: `hoo_${Random.id()}`,
    targetUrl,
    createdAt: new Date(),
  };

  Levels.update(levelId, { $push: { hooks: hook } });
  log('/api/hooks: new hooks registered', { levelId, reqBody: req.body, hook });

  res.end(JSON.stringify(hook));
  return 'response with hook';
});
