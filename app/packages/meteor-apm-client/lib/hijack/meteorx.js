// Various tricks for accessing "private" Meteor APIs borrowed from the
// now-unmaintained meteorhacks:meteorx package.

export const Server = Meteor.server.constructor;

function getSession() {
  const fakeSocket = {
    send() {},
    close() {},
    headers: []
  };

  const server = Meteor.server;

  server._handleConnect(fakeSocket, {
    msg: "connect",
    version: "pre1",
    support: ["pre1"]
  });

  const session = fakeSocket._meteorSession;

  server._removeSession(session);

  return session;
}

const session = getSession();
export const Session = session.constructor;

const collection = new Mongo.Collection("__dummy_coll_" + Random.id());
collection.findOne();
const cursor = collection.find();
export const MongoCursor = cursor.constructor;

function getMultiplexer(cursor) {
  const handle = cursor.observeChanges({
    added() {}
  });
  handle.stop();
  return handle._multiplexer;
}

export const Multiplexer = getMultiplexer(cursor).constructor;

export const MongoConnection =
  MongoInternals.defaultRemoteCollectionDriver().mongo.constructor;

function getSubscription(session) {
  const subId = Random.id();

  session._startSubscription(function () {
    this.ready();
  }, subId, [], "__dummy_pub_" + Random.id());

  const subscription = session._namedSubs instanceof Map
    ? session._namedSubs.get(subId)
    : session._namedSubs[subId];

  session._stopSubscription(subId);

  return subscription;
}

export const Subscription = getSubscription(session).constructor;

function getObserverDriver(cursor) {
  const multiplexer = getMultiplexer(cursor);
  return multiplexer && multiplexer._observeDriver || null;
}

function getMongoOplogDriver() {
  const driver = getObserverDriver(cursor);
  let MongoOplogDriver = driver && driver.constructor || null;
  if (MongoOplogDriver &&
    typeof MongoOplogDriver.cursorSupported !== "function") {
    return null;
  }
  return MongoOplogDriver;
}

export const MongoOplogDriver = getMongoOplogDriver();

function getMongoPollingDriver() {
  const cursor = collection.find({}, {
    limit: 20,
    _disableOplog: true,
  });

  const driver = getObserverDriver(cursor);

  // verify observer driver is a polling driver
  if (driver && typeof driver.constructor.cursorSupported === "undefined") {
    return driver.constructor;
  }

  return null;
}

export const MongoPollingDriver = getMongoPollingDriver();