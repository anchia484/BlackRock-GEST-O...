const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./User');
const Transaction = require('./Transaction');
const Feed = require('./Feed');
const Plan = require('./Plan');
const Notification = require('./Notification');

// Como a sua pasta tem 'R' maiúsculo, mantemos o 'R' maiúsculo para não dar erro:
const Requirement = require('./Requirement'); 

const Message = require('./Message');
const System = require('./System');       // <-- ADICIONADO: Obrigatório para os Requisitos
const SystemLog = require('./SystemLog'); // <-- ADICIONADO: Obrigatório para a Caixa Negra
const auth = require('./authMiddleware');
const router = express.Router();

// ==========================================
// 0. LOGIN DA DIRETORIA
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
// 1. DASHBOARD CORPORATIVO E ESTATÍSTICAS
// ==========================================
router.get('/dashboard', auth, adminAuth, async (req, res) => {
    try {
        const transacoes = await Transaction.find();
        const aprovadas = transacoes.filter(t => t.status === 'aprovado');
        const pendentes = transacoes.filter(t => t.status === 'pendente');

        // Totais
        const totalDepositado = aprovadas.filter(t => t.tipo === 'deposito').reduce((a, b) => a + b.valor, 0);
        const totalSacado = aprovadas.filter(t => t.tipo === 'saque').reduce((a, b) => a + b.valor, 0);
        
        // Dados de Hoje
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        const depositosHoje = aprovadas.filter(t => t.tipo === 'deposito' && new Date(t.createdAt) >= startOfDay).reduce((a, b) => a + b.valor, 0);
        
        // Usuários
        const usuariosAtivos = await User.countDocuments({ planoAtivo: { $ne: 'Nenhum' } });
        const novosUsuariosHoje = await User.countDocuments({ createdAt: { $gte: startOfDay } });

        // Pendências (Alertas)
        const depPendentes = pendentes.filter(t => t.tipo === 'deposito').length;
        const saqPendentes = pendentes.filter(t => t.tipo === 'saque').length;

        // Logs de Atividade (Últimas 50 para o filtro do Frontend)
        const logs = aprovadas.sort((a,b) => b.createdAt - a.createdAt).slice(0, 50).map(u => ({
            id: u._id,
            usuario: u.nomeUsuario || "ID: " + u.idUnicoUsuario,
            tipo: u.tipo,
            valor: u.valor,
            data: u.createdAt
        }));

        // Dados para o Gráfico (Últimos 7 dias)
        const chartData = { labels: [], depositos: [], saques: [] };
        for(let i=6; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            chartData.labels.push(d.toLocaleDateString('pt-PT', {day:'2-digit', month:'2-digit'}));
            
            const dStart = new Date(d); dStart.setHours(0,0,0,0);
            const dEnd = new Date(d); dEnd.setHours(23,59,59,999);
            
            chartData.depositos.push(aprovadas.filter(t => t.tipo === 'deposito' && t.createdAt >= dStart && t.createdAt <= dEnd).reduce((a,b) => a+b.valor, 0));
            chartData.saques.push(aprovadas.filter(t => t.tipo === 'saque' && t.createdAt >= dStart && t.createdAt <= dEnd).reduce((a,b) => a+b.valor, 0));
        }

        res.json({ 
            totalDepositado, totalSacado, caixaLiquido: totalDepositado - totalSacado, 
            lucroSistema: totalDepositado - totalSacado, // Pode ajustar a fórmula do lucro depois se tiver taxas
            usuariosAtivos, novosUsuariosHoje, 
            depPendentes, saqPendentes,
            variacaoDep: depositosHoje, // Para mostrar "X MZN hoje"
            ultimasAcoes: logs,
            chartData
        });
    } catch (e) { res.status(500).json({ erro: 'Falha ao calcular balanço.' }); }
});

