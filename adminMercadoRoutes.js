const express = require('express');
const router = express.Router();
const MarketProduct = require('./MarketProduct');
const MarketContract = require('./MarketContract');
const MarketConfig = require('./MarketConfig');
const auth = require('./authMiddleware');

// Middleware para garantir que só a Diretoria entra aqui
const adminAuth = async (req, res, next) => {
    if (!req.usuario || !req.usuario.isAdmin) {
        return res.status(403).json({ erro: 'Acesso restrito à Diretoria BlackRock.' });
    }
    next();
};

// ==========================================
// 1. GESTÃO GLOBAL DO MERCADO (ABRIR / FECHAR)
// ==========================================
router.get('/config', auth, adminAuth, async (req, res) => {
    try {
        let config = await MarketConfig.findOne();
        if (!config) {
            config = await MarketConfig.create({ isMercadoAberto: false });
        }
        res.json(config);
    } catch (e) { res.status(500).json({ erro: 'Erro ao buscar configurações do mercado.' }); }
});

router.post('/config', auth, adminAuth, async (req, res) => {
    try {
        const { isMercadoAberto, dataFechamento } = req.body;
        let config = await MarketConfig.findOne();
        
        if (!config) config = new MarketConfig();
        
        config.isMercadoAberto = isMercadoAberto;
        if (dataFechamento) config.dataFechamento = dataFechamento;
        
        await config.save();
        res.json({ mensagem: isMercadoAberto ? '🔥 MERCADO PREMIUM ABERTO!' : '🔒 MERCADO FECHADO.', config });
    } catch (e) { res.status(500).json({ erro: 'Erro ao alterar estado do mercado.' }); }
});

// ==========================================
// 2. GESTÃO DE PRODUTOS (CRIAR, EDITAR, LISTAR, APAGAR)
// ==========================================
router.get('/produtos', auth, adminAuth, async (req, res) => {
    try {
        const produtos = await MarketProduct.find().sort({ createdAt: -1 });
        res.json(produtos);
    } catch (e) { res.status(500).json({ erro: 'Erro ao buscar produtos.' }); }
});

router.post('/produtos', auth, adminAuth, async (req, res) => {
    try {
        const { nome, valorMinimo, valorMaximo, duracaoDias, retornoPercentual, limiteParticipantes, status } = req.body;
        
        const novoProduto = new MarketProduct({
            nome, valorMinimo, valorMaximo, duracaoDias, retornoPercentual, limiteParticipantes, status
        });
        
        await novoProduto.save();
        res.status(201).json({ mensagem: 'Produto Estratégico criado com sucesso!', produto: novoProduto });
    } catch (e) { res.status(500).json({ erro: 'Erro ao criar produto.' }); }
});

router.put('/produtos/:id', auth, adminAuth, async (req, res) => {
    try {
        const produto = await MarketProduct.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' });
        res.json({ mensagem: 'Produto atualizado com sucesso.', produto });
    } catch (e) { res.status(500).json({ erro: 'Erro ao atualizar produto.' }); }
});

router.delete('/produtos/:id', auth, adminAuth, async (req, res) => {
    try {
        // Verifica se já existem pessoas com este contrato antes de apagar
        const contratosAtivos = await MarketContract.countDocuments({ produtoId: req.params.id });
        if (contratosAtivos > 0) {
            return res.status(400).json({ erro: 'Não pode apagar este produto porque já existem investidores com ele ativo. Mude o status para "Oculto" ou "Encerrado".' });
        }

        await MarketProduct.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Produto removido do sistema.' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao remover produto.' }); }
});

// ==========================================
// 3. AUDITORIA: VER QUEM ESTÁ A INVESTIR NO MERCADO
// ==========================================
router.get('/contratos', auth, adminAuth, async (req, res) => {
    try {
        const contratos = await MarketContract.find().sort({ createdAt: -1 });
        res.json(contratos);
    } catch (e) { res.status(500).json({ erro: 'Erro ao buscar contratos.' }); }
});

module.exports = router;