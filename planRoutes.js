const express = require('express');
const Plan = require('./Plan');
const User = require('./User');
const auth = require('./authMiddleware');
const router = express.Router();

// 1. Rota TEMPORÁRIA para gerar os 3 primeiros Planos NODE (Para podermos testar)
router.post('/gerar-nodes', async (req, res) => {
    try {
        const planos = [
            { nome: "NODE 1", estrato: "Standard", valorEntrada: 1000, ganhoDiario: 50, duracaoDias: 30, retornoTotal: 1500, limiteTarefasDia: 5 },
            { nome: "NODE 2", estrato: "Standard", valorEntrada: 2500, ganhoDiario: 130, duracaoDias: 30, retornoTotal: 3900, limiteTarefasDia: 5 },
            { nome: "NODE 3", estrato: "Standard", valorEntrada: 5000, ganhoDiario: 280, duracaoDias: 30, retornoTotal: 8400, limiteTarefasDia: 5 }
        ];
        await Plan.insertMany(planos);
        res.json({ mensagem: "Planos NODE 1, 2 e 3 gerados com sucesso no banco de dados!" });
    } catch (erro) {
        res.status(500).json({ erro: 'Os planos já existem ou houve um erro.' });
    }
});

// 2. Rota para listar todos os planos disponíveis (O Frontend vai usar essa)
router.get('/', async (req, res) => {
    try {
        const planos = await Plan.find().sort({ valorEntrada: 1 });
        res.json(planos);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao buscar planos.' });
    }
});

// 3. Rota para Comprar ou fazer Upgrade (Controle financeiro e de dias)
router.post('/comprar', auth, async (req, res) => {
    try {
        const { planoId } = req.body;
        
        const planoNovo = await Plan.findById(planoId);
        if (!planoNovo) return res.status(404).json({ erro: 'Plano não encontrado.' });

        const usuario = await User.findById(req.usuario.id);

        // Lógica de Upgrade: Descobrir quanto o usuário precisa pagar
        let valorAPagar = planoNovo.valorEntrada;
        
        if (usuario.planoAtivo !== 'Nenhum') {
            const planoAtual = await Plan.findOne({ nome: usuario.planoAtivo });
            if (planoAtual) {
                // Impede o usuário de comprar um plano mais barato que o dele
                if (planoNovo.valorEntrada <= planoAtual.valorEntrada) {
                    return res.status(400).json({ erro: 'Você só pode fazer upgrade para um plano mais caro.' });
                }
                // Paga apenas a diferença!
                valorAPagar = planoNovo.valorEntrada - planoAtual.valorEntrada; 
            }
        }

        // Verifica se tem saldo na carteira
        if (usuario.saldo < valorAPagar) {
            return res.status(400).json({ erro: `Saldo insuficiente. Você precisa de ${valorAPagar} MZN para ativar este plano.` });
        }

        // Desconta o saldo e ativa o plano
        usuario.saldo -= valorAPagar;
        usuario.planoAtivo = planoNovo.nome;
        
        // Controle de Dias: Define o dia exato que o plano vai expirar
        const dataExpiracao = new Date();
        dataExpiracao.setDate(dataExpiracao.getDate() + planoNovo.duracaoDias);
        usuario.dataExpiracaoPlano = dataExpiracao;

        await usuario.save();

        res.json({ 
            mensagem: `Parabéns! ${planoNovo.nome} ativado com sucesso!`, 
            novoSaldo: usuario.saldo,
            validoAte: usuario.dataExpiracaoPlano
        });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

module.exports = router;
