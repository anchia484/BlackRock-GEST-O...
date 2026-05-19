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

// 2. LER CHAT (OTIMIZAÇÃO EXTREMA ANTI-OOM)
router.get('/meu-chat', auth, async (req, res) => {
    try {
        // 🛡️ OTIMIZAÇÃO: Busca APENAS as últimas 60 mensagens. 
        // Impede que o servidor Node.js esgote a RAM (OOM) ao enviar arrays gigantes no Polling.
        const mensagens = await Message.find({ usuarioId: req.usuario.id })
            .sort({ createdAt: -1 })
            .limit(60);
            
        // Inverte para voltar à ordem cronológica correta (antigas no topo, novas em baixo)
        res.json(mensagens.reverse());
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

// 4. APAGAR MENSAGEM (Muda o estado sem quebrar o banco de dados)
router.delete('/apagar/:id', auth, async (req, res) => {
    try {
        const mensagem = await Message.findOne({ _id: req.params.id, usuarioId: req.usuario.id });
        if (!mensagem || mensagem.isApagada) return res.status(404).json({ erro: 'Não disponível.' });

        const diff = (new Date() - new Date(mensagem.createdAt)) / (1000 * 60);
        if (diff > 20) return res.status(400).json({ erro: 'Tempo limite expirado.' });

        mensagem.isApagada = true;
        mensagem.texto = "🚫 Mensagem anulada"; 
        await mensagem.save();
        
        res.json({ mensagem: 'Apagada.' });
    } catch (e) { res.status(500).json({ erro: 'Erro interno.' }); }
});

module.exports = router;