const express = require('express');
const router = express.Router();
const MarketProduct = require('./MarketProduct');
const MarketContract = require('./MarketContract');
const MarketConfig = require('./MarketConfig');
const User = require('./User'); // Import necessário para deduzir saldo
const Transaction = require('./Transaction'); // Import necessário para o extrato
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
        
        if (isMercadoAberto === false && config.isMercadoAberto === true) {
            await MarketProduct.updateMany({ status: 'ativo' }, { $set: { status: 'oculto' } });
        }
        
        config.isMercadoAberto = isMercadoAberto;
        if (dataFechamento !== undefined) config.dataFechamento = dataFechamento; 
        
        await config.save();
        res.json({ mensagem: isMercadoAberto ? '🔥 MERCADO PREMIUM ABERTO!' : '🔒 MERCADO FECHADO.', config });
    } catch (e) { res.status(500).json({ erro: 'Erro ao alterar estado do mercado.' }); }
});

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
        const contratosAtivos = await MarketContract.countDocuments({ produtoId: req.params.id });
        if (contratosAtivos > 0) {
            return res.status(400).json({ erro: 'Não pode apagar este produto porque já existem investidores com ele ativo. Mude o status para "Oculto" ou "Encerrado".' });
        }
        await MarketProduct.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Produto removido do sistema.' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao remover produto.' }); }
});

router.get('/contratos', auth, adminAuth, async (req, res) => {
    try {
        const contratos = await MarketContract.find().sort({ dataFim: -1 });
        res.json(contratos);
    } catch (e) { res.status(500).json({ erro: 'Erro ao buscar contratos.' }); }
});

// ====================================================================
// 🚀 ROTA DE ASSINATURA DE CONTRATO (REPOSIÇÃO & BLINDAGEM ATÓMICA)
// ====================================================================
router.post('/investir', auth, async (req, res) => {
    try {
        const { produtoId, valorAplicado } = req.body;
        const valorNumerico = Number(Number(valorAplicado).toFixed(2));

        if (isNaN(valorNumerico) || valorNumerico <= 0) return res.status(400).json({ erro: 'Valor de investimento inválido.' });

        const config = await MarketConfig.findOne();
        if (!config || !config.isMercadoAberto) return res.status(403).json({ erro: 'O Mercado Premium encontra-se encerrado. Aguarde a próxima sessão.' });

        const produto = await MarketProduct.findOne({ _id: produtoId, status: 'ativo' });
        if (!produto) return res.status(404).json({ erro: 'Contrato não disponível no mercado atual.' });

        if (valorNumerico < produto.valorMinimo) return res.status(400).json({ erro: `Investimento mínimo exigido: ${produto.valorMinimo} MZN.` });
        if (produto.valorMaximo && valorNumerico > produto.valorMaximo) return res.status(400).json({ erro: `Teto máximo ultrapassado: ${produto.valorMaximo} MZN.` });

        // 🛡️ COMPRA ATÓMICA: Garante que não compra o contrato duas vezes com a mesma fração de saldo
        const usuario = await User.findOneAndUpdate(
            { _id: req.usuario.id, saldo: { $gte: valorNumerico } },
            { $inc: { saldo: -valorNumerico } },
            { new: true }
        );

        if (!usuario) {
            return res.status(400).json({ erro: 'Saldo insuficiente para a operação ou transação simultânea bloqueada.' });
        }

        const lucro = Number((valorNumerico * (produto.retornoPercentual / 100)).toFixed(2));
        const valorRetorno = Number((valorNumerico + lucro).toFixed(2));

        const dataInicio = new Date();
        const dataFim = new Date();
        dataFim.setDate(dataFim.getDate() + produto.duracaoDias);

        const contrato = new MarketContract({
            usuarioId: usuario._id,
            nomeUsuario: usuario.nome,
            idUnicoUsuario: usuario.idUnico,
            produtoId: produto._id,
            nomeProduto: produto.nome,
            valorAplicado: valorNumerico,
            valorRetorno: valorRetorno,
            dataInicio: dataInicio,
            dataFim: dataFim,
            status: 'ativo'
        });

        await contrato.save();

        res.json({ mensagem: `Sucesso! Contrato estratégico ${produto.nome} ativo. Capital de ${valorNumerico} MZN alocado.` });

    } catch (e) {
        console.error('Erro na assinatura do mercado:', e);
        res.status(500).json({ erro: 'Erro interno ao processar e assinar contrato.' });
    }
});

module.exports = router;