const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const chatController = require('../controllers/chatController');

router.get('/messages', auth, chatController.showMessagesInbox);
router.get('/chat/:otherUserId', auth, chatController.showChat);
router.get('/api/chat/inbox-panel', auth, chatController.getPatientInboxPanel);
router.get('/api/chat/conversations', auth, chatController.listConversations);
router.get('/api/chat/conversation/:id/messages', auth, chatController.getConversationMessages);

module.exports = router;
