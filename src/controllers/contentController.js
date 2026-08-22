'use strict';
const contentService = require('../services/contentService');
const { publicKey } = require('../services/fileStorage');

async function create(req, res, next) {
  try {
    const { type, title, body, metadata } = req.body || {};
    let storageKey = null;
    let mimeType = null;
    let size = null;
    if (req.file) {
      storageKey = publicKey(req.file.filename);
      mimeType = req.file.mimetype;
      size = req.file.size;
    }
    const item = await contentService.createContent(req.user.id, {
      type: type || (req.file ? 'image' : 'chat'),
      title,
      body,
      metadata,
      storageKey,
      mimeType,
      size,
    });
    res.status(201).json({ content: item });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const items = await contentService.listContent(req.user.id, req.query);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const item = await contentService.getContent(req.user.id, req.params.id);
    res.json({ content: item });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await contentService.deleteContent(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getOne, remove };
