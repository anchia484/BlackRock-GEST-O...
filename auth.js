const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./User');
const auth = require('./authMiddleware');
const router = express.Router();

// REGISTRO
router.post('/register', async (req, res) => {
    try {
        const { nome, telefone, senha, codigoConvite } = req.body;
        const usuarioExiste = await User.findOne({ telefone });
        if (usuarioExiste) return res.status(400).json({ erro: 'Este telefone já está registrado.' });

        const salt = await bcrypt.genSalt(10);
        const senhaCriptografada = await bcrypt.hash(senha, salt);
        const idGerado = Math.floor(10000 + Math.random() * 90000);
        const meuConvite = "BR" + idGerado;

        const novoUsuario = new User({
            nome, telefone, senha: senhaCriptografada,
            idUnico: idGerado, meuCodigoConvite: meuConvite,
            convidadoPor: codigoConvite || null
        });

        await novoUsuario.save();
        res.status(201).json({ mensagem: 'Conta criada com sucesso!', idUnico: idGerado });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        const { telefone, senha } = req.body;
        const usuario = await User.findOne({ telefone });
        if (!usuario) return res.status(400).json({ erro: 'Usuário não encontrado.' });

        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) return res.status(400).json({ erro: 'Senha incorreta.' });

        const token = jwt.sign({ id: usuario._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, usuario: { nome: usuario.nome, idUnico: usuario.idUnico, saldo: usuario.saldo, plano: usuario.planoAtivo } });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// ATUALIZAR PERFIL (Novo)
router.put('/perfil/atualizar', auth, async (req, res) => {
    try {
        const { nome, novaSenha, senhaAtual, carteiraPreferencial, numeroRecebimento, nomeTitularConta } = req.body;
        const usuario = await User.findById(req.usuario.id);

        const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
        if (!senhaValida) return res.status(401).json({ erro: 'Senha atual incorreta para autorizar mudanças.' });

        if (nome) usuario.nome = nome;
        if (carteiraPreferencial) usuario.carteiraPreferencial = carteiraPreferencial;
        if (numeroRecebimento) usuario.numeroRecebimento = numeroRecebimento;
        if (nomeTitularConta) usuario.nomeTitularConta = nomeTitularConta;
        
        if (novaSenha) {
            const salt = await bcrypt.genSalt(10);
            usuario.senha = await bcrypt.hash(novaSenha, salt);
        }

        await usuario.save();
        res.json({ mensagem: 'Dados atualizados com sucesso!' });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao atualizar perfil.' });
    }
});

module.exports = router;