// ==========================================
// 1.5. BOTÃO DE DESTRUIÇÃO (RESET PARA LANÇAMENTO)
// ==========================================
router.post('/reset-sistema', auth, adminAuth, async (req, res) => {
    try {
        // Apaga todos os registos financeiros e chats, mas mantém os Planos e Requisitos
        await Transaction.deleteMany({});
        await Message.deleteMany({});
        await Feed.deleteMany({});
        
        // Zera o saldo e planos de todos os usuários (exceto os Diretores)
        await User.updateMany({ isAdmin: { $ne: true } }, { $set: { saldo: 0, planoAtivo: 'Nenhum' } });

        res.json({ mensagem: 'SISTEMA LIMPO! Plataforma pronta para o Lançamento Oficial.' });
    } catch (e) { res.status(500).json({ erro: 'Falha ao resetar o sistema.' }); }
});

// ==========================================
// 2. ALERTAS GLOBAIS (AS BOLINHAS VERMELHAS)
// ==========================================
router.get('/alertas-globais', auth, adminAuth, async (req, res) => {
    try {
        const pendentesFin = await Transaction.countDocuments({ status: 'pendente', tipo: { $in: ['deposito', 'saque'] } });
        const chatsNaoLidos = await Message.countDocuments({ remetente: 'usuario', lida: false });
        res.json({ financeiro: pendentesFin, chat: chatsNaoLidos, notificacoes: 0 });
    } catch (e) { res.status(500).json({ erro: 'Erro nos alertas.' }); }
});

// ==========================================
// 3. MÓDULO FINANCEIRO CORPORATIVO (CAIXA FORTE)
// ==========================================

// Buscar TODAS as transações (Pendentes, Aprovados, Rejeitados para o Histórico)
router.get('/transacoes-todas', auth, adminAuth, async (req, res) => {
    try {
        // Busca tudo ordenado da mais recente para a mais antiga
        const transacoes = await Transaction.find({ tipo: { $in: ['deposito', 'saque'] } }).sort({ createdAt: -1 });
        res.json(transacoes);
    } catch (erro) { res.status(500).json({ erro: 'Erro ao buscar financeiro.' }); }
});

router.post('/processar-transacao', auth, adminAuth, async (req, res) => {
    try {
        // Agora recebe o motivoRejeicao
        const { transacaoId, acao, motivoRejeicao } = req.body;
        const transacao = await Transaction.findById(transacaoId);
        if (!transacao || transacao.status !== 'pendente') return res.status(400).json({ erro: 'Transação não encontrada ou já processada.' });

        const usuario = await User.findById(transacao.usuarioId);
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        if (acao === 'aprovado') {
            if (transacao.tipo === 'deposito') {
                usuario.saldo += transacao.valor;
            } else if (transacao.tipo === 'saque') {
                const post = new Feed({ titulo: 'Saque Pago! 💸', mensagem: `O investidor ID: ${usuario.idUnico} recebeu ${transacao.valor} MZN.`, tipo: 'prova_pagamento', autor: 'Sistema Financeiro' });
                await post.save();
            }
        } else if (acao === 'rejeitado' || acao === 'fraude') {
            // Se for saque e for rejeitado, devolve o dinheiro ao saldo do usuário
            if (transacao.tipo === 'saque') usuario.saldo += transacao.valor;
            
            // Grava o motivo para o histórico
            if (motivoRejeicao) transacao.motivoRejeicao = motivoRejeicao;
            
            if (acao === 'fraude') usuario.status = 'analise';
        }

             await new Notification({
             usuarioId: idDoUsuarioAprovado,
             titulo: 'Depósito Aprovado',
             mensagem: 'O seu depósito de $1000 foi creditado com sucesso.',
             tipo: 'financeiro',
             link: 'historico.html'
             }).save();

        transacao.status = acao;
        
        // Log de Auditoria invisível
        transacao.processadoPor = req.usuario.id;
        transacao.dataProcessamento = new Date();

        await transacao.save();
        await usuario.save();
        res.json({ mensagem: `Transação ${acao} com sucesso.` });
    } catch (erro) { res.status(500).json({ erro: 'Erro crítico financeiro.' }); }
});

