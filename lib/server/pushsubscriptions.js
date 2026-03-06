'use strict';

function storage(env, ctx) {
  const collectionName = 'pushsubscriptions';

  function api() {
    return ctx.store.collection(collectionName);
  }

  function save(subscription, fn) {
    const endpoint = subscription.endpoint;
    // Upsert by endpoint so re-subscribing just updates keys
    api().updateOne(
      { endpoint },
      { $set: { ...subscription, updated_at: new Date().toISOString() } },
      { upsert: true },
      fn
    );
  }

  function remove(endpoint, fn) {
    api().deleteOne({ endpoint }, fn);
  }

  function listAll(fn) {
    api().find({}).toArray(fn);
  }

  // Make callable so ctx.store.ensureIndexes(ctx.pushsubscriptions(), ...) works
  const apiWrapper = function() { return api(); };
  apiWrapper.save = save;
  apiWrapper.remove = remove;
  apiWrapper.listAll = listAll;
  apiWrapper.indexedFields = ['endpoint'];
  return apiWrapper;
}

module.exports = storage;
