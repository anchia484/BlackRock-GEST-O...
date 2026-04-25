const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./User');
const auth = require('./authMiddleware');
const router = express.Router();

// LOGIN EXCLUSIVO PARA ADMIN
router.post('/login', async (req, res) => {
    try {
        const { telefone, senha } = req.body;
        const admin = await User.findOne({ telefone, isAdmin: true });

        if (!admin) return res.status(403).json({ erro: 'Acesso negado. Credenciais de diretoria não encontradas.' });

        const senhaValida = await bcrypt.compare(senha, admin.senha);
        if (!senhaValida) return res.status(401).json({ erro: 'Senha incorreta.' });

        const token = jwt.sign({ id: admin._id, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, admin: { nome: admin.nome, id: admin.idUnico } });
    } catch (e) { res.status(500).json({ erro: 'Erro no servidor de autenticação.' }); }
});

// MIDDLEWARE DE PROTEÇÃO PARA TODAS AS ROTAS ABAIXO
const verificarDiretoria = async (req, res, next) => {
    if (!req.usuario.isAdmin) return res.status(403).json({ erro: 'Área restrita à Diretoria.' });
    next();
};

module.exports = router;
// ROTA 1: ESTATÍSTICAS REAIS DO DASHBOARD MASTER
router.get('/dashboard', auth, async (req, res) => {
    try {
        // Apenas o ADM passa
        if (!req.usuario.isAdmin) return res.status(403).json({ erro: 'Acesso negado.' });

        const transacoes = await Transaction.find({ status: 'aprovado' });
        const totalDepositado = transacoes.filter(t => t.tipo === 'deposito').reduce((a, b) => a + b.valor, 0);
        const totalSacado = transacoes.filter(t => t.tipo === 'saque').reduce((a, b) => a + b.valor, 0);
        
        const usuariosAtivos = await User.countDocuments({ planoAtivo: { $ne: 'Nenhum' } });

        // Puxa as últimas 10 transações de qualquer tipo para o log
        const ultimas = await Transaction.find().sort({ createdAt: -1 }).limit(10);
        const logs = ultimas.map(u => ({
            usuario: u.nomeUsuario || "ID: " + u.idUnicoUsuario,
            tipo: u.tipo.toUpperCase(),
            valor: u.tipo === 'saque' ? -u.valor : u.valor,
            data: u.createdAt
        }));

        res.json({
            totalDepositado,
            totalSacado,
            caixaLiquido: totalDepositado - totalSacado,
            usuariosAtivos,
            ultimasAcoes: logs
        });
    } catch (e) { res.status(500).json({ erro: 'Falha ao calcular balanço global.' }); }
});
// ROTA 2: LISTAR TRANSAÇÕES PENDENTES
router.get('/transacoes-pendentes', auth, adminAuth, async (req, res) => {
    try {
        // Puxa tudo o que for depósito ou saque e que esteja pendente
        const transacoes = await Transaction.find({ 
            status: 'pendente', 
            tipo: { $in: ['deposito', 'saque'] } 
        }).sort({ createdAt: 1 }); // Mais antigos primeiro

        res.json(transacoes);
    } catch (erro) { 
        res.status(500).json({ erro: 'Erro ao buscar pendentes.' }); 
    }
});

// ROTA 3: PROCESSAR TRANSAÇÃO (A Aprovação Final)
router.post('/processar-transacao', auth, adminAuth, async (req, res) => {
    try {
        const { transacaoId, acao } = req.body; // acao = 'aprovado', 'rejeitado', 'fraude'
        
        const transacao = await Transaction.findById(transacaoId);
        if (!transacao || transacao.status !== 'pendente') {
            return res.status(400).json({ erro: 'Transação não encontrada ou já processada.' });
        }

        const usuario = await User.findById(transacao.usuarioId);
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        // LÓGICA FINANCEIRA IMPLACÁVEL
        if (acao === 'aprovado') {
            if (transacao.tipo === 'deposito') {
                // Depósito Aprovado: O dinheiro entra na conta do utilizador
                usuario.saldo += transacao.valor;
            } 
            else if (transacao.tipo === 'saque') {
                // Saque Aprovado: O dinheiro já foi deduzido no ato do pedido.
                // Criamos um Post automático no Feed para provar que a plataforma paga!
                const post = new Feed({
                    titulo: 'Saque Pago com Sucesso! 💸',
                    mensagem: `O investidor ${usuario.nome.split(' ')[0]} (ID: ${usuario.idUnico}) acaba de receber ${transacao.valor} MZN na sua conta M-Pesa/E-Mola. A BlackRock não falha!`,
                    tipo: 'prova_pagamento',
                    autor: 'Sistema Financeiro'
                });
                await post.save();
            }
        } 
        else if (acao === 'rejeitado' || acao === 'fraude') {
            if (transacao.tipo === 'saque') {
                // Saque Rejeitado: O dinheiro que estava bloqueado volta para o utilizador
                usuario.saldo += transacao.valor;
            }
            if (acao === 'fraude') {
                // Se marcar como fraude, podemos também bloquear o utilizador preventivamente
                usuario.status = 'analise'; 
            }
        }

        // Guarda as alterações
        transacao.status = acao;
        await transacao.save();
        await usuario.save();

        res.json({ mensagem: `Transação ${acao} com sucesso. Saldo atualizado.` });
    } catch (erro) { 
        res.status(500).json({ erro: 'Erro crítico ao processar valores.' }); 
    }
});
// ==========================================
// 6. CONFIGURAÇÕES DE NODES (PLANOS)
// ==========================================

// Criar Novo Plano
router.post('/planos/criar', auth, adminAuth, async (req, res) => {
    try {
        const novoPlano = new Plan(req.body);
        await novoPlano.save();
        res.json({ mensagem: 'Node criado e disponível para os usuários.' });
    } catch (e) {
        res.status(500).json({ erro: 'Erro ao criar plano.' });
    }
});

// Apagar Plano
router.delete('/planos/apagar/:id', auth, adminAuth, async (req, res) => {
    try {
        await Plan.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Node removido do sistema.' });
    } catch (e) {
        res.status(500).json({ erro: 'Erro ao apagar plano.' });
    }
});
// ==========================================
// 7. SISTEMA DE REQUISITOS (Checklist Master)
// ==========================================

// Criar novo Requisito
router.post('/requisitos/criar', auth, adminAuth, async (req, res) => {
    try {
        const Requirement = require('./requirement'); // Modelo que criamos na Parte 3 da resposta anterior
        const novoReq = new Requirement({
            chave: "REQ_" + Date.now(),
            titulo: req.body.titulo,
            descricao: req.body.descricao,
            tipoValidacao: req.body.tipoValidacao,
            valorNecessario: req.body.valorNecessario
        });
        await novoReq.save();
        res.json({ mensagem: 'Nova regra de bónus injetada no algoritmo.' });
    } catch (e) {
        res.status(500).json({ erro: 'Erro ao criar requisito.' });
    }
});

// Listar todos os Requisitos para o ADM
router.get('/requisitos', auth, adminAuth, async (req, res) => {
    try {
        const Requirement = require('./requirement');
        const reqs = await Requirement.find();
        res.json(reqs);
    } catch (e) { res.status(500).json({ erro: 'Erro ao listar.' }); }
});

// Apagar Requisito
router.delete('/requisitos/apagar/:id', auth, adminAuth, async (req, res) => {
    try {
        const Requirement = require('./requirement');
        await Requirement.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Regra removida.' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao apagar.' }); }
});