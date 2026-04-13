const express = require('express');
const Transaction = require('./Transaction');
const User = require('./User');
const auth = require('./authMiddleware');
const router = express.Router();

// 1. Usuário solicita Depósito
router.post('/deposito', auth, async (req, res) => {
    try {
        const { valor, metodo, numeroTelefone } = req.body;
        if (valor < 100) return res.status(400).json({ erro: 'O depósito mínimo é de 100 MZN.' });

        const novaTransacao = new Transaction({
            usuarioId: req.usuario.id,
            tipo: 'deposito',
            valor,
            metodo,
            numeroTelefone,
            status: 'pendente'
        });

        await novaTransacao.save();
        res.json({ mensagem: 'Pedido de depósito enviado com sucesso! Aguarde a aprovação da Diretoria.' });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor.' });
    }
});

// 2. Usuário solicita Saque (Levantamento)
router.post('/saque', auth, async (req, res) => {
    try {
        const { valor, metodo, numeroTelefone } = req.body;
        const usuario = await User.findById(req.usuario.id);

        if (valor < 200) return res.status(400).json({ erro: 'O saque mínimo é de 200 MZN.' });
        if (usuario.saldo < valor) return res.status(400).json({ erro: 'Saldo insuficiente. Você não tem esse valor disponível.' });

        // Retira o saldo imediatamente (o dinheiro fica congelado aguardando o Admin)
        usuario.saldo -= valor;
        await usuario.save();

        const novaTransacao = new Transaction({
            usuarioId: req.usuario.id,
            tipo: 'saque',
            valor,
            metodo,
            numeroTelefone,
            status: 'pendente'
        });

        await novaTransacao.save();
        res.json({ 
            mensagem: `Pedido de saque de ${valor} MZN enviado! O valor foi retido da sua conta e aguarda aprovação.`, 
            saldoRestante: usuario.saldo 
        });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor.' });
    }
});

module.exports = router;
