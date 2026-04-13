const express = require('express');
const Feed = require('./Feed');
const router = express.Router();

// 1. BUSCAR FEED (Fixados primeiro, depois por data)
router.get('/', async (req, res) => {
    try {
        // Ordena por isFixado (true primeiro) e depois por data de criação (mais novos)
        const posts = await Feed.find().sort({ isFixado: -1, createdAt: -1 });
        res.json(posts);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao carregar o feed.' });
    }
});

// 2. REAÇÃO DE LIKE (❤️)
router.post('/:id/like', async (req, res) => {
    try {
        const post = await Feed.findById(req.params.id);
        post.reacoes += 1;
        await post.save();
        res.json({ totalLikes: post.reacoes });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao reagir.' });
    }
});

module.exports = router;
