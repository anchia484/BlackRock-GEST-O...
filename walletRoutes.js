const express = require('express');
const router = express.Router();
const auth = require('./authMiddleware'); 
const User = require('./User'); 
const Transaction = require('./Transaction'); // Conecta-se ao seu ficheiro Transaction.js

// 1. RECEBER E GUARDAR O DEPÓSITO DEFINITIVAMENTE NA BASE DE DADOS
router.post('/deposito', auth, async (req, res) => {
    try {
        console.log("1. Recebendo pedido de depósito no backend..."); // LOG PARA DEBUG NO HOPWEB
        
        const { canal, numeroOrigem, valor, idTransacaoBancaria, comprovanteBase64, senhaConfirmacao } = req.body;

        // Vai buscar o utilizador para validar
        const usuario = await User.findById(req.usuario.id);
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        // Validação da Senha
        if (senhaConfirmacao !== usuario.senha) {
            console.log("Erro: Senha de confirmação errada.");
            return res.status(400).json({ erro: 'Senha de segurança incorreta.' });
        }

        // Traduz as operadoras para o formato exato que o seu Transaction.js exige
        let operadoraFormatada = null;
        if (canal === 'M-PESA' || canal === 'M-Pesa') operadoraFormatada = 'M-Pesa';
        if (canal === 'E-MOLA' || canal === 'E-Mola') operadoraFormatada = 'E-Mola';

        // Cria o cofre do registo
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

        // SALVA NA BASE DE DADOS (Esta é a linha que faltava no seu sistema original)
        await novaTransacao.save();
        
        console.log("2. SUCESSO! Depósito guardado na base de dados (MongoDB)."); // LOG DE SUCESSO

        res.json({ mensagem: 'Depósito registado com sucesso!' });

    } catch (erro) {
        console.error("ERRO GRAVE AO SALVAR DEPÓSITO:", erro);
        res.status(500).json({ erro: 'Erro interno ao salvar no banco de dados.' });
    }
});

// 2. LER HISTÓRICO REAL DA BASE DE DADOS
router.get('/historico', auth, async (req, res) => {
    try {
        console.log("3. O Telemóvel está a pedir o Histórico do utilizador:", req.usuario.id);
        
        // Vai à base de dados buscar todos os registos do utilizador
        const historico = await Transaction.find({ usuarioId: req.usuario.id }).sort({ createdAt: -1 });
        
        console.log("4. Total de registos encontrados na Base de Dados:", historico.length);
        
        res.json(historico); // Entrega os registos verdadeiros à página historico.html
    } catch (erro) {
        console.error("ERRO AO LER HISTÓRICO:", erro);
        res.status(500).json({ erro: 'Erro ao carregar o histórico.' });
    }
});

module.exports = router;
