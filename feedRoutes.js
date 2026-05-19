const express = require('express');
const Feed = require('./Feed');
const auth = require('./authMiddleware'); 
const router = express.Router();

// 1. BUSCAR FEED (Fixados primeiro, depois por data)
router.get('/', async (req, res) => {
    try {
        const posts = await Feed.find().sort({ isFixado: -1, createdAt: -1 });
        res.json(posts);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao carregar o feed.' });
    }
});

// 2. REAÇÃO DE LIKE (❤️) BLINDADA CONTRA SPAM / RACE CONDITION
router.post('/:id/like', auth, async (req, res) => {
    try {
        const userId = req.usuario.id;
        const postId = req.params.id;

        // 🛡️ TENTATIVA 1: Adicionar Like Atómicamente
        // Só funciona se o userId ainda NÃO estiver no array de curtidas
        const postAdicionado = await Feed.findOneAndUpdate(
            { _id: postId, curtidas: { $ne: userId } },
            { $addToSet: { curtidas: userId }, $inc: { reacoes: 1 } },
            { new: true }
        );

        if (postAdicionado) {
            return res.json({ totalLikes: postAdicionado.reacoes, isLiked: true });
        }

        // 🛡️ TENTATIVA 2: Se falhou acima, é porque já curtiu. Então remove atómicamente!
        const postRemovido = await Feed.findOneAndUpdate(
            { _id: postId, curtidas: userId },
            { $pull: { curtidas: userId }, $inc: { reacoes: -1 } },
            { new: true }
        );

        if (postRemovido) {
            return res.json({ totalLikes: postRemovido.reacoes, isLiked: false });
        }

        res.status(404).json({ erro: 'Publicação não encontrada.' });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao processar reação.' });
    }
});

module.exports = router;
