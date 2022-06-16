lp.collectionRegister = (collectionName, collectionIdPrefix, forbiddenKeys = [], checks) => {
  const collection = new Mongo.Collection(collectionName);
  collection.id = () => `${collectionIdPrefix}_${Random.id()}`;
  lp.collections[collectionIdPrefix] = collection;

  collection.allow({
    insert(userId, doc) {
      log('lp.collection: check col allow insert', { collectionName, userId, doc });
      return true;
    },
    update(userId, doc, fieldNames, modifier) {
      log('lp.collection: check col allow insert', { collectionName, userId, doc, fieldNames, modifier });
      return true;
    },
    remove(userId, doc) {
      log('lp.collection: check col allow insert', { collectionName, userId, doc });
      return true;
    },
  });

  collection.deny({
    insert(userId, doc) {
      if (!checks || !checks.insert) return true;
      const check = checks.insert(userId, doc);
      if (check) log('lp.collection: deny insert check', { collectionName, userId, doc, check });
      else error('lp.collection: deny insert failed HACKER DETECTED', { collectionName, userId, doc, check });
      return !check;
    },
    update(userId, doc, fieldNames, modifier) {
      // test client check
      if (!checks || !checks.update) return true;
      if (!checks.update(userId, doc, fieldNames, modifier)) { error('lp.collection: deny update check failed HACKER DETECTED', { collectionName, userId, doc, fieldNames, modifier }); return true; }

      // test client forbidden keys
      if (_.intersection(fieldNames, forbiddenKeys).length > 0) { error('lp.collection: deny update forbidden keys failed HACKER DETECTED', { collectionName, userId, doc, fieldNames, modifier, intersection: _.intersection(fieldNames, forbiddenKeys) }); return true; }

      log('lp.collection: deny update check', { collectionName, userId, doc, fieldNames, modifier });
      return false;
    },
    remove(userId, doc) {
      if (!checks || !checks.remove) return true;
      const check = checks.remove(userId, doc);
      if (check) log('lp.collection: deny remove check', { collectionName, userId, doc, check });
      else error('lp.collection: deny remove failed HACKER DETECTED', { collectionName, userId, doc, check });
      return !check;
    },
  });

  return collection;
};