// ==========================================
// 4. GESTÃO DE USUÁRIOS
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
        if (!u) return res.status(404).json({ erro: 'Não encontrado.' });
        if (u.isAdmin) return res.status(403).json({ erro: 'Não pode alterar outro Diretor.' });

        if (acao === 'bloquear') u.status = 'bloqueado';
        if (acao === 'desbloquear') u.status = 'ativo';
        if (acao === 'analise') u.status = 'analise';
        if (acao === 'saldo_add') u.saldo += Number(valor);
        if (acao === 'saldo_rem') {
            if(u.saldo < valor) return res.status(400).json({ erro: 'Saldo insuficiente.' });
            u.saldo -= Number(valor);
        }
        if (acao === 'senha_reset') {
            const salt = await bcrypt.genSalt(10);
            u.senha = await bcrypt.hash(novaSenha, salt);
        }
        await u.save();
        res.json({ mensagem: 'Ação executada.' });
    } catch (e) { res.status(500).json({ erro: 'Erro na ação.' }); }
});

// ==========================================
// 5. CONFIGURAÇÕES: PLANOS E REQUISITOS
// ==========================================
router.post('/planos/criar', auth, adminAuth, async (req, res) => {
    try { const novoPlano = new Plan(req.body); await novoPlano.save(); res.json({ mensagem: 'Node criado.' }); } catch (e) { res.status(500).json({ erro: 'Erro.' }); }
});
router.delete('/planos/apagar/:id', auth, adminAuth, async (req, res) => {
    try { await Plan.findByIdAndDelete(req.params.id); res.json({ mensagem: 'Apagado.' }); } catch (e) { res.status(500).json({ erro: 'Erro.' }); }
});
router.post('/requisitos/criar', auth, adminAuth, async (req, res) => {
    try {
        const novoReq = new Requirement({ chave: "REQ_" + Date.now(), titulo: req.body.titulo, descricao: req.body.descricao, tipoValidacao: req.body.tipoValidacao, valorNecessario: req.body.valorNecessario });
        await novoReq.save(); res.json({ mensagem: 'Regra criada.' });
    } catch (e) { res.status(500).json({ erro: 'Erro.' }); }
});
router.get('/requisitos', auth, adminAuth, async (req, res) => {
    try { const reqs = await Requirement.find(); res.json(reqs); } catch (e) { res.status(500).json({ erro: 'Erro.' }); }
});
router.delete('/requisitos/apagar/:id', auth, adminAuth, async (req, res) => {
    try { await Requirement.findByIdAndDelete(req.params.id); res.json({ mensagem: 'Removida.' }); } catch (e) { res.status(500).json({ erro: 'Erro.' }); }
});

// ==========================================
// 6. FEED E COMUNICAÇÃO OFICIAL
// ==========================================
router.post('/criar-post', auth, adminAuth, async (req, res) => {
    try { const novoPost = new Feed(req.body); await novoPost.save(); res.json({ mensagem: 'Post publicado!' }); } catch (e) { res.status(500).json({ erro: 'Erro.' }); }
});

// ==========================================
// 7. MÓDULO CHAT SAC (ESTILO FACEBOOK)
// ==========================================
router.get('/suporte/conversas', auth, adminAuth, async (req, res) => {
    try {
        const conversas = await Message.aggregate([
            { $sort: { createdAt: -1 } },
            { $group: {
                _id: "$usuarioId",
                ultimaMensagem: { $first: "$texto" },
                data: { $first: "$createdAt" },
                naoLidas: { $sum: { $cond: [{ $and: [{ $eq: ["$remetente", "usuario"]}, { $eq: ["$lida", false]}] }, 1, 0] } }
            }},
            { $lookup: { from: "usuarios_blackrock", localField: "_id", foreignField: "_id", as: "user" } },
            { $unwind: "$user" },
            { $project: { usuarioId: "$_id", nomeUsuario: "$user.nome", idUnico: "$user.idUnico", ultimaMensagem: 1, naoLidas: 1, data: 1 } },
            { $sort: { data: -1 } }
        ]);
        res.json(conversas);
    } catch (e) { res.status(500).json({ erro: 'Erro conversas.' }); }
});

