const express = require('express');
const Message = require('./Message');
const auth = require('./authMiddleware');
const router = express.Router();

// 1. USUÁRIO ENVIA MENSAGEM PARA O ADMIN
router.post('/enviar', auth, async (req, res) => {
    try {
        const { texto } = req.body;
        if (!texto) return res.status(400).json({ erro: 'A mensagem não pode estar vazia.' });

        const novaMensagem = new Message({
            usuarioId: req.usuario.id,
            remetente: 'usuario',
            texto
        });

        await novaMensagem.save();
        res.json({ mensagem: 'Mensagem enviada ao suporte!' });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao enviar mensagem.' });
    }
});

// 2. USUÁRIO LÊ O SEU PRÓPRIO CHAT
router.get('/meu-chat', auth, async (req, res) => {
    try {
        const mensagens = await Message.find({ usuarioId: req.usuario.id }).sort({ createdAt: 1 });
        res.json(mensagens);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao carregar chat.' });
    }
});

module.exports = router;
