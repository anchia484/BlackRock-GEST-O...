const express = require('express');
const Transaction = require('./Transaction');
const auth = require('./authMiddleware');
const router = express.Router();

// 1. Rota para solicitar um depósito manual
router.post('/deposito', auth, async (req, res) => {
    try {
        const { valor, metodo, numeroTelefone } = req.body;

        if (valor <= 0) {
            return res.status(400).json({ erro: 'O valor do depósito deve ser maior que zero.' });
        }

        // Cria a transação como pendente
        const novaTransacao = new Transaction({
            usuarioId: req.usuario.id,
            tipo: 'deposito',
            valor,
            metodo, // Vai receber "M-Pesa" ou "e-Mola" do frontend depois
            numeroTelefone,
            status: 'pendente'
        });

        await novaTransacao.save();

        res.status(201).json({ 
            mensagem: 'Pedido de depósito enviado com sucesso! Aguarde a aprovação do administrador.',
            transacao: novaTransacao 
        });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

// 2. Rota para ver o histórico simples
router.get('/historico', auth, async (req, res) => {
    try {
        // Busca todas as transações deste usuário logado, da mais nova para a mais velha
        const historico = await Transaction.find({ usuarioId: req.usuario.id }).sort({ createdAt: -1 });
        res.json(historico);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

module.exports = router;
