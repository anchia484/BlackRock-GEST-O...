const express = require('express');
const router = express.Router();
const MarketProduct = require('./MarketProduct');
const MarketContract = require('./MarketContract');
const MarketConfig = require('./MarketConfig');
const User = require('./User'); 
const Transaction = require('./Transaction'); 
const auth = require('./authMiddleware');

const adminAuth = async (req, res, next) => {
    if (!req.usuario || !req.usuario.isAdmin) {
        return res.status(403).json({ erro: 'Acesso restrito à Diretoria BlackRock.' });
    }
    next();
};

router.get('/config', auth, adminAuth, async (req, res) => {
    try {
        let config = await MarketConfig.findOne();
        if (!config) config = await MarketConfig.create({ isMercadoAberto: false });
        res.json(config);
    } catch (e) { res.status(500).json({ erro: 'Erro de config.' }); }
});

router.post('/config', auth, adminAuth, async (req, res) => {
    try {
        const { isMercadoAberto, dataFechamento } = req.body;
        let config = await MarketConfig.findOne();
        if (!config) config = new MarketConfig();
        
        if (isMercadoAberto === false && config.isMercadoAberto === true) {
            await MarketProduct.updateMany({ status: 'ativo' }, { $set: { status: 'oculto' } });
        }
        
        config.isMercadoAberto = isMercadoAberto;
        if (dataFechamento !== undefined) config.dataFechamento = dataFechamento; 
        
        await config.save();
        res.json({ mensagem: isMercadoAberto ? '🔥 MERCADO ABERTO!' : '🔒 MERCADO FECHADO.', config });
    } catch (e) { res.status(500).json({ erro: 'Erro.' }); }
});

router.get('/produtos', auth, adminAuth, async (req, res) => {
    try {
        const produtos = await MarketProduct.find().sort({ createdAt: -1 });
        res.json(produtos);
    } catch (e) { res.status(500).json({ erro: 'Erro' }); }
});

// 🚀 CRIAÇÃO COM SUPORTE A HORAS (FLEXIBILIDADE TOTAL)
router.post('/produtos', auth, adminAuth, async (req, res) => {
    try {
        // Recebe duracaoHoras e duracaoDias do frontend
        const { nome, valorMinimo, valorMaximo, duracaoDias, duracaoHoras, retornoPercentual, limiteParticipantes, status } = req.body;
        
        const novoProduto = new MarketProduct({
            nome, valorMinimo, valorMaximo, 
            duracaoDias: duracaoDias || 0, 
            duracaoHoras: duracaoHoras || 0, // Guarda as horas no BD
            retornoPercentual, limiteParticipantes, status
        });
        await novoProduto.save();
        res.status(201).json({ mensagem: 'Produto criado com sucesso!', produto: novoProduto });
    } catch (e) { res.status(500).json({ erro: 'Erro ao criar produto.' }); }
});

router.put('/produtos/:id', auth, adminAuth, async (req, res) => {
    try {
        const produto = await MarketProduct.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ mensagem: 'Atualizado com sucesso.', produto });
    } catch (e) { res.status(500).json({ erro: 'Erro' }); }
});

// 🚀 PROTEÇÃO RESOLVIDA: O Admin FORÇA a liquidação de atrasados antes de apagar
router.delete('/produtos/:id', auth, adminAuth, async (req, res) => {
    try {
        const agora = new Date();
        // 1. Tenta forçar o pagamento de todos os contratos que já passaram do tempo mas estavam presos
        const expirados = await MarketContract.find({ produtoId: req.params.id, status: 'ativo', dataFim: { $lte: agora } });
        
        for(let c of expirados) {
            const processado = await MarketContract.findOneAndUpdate({ _id: c._id, status: 'ativo' }, { $set: { status: 'finalizado' } });
            if(processado) {
                await User.findByIdAndUpdate(c.usuarioId, { $inc: { saldo: processado.valorRetorno, saldoPrincipal: processado.valorRetorno } });
                await Transaction.create({ usuarioId: c.usuarioId, nomeUsuario: processado.nomeUsuario, tipo: 'retorno_mercado', valor: processado.valorRetorno, status: 'concluido' });
            }
        }

        // 2. Agora sim, verifica se sobrou alguém com o tempo ainda a rodar (realmente ativo)
        const contratosAtivos = await MarketContract.countDocuments({ produtoId: req.params.id, status: 'ativo' });
        if (contratosAtivos > 0) {
            return res.status(400).json({ erro: 'Não pode apagar. Ainda existem clientes com o relógio a correr. Aguarde terminar.' });
        }
        
        // 3. Se estiver limpo, apaga definitivamente!
        await MarketProduct.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Produto destruído e removido.' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao remover produto.' }); }
});

router.get('/contratos', auth, adminAuth, async (req, res) => {
    try {
        const contratos = await MarketContract.find().sort({ dataFim: -1 });
        res.json(contratos);
    } catch (e) { res.status(500).json({ erro: 'Erro ao buscar contratos.' }); }
});

module.exports = router;