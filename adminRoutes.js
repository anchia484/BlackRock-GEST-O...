const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./User');
const Transaction = require('./Transaction');
const Feed = require('./Feed'); // Importando o banco do Feed
const auth = require('./authMiddleware');
const router = express.Router();

const adminAuth = async (req, res, next) => {
    try {
        const usuario = await User.findById(req.usuario.id);
        if (!usuario || !usuario.isAdmin) return res.status(403).json({ erro: 'ACESSO NEGADO' });
        next();
    } catch (erro) { res.status(500).json({ erro: 'Erro de segurança.' }); }
};

// 1. GERAR ADMIN
router.post('/setup-admin', async (req, res) => {
    try {
        const adminExiste = await User.findOne({ isAdmin: true });
        if (adminExiste) return res.status(400).json({ erro: 'O Administrador principal já foi criado.' });

        const salt = await bcrypt.genSalt(10);
        const senhaCriptografada = await bcrypt.hash('SenhaAdmin123!', salt);

        const admin = new User({
            nome: 'Diretor BlackRock', telefone: 'ADMIN', senha: senhaCriptografada,
            idUnico: 00000, meuCodigoConvite: 'ADMIN0', isAdmin: true, isAgente: true
        });

        await admin.save();
        res.json({ mensagem: '✅ Conta de Administrador criada com sucesso!' });
    } catch (erro) { res.status(500).json({ erro: 'Erro no servidor' }); }
});

// 2. LOGIN ADMIN
router.post('/login', async (req, res) => {
    try {
        const { telefone, senha } = req.body;
        const usuario = await User.findOne({ telefone });
        if (!usuario || !usuario.isAdmin) return res.status(403).json({ erro: 'ACESSO NEGADO' });

        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) return res.status(400).json({ erro: 'Credenciais inválidas.' });

        const token = jwt.sign({ id: usuario._id, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '12h' });
        res.json({ mensagem: 'Bem-vindo ao Painel Admin!', token, adminLogado: usuario.nome });
    } catch (erro) { res.status(500).json({ erro: 'Erro no servidor' }); }
});

// 3. INJETAR SALDO MANUAL
router.post('/adicionar-saldo', auth, adminAuth, async (req, res) => {
    try {
        const { telefoneUsuario, valor } = req.body;
        const cliente = await User.findOne({ telefone: telefoneUsuario });
        if (!cliente) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        cliente.saldo += valor;
        await cliente.save();
        res.json({ mensagem: `✅ Injetado ${valor} MZN em ${cliente.nome}.`, novoSaldo: cliente.saldo });
    } catch (erro) { res.status(500).json({ erro: 'Erro no servidor' }); }
});

// 4. VER FILA DE TRANSAÇÕES
router.get('/transacoes-pendentes', auth, adminAuth, async (req, res) => {
    try {
        const pendentes = await Transaction.find({ status: 'pendente' }).sort({ createdAt: -1 });
        res.json(pendentes);
    } catch (erro) { res.status(500).json({ erro: 'Erro no servidor' }); }
});

// 5. PROCESSAR TRANSAÇÕES E GERAR POST AUTOMÁTICO DE SAQUE
router.post('/processar-transacao', auth, adminAuth, async (req, res) => {
    try {
        const { transacaoId, acao } = req.body; 
        const transacao = await Transaction.findById(transacaoId);
        if (!transacao || transacao.status !== 'pendente') return res.status(400).json({ erro: 'Transação inválida.' });

        const usuario = await User.findById(transacao.usuarioId);

        if (acao === 'aprovado') {
            transacao.status = 'aprovado';
            if (transacao.tipo === 'deposito') {
                usuario.saldo += transacao.valor;
            } else if (transacao.tipo === 'saque') {
                // AQUI ESTÁ A MÁGICA: Post automático de Prova de Pagamento
                const postPagamento = new Feed({
                    titulo: 'Pagamento Realizado! ✅',
                    mensagem: `O usuário ${usuario.nome.split(' ')[0]} recebeu ${transacao.valor} MZN via ${transacao.operadora}.`,
                    tipo: 'prova_pagamento',
                    autor: 'Financeiro BlackRock',
                    dadosExtras: { idUsuario: usuario.idUnico, valor: transacao.valor }
                });
                await postPagamento.save();
            }
        } else if (acao === 'rejeitado') {
            transacao.status = 'rejeitado';
            if (transacao.tipo === 'saque') usuario.saldo += transacao.valor; 
        } else if (acao === 'fraude') {
            transacao.status = 'fraude';
        } else {
            return res.status(400).json({ erro: 'Ação inválida.' });
        }

        await transacao.save();
        await usuario.save();
        res.json({ mensagem: `✅ Transação de ${transacao.tipo} marcada como: ${acao.toUpperCase()}` });
    } catch (erro) { res.status(500).json({ erro: 'Erro no servidor' }); }
});

// ==========================================
// 6. CRIAR POST PROFISSIONAL NO FEED
// ==========================================
router.post('/criar-post', auth, adminAuth, async (req, res) => {
    try {
        const { titulo, mensagem, midiaBase64, formatoMidia, tipo, isFixado } = req.body;
        
        const novoPost = new Feed({ 
            titulo, mensagem, midiaBase64, formatoMidia, tipo, isFixado 
        });
        await novoPost.save();

        res.json({ mensagem: '📢 Postagem publicada com sucesso no Feed!' });
    } catch (erro) { res.status(500).json({ erro: 'Erro no servidor' }); }
});

// ==========================================
// 7. FIXAR OU DESFIXAR POST
// ==========================================
router.patch('/fixar-post/:id', auth, adminAuth, async (req, res) => {
    try {
        const post = await Feed.findById(req.params.id);
        if (!post) return res.status(404).json({ erro: 'Post não encontrado.' });
        
        post.isFixado = !post.isFixado; // Inverte o estado (se for true vira false, se for false vira true)
        await post.save();
        
        res.json({ mensagem: post.isFixado ? 'Post fixado no topo! 📌' : 'Post desfixado.' });
    } catch (erro) { res.status(500).json({ erro: 'Erro no servidor' }); }
});

module.exports = router;
