const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./User');
const Transaction = require('./Transaction');
const Feed = require('./Feed');
const Plan = require('./Plan');
const Requirement = require('./requirement'); // <-- Letra minúscula corrigida para o Render!
const auth = require('./authMiddleware');
const router = express.Router();

// ==========================================
// 0. MIDDLEWARES E LOGIN DA DIRETORIA
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { telefone, senha } = req.body;
        const admin = await User.findOne({ telefone, isAdmin: true });
        if (!admin) return res.status(403).json({ erro: 'Acesso negado. Credenciais não encontradas.' });

        const senhaValida = await bcrypt.compare(senha, admin.senha);
        if (!senhaValida) return res.status(401).json({ erro: 'Senha incorreta.' });

        const token = jwt.sign({ id: admin._id, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, admin: { nome: admin.nome, id: admin.idUnico } });
    } catch (e) { res.status(500).json({ erro: 'Erro no login.' }); }
});

const adminAuth = async (req, res, next) => {
    if (!req.usuario.isAdmin) return res.status(403).json({ erro: 'Área restrita à Diretoria.' });
    next();
};

// ==========================================
// 1. DASHBOARD COMPLETO
// ==========================================
router.get('/dashboard', auth, adminAuth, async (req, res) => {
    try {
        const transacoes = await Transaction.find({ status: 'aprovado' });
        const totalDepositado = transacoes.filter(t => t.tipo === 'deposito').reduce((a, b) => a + b.valor, 0);
        const totalSacado = transacoes.filter(t => t.tipo === 'saque').reduce((a, b) => a + b.valor, 0);
        const usuariosAtivos = await User.countDocuments({ planoAtivo: { $ne: 'Nenhum' } });

        const ultimas = await Transaction.find().sort({ createdAt: -1 }).limit(10);
        const logs = ultimas.map(u => ({
            usuario: u.nomeUsuario || "ID: " + u.idUnicoUsuario,
            tipo: u.tipo.toUpperCase(),
            valor: u.tipo === 'saque' ? -u.valor : u.valor,
            data: u.createdAt
        }));

        res.json({ totalDepositado, totalSacado, caixaLiquido: totalDepositado - totalSacado, usuariosAtivos, ultimasAcoes: logs });
    } catch (e) { res.status(500).json({ erro: 'Falha ao calcular balanço.' }); }
});

// ==========================================
// 2. MÓDULO FINANCEIRO (CAIXA FORTE)
// ==========================================
router.get('/transacoes-pendentes', auth, adminAuth, async (req, res) => {
    try {
        const transacoes = await Transaction.find({ status: 'pendente', tipo: { $in: ['deposito', 'saque'] } }).sort({ createdAt: 1 });
        res.json(transacoes);
    } catch (erro) { res.status(500).json({ erro: 'Erro ao buscar pendentes.' }); }
});

router.post('/processar-transacao', auth, adminAuth, async (req, res) => {
    try {
        const { transacaoId, acao } = req.body;
        const transacao = await Transaction.findById(transacaoId);
        if (!transacao || transacao.status !== 'pendente') return res.status(400).json({ erro: 'Transação não encontrada.' });

        const usuario = await User.findById(transacao.usuarioId);
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        if (acao === 'aprovado') {
            if (transacao.tipo === 'deposito') usuario.saldo += transacao.valor;
            else if (transacao.tipo === 'saque') {
                const post = new Feed({ titulo: 'Saque Pago com Sucesso! 💸', mensagem: `O investidor ${usuario.nome.split(' ')[0]} (ID: ${usuario.idUnico}) recebeu ${transacao.valor} MZN.`, tipo: 'prova_pagamento', autor: 'Sistema Financeiro' });
                await post.save();
            }
        } else if (acao === 'rejeitado' || acao === 'fraude') {
            if (transacao.tipo === 'saque') usuario.saldo += transacao.valor;
            if (acao === 'fraude') usuario.status = 'analise';
        }

        transacao.status = acao;
        await transacao.save();
        await usuario.save();
        res.json({ mensagem: `Transação ${acao} com sucesso.` });
    } catch (erro) { res.status(500).json({ erro: 'Erro crítico.' }); }
});

// ==========================================
// 3. GESTÃO DE USUÁRIOS (BIG BROTHER)
// ==========================================
router.get('/usuarios/busca/:termo', auth, adminAuth, async (req, res) => {
    try {
        const q = req.params.termo;
        const users = await User.find({ $or: [{ telefone: q }, { idUnico: isNaN(q) ? 0 : Number(q) }] }).select('-senha');
        res.json(users);
    } catch (e) { res.status(500).json({ erro: 'Erro na busca.' }); }
});

router.post('/usuarios/acao', auth, adminAuth, async (req, res) => {
    try {
        const { userId, acao, valor, novaSenha } = req.body;
        const u = await User.findById(userId);
        if (!u) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        if (u.isAdmin) return res.status(403).json({ erro: 'Você não pode alterar dados de outro Diretor.' });

        if (acao === 'bloquear') u.status = 'bloqueado';
        if (acao === 'desbloquear') u.status = 'ativo';
        if (acao === 'analise') u.status = 'analise';
        if (acao === 'saldo_add') u.saldo += Number(valor);
        if (acao === 'saldo_rem') {
            if(u.saldo < valor) return res.status(400).json({ erro: 'Saldo insuficiente no usuário.' });
            u.saldo -= Number(valor);
        }
        if (acao === 'senha_reset') {
            const salt = await bcrypt.genSalt(10);
            u.senha = await bcrypt.hash(novaSenha, salt);
            if (u.precisaTrocarSenha !== undefined) u.precisaTrocarSenha = true;
        }

        await u.save();
        res.json({ mensagem: 'Ação executada com sucesso.' });
    } catch (e) { res.status(500).json({ erro: 'Erro na ação.' }); }
});

// ==========================================
// 4. FEED (MEGAFONE)
// ==========================================
router.post('/criar-post', auth, adminAuth, async (req, res) => {
    try {
        const novoPost = new Feed(req.body);
        await novoPost.save();
        res.json({ mensagem: 'Post publicado!' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao criar post.' }); }
});

// ==========================================
// 5. CONFIGURAÇÕES: PLANOS
// ==========================================
router.post('/planos/criar', auth, adminAuth, async (req, res) => {
    try {
        const novoPlano = new Plan(req.body);
        await novoPlano.save();
        res.json({ mensagem: 'Novo Node criado.' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao criar.' }); }
});

router.delete('/planos/apagar/:id', auth, adminAuth, async (req, res) => {
    try {
        await Plan.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Node apagado.' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao apagar.' }); }
});

// ==========================================
// 6. SISTEMA DE REQUISITOS (INTELIGÊNCIA)
// ==========================================
router.post('/requisitos/criar', auth, adminAuth, async (req, res) => {
    try {
        const novoReq = new Requirement({
            chave: "REQ_" + Date.now(),
            titulo: req.body.titulo,
            descricao: req.body.descricao,
            tipoValidacao: req.body.tipoValidacao,
            valorNecessario: req.body.valorNecessario
        });
        await novoReq.save();
        res.json({ mensagem: 'Regra de bónus injetada.' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao criar requisito.' }); }
});

router.get('/requisitos', auth, adminAuth, async (req, res) => {
    try {
        const reqs = await Requirement.find();
        res.json(reqs);
    } catch (e) { res.status(500).json({ erro: 'Erro ao listar.' }); }
});

router.delete('/requisitos/apagar/:id', auth, adminAuth, async (req, res) => {
    try {
        await Requirement.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Regra removida.' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao apagar.' }); }
});

module.exports = router;
