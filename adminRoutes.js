const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./User');
const Transaction = require('./Transaction');
const Feed = require('./Feed');
const Plan = require('./Plan');
const auth = require('./authMiddleware');
const router = express.Router();

const adminAuth = async (req, res, next) => {
    try {
        const usuario = await User.findById(req.usuario.id);
        if (!usuario || !usuario.isAdmin) return res.status(403).json({ erro: 'ACESSO NEGADO' });
        next();
    } catch (erro) { res.status(500).json({ erro: 'Erro de segurança.' }); }
};

// 1. DASHBOARD (Estatísticas Reais)
router.get('/dashboard', auth, adminAuth, async (req, res) => {
    try {
        const totalUsuarios = await User.countDocuments({ isAdmin: false });
        const usuariosAtivos = await User.countDocuments({ planoAtivo: { $ne: 'Nenhum' } });
        const transacoes = await Transaction.find({ status: 'aprovado' });
        
        const totalDepositado = transacoes.filter(t => t.tipo === 'deposito').reduce((acc, curr) => acc + curr.valor, 0);
        const totalSacado = transacoes.filter(t => t.tipo === 'saque').reduce((acc, curr) => acc + curr.valor, 0);

        res.json({
            totalUsuarios,
            usuariosAtivos,
            caixaLiquido: totalDepositado - totalSacado,
            totalDepositado,
            totalSacado
        });
    } catch (erro) { res.status(500).json({ erro: 'Erro no Dashboard' }); }
});

// 2. CONFIGURAR PLANOS (Criar ou Editar)
router.post('/configurar-plano', auth, adminAuth, async (req, res) => {
    try {
        const { nome, preco, ganhoDiario, limiteTarefasDia, validadeDias } = req.body;
        const plano = await Plan.findOneAndUpdate(
            { nome }, 
            { preco, ganhoDiario, limiteTarefasDia, validadeDias },
            { upsert: true, new: true }
        );
        res.json({ mensagem: `Plano ${nome} atualizado!`, plano });
    } catch (erro) { res.status(500).json({ erro: 'Erro ao configurar plano.' }); }
});

// 3. SETUP ADMIN INICIAL
router.post('/setup-admin', async (req, res) => {
    try {
        const adminExiste = await User.findOne({ isAdmin: true });
        if (adminExiste) return res.status(400).json({ erro: 'Admin já existe.' });
        const salt = await bcrypt.genSalt(10);
        const senhaCriptografada = await bcrypt.hash('SenhaAdmin123!', salt);
        const admin = new User({
            nome: 'Diretor BlackRock', telefone: 'ADMIN', senha: senhaCriptografada,
            idUnico: 0, meuCodigoConvite: 'ADMIN0', isAdmin: true
        });
        await admin.save();
        res.json({ mensagem: 'Admin criado!' });
    } catch (erro) { res.status(500).json({ erro: 'Erro no setup' }); }
});

// 4. LOGIN ADMIN
router.post('/login', async (req, res) => {
    try {
        const { telefone, senha } = req.body;
        const usuario = await User.findOne({ telefone });
        if (!usuario || !usuario.isAdmin) return res.status(403).json({ erro: 'Acesso negado.' });
        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) return res.status(400).json({ erro: 'Senha incorreta.' });
        const token = jwt.sign({ id: usuario._id, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '12h' });
        res.json({ token, adminLogado: usuario.nome });
    } catch (erro) { res.status(500).json({ erro: 'Erro no login' }); }
});

// 5. PROCESSAR TRANSAÇÕES + POST AUTOMÁTICO
router.post('/processar-transacao', auth, adminAuth, async (req, res) => {
    try {
        const { transacaoId, acao } = req.body; 
        const transacao = await Transaction.findById(transacaoId);
        const usuario = await User.findById(transacao.usuarioId);

        if (acao === 'aprovado') {
            transacao.status = 'aprovado';
            if (transacao.tipo === 'deposito') usuario.saldo += transacao.valor;
            if (transacao.tipo === 'saque') {
                const post = new Feed({
                    titulo: 'Pagamento Realizado! ✅',
                    mensagem: `O usuário ${usuario.nome.split(' ')[0]} recebeu ${transacao.valor} MZN.`,
                    tipo: 'prova_pagamento'
                });
                await post.save();
            }
        } else {
            transacao.status = acao; // rejeitado ou fraude
            if (transacao.tipo === 'saque' && acao === 'rejeitado') usuario.saldo += transacao.valor;
        }

        await transacao.save();
        await usuario.save();
        res.json({ mensagem: 'Transação processada!' });
    } catch (erro) { res.status(500).json({ erro: 'Erro ao processar' }); }
});

// 6. FEED E INJETAR SALDO
router.post('/criar-post', auth, adminAuth, async (req, res) => {
    const novoPost = new Feed(req.body);
    await novoPost.save();
    res.json({ mensagem: 'Post criado!' });
});

router.post('/adicionar-saldo', auth, adminAuth, async (req, res) => {
    const { telefoneUsuario, valor } = req.body;
    const cliente = await User.findOne({ telefone: telefoneUsuario });
    cliente.saldo += valor;
    await cliente.save();
    res.json({ mensagem: 'Saldo injetado!' });
});

router.get('/transacoes-pendentes', auth, adminAuth, async (req, res) => {
    const pendentes = await Transaction.find({ status: 'pendente' }).sort({ createdAt: -1 });
    res.json(pendentes);
});

module.exports = router;
