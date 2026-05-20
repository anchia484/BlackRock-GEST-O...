const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./User');
const Recovery = require('./Recovery'); 
const auth = require('./authMiddleware');
const router = express.Router();

// ==========================================
// REGISTRO SEGURO (COM VALIDAÇÃO DE VÍNCULO)
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { nome, telefone, senha, codigoConvite } = req.body;
        
        if (!nome || !telefone || !senha) {
            return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
        }

        const usuarioExiste = await User.findOne({ telefone });
        if (usuarioExiste) return res.status(400).json({ erro: 'Telefone já registrado na plataforma.' });

        if (senha.length < 6 || !/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
            return res.status(400).json({ erro: 'A senha deve ter letras, números e no mínimo 6 caracteres.' });
        }

        const salt = await bcrypt.genSalt(10);
        const senhaCriptografada = await bcrypt.hash(senha, salt);
        
        // MOTOR DE GERAÇÃO DE ID ÚNICO
        let idGerado;
        let isUnique = false;
        let tentativas = 0;

        while (!isUnique) {
            if (tentativas > 10) {
                idGerado = Math.floor(100000 + Math.random() * 900000); 
            } else {
                idGerado = Math.floor(10000 + Math.random() * 90000); 
            }

            const checkId = await User.findOne({ idUnico: idGerado }).select('_id').lean();
            if (!checkId) {
                isUnique = true;
            }
            tentativas++;
        }

        // 🛡️ VALIDAÇÃO DE VÍNCULO (Impede nós órfãos na rede)
        let patrocinadorValido = null;
        if (codigoConvite) {
            const patrocinador = await User.findOne({ meuCodigoConvite: codigoConvite }).select('_id').lean();
            if (patrocinador) {
                patrocinadorValido = codigoConvite;
            }
        }

        const novoUsuario = new User({
            nome, telefone, senha: senhaCriptografada,
            idUnico: idGerado, meuCodigoConvite: "BR" + idGerado,
            convidadoPor: patrocinadorValido 
        });

        await novoUsuario.save();
        res.status(201).json({ mensagem: 'Conta criada com sucesso!', idUnico: idGerado });
    } catch (erro) { 
        console.error("Erro no registro:", erro);
        res.status(500).json({ erro: 'Erro no servidor' }); 
    }
});

// ==========================================
// LOGIN (COM TOKEN DE VIDA CURTA)
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { nome, telefone, senha } = req.body;
        if (!nome || !telefone || !senha) return res.status(400).json({ erro: 'Preencha Nome, Número e Senha.' });

        const usuario = await User.findOne({ telefone });
        if (!usuario || usuario.nome !== nome) return res.status(400).json({ erro: 'Credenciais inválidas.' });

        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) return res.status(400).json({ erro: 'Senha incorreta.' });

        // Token do usuário morre em exatos 20 minutos (Segurança Financeira)
        const token = jwt.sign({ id: usuario._id, isAdmin: usuario.isAdmin }, process.env.JWT_SECRET, { expiresIn: '20m' });
        
        res.json({ 
            token, 
            precisaTrocarSenha: usuario.precisaTrocarSenha, 
            usuario: { nome: usuario.nome, idUnico: usuario.idUnico, saldo: usuario.saldo, plano: usuario.planoAtivo, isAdmin: usuario.isAdmin } 
        });
    } catch (erro) { res.status(500).json({ erro: 'Erro no servidor' }); }
});

// ==========================================
// RECUPERAÇÃO E PERFIL
// ==========================================
router.post('/solicitar-recuperacao', async (req, res) => {
    try {
        const { telefone, nome, idUnico, descricao } = req.body;
        if (!telefone || !descricao) return res.status(400).json({ erro: 'Telefone e descrição são obrigatórios.' });

        const pedido = new Recovery({ telefone, nome, idUnico, descricao });
        await pedido.save();

        res.json({ mensagem: 'Pedido enviado à Diretoria. Aguarde o contato ou tente logar mais tarde com a senha informada pelo suporte.' });
    } catch (erro) { res.status(500).json({ erro: 'Erro ao enviar pedido.' }); }
});

router.put('/perfil/atualizar', auth, async (req, res) => {
    try {
        const { nome, telefone, novaSenha, senhaAtual, carteiraPreferencial, numeroRecebimento, nomeTitularConta } = req.body;
        const usuario = await User.findById(req.usuario.id);

        const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
        if (!senhaValida) return res.status(401).json({ erro: 'Senha atual incorreta.' });

        if (nome) usuario.nome = nome;
        if (telefone) usuario.telefone = telefone; 
        if (carteiraPreferencial) usuario.carteiraPreferencial = carteiraPreferencial;
        if (numeroRecebimento) usuario.numeroRecebimento = numeroRecebimento;
        if (nomeTitularConta) usuario.nomeTitularConta = nomeTitularConta;
        
        if (novaSenha) {
            if (novaSenha.length < 6 || !/[a-zA-Z]/.test(novaSenha) || !/[0-9]/.test(novaSenha)) {
                return res.status(400).json({ erro: 'A senha deve ter letras, números e 6 caracteres.' });
            }
            const salt = await bcrypt.genSalt(10);
            usuario.senha = await bcrypt.hash(novaSenha, salt);
            usuario.precisaTrocarSenha = false; 
        }

        await usuario.save();
        res.json({ mensagem: 'Dados atualizados com sucesso!' });
    } catch (erro) { res.status(500).json({ erro: 'Erro ao atualizar.' }); }
});

module.exports = router;