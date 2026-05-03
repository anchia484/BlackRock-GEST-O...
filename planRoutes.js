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
        
        // 1. BLINDAGEM DE CAMPOS (Aceita os nomes criados pelo Admin Novo ou Antigo)
        const precoDoPlano = plano.valor || plano.valorEntrada || 0;
        const diasDeDuracao = plano.duracao || plano.validade || plano.duracaoDias || 0;

        if (usuario.saldo < precoDoPlano) {
            return res.status(400).json({ erro: 'Saldo insuficiente.' });
        }

        // 2. DESCONTA O SALDO E ATIVA O PLANO
        usuario.saldo -= precoDoPlano;
        usuario.planoAtivo = plano.nome;
        
        // 3. A MÁGICA DA DATA DE VALIDADE
        // Pega a data de HOJE e soma os dias exatos (ex: 65) que o Admin configurou.
        const dataExpiracao = new Date();
        dataExpiracao.setDate(dataExpiracao.getDate() + diasDeDuracao);
        
        // Grava na base de dados. O painel de tarefas agora vai ler isto
        // e subtrair pela data do dia, resultando perfeitamente em 64, 63...
        usuario.dataExpiracaoPlano = dataExpiracao;
        
        // Opcional: Zera as tarefas feitas para o cliente começar a trabalhar no novo plano
        usuario.tarefasFeitasHoje = 0; 

        await usuario.save();

        // 4. POST AUTOMÁTICO NO FEED
        try {
            const postAuto = new Feed({
                titulo: 'Novo Investidor!',
                mensagem: `O investidor ID ${usuario.idUnico || 'Anônimo'} acaba de ativar o node ${plano.nome}. 🚀`,
                tipo: 'automatico',
                autor: 'Sistema BlackRock'
            });
            await postAuto.save();
        } catch (e) {
            console.log("Feed não atualizado, mas compra feita com sucesso.");
        }

        res.json({ mensagem: `Sucesso! Node ${plano.nome} ativo por ${diasDeDuracao} dias.`, user: usuario });
    } catch (erro) { 
        console.error("Erro no processamento da compra:", erro);
        res.status(500).json({ erro: 'Erro interno na compra.' }); 
    }
});

module.exports = router;