const express = require('express');
const Feed = require('./Feed');
const router = express.Router();

// Busca todas as postagens (da mais nova para a mais velha)
router.get('/', async (req, res) => {
    try {
        const posts = await Feed.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao carregar o feed de notícias.' });
    }
});

module.exports = router;
