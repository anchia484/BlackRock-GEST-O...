const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./User');
const Transaction = require('./Transaction');
const Feed = require('./Feed'); // NOVO: Importando o Feed
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

// 5. PROCESSAR TRANSAÇÕES
router.post('/processar-transacao', auth, adminAuth, async (req, res) => {
    try {
        const { transacaoId, acao } = req.body; 
        const transacao = await Transaction.findById(transacaoId);
        if (!transacao || transacao.status !== 'pendente') return res.status(400).json({ erro: 'Transação inválida.' });

        const usuario = await User.findById(transacao.usuarioId);

        if (acao === 'aprovado') {
            transacao.status = 'aprovado';
            if (transacao.tipo === 'deposito') usuario.saldo += transacao.valor;
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
// 6. CRIAR NOVA NOTÍCIA NO FEED
// ==========================================
router.post('/criar-post', auth, adminAuth, async (req, res) => {
    try {
        const { titulo, mensagem, imagemBase64, tipo } = req.body;
        
        if (!titulo || !mensagem) {
            return res.status(400).json({ erro: 'O título e a mensagem são obrigatórios.' });
        }

        const novoPost = new Feed({ titulo, mensagem, imagemBase64, tipo });
        await novoPost.save();

        res.json({ mensagem: '📢 Sucesso! Nova postagem enviada para o Feed de todos os usuários.' });
    } catch (erro) { res.status(500).json({ erro: 'Erro no servidor' }); }
});

module.exports = router;