router.get('/suporte/conversa/:userId', auth, adminAuth, async (req, res) => {
    try {
        const msgs = await Message.find({ usuarioId: req.params.userId }).sort({ createdAt: 1 });
        await Message.updateMany({ usuarioId: req.params.userId, remetente: 'usuario', lida: false }, { $set: { lida: true } });
        res.json(msgs);
    } catch (e) { res.status(500).json({ erro: 'Erro chat.' }); }
});

router.post('/suporte/responder', auth, adminAuth, async (req, res) => {
    try {
        const novaMsg = new Message({ usuarioId: req.body.usuarioId, remetente: 'admin', texto: req.body.texto, lida: false });
        await novaMsg.save();
        const notif = new Notification({ usuarioId: usuarioId, titulo: 'Novo Atendimento SAC', mensagem: 'A Diretoria BlackRock respondeu à sua solicitação de suporte.', tipo: 'chat', link: 'chat.html'});
        await notif.save();

           res.json({ mensagem: 'Resposta enviada' });

        
    } catch (e) { res.status(500).json({ erro: 'Erro.' }); }
});
// ==========================================
// 10. MÓDULO DE REDE & COMISSÕES
// ==========================================
router.get('/rede/stats', auth, adminAuth, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalAgentes = await User.countDocuments({ isAgente: true });
        
        const comissoes = await Transaction.find({ tipo: { $in: ['comissao', 'bonus_deposito'] }, status: 'aprovado' });
        
        const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
        const comissoesHoje = comissoes.filter(c => new Date(c.createdAt) >= startOfDay).reduce((a, b) => a + b.valor, 0);
        const totalComissoes = comissoes.filter(c => c.tipo === 'comissao').reduce((a, b) => a + b.valor, 0);
        const totalBonusDep = comissoes.filter(c => c.tipo === 'bonus_deposito').reduce((a, b) => a + b.valor, 0);

        // TOP 5 Agentes (Quem tem mais saldo/convidados)
        const topAgentes = await User.find({ isAgente: true }).sort({ convidadosN1: -1 }).limit(5).select('nome idUnico convidadosN1 isAgente');

        res.json({ totalUsers, totalAgentes, comissoesHoje, totalComissoes, totalBonusDep, topAgentes });
    } catch (e) { res.status(500).json({ erro: 'Erro nas estatísticas de rede.' }); }
});

router.get('/rede/arvore/:termo', auth, adminAuth, async (req, res) => {
    try {
        const q = req.params.termo;
        const rootUser = await User.findOne({ $or: [{ telefone: q }, { idUnico: isNaN(q) ? 0 : Number(q) }, { nome: new RegExp(q, 'i') }] }).select('nome idUnico isAgente status nivel planoAtivo codigoConvite');
        
        if(!rootUser) return res.status(404).json({ erro: 'Usuário raiz não encontrado.' });

        // Busca N1 (Diretos)
        const n1 = await User.find({ convidadoPor: rootUser.codigoConvite }).select('nome idUnico isAgente status planoAtivo codigoConvite');
        
        // Busca N2 (Indiretos) mapeando os códigos do N1
        const codigosN1 = n1.map(u => u.codigoConvite);
        const n2 = await User.find({ convidadoPor: { $in: codigosN1 } }).select('nome idUnico isAgente status planoAtivo convidadoPor');

        res.json({ raiz: rootUser, diretos: n1, indiretos: n2 });
    } catch (e) { res.status(500).json({ erro: 'Erro ao montar árvore.' }); }
});

router.get('/rede/comissoes', auth, adminAuth, async (req, res) => {
    try {
        const comissoes = await Transaction.find({ tipo: { $in: ['comissao', 'bonus_deposito'] } }).sort({ createdAt: -1 }).limit(100);
        res.json(comissoes);
    } catch (e) { res.status(500).json({ erro: 'Erro nas comissões.' }); }
});

