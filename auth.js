const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./User');
const Recovery = require('./Recovery'); // Importando o banco de recuperação
const auth = require('./authMiddleware');
const router = express.Router();

// REGISTRO
router.post('/register', async (req, res) => {
    try {
        const { nome, telefone, senha, codigoConvite } = req.body;
        const usuarioExiste = await User.findOne({ telefone });
        if (usuarioExiste) return res.status(400).json({ erro: 'Telefone já registrado.' });

        if (senha.length < 6 || !/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
            return res.status(400).json({ erro: 'A senha deve ter letras, números e no mínimo 6 caracteres.' });
        }

        const salt = await bcrypt.genSalt(10);
        const senhaCriptografada = await bcrypt.hash(senha, salt);
        const idGerado = Math.floor(10000 + Math.random() * 90000);

        const novoUsuario = new User({
            nome, telefone, senha: senhaCriptografada,
            idUnico: idGerado, meuCodigoConvite: "BR" + idGerado,
            convidadoPor: codigoConvite || null
        });

        await novoUsuario.save();
        res.status(201).json({ mensagem: 'Conta criada!', idUnico: idGerado });
    } catch (erro) { res.status(500).json({ erro: 'Erro no servidor' }); }
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        const { nome, telefone, senha } = req.body;
        if (!nome || !telefone || !senha) return res.status(400).json({ erro: 'Preencha Nome, Número e Senha.' });

        const usuario = await User.findOne({ telefone });
        if (!usuario || usuario.nome !== nome) return res.status(400).json({ erro: 'Credenciais inválidas.' });

        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) return res.status(400).json({ erro: 'Senha incorreta.' });

        const token = jwt.sign({ id: usuario._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ 
            token, 
            precisaTrocarSenha: usuario.precisaTrocarSenha, // Avisa o app se o Admin resetou a senha
            usuario: { nome: usuario.nome, idUnico: usuario.idUnico, saldo: usuario.saldo, plano: usuario.planoAtivo } 
        });
    } catch (erro) { res.status(500).json({ erro: 'Erro no servidor' }); }
});

// PEDIR RECUPERAÇÃO DE CONTA (Não precisa de login)
router.post('/solicitar-recuperacao', async (req, res) => {
    try {
        const { telefone, nome, idUnico, descricao } = req.body;
        if (!telefone || !descricao) return res.status(400).json({ erro: 'Telefone e descrição são obrigatórios.' });

        const pedido = new Recovery({ telefone, nome, idUnico, descricao });
        await pedido.save();

        res.json({ mensagem: 'Pedido enviado à Diretoria. Aguarde o contato ou tente logar mais tarde com a senha padrão informada pelo suporte.' });
    } catch (erro) { res.status(500).json({ erro: 'Erro ao enviar pedido.' }); }
});

// ATUALIZAR PERFIL / TROCAR SENHA
router.put('/perfil/atualizar', auth, async (req, res) => {
    try {
        const { nome, novaSenha, senhaAtual, carteiraPreferencial, numeroRecebimento, nomeTitularConta } = req.body;
        const usuario = await User.findById(req.usuario.id);

        const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
        if (!senhaValida) return res.status(401).json({ erro: 'Senha atual incorreta.' });

        if (nome) usuario.nome = nome;
        if (carteiraPreferencial) usuario.carteiraPreferencial = carteiraPreferencial;
        if (numeroRecebimento) usuario.numeroRecebimento = numeroRecebimento;
        if (nomeTitularConta) usuario.nomeTitularConta = nomeTitularConta;
        
        if (novaSenha) {
            if (novaSenha.length < 6 || !/[a-zA-Z]/.test(novaSenha) || !/[0-9]/.test(novaSenha)) {
                return res.status(400).json({ erro: 'A senha deve ter letras, números e 6 caracteres.' });
            }
            const salt = await bcrypt.genSalt(10);
            usuario.senha = await bcrypt.hash(novaSenha, salt);
            usuario.precisaTrocarSenha = false; // Retira o aviso de troca forçada
        }

        await usuario.save();
        res.json({ mensagem: 'Dados atualizados com sucesso!' });
    } catch (erro) { res.status(500).json({ erro: 'Erro ao atualizar.' }); }
});

module.exports = router;
