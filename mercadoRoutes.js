const express = require('express');
const router = express.Router();
const MarketProduct = require('./MarketProduct');
const MarketContract = require('./MarketContract');
const MarketConfig = require('./MarketConfig');
const User = require('./User'); 
const Transaction = require('./Transaction'); 
const auth = require('./authMiddleware');

// ====================================================================
// 🚀 GATILHO DE LIQUIDAÇÃO (PAGA O CLIENTE QUANDO O TEMPO ACABA)
// ====================================================================
async function liquidarContratosExpirados(usuarioId) {
    try {
        const agora = new Date();
        
        // Encontra todos os contratos do cliente que já passaram da hora e estão pendentes de pagamento
        const expirados = await MarketContract.find({
            usuarioId: usuarioId,
            status: 'ativo',
            dataFim: { $lte: agora }
        });

        for (let contrato of expirados) {
            // TRANSAÇÃO ATÓMICA: Garante que o pagamento é feito apenas UMA vez
            const contratoFechado = await MarketContract.findOneAndUpdate(
                { _id: contrato._id, status: 'ativo' },
                { $set: { status: 'finalizado' } },
                { new: true }
            );

            if (contratoFechado) {
                // 💰 Injeta o Dinheiro (Capital + Lucro) no Saldo Disponível do Cliente
                await User.findByIdAndUpdate(usuarioId, {
                    $inc: { saldo: contratoFechado.valorRetorno, saldoPrincipal: contratoFechado.valorRetorno }
                });

                // 🧾 Gera o recibo no Histórico do cliente para transparência
                await Transaction.create({
                    usuarioId: usuarioId,
                    nomeUsuario: contratoFechado.nomeUsuario,
                    tipo: 'retorno_mercado',
                    valor: contratoFechado.valorRetorno,
                    status: 'concluido'
                });
            }
        }
    } catch (error) {
        console.error("Falha no gatilho de liquidação de mercado:", error);
    }
}

// ====================================================================
// ROTAS DOS CLIENTES (A VITRINE E OS CONTRATOS)
// ====================================================================

// 1. CARREGAR A VITRINE (E Pagar atrasados)
router.get('/vitrine', auth, async (req, res) => {
    try {
        await liquidarContratosExpirados(req.usuario.id); // Paga antes de mostrar a tela
        
        const config = await MarketConfig.findOne() || { isMercadoAberto: false, dataFechamento: null };
        const produtos = await MarketProduct.find({ status: 'ativo' }).sort({ valorMinimo: 1 });
        
        res.json({
            isMercadoAberto: config.isMercadoAberto,
            dataFechamento: config.dataFechamento,
            produtos: produtos
        });
    } catch (e) { res.status(500).json({ erro: 'Erro ao carregar mercado.' }); }
});

// 2. MEUS CONTRATOS
router.get('/meus-contratos', auth, async (req, res) => {
    try {
        await liquidarContratosExpirados(req.usuario.id); // Atualiza e paga antes de listar
        const contratos = await MarketContract.find({ usuarioId: req.usuario.id }).sort({ dataInicio: -1 });
        res.json(contratos);
    } catch (e) { res.status(500).json({ erro: 'Erro ao buscar contratos.' }); }
});

// 3. FEED AO VIVO (Nomes Falsos para o Social Proof)
router.get('/feed-vivo', auth, async (req, res) => {
    try {
        const produtos = await MarketProduct.find({ status: 'ativo' }).select('nome');
        const nomes = produtos.map(p => p.nome);
        res.json({ nomesProdutos: nomes.length > 0 ? nomes : ['Sigma-7', 'Alpha-15', 'Reserva Prime'] });
    } catch (e) { res.status(500).json({ erro: 'Erro no feed vivo.' }); }
});

// ====================================================================
// 🚀 ASSINATURA DE CONTRATO (COM SUPORTE A HORAS)
// ====================================================================
router.post('/investir', auth, async (req, res) => {
    try {
        const { produtoId, valorAplicado } = req.body;
        const valorNumerico = Number(Number(valorAplicado).toFixed(2));

        if (isNaN(valorNumerico) || valorNumerico <= 0) return res.status(400).json({ erro: 'Valor inválido.' });

        const config = await MarketConfig.findOne();
        if (!config || !config.isMercadoAberto) return res.status(403).json({ erro: 'O Mercado Premium encontra-se encerrado.' });

        const produto = await MarketProduct.findOne({ _id: produtoId, status: 'ativo' });
        if (!produto) return res.status(404).json({ erro: 'Contrato não disponível.' });

        if (valorNumerico < produto.valorMinimo) return res.status(400).json({ erro: `Mínimo: ${produto.valorMinimo} MZN.` });
        if (produto.valorMaximo && valorNumerico > produto.valorMaximo) return res.status(400).json({ erro: `Máximo: ${produto.valorMaximo} MZN.` });

        // Retira o saldo da carteira do cliente
        const usuario = await User.findOneAndUpdate(
            { _id: req.usuario.id, saldo: { $gte: valorNumerico } },
            { $inc: { saldo: -valorNumerico } },
            { new: true }
        );

        if (!usuario) return res.status(400).json({ erro: 'Saldo insuficiente.' });

        const lucro = Number((valorNumerico * (produto.retornoPercentual / 100)).toFixed(2));
        const valorRetorno = Number((valorNumerico + lucro).toFixed(2));

        const dataInicio = new Date();
        const dataFim = new Date();
        
        // ⏱️ O SEGREDO DO TEMPO: Verifica se foi criado em horas ou em dias!
        if (produto.duracaoHoras && produto.duracaoHoras > 0) {
            // Usa as horas (permite décimos, ex: 0.5 = 30 mins)
            dataFim.setTime(dataFim.getTime() + (produto.duracaoHoras * 60 * 60 * 1000));
        } else {
            // Mantém a lógica antiga de Dias se a duração em horas não existir
            dataFim.setDate(dataFim.getDate() + (produto.duracaoDias || 1));
        }

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
        res.json({ mensagem: `Contrato ${produto.nome} ativo. Capital de ${valorNumerico} MZN alocado.` });

    } catch (e) { res.status(500).json({ erro: 'Erro interno ao assinar.' }); }
});

module.exports = router;