const express = require('express');
const Plan = require('./Plan');
const User = require('./User');
const Feed = require('./Feed'); // Importando o banco do Feed
const auth = require('./authMiddleware');
const router = express.Router();

// Busca todos os planos
router.get('/', async (req, res) => {
    try {
        const planos = await Plan.find();
        res.json(planos);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

// Comprar plano
router.post('/comprar', auth, async (req, res) => {
    try {
        const { planoId } = req.body;
        const usuario = await User.findById(req.usuario.id);
        const plano = await Plan.findById(planoId);

        if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });
        if (usuario.saldo < plano.preco) return res.status(400).json({ erro: 'Saldo insuficiente para comprar este plano.' });

        usuario.saldo -= plano.preco;
        usuario.planoAtivo = plano.nome;
        
        const dataExpiracao = new Date();
        dataExpiracao.setDate(dataExpiracao.getDate() + plano.validadeDias);
        usuario.dataExpiracaoPlano = dataExpiracao;

        await usuario.save();

        // AQUI ESTÁ A MÁGICA: Post automático no Feed de compra de plano
        const postAuto = new Feed({
            titulo: 'Novo Investidor!',
            mensagem: `O investidor ID ${usuario.idUnico} acaba de ativar o plano ${plano.nome}. 🚀`,
            tipo: 'automatico',
            autor: 'Sistema BlackRock'
        });
        await postAuto.save();

        res.json({ 
            mensagem: `Parabéns! Você comprou o plano ${plano.nome}.`,
            novoSaldo: usuario.saldo,
            plano: usuario.planoAtivo
        });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

module.exports = router;
