const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // NOVO: Biblioteca para gerar a chave de acesso (Token)
const User = require('./User');
const router = express.Router();

const gerarIdUnico = () => Math.floor(10000 + Math.random() * 90000);

const gerarCodigoConvite = () => {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = '';
    for (let i = 0; i < 6; i++) {
        codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return codigo;
};

// ------------------- ROTA DE CADASTRO -------------------
router.post('/registro', async (req, res) => {
    try {
        const { nome, telefone, senha, codigoConvite } = req.body;

        const usuarioExiste = await User.findOne({ telefone });
        if (usuarioExiste) {
            return res.status(400).json({ erro: 'Este número já está cadastrado.' });
        }

        const salt = await bcrypt.genSalt(10);
        const senhaCriptografada = await bcrypt.hash(senha, salt);

        let idUnico = gerarIdUnico();
        let meuCodigoConvite = gerarCodigoConvite();

        while(await User.findOne({ idUnico })) idUnico = gerarIdUnico();
        while(await User.findOne({ meuCodigoConvite })) meuCodigoConvite = gerarCodigoConvite();

        const novoUsuario = new User({
            nome,
            telefone,
            senha: senhaCriptografada,
            idUnico,
            meuCodigoConvite,
            convidadoPor: codigoConvite || null
        });

        await novoUsuario.save();

        res.status(201).json({ 
            mensagem: 'Usuário cadastrado com sucesso!',
            usuario: {
                nome: novoUsuario.nome,
                telefone: novoUsuario.telefone,
                idUnico: novoUsuario.idUnico,
                meuCodigoConvite: novoUsuario.meuCodigoConvite,
                saldo: novoUsuario.saldo
            }
        });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

// ------------------- ROTA DE LOGIN (NOVA) -------------------
router.post('/login', async (req, res) => {
    try {
        const { telefone, senha } = req.body;

        // 1. Verifica se o usuário existe no banco
        const usuario = await User.findOne({ telefone });
        if (!usuario) {
            return res.status(400).json({ erro: 'Número de telefone não encontrado.' });
        }

        // 2. Compara a senha digitada com a senha criptografada do banco
        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) {
            return res.status(400).json({ erro: 'Senha incorreta.' });
        }

        // 3. Gera o Token de acesso seguro (dura 24 horas)
        const token = jwt.sign(
            { id: usuario._id, isAgente: usuario.isAgente, idUnico: usuario.idUnico }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );

        // 4. Retorna o sucesso e o token
        res.json({
            mensagem: 'Login efetuado com sucesso!',
            token: token,
            usuario: {
                nome: usuario.nome,
                idUnico: usuario.idUnico,
                saldo: usuario.saldo,
                isAgente: usuario.isAgente
            }
        });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

module.exports = router;
