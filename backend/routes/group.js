const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const controller = require('../controllers/groupController');

router.post('/', auth, controller.createGroup);
router.get('/:id', auth, controller.getGroup);
router.put('/:id', auth, controller.updateGroup);
router.post('/:id/invite', auth, controller.createInvite);
router.post('/join', auth, controller.joinByInvite);
router.get('/:id/members', auth, controller.listMembers);
router.post('/:id/kick', auth, controller.kickMember);
router.put('/:id/role', auth, controller.updateMemberRole);

module.exports = router;
