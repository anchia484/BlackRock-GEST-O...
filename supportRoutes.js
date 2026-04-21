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

// ==========================================
// NOVAS ROTAS (SISTEMA DE EDIÇÃO E EXCLUSÃO)
// ==========================================

// 3. EDITAR MENSAGEM (Com regra estrita de 20 minutos)
router.put('/editar/:id', auth, async (req, res) => {
    try {
        const { texto } = req.body;
        
        // Procura a mensagem específica certificando-se que pertence a quem fez o pedido
        const mensagem = await Message.findOne({ _id: req.params.id, usuarioId: req.usuario.id });
        
        if (!mensagem) {
            return res.status(404).json({ erro: 'Mensagem não encontrada ou não pertence a este terminal.' });
        }
        
        // Calcula a diferença de tempo em minutos desde a criação da mensagem
        const diffMinutos = (new Date() - new Date(mensagem.createdAt)) / (1000 * 60);
        
        if (diffMinutos > 20) {
            return res.status(400).json({ erro: 'O tempo limite de 20 minutos para edição expirou.' });
        }

        // Atualiza e guarda a mensagem
        mensagem.texto = texto;
        await mensagem.save();
        
        res.json({ mensagem: 'Mensagem editada com sucesso.' });
    } catch (erro) { 
        res.status(500).json({ erro: 'Erro interno ao processar a edição.' }); 
    }
});

// 4. APAGAR MENSAGEM (Com regra estrita de 20 minutos)
router.delete('/apagar/:id', auth, async (req, res) => {
    try {
        // Procura a mensagem garantindo que pertence ao utilizador
        const mensagem = await Message.findOne({ _id: req.params.id, usuarioId: req.usuario.id });
        
        if (!mensagem) {
            return res.status(404).json({ erro: 'Mensagem não encontrada ou não pertence a este terminal.' });
        }

        // Bloqueio de tempo real no backend
        const diffMinutos = (new Date() - new Date(mensagem.createdAt)) / (1000 * 60);
        
        if (diffMinutos > 20) {
            return res.status(400).json({ erro: 'O tempo limite de 20 minutos para anular expirou.' });
        }

        // Remove a mensagem da base de dados
        await Message.deleteOne({ _id: req.params.id });
        
        res.json({ mensagem: 'Mensagem anulada com sucesso.' });
    } catch (erro) { 
        res.status(500).json({ erro: 'Erro interno ao anular a mensagem.' }); 
    }
});

module.exports = router;
