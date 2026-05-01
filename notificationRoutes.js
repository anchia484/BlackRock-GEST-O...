const express = require('express');
const Notification = require('./Notification');
const auth = require('./authMiddleware');
const router = express.Router();

// 1. Enviar notificações reais para o painel do usuário
router.get('/', auth, async (req, res) => {
    try {
        // Busca as notificações do usuário logado, as mais recentes primeiro (limite de 50 para não pesar)
        const notifications = await Notification.find({ usuarioId: req.usuario.id }).sort({ createdAt: -1 }).limit(50);
        res.json({ notifications });
    } catch (e) {
        res.status(500).json({ erro: 'Erro ao buscar notificações' });
    }
});

// 2. Marcar uma notificação específica como lida (quando ele clica)
router.post('/:id/ler', auth, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { lida: true });
        res.json({ sucesso: true });
    } catch (e) {
        res.status(500).json({ erro: 'Erro ao marcar como lida' });
    }
});

// 3. Marcar TODAS como lidas (se você quiser colocar um botão "Ler tudo")
router.post('/ler-todas', auth, async (req, res) => {
    try {
        await Notification.updateMany({ usuarioId: req.usuario.id, lida: false }, { lida: true });
        res.json({ sucesso: true });
    } catch (e) {
        res.status(500).json({ erro: 'Erro ao limpar notificações' });
    }
});

module.exports = router;
