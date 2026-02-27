'use strict';

const _ = require('lodash');

function storage (env, ctx) {
  const collectionName = env.settings_collection || 'settings';

  function api () {
    return ctx.store.collection(collectionName);
  }

  function normalizeRecord (record) {
    const data = _.clone(record || {});
    if (!data.created_at) {
      data.created_at = new Date().toISOString();
    }
    if (!data.app) {
      data.app = 'insulin-buddy-pwa';
    }
    return data;
  }

  function create (objOrArray, fn) {
    if (_.isArray(objOrArray)) {
      const docs = objOrArray.map(normalizeRecord);
      api().insertMany(docs, function insertManyDone (err, result) {
        if (err) {
          return fn(err);
        }
        fn(null, result.ops || docs);
      });
      return;
    }

    const data = normalizeRecord(objOrArray);
    api().insertOne(data, function insertDone (err, result) {
      if (err) {
        return fn(err);
      }
      fn(null, result.ops ? result.ops[0] : data);
    });
  }

  function list (opts, fn) {
    const query = {};
    if (opts && opts.app) {
      query.app = opts.app;
    } else {
      query.app = 'insulin-buddy-pwa';
    }

    let cursor = api().find(query).sort({ created_at: -1 });
    if (opts && opts.count) {
      cursor = cursor.limit(parseInt(opts.count));
    }
    cursor.toArray(fn);
  }

  function apiCollection () {
    return api();
  }

  const apiWrapper = function () {
    return apiCollection();
  };

  apiWrapper.list = list;
  apiWrapper.create = create;
  apiWrapper.indexedFields = [
    'created_at',
    'app',
    'NSCLIENT_ID'
  ];

  return apiWrapper;
}

module.exports = storage;
