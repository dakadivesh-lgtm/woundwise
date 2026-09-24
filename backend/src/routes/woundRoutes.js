const express = require('express');
const router = express.Router();
const woundController = require('../controllers/woundController');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All wound routes require authentication
router.use(authenticateToken);

// Dashboard data endpoint
router.get('/dashboard', woundController.getDashboard);

// Wounds management
router.get('/', woundController.listWounds);
router.get('/:id', woundController.getWoundDetail);
router.post('/upload', upload.single('image'), woundController.uploadWound);
router.delete('/:id', woundController.deleteWound);

module.exports = router;
