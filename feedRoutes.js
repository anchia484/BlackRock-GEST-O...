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

// 2. REAÇÃO DE LIKE (❤️) COM TOGGLE PERMANENTE
router.post('/:id/like', auth, async (req, res) => {
    try {
        const post = await Feed.findById(req.params.id);
        const userId = req.usuario.id;
        
        // Verifica se o utilizador já curtiu
        const index = post.curtidas.indexOf(userId);

        if (index === -1) {
            // Se não curtiu, adiciona o ID e aumenta
            post.curtidas.push(userId);
            post.reacoes = post.curtidas.length;
        } else {
            // Se já curtiu, remove o ID e diminui
            post.curtidas.splice(index, 1);
            post.reacoes = post.curtidas.length;
        }

        await post.save();
        res.json({ totalLikes: post.reacoes, isLiked: index === -1 });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao processar reação.' });
    }
});


module.exports = router;