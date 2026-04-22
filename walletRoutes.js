const express = require('express');
const router = express.Router();
const auth = require('./authMiddleware'); 
const User = require('./User'); 
const Transaction = require('./Transaction'); // O seu ficheiro integrado

// 1. RECEBER E GUARDAR O DEPÓSITO
router.post('/deposito', auth, async (req, res) => {
    try {
        const { canal, numeroOrigem, valor, idTransacaoBancaria, comprovanteBase64, senhaConfirmacao } = req.body;

        // Vai buscar o utilizador à base de dados para pegar o Nome, ID e validar a senha
        const usuario = await User.findById(req.usuario.id);
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        // Validação da Senha
        if (senhaConfirmacao !== usuario.senha) {
            return res.status(400).json({ erro: 'Senha de segurança incorreta.' });
        }

        // INTEGRAÇÃO: Adaptação para o seu modelo Transaction.js
        let operadoraFormatada = null;
        if (canal === 'M-PESA' || canal === 'M-Pesa') operadoraFormatada = 'M-Pesa';
        if (canal === 'E-MOLA' || canal === 'E-Mola') operadoraFormatada = 'E-Mola';

        const novaTransacao = new Transaction({
            usuarioId: usuario._id,
            nomeUsuario: usuario.nome,         // Preenche automaticamente o nome (do seu código)
            idUnicoUsuario: usuario.idUnico,   // Preenche automaticamente o ID (do seu código)
            tipo: 'deposito',
            valor: valor,
            status: 'pendente',
            operadora: operadoraFormatada,       // Usando o seu campo "operadora"
            numeroTransferencia: numeroOrigem,   // Usando o seu campo "numeroTransferencia"
            idTransacaoBancaria: idTransacaoBancaria,
            comprovanteBase64: comprovanteBase64
        });

        // Salva definitivamente na base de dados
        await novaTransacao.save();

        res.json({ mensagem: 'Depósito registado com sucesso!' });

    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro interno ao salvar no banco de dados.' });
    }
});

// 2. BUSCAR HISTÓRICO REAL
router.get('/historico', auth, async (req, res) => {
    try {
        // Vai buscar todas as transações, ordenadas das mais recentes para as mais antigas (-1)
        const historico = await Transaction.find({ usuarioId: req.usuario.id }).sort({ createdAt: -1 });
        res.json(historico);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao carregar o histórico.' });
    }
});

module.exports = router;
