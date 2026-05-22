const express = require('express');
const router = express.Router();
const MarketProduct = require('./MarketProduct');
const MarketContract = require('./MarketContract');
const MarketConfig = require('./MarketConfig');
const User = require('./User'); 
const Transaction = require('./Transaction'); 
const Notification = require('./Notification'); 
const auth = require('./authMiddleware');

// ====================================================================
// 🚀 GATILHO DE LIQUIDAÇÃO (ALINHADO COM 'concluido' + 4 PASSOS)
// ====================================================================
async function liquidarContratosExpirados(usuarioId) {
    try {
        const agora = new Date();
        
        const expirados = await MarketContract.find({
            usuarioId: usuarioId,
            status: 'ativo',
            dataFim: { $lte: agora }
        });

        for (let contrato of expirados) {
            // 🛡️ CORREÇÃO CRÍTICA: Alinhado para 'concluido' conforme o Schema e userRoutes
            const contratoFechado = await MarketContract.findOneAndUpdate(
                { _id: contrato._id, status: 'ativo' },
                { $set: { status: 'concluido' } }, 
                { new: true }
            );

            if (contratoFechado) {
                const lucroLiquido = Number((contratoFechado.valorRetorno - contratoFechado.valorAplicado).toFixed(2));

                // 💰 1. Atualiza o Saldo Bruto na Conta do Utilizador
                await User.findByIdAndUpdate(usuarioId, {
                    $inc: { 
                        saldo: contratoFechado.valorRetorno, 
                        saldoPrincipal: contratoFechado.valorRetorno
                    }
                });

                // 🧾 2. Injeta o Recibo Real para alimentar a página historico.html
                await new Transaction({
                    usuarioId: usuarioId,
                    nomeUsuario: contratoFechado.nomeUsuario,
                    idUnicoUsuario: contratoFechado.idUnicoUsuario,
                    telefoneUsuario: contratoFechado.telefoneUsuario || '',
                    tipo: 'deposito',
                    valor: contratoFechado.valorRetorno,
                    status: 'concluido',
                    operadora: 'Mercado Premium',
                    numeroContaDestino: contratoFechado.nomeProduto,
                    idTransacaoBancaria: 'MKT-RET-' + Date.now()
                }).save();

                // 🔔 3. Dispara o Alerta no Sino de Notificações
                await Notification.create({
                    usuarioId: usuarioId,
                    titulo: 'Contrato Finalizado 📈',
                    mensagem: `A operação ${contratoFechado.nomeProduto} encerrou com sucesso! O seu capital e o lucro de +${lucroLiquido} MZN foram creditados na sua conta.`,
                    tipo: 'financeiro',
                    lida: false
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

router.get('/vitrine', auth, async (req, res) => {
    try {
        await liquidarContratosExpirados(req.usuario.id); 
        const config = await MarketConfig.findOne() || { isMercadoAberto: false, dataFechamento: null };
        const produtos = await MarketProduct.find({ status: 'ativo' }).sort({ valorMinimo: 1 });
        res.json({ isMercadoAberto: config.isMercadoAberto, dataFechamento: config.dataFechamento, produtos });
    } catch (e) { res.status(500).json({ erro: 'Erro ao carregar mercado.' }); }
});

router.get('/meus-contratos', auth, async (req, res) => {
    try {
        await liquidarContratosExpirados(req.usuario.id); 
        const contratos = await MarketContract.find({ usuarioId: req.usuario.id }).sort({ dataInicio: -1 });
        res.json(contratos);
    } catch (e) { res.status(500).json({ erro: 'Erro ao buscar contratos.' }); }
});

router.get('/feed-vivo', auth, async (req, res) => {
    try {
        const produtos = await MarketProduct.find({ status: 'ativo' }).select('nome');
        const nomes = produtos.map(p => p.nome);
        res.json({ nomesProdutos: nomes.length > 0 ? nomes : ['Sigma-7', 'Alpha-15', 'Reserva Prime'] });
    } catch (e) { res.status(500).json({ erro: 'Erro no feed vivo.' }); }
});

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
        if (produto.valorMaximo && valorNumerico > produto.valorMaximo) return res.status(400).json({ erro: `Maximum: ${produto.valorMaximo} MZN.` });

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
        
        if (produto.duracaoHoras && produto.duracaoHoras > 0) {
            dataFim.setTime(dataFim.getTime() + (produto.duracaoHoras * 60 * 60 * 1000));
        } else {
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