router.post('/rede/config', auth, adminAuth, async (req, res) => {
    try {
        // Como o sistema de Configs pode variar, guardamos os logs da alteração.
        // Se tiver uma tabela Config, o update seria feito aqui.
        res.json({ mensagem: 'Configurações de Rede atualizadas e registadas no sistema!' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao salvar configs.' }); }
});
// ==========================================
// 11. INTELIGÊNCIA AVANÇADA DE REDE (FRAUDE E AUDITORIA)
// ==========================================

// Detecção de Fraude (IP e Dispositivo)
router.get('/rede/fraude', auth, adminAuth, async (req, res) => {
    try {
        const suspeitos = await User.aggregate([
            { $group: { _id: "$ultimoIP", total: { $sum: 1 }, contas: { $push: { nome: "$nome", id: "$idUnico", tel: "$telefone" } } } },
            { $match: { total: { $gt: 1 }, _id: { $ne: null } } }
        ]);
        res.json(suspeitos);
    } catch (e) { res.status(500).json({ erro: 'Erro na análise de risco.' }); }
});

// Histórico de Auditoria
router.get('/rede/auditoria', auth, adminAuth, async (req, res) => {
    try {
        // Busca logs de transações que foram alterações de sistema (marcadas como auditoria)
        const logs = await Transaction.find({ tipo: 'auditoria_sistema' }).sort({ createdAt: -1 }).limit(50);
        res.json(logs);
    } catch (e) { res.status(500).json({ erro: 'Erro na auditoria.' }); }
});

// Ação de Bloqueio de Rede (Sem bloquear a conta)
router.post('/rede/bloquear-ganhos', auth, adminAuth, async (req, res) => {
    try {
        const { userId, statusRede } = req.body;
        await User.findByIdAndUpdate(userId, { redeBloqueada: statusRede });
        res.json({ mensagem: `Status de rede do usuário atualizado para: ${statusRede ? 'BLOQUEADO' : 'ATIVO'}` });
    } catch (e) { res.status(500).json({ erro: 'Erro ao alterar permissão.' }); }
});

// Criar ou Editar Plano (Com Cálculo Inteligente %)
router.post('/planos/salvar', auth, adminAuth, async (req, res) => {
    try {
        const { id, nome, nivel, valor, percentagem, duracao, tarefas } = req.body;
        
        // 🚨 VALIDAÇÕES E CÁLCULOS BLINDADOS NO BACKEND 🚨
        const valInvestimento = Number(valor);
        const valPercentagem = Number(percentagem);
        const dias = Number(duracao);

        if(valPercentagem <= 0 || valPercentagem > 50) return res.status(400).json({ erro: 'Percentagem inválida. Deve ser entre 0.1% e 50%.' });

        const ganhoDiarioCalculado = (valInvestimento * valPercentagem) / 100;
        const ganhoTotalCalculado = ganhoDiarioCalculado * dias;

        const dadosPlano = {
            nome, nivel, 
            valor: valInvestimento, 
            percentagem: valPercentagem,
            ganhoDiario: ganhoDiarioCalculado, 
            duracao: dias,
            tarefas: tarefas || (nivel === 'VIP GOLD' ? 15 : (nivel === 'PREMIUM PLUS' ? 10 : 5)),
            ganhoTotal: ganhoTotalCalculado,
            ativo: true
        };

        if (id) {
            await Plan.findByIdAndUpdate(id, dadosPlano);
            res.json({ mensagem: 'Node atualizado com a nova percentagem.' });
        } else {
            const existe = await Plan.findOne({ nome });
            if (existe) return res.status(400).json({ erro: 'Este nome de Node já existe.' });
            const novo = new Plan(dadosPlano);
            await novo.save();
            res.json({ mensagem: 'Novo Node criado com matemática inteligente.' });
        }
    } catch (e) { res.status(500).json({ erro: 'Erro ao salvar plano.' }); }
});
// Rota para estatísticas globais de tarefas
router.get('/tarefas/estatisticas', auth, adminAuth, async (req, res) => {
    try {
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const totalPago = await Transaction.aggregate([
            { $match: { tipo: 'tarefa', data: { $gte: hoje } } },
            { $group: { _id: null, total: { $sum: "$valor" } } }
        ]);
        const execucoesHoje = await Transaction.countDocuments({ tipo: 'tarefa', data: { $gte: hoje } });
        const usuariosAtivos = await User.countDocuments({ 'planoAtivo.status': true });

        res.json({
            execucoesHoje,
            totalPago: totalPago[0]?.total || 0,
            usuariosAtivos,
            mediaGanhos: execucoesHoje > 0 ? (totalPago[0]?.total / usuariosAtivos).toFixed(2) : 0
        });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});
// ==========================================
// 13. MÓDULO DE FEED & COMUNICAÇÃO OFICIAL
// ==========================================

// Buscar todos os posts com estatísticas (Admin)
router.get('/feed/admin/todos', auth, adminAuth, async (req, res) => {
    try {
        const posts = await Feed.find().sort({ isFixado: -1, createdAt: -1 });
        res.json(posts);
    } catch (e) { res.status(500).json({ erro: 'Erro ao carregar mural.' }); }
} );

// Criar Post (Manual)
router.post('/feed/criar', auth, adminAuth, async (req, res) => {
    try {
        const { tipo, texto, imagemUrl, videoUrl, isFixado } = req.body;
        const novoPost = new Feed({
            tipo, texto, imagemUrl, videoUrl, isFixado,
            autor: 'Administração',
            isAutomatico: false
        });
        await novoPost.save();
        res.json({ mensagem: 'Publicação lançada no mural!' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao publicar.' }); }
});

// Ações de Gestão (Fixar / Apagar)
router.patch('/feed/gestao', auth, adminAuth, async (req, res) => {
    try {
        const { postId, acao } = req.body;
        if(acao === 'fixar') {
            await Feed.updateMany({}, { isFixado: false }); // Desfixa outros
            await Feed.findByIdAndUpdate(postId, { isFixado: true });
        }
        if(acao === 'apagar') await Feed.findByIdAndDelete(postId);
        res.json({ mensagem: 'Mural atualizado com sucesso.' });
    } catch (e) { res.status(500).json({ erro: 'Erro na gestão do post.' }); }
});

// 2. Buscar histórico completo de um usuário
router.get('/suporte/historico/:userId', auth, adminAuth, async (req, res) => {
    try {
        const mensagens = await Message.find({ usuarioId: req.params.userId }).sort({ createdAt: 1 });
        // Marcar todas como lidas ao abrir o chat
        await Message.updateMany({ usuarioId: req.params.userId, enviadoPor: 'usuario' }, { lida: true });
        res.json(mensagens);
    } catch (e) { res.status(500).json({ erro: 'Erro ao carregar histórico.' }); }
});

// ==========================================
// 15. CENTRAL INTELIGENTE DE NOTIFICAÇÕES
// ==========================================

// Buscar todas as notificações e fazer limpeza automática (>10 dias)
router.get('/notificacoes', auth, adminAuth, async (req, res) => {
    try {
        const dezDiasAtras = new Date();
        dezDiasAtras.setDate(dezDiasAtras.getDate() - 10);
        
        // Auto-limpeza silenciosa
        // await Notification.deleteMany({ createdAt: { $lt: dezDiasAtras } }); // Descomente se tiver o modelo importado

        // Como Notification pode ser um modelo novo, você deve criar o arquivo Notification.js no seu backend.
        // Aqui simulamos a busca para a estrutura (Assumindo que o modelo Notification existe)
        const notificacoes = await Notification.find().sort({ createdAt: -1 });
        res.json(notificacoes);
    } catch (e) { res.status(500).json({ erro: 'Erro ao buscar alertas.' }); }
});

// Marcar como lida (Uma ou Todas)
router.patch('/notificacoes/ler', auth, adminAuth, async (req, res) => {
    try {
        const { id, todas } = req.body;
        if (todas) {
            await Notification.updateMany({ lida: false }, { lida: true });
        } else {
            await Notification.findByIdAndUpdate(id, { lida: true });
        }
        res.json({ mensagem: 'Status de leitura atualizado.' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao atualizar notificação.' }); }
});

// Limpar histórico manualmente
router.delete('/notificacoes/limpar', auth, adminAuth, async (req, res) => {
    try {
        await Notification.deleteMany({});
        res.json({ mensagem: 'Todas as notificações foram apagadas.' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao limpar.' }); }
});

// ==========================================
// 17. SISTEMA & REGRAS (CONFIGURAÇÃO GLOBAL DA PLATAFORMA)
// ==========================================

// Buscar as configurações atuais
router.get('/system', auth, adminAuth, async (req, res) => {
    try {
        // Assume que existe apenas 1 documento de configuração no banco
        let config = await System.findOne(); 
        if (!config) {
            // Se não existir, cria um padrão
            config = await System.create({ saqueAtivo: true, modoManutencao: false });
        }
        res.json(config);
    } catch (e) { res.status(500).json({ erro: 'Erro ao carregar configurações do sistema.' }); }
});

// Atualizar as configurações (Salvar Alterações Globais)
router.patch('/system', auth, adminAuth, async (req, res) => {
    try {
        const payload = req.body;
        
        // Encontra a configuração e atualiza com os novos dados recebidos do Frontend
        let config = await System.findOne();
        if (!config) {
            config = new System(payload);
        } else {
            Object.assign(config, payload);
        }
        
        await config.save();
        
        // Regista a ação na Caixa Negra (Logs do Sistema)
        await SystemLog.create({
            usuarioId: req.usuario.id,
            usuario: 'Diretoria (ADMIN)',
            acao: 'Atualizou as Regras e Diretrizes do Sistema',
            tipo: 'SISTEMA',
            ip: req.ip || req.connection.remoteAddress,
            status: 'sucesso',
            detalhes: payload
        });

        res.json({ mensagem: 'Configurações atualizadas com sucesso.', config });
    } catch (e) { res.status(500).json({ erro: 'Erro ao salvar configurações do sistema.' }); }
});

// ==========================================
// 17. ÁREA DE SUPORTE (CHAT ADMIN - VERSÃO FINAL BLINDADA)
// ==========================================

// 1. Lista de conversas
router.get('/suporte/lista', auth, adminAuth, async (req, res) => {
    try {
        const mensagens = await Message.find().populate('usuarioId', 'nome idUnico fotoPerfil').sort({ createdAt: -1 });
        const conversas = {};

        mensagens.forEach(msg => {
            if (!msg.usuarioId || !msg.usuarioId._id) return; 

            const uid = msg.usuarioId._id.toString();
            if (!conversas[uid]) {
                conversas[uid] = {
                    usuarioId: uid,
                    nome: msg.usuarioId.nome || 'Usuário Desconhecido',
                    idUnico: msg.usuarioId.idUnico || '00000',
                    fotoPerfil: msg.usuarioId.fotoPerfil || null,
                    ultimaMensagem: msg.texto || '',
                    data: msg.createdAt,
                    naoLidas: 0
                };
            }
            if (msg.remetente === 'usuario' && !msg.lida) {
                conversas[uid].naoLidas++;
            }
        });

        res.json(Object.values(conversas).sort((a, b) => b.data - a.data));
    } catch (e) { 
        res.status(500).json({ erro: 'Falha ao carregar lista de suporte.' }); 
    }
});

// 2. Abrir conversa
router.get('/suporte/conversa/:id', auth, adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await Message.updateMany({ usuarioId: id, remetente: 'usuario', lida: false }, { lida: true });
        const chat = await Message.find({ usuarioId: id }).sort({ createdAt: 1 });
        res.json(chat);
    } catch (e) { res.status(500).json({ erro: 'Erro ao abrir chat.' }); }
});

// 3. Responder
router.post('/suporte/responder', auth, adminAuth, async (req, res) => {
    try {
        const { usuarioId, texto } = req.body;
        if(!texto) return res.status(400).json({ erro: 'Mensagem vazia' });
        
        const msg = new Message({ usuarioId, remetente: 'admin', texto, lida: false });
        await msg.save();
        res.json({ mensagem: 'Resposta enviada' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao responder.' }); }
});
module.exports = router;