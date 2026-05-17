const express = require('express');
const router = express.Router();
const User = require('./User');
const MarketProduct = require('./MarketProduct');
const MarketContract = require('./MarketContract');
const MarketConfig = require('./MarketConfig');
const Transaction = require('./Transaction');
const auth = require('./authMiddleware');

// ==========================================
// 1. CARREGAR A VITRINE DO MERCADO (PARA O CLIENTE)
// ==========================================
router.get('/vitrine', auth, async (req, res) => {
    try {
        let config = await MarketConfig.findOne();
        const agora = new Date();
        
        // 🚀 GUILHOTINA DO TEMPO: FECHAMENTO REAL AUTOMÁTICO
        if (config && config.isMercadoAberto && config.dataFechamento) {
            if (agora >= new Date(config.dataFechamento)) {
                // O tempo esgotou! Fecha o mercado e oculta os produtos instantaneamente
                config.isMercadoAberto = false;
                await config.save();
                await MarketProduct.updateMany({ status: 'ativo' }, { $set: { status: 'oculto' } });
            }
        }

        if (!config || !config.isMercadoAberto) {
            return res.json({ isMercadoAberto: false, produtos: [], dataFechamento: null });
        }

        // Busca apenas produtos ativos
        const produtos = await MarketProduct.find({ status: 'ativo' }).sort({ retornoPercentual: -1 });
        
        res.json({ 
            isMercadoAberto: true, 
            dataFechamento: config.dataFechamento, 
            produtos 
        });
    } catch (e) { res.status(500).json({ erro: 'Erro ao carregar o mercado.' }); }
});

// ==========================================
// 2. O MOTOR DE COMPRA (TRANSAÇÃO ATÓMICA E CONTRATO ÚNICO)
// ==========================================
router.post('/investir', auth, async (req, res) => {
    try {
        const { produtoId, valorAplicado } = req.body;
        const valor = Number(valorAplicado);
        const usuarioId = req.usuario.id;

        if (!valor || valor <= 0) return res.status(400).json({ erro: 'Valor inválido.' });

        let config = await MarketConfig.findOne();
        
        // 🚀 VERIFICAÇÃO DE FECHO NO MOMENTO DO CLIQUE
        if (config && config.isMercadoAberto && config.dataFechamento && new Date() >= new Date(config.dataFechamento)) {
            config.isMercadoAberto = false;
            await config.save();
            await MarketProduct.updateMany({ status: 'ativo' }, { $set: { status: 'oculto' } });
            return res.status(403).json({ erro: 'O tempo esgotou! O mercado acabou de fechar.' });
        }

        if (!config || !config.isMercadoAberto) {
            return res.status(403).json({ erro: 'O Mercado Estratégico está fechado no momento.' });
        }

        // 🚀 REGRA DE OURO: CONTRATO ÚNICO
        const contratoExistente = await MarketContract.findOne({ usuarioId: usuarioId, status: 'ativo' });
        if (contratoExistente) {
            return res.status(400).json({ erro: 'Você já possui um contrato estratégico ativo. É permitido apenas um por ciclo!' });
        }

        const produto = await MarketProduct.findById(produtoId);
        if (!produto || produto.status !== 'ativo') {
            return res.status(404).json({ erro: 'Produto indisponível.' });
        }

        if (valor < produto.valorMinimo) {
            return res.status(400).json({ erro: `A aplicação mínima para este contrato é de ${produto.valorMinimo} MZN.` });
        }
        if (produto.valorMaximo && valor > produto.valorMaximo) {
            return res.status(400).json({ erro: `A aplicação máxima permitida é de ${produto.valorMaximo} MZN.` });
        }
        if (produto.limiteParticipantes > 0 && produto.participantesAtuais >= produto.limiteParticipantes) {
            return res.status(400).json({ erro: 'As vagas para este contrato já esgotaram!' });
        }

        const usuario = await User.findById(usuarioId);
        if (usuario.saldo < valor) {
            return res.status(400).json({ erro: 'Saldo insuficiente para realizar esta operação.' });
        }

        const lucroCalculado = valor * (produto.retornoPercentual / 100);
        const valorRetornoTotal = valor + lucroCalculado;
        
        const dataInicio = new Date();
        const dataFim = new Date(dataInicio.getTime() + (produto.duracaoDias * 24 * 60 * 60 * 1000));

        // EXECUÇÃO FINANCEIRA
        usuario.saldo -= valor; 
        await usuario.save();

        produto.participantesAtuais += 1;
        await produto.save();

        const novoContrato = new MarketContract({
            usuarioId: usuario._id,
            nomeUsuario: usuario.nome,
            idUnicoUsuario: usuario.idUnico,
            produtoId: produto._id,
            nomeProduto: produto.nome,
            valorAplicado: valor,
            valorRetorno: valorRetornoTotal,
            dataInicio: dataInicio,
            dataFim: dataFim,
            status: 'ativo'
        });
        await novoContrato.save();

        await new Transaction({
            usuarioId: usuario._id,
            nomeUsuario: usuario.nome,
            idUnicoUsuario: usuario.idUnico,
            telefoneUsuario: usuario.telefone,
            tipo: 'investimento_mercado',
            valor: valor,
            status: 'aprovado',
            operadora: 'BlackRock Premium',
            idTransacaoBancaria: 'MKT-' + Date.now()
        }).save();

        res.json({ mensagem: 'Contrato Assinado com Sucesso! O seu capital está agora protegido e a gerar lucros.', contrato: novoContrato });

    } catch (e) { res.status(500).json({ erro: 'Falha crítica ao processar o investimento.' }); }
});

// ==========================================
// 3. CARREGAR OS CONTRATOS ATIVOS DO UTILIZADOR
// ==========================================
router.get('/meus-contratos', auth, async (req, res) => {
    try {
        const contratos = await MarketContract.find({ usuarioId: req.usuario.id }).sort({ createdAt: -1 });
        res.json(contratos);
    } catch (e) { res.status(500).json({ erro: 'Erro ao buscar os seus contratos.' }); }
});

// ==========================================
// 4. MOTOR DO FEED VIVO (INTELIGÊNCIA DE DADOS)
// ==========================================
router.get('/feed-vivo', auth, async (req, res) => {
    try {
        const config = await MarketConfig.findOne();
        if (!config || !config.isMercadoAberto) {
            return res.json({ mercadoAberto: false, feedReal: [], nomesProdutos: [] });
        }

        // Puxa os nomes reais dos produtos que a Diretoria criou para alimentar o simulador
        const produtosAtivos = await MarketProduct.find({ status: 'ativo' }).select('nome');
        const nomesProdutos = produtosAtivos.map(p => p.nome);

        // Puxa as últimas 5 compras REAIS para dar vida ao feed
        const ultimosContratos = await MarketContract.find({ status: 'ativo' })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('idUnicoUsuario nomeProduto valorAplicado createdAt');

        res.json({ 
            mercadoAberto: true, 
            feedReal: ultimosContratos, 
            nomesProdutos: nomesProdutos 
        });
    } catch (e) { res.status(500).json({ erro: 'Erro ao processar dados do Feed.' }); }
});

module.exports = router;
