const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./User');
const Transaction = require('./Transaction');
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

// ==========================================
// 4. VER FILA DE TRANSAÇÕES PENDENTES
// ==========================================
router.get('/transacoes-pendentes', auth, adminAuth, async (req, res) => {
    try {
        const pendentes = await Transaction.find({ status: 'pendente' }).sort({ createdAt: -1 });
        res.json(pendentes);
    } catch (erro) { res.status(500).json({ erro: 'Erro no servidor' }); }
});

// ==========================================
// 5. APROVAR, REJEITAR OU MARCAR COMO FRAUDE
// ==========================================
router.post('/processar-transacao', auth, adminAuth, async (req, res) => {
    try {
        const { transacaoId, acao } = req.body; // 'aprovado', 'rejeitado' ou 'fraude'
        
        const transacao = await Transaction.findById(transacaoId);
        if (!transacao || transacao.status !== 'pendente') {
            return res.status(400).json({ erro: 'Transação não encontrada ou já processada.' });
        }

        const usuario = await User.findById(transacao.usuarioId);

        if (acao === 'aprovado') {
            transacao.status = 'aprovado';
            if (transacao.tipo === 'deposito') usuario.saldo += transacao.valor;
        } else if (acao === 'rejeitado') {
            transacao.status = 'rejeitado';
            if (transacao.tipo === 'saque') usuario.saldo += transacao.valor; // Devolve o dinheiro do saque rejeitado
        } else if (acao === 'fraude') {
            transacao.status = 'fraude';
            // Em caso de fraude, a transação fica marcada no banco e o saldo não mexe
        } else {
            return res.status(400).json({ erro: 'Ação inválida.' });
        }

        await transacao.save();
        await usuario.save();

        res.json({ mensagem: `✅ Transação de ${transacao.tipo} de ${transacao.nomeUsuario} marcada como: ${acao.toUpperCase()}` });
    } catch (erro) { res.status(500).json({ erro: 'Erro no servidor' }); }
});

module.exports = router;
