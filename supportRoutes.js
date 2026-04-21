const express = require('express');
const Message = require('./Message');
const auth = require('./authMiddleware');
const router = express.Router();

// 1. ENVIAR MENSAGEM
router.post('/enviar', auth, async (req, res) => {
    try {
        const { texto } = req.body;
        if (!texto) return res.status(400).json({ erro: 'Vazio' });

        const novaMensagem = new Message({ usuarioId: req.usuario.id, remetente: 'usuario', texto });
        await novaMensagem.save();
        res.json({ mensagem: 'Enviado' });
    } catch (e) { res.status(500).json({ erro: 'Erro interno.' }); }
});

// 2. LER CHAT
router.get('/meu-chat', auth, async (req, res) => {
    try {
        const mensagens = await Message.find({ usuarioId: req.usuario.id }).sort({ createdAt: 1 });
        res.json(mensagens);
    } catch (e) { res.status(500).json({ erro: 'Erro interno.' }); }
});

// 3. EDITAR MENSAGEM
router.put('/editar/:id', auth, async (req, res) => {
    try {
        const { texto } = req.body;
        const mensagem = await Message.findOne({ _id: req.params.id, usuarioId: req.usuario.id });
        
        if (!mensagem || mensagem.isApagada) return res.status(404).json({ erro: 'Não disponível.' });
        
        const diff = (new Date() - new Date(mensagem.createdAt)) / (1000 * 60);
        if (diff > 20) return res.status(400).json({ erro: 'Tempo limite expirado.' });

        mensagem.texto = texto;
        await mensagem.save();
        res.json({ mensagem: 'Editado.' });
    } catch (e) { res.status(500).json({ erro: 'Erro interno.' }); }
});

// 4. APAGAR MENSAGEM (O SEGREDO: Em vez de eliminar, muda o estado)
router.delete('/apagar/:id', auth, async (req, res) => {
    try {
        const mensagem = await Message.findOne({ _id: req.params.id, usuarioId: req.usuario.id });
        if (!mensagem || mensagem.isApagada) return res.status(404).json({ erro: 'Não disponível.' });

        const diff = (new Date() - new Date(mensagem.createdAt)) / (1000 * 60);
        if (diff > 20) return res.status(400).json({ erro: 'Tempo limite expirado.' });

        mensagem.isApagada = true;
        mensagem.texto = "🚫 Mensagem anulada"; // Para limpar na base de dados
        await mensagem.save();
        
        res.json({ mensagem: 'Apagada.' });
    } catch (e) { res.status(500).json({ erro: 'Erro interno.' }); }
});

module.exports = router;
