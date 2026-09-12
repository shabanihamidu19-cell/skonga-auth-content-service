'use strict';
const learnService = require('../services/learnService');

async function postResult(req, res, next) {
  try {
    const result = await learnService.recordResult(req.user.id, req.body || {});
    res.json({ ok: true, progress: result });
  } catch (err) {
    next(err);
  }
}

async function getProgress(req, res, next) {
  try {
    const subject = req.query.subject;
    const items = await learnService.getProgress(req.user.id, { subject });
    res.json({
      ok: true,
      items,
      algorithm: { version: 2, masteredThreshold: 2, reviewAfterDays: 7 },
    });
  } catch (err) {
    next(err);
  }
}

async function getNext(req, res, next) {
  try {
    const data = await learnService.nextTopic(req.user.id, {
      subject: req.query.subject,
      form: req.query.form,
    });
    res.json({ ok: true, ...data });
  } catch (err) {
    next(err);
  }
}

async function getCatalog(req, res, next) {
  try {
    const data = learnService.getCatalog({
      subject: req.query.subject,
      form: req.query.form,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { postResult, getProgress, getNext, getCatalog };
