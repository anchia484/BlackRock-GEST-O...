const express = require('express');
const router = express.Router();
const auth = require('./authMiddleware'); 
const User = require('./User'); 
const Transaction = require('./Transaction'); // Puxa o modelo protegido

// 1. RECEBER E GUARDAR O DEPÓSITO
router.post('/deposito', auth, async (req, res) => {
    try {
        console.log("1. Backend recebeu o pedido de depósito...");
        
        const { canal, numeroOrigem, valor, idTransacaoBancaria, comprovanteBase64, senhaConfirmacao } = req.body;

        const usuario = await User.findById(req.usuario.id);
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        if (senhaConfirmacao !== usuario.senha) {
            console.log("Erro: Senha errada.");
            return res.status(400).json({ erro: 'Senha de segurança incorreta.' });
        }

        let operadoraFormatada = null;
        if (canal === 'M-PESA' || canal === 'M-Pesa') operadoraFormatada = 'M-Pesa';
        if (canal === 'E-MOLA' || canal === 'E-Mola') operadoraFormatada = 'E-Mola';

        // Usa o construtor protegido
        const novaTransacao = new Transaction({
            usuarioId: req.usuario.id,
            nomeUsuario: usuario.nome,         
            idUnicoUsuario: usuario.idUnico,   
            tipo: 'deposito',
            valor: valor,
            status: 'pendente',
            operadora: operadoraFormatada,       
            numeroTransferencia: numeroOrigem,   
            idTransacaoBancaria: idTransacaoBancaria,
            comprovanteBase64: comprovanteBase64
        });

        await novaTransacao.save();
        console.log("2. SUCESSO! Transação guardada no MongoDB.");

        res.json({ mensagem: 'Depósito registado com sucesso!' });

    } catch (erro) {
        console.error("ERRO AO SALVAR:", erro);
        res.status(500).json({ erro: 'Erro interno ao salvar no banco de dados.' });
    }
});

// 2. BUSCAR HISTÓRICO REAL
router.get('/historico', auth, async (req, res) => {
    try {
        const historico = await Transaction.find({ usuarioId: req.usuario.id }).sort({ createdAt: -1 });
        res.json(historico);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao carregar o histórico.' });
    }
});

module.exports = router;
