'use strict';
const contentService = require('../services/contentService');
const { persistUpload } = require('../services/fileStorage');

async function create(req, res, next) {
  try {
    const { type, title, body, metadata } = req.body || {};
    let storageKey = null;
    let mimeType = null;
    let size = null;
    let fileUrl = null;

    if (req.file) {
      const saved = await persistUpload(req);
      if (saved) {
        storageKey = saved.storageKey;
        mimeType = saved.mimeType;
        size = saved.size;
        fileUrl = saved.url;
      }
    }

    let meta = metadata;
    if (typeof meta === 'string') {
      try {
        meta = JSON.parse(meta);
      } catch {
        meta = { raw: meta };
      }
    }
    if (fileUrl) {
      meta = { ...(meta || {}), fileUrl };
    }

    const item = await contentService.createContent(req.user.id, {
      type: type || (req.file ? (mimeType && mimeType.startsWith('image/') ? 'image' : 'file') : 'chat'),
      title,
      body,
      metadata: meta,
      storageKey,
      mimeType,
      size,
    });

    res.status(201).json({
      content: item,
      fileUrl: fileUrl || null,
    });
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
