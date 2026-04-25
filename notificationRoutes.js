const express = require('express');
const auth = require('./authMiddleware');
const router = express.Router();

// Aqui você pode usar o modelo Message ou criar um específico para Alerts
router.get('/', auth, async (req, res) => {
    // Busca notificações reais do usuário
    res.json({ notifications: [] }); 
});

module.exports = router;
