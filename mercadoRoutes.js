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
        const config = await MarketConfig.findOne();
        
        // Se o mercado estiver fechado, nem adianta mostrar os produtos
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
// 2. O MOTOR DE COMPRA (TRANSAÇÃO ATÓMICA)
// ==========================================
router.post('/investir', auth, async (req, res) => {
    try {
        const { produtoId, valorAplicado } = req.body;
        const valor = Number(valorAplicado);
        const usuarioId = req.usuario.id;

        // 1. Validações Iniciais
        if (!valor || valor <= 0) return res.status(400).json({ erro: 'Valor inválido.' });

        const config = await MarketConfig.findOne();
        if (!config || !config.isMercadoAberto) {
            return res.status(403).json({ erro: 'O Mercado Estratégico está fechado no momento.' });
        }

        const produto = await MarketProduct.findById(produtoId);
        if (!produto || produto.status !== 'ativo') {
            return res.status(404).json({ erro: 'Produto indisponível.' });
        }

        // 2. Validações de Regras do Produto
        if (valor < produto.valorMinimo) {
            return res.status(400).json({ erro: `A aplicação mínima para este contrato é de ${produto.valorMinimo} MZN.` });
        }
        if (produto.valorMaximo && valor > produto.valorMaximo) {
            return res.status(400).json({ erro: `A aplicação máxima permitida é de ${produto.valorMaximo} MZN.` });
        }
        if (produto.limiteParticipantes > 0 && produto.participantesAtuais >= produto.limiteParticipantes) {
            return res.status(400).json({ erro: 'As vagas para este contrato já esgotaram!' });
        }

        // 3. Validação de Saldo do Utilizador
        const usuario = await User.findById(usuarioId);
        if (usuario.saldo < valor) {
            return res.status(400).json({ erro: 'Saldo insuficiente para realizar esta operação.' });
        }

        // 4. MATEMÁTICA: Calculando Lucro e Tempo
        const lucroCalculado = valor * (produto.retornoPercentual / 100);
        const valorRetornoTotal = valor + lucroCalculado;
        
        const dataInicio = new Date();
        const dataFim = new Date(dataInicio.getTime() + (produto.duracaoDias * 24 * 60 * 60 * 1000));

        // 5. EXECUÇÃO FINANCEIRA (Debitar, Registar e Criar Contrato)
        usuario.saldo -= valor; // Debita o saldo principal
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

        // Registo no histórico global
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

        res.json({ mensagem: 'Investimento realizado com sucesso! O seu capital está agora a gerar lucros.', contrato: novoContrato });

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

module.exports = router;