const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./User');
const auth = require('./authMiddleware');
const router = express.Router();

// ==========================================
// CADEADO DE SEGURANÇA (Só Admin passa)
// ==========================================
const adminAuth = async (req, res, next) => {
    try {
        const usuario = await User.findById(req.usuario.id);
        if (!usuario || !usuario.isAdmin) {
            return res.status(403).json({ erro: 'ACESSO NEGADO: Você não tem permissão de Administrador.' });
        }
        next();
    } catch (erro) {
        res.status(500).json({ erro: 'Erro de segurança.' });
    }
};

// ==========================================
// 1. GERAR A SUA CONTA ADMIN (Rodar apenas 1 vez)
// ==========================================
router.post('/setup-admin', async (req, res) => {
    try {
        const adminExiste = await User.findOne({ isAdmin: true });
        if (adminExiste) {
            return res.status(400).json({ erro: 'O Administrador principal já foi criado.' });
        }

        const salt = await bcrypt.genSalt(10);
        const senhaCriptografada = await bcrypt.hash('SenhaAdmin123!', salt);

        const admin = new User({
            nome: 'Diretor BlackRock',
            telefone: 'ADMIN', // Login será com a palavra ADMIN
            senha: senhaCriptografada,
            idUnico: 00000,
            meuCodigoConvite: 'ADMIN0',
            isAdmin: true,
            isAgente: true
        });

        await admin.save();
        res.json({ mensagem: '✅ Conta de Administrador criada com sucesso! (Login: ADMIN / Senha: SenhaAdmin123!)' });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

// ==========================================
// 2. LOGIN EXCLUSIVO DO ADMIN (A porta dos fundos)
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { telefone, senha } = req.body;

        const usuario = await User.findOne({ telefone });
        if (!usuario) return res.status(400).json({ erro: 'Credenciais inválidas.' });

        // VERIFICAÇÃO DE SEPARAÇÃO: Se for usuário comum tentando entrar no link de admin, ele é bloqueado aqui!
        if (!usuario.isAdmin) {
            return res.status(403).json({ erro: 'ACESSO NEGADO: Esta tela de login é apenas para administradores.' });
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) return res.status(400).json({ erro: 'Credenciais inválidas.' });

        const token = jwt.sign(
            { id: usuario._id, isAdmin: true }, 
            process.env.JWT_SECRET, 
            { expiresIn: '12h' }
        );

        res.json({
            mensagem: 'Bem-vindo ao Painel de Controle BlackRock!',
            token: token,
            adminLogado: usuario.nome
        });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

// ==========================================
// 3. ADICIONAR SALDO (Função restrita)
// ==========================================
router.post('/adicionar-saldo', auth, adminAuth, async (req, res) => {
    try {
        const { telefoneUsuario, valor } = req.body;
        
        if (valor <= 0) return res.status(400).json({ erro: 'Valor inválido.' });

        const cliente = await User.findOne({ telefone: telefoneUsuario });
        if (!cliente) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        cliente.saldo += valor;
        await cliente.save();

        res.json({ mensagem: `✅ Sucesso! Injetado ${valor} MZN na conta de ${cliente.nome}.`, novoSaldo: cliente.saldo });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

module.exports = router;
