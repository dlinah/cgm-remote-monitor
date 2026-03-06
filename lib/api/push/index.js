'use strict';

const webpush = require('web-push');

function configure(app, wares, ctx, env) {
  const express = require('express');
  const api = express.Router();

  api.use(wares.rawParser);
  api.use(wares.jsonParser);
  api.use(wares.sendJSONStatus);

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@localhost';

  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } else {
    console.warn('[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — Web Push disabled');
  }

  // Return VAPID public key so the PWA can subscribe
  api.get('/vapidPublicKey', function(req, res) {
    if (!vapidPublicKey) return res.status(503).json({ error: 'Web Push not configured' });
    res.json({ publicKey: vapidPublicKey });
  });

  // Save a push subscription (requires auth)
  api.post('/subscribe', ctx.authorization.isPermitted('api:treatments:create'), function(req, res) {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }
    ctx.pushsubscriptions.save(subscription, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    });
  });

  // Remove a push subscription (requires auth)
  api.delete('/subscribe', ctx.authorization.isPermitted('api:treatments:create'), function(req, res) {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    ctx.pushsubscriptions.remove(endpoint, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    });
  });

  // Trigger a push notification to all stored subscriptions (called by PWA)
  api.post('/notify', ctx.authorization.isPermitted('api:treatments:create'), function(req, res) {
    if (!vapidPublicKey || !vapidPrivateKey) {
      return res.status(503).json({ error: 'Web Push not configured' });
    }

    const { title, body, dose } = req.body || {};
    const payload = JSON.stringify({
      title: title || 'Insulin Reminder',
      body: body || (dose ? `Recommended dose: ${dose} units` : 'Check your insulin dose'),
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    });

    ctx.pushsubscriptions.listAll(function(err, subscriptions) {
      if (err) return res.status(500).json({ error: err.message });
      if (!subscriptions || subscriptions.length === 0) {
        return res.json({ ok: true, sent: 0 });
      }

      let sent = 0;
      let failed = 0;
      let pending = subscriptions.length;

      subscriptions.forEach(function(sub) {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: sub.keys,
        };
        webpush.sendNotification(pushSub, payload).then(function() {
          sent++;
        }).catch(function(pushErr) {
          failed++;
          // Remove expired/invalid subscriptions (410 Gone)
          if (pushErr.statusCode === 410) {
            ctx.pushsubscriptions.remove(sub.endpoint, function() {});
          }
        }).finally(function() {
          pending--;
          if (pending === 0) {
            res.json({ ok: true, sent, failed });
          }
        });
      });
    });
  });

  return api;
}

module.exports = configure;
