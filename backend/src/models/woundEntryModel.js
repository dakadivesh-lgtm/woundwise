const db = require('./db');
const { v4: uuidv4 } = require('uuid');

const woundEntryModel = {
  async createEntry({
    woundId,
    userId,
    imageFilename,
    originalFilename = '',
    mimeType = 'image/jpeg',
    fileSize = 0,
    notes = '',
    isFollowup = false,
    qualityMetrics = null,
    entryDate = new Date().toISOString()
  }) {
    const id = uuidv4();
    const query = `
      INSERT INTO wound_entries (
        id, wound_id, user_id, image_filename, original_filename,
        mime_type, file_size, notes, is_followup, quality_metrics, entry_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;
    const qualityStr = typeof qualityMetrics === 'object' && qualityMetrics !== null
      ? JSON.stringify(qualityMetrics)
      : qualityMetrics;

    await db.query(query, [
      id,
      woundId,
      userId,
      imageFilename,
      originalFilename,
      mimeType,
      fileSize,
      notes,
      Boolean(isFollowup),
      qualityStr,
      entryDate
    ]);

    return woundEntryModel.getEntryById(id, userId);
  },

  async getEntryById(id, userId) {
    const query = `
      SELECT e.*, w.title as wound_title, w.location as wound_location, w.status as wound_status
      FROM wound_entries e
      JOIN wounds w ON e.wound_id = w.id
      WHERE e.id = $1 AND e.user_id = $2
      LIMIT 1
    `;
    const res = await db.query(query, [id, userId]);
    return res.rows[0] || null;
  },

  async getEntriesByWound(woundId, userId) {
    const query = `
      SELECT e.*, a.status as assessment_status, a.summary as assessment_summary, a.details as assessment_details
      FROM wound_entries e
      LEFT JOIN assessments a ON a.entry_id = e.id
      WHERE e.wound_id = $1 AND e.user_id = $2
      ORDER BY e.entry_date ASC
    `;
    const res = await db.query(query, [woundId, userId]);
    return res.rows;
  },

  async getAllEntriesByUser(userId) {
    const query = `
      SELECT e.*, w.title as wound_title, w.location as wound_location, w.status as wound_status,
             a.status as assessment_status, a.summary as assessment_summary, a.details as assessment_details
      FROM wound_entries e
      JOIN wounds w ON e.wound_id = w.id
      LEFT JOIN assessments a ON a.entry_id = e.id
      WHERE e.user_id = $1
      ORDER BY e.entry_date DESC
    `;
    const res = await db.query(query, [userId]);
    return res.rows;
  },

  async getRecentEntriesByUser(userId, limit = 5) {
    const query = `
      SELECT e.*, w.title as wound_title, w.location as wound_location, w.status as wound_status,
             a.status as assessment_status, a.summary as assessment_summary
      FROM wound_entries e
      JOIN wounds w ON e.wound_id = w.id
      LEFT JOIN assessments a ON a.entry_id = e.id
      WHERE e.user_id = $1
      ORDER BY e.entry_date DESC
      LIMIT $2
    `;
    const res = await db.query(query, [userId, limit]);
    return res.rows;
  },

  async deleteEntry(id, userId) {
    const query = `DELETE FROM wound_entries WHERE id = $1 AND user_id = $2`;
    const res = await db.query(query, [id, userId]);
    return res.rowCount > 0;
  }
};

module.exports = woundEntryModel;
