const express = require('express');
const Plan = require('./Plan');
const User = require('./User');
const Feed = require('./Feed');
const auth = require('./authMiddleware');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const planos = await Plan.find();
        res.json(planos);
    } catch (erro) { res.status(500).json({ erro: 'Erro ao carregar planos.' }); }
});

router.post('/comprar', auth, async (req, res) => {
    try {
        const { planoId } = req.body;
        const usuario = await User.findById(req.usuario.id);
        const plano = await Plan.findById(planoId);

        if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });
        // CORREÇÃO: Usando 'valorEntrada' conforme o Modelo Plan.js
        if (usuario.saldo < plano.valorEntrada) return res.status(400).json({ erro: 'Saldo insuficiente.' });

        usuario.saldo -= plano.valorEntrada;
        usuario.planoAtivo = plano.nome;
        
        const dataExpiracao = new Date();
        // CORREÇÃO: Usando 'duracaoDias' conforme o Modelo Plan.js
        dataExpiracao.setDate(dataExpiracao.getDate() + plano.duracaoDias);
        usuario.dataExpiracaoPlano = dataExpiracao;

        await usuario.save();

        const postAuto = new Feed({
            titulo: 'Novo Investidor!',
            mensagem: `O investidor ID ${usuario.idUnico} acaba de ativar o plano ${plano.nome}. 🚀`,
            tipo: 'automatico',
            autor: 'Sistema BlackRock'
        });
        await postAuto.save();

        res.json({ mensagem: `Sucesso! Plano ${plano.nome} ativo.`, user: usuario });
    } catch (erro) { res.status(500).json({ erro: 'Erro interno na compra.' }); }
});

module.exports = router;
