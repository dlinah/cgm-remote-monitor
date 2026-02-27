'use strict';

const consts = require('../../constants');

function configure (app, wares, ctx) {
  const express = require('express');
  const api = express.Router();

  api.use(wares.sendJSONStatus);
  api.use(wares.rawParser);
  api.use(wares.jsonParser);
  api.use(wares.urlencodedParser);

  api.use(ctx.authorization.isPermitted('api:settings:read'));

  api.get('/insulinsettings', function getSettings (req, res) {
    ctx.insulinsettings.list(req.query, function listDone (err, results) {
      if (err) {
        res.sendJSONStatus(res, consts.HTTP_INTERNAL_ERROR, 'Mongo Error', err);
        return;
      }
      res.json(results || []);
    });
  });

  function config_authed (app, api, wares, ctx) {
    api.post('/insulinsettings', ctx.authorization.isPermitted('api:settings:create'), function createSetting (req, res) {
      const data = req.body || {};

      ctx.purifier.purifyObject(data);

      ctx.insulinsettings.create(data, function created (err, createdDoc) {
        if (err) {
          res.sendJSONStatus(res, consts.HTTP_INTERNAL_ERROR, 'Mongo Error', err);
          return;
        }
        res.json(createdDoc || {});
      });
    });
  }

  if (app.enabled('api')) {
    config_authed(app, api, wares, ctx);
  }

  return api;
}

module.exports = configure;
