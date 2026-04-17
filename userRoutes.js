const express = require('express');
const User = require('./User');
const auth = require('./authMiddleware');
const router = express.Router();

// 1. Rota chamada pelo planos.html e dashboard.html
router.get('/dashboard', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario.id).select('-senha');
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        
        res.json({ user: usuario });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao carregar dados do dashboard.' });
    }
});

// 2. Rota chamada pelo perfil.html
router.get('/perfil', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario.id).select('-senha');
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        
        res.json({ usuario: usuario });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao carregar dados do perfil.' });
    }
});

module.exports = router;
