lp.collectionRegister = (collectionName, collectionIdPrefix) => {
  const collection = new Mongo.Collection(collectionName);
  collection.id = () => `${collectionIdPrefix}_${Random.id()}`;
  lp.collections[collectionIdPrefix] = collection;
  return collection;
};
