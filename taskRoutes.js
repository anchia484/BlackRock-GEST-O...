const express = require('express');
const User = require('./User');
const Plan = require('./Plan');
const Transaction = require('./Transaction');
const auth = require('./authMiddleware');
const router = express.Router();

router.post('/executar', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario.id);

        if (usuario.planoAtivo === 'Nenhum') {
            return res.status(400).json({ erro: 'Você precisa comprar um plano para fazer tarefas.' });
        }

        // Busca o plano do usuário para saber as regras
        const plano = await Plan.findOne({ nome: usuario.planoAtivo });
        if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });

        // SISTEMA DE RESET DIÁRIO
        const hoje = new Date().toDateString(); // Ex: "Wed Apr 12 2026"
        const ultimaTarefa = usuario.dataUltimaTarefa ? usuario.dataUltimaTarefa.toDateString() : '';

        if (hoje !== ultimaTarefa) {
            // Se o dia mudou, zera as tarefas
            usuario.tarefasFeitasHoje = 0;
        }

        // Verifica se já atingiu o limite do plano (Ex: 5 por dia)
        if (usuario.tarefasFeitasHoje >= plano.limiteTarefasDia) {
            return res.status(400).json({ erro: 'Você já completou todas as tarefas de hoje. Volte amanhã!' });
        }

        // Calcula o ganho de 1 tarefa (Ex: 50MZN / 5 tarefas = 10MZN por tarefa)
        const ganhoPorTarefa = plano.ganhoDiario / plano.limiteTarefasDia;

        // Atualiza o usuário
        usuario.saldo += ganhoPorTarefa;
        usuario.tarefasFeitasHoje += 1;
        usuario.dataUltimaTarefa = new Date(); // Registra o momento exato

        await usuario.save();

        // Registra o ganho no histórico de transações
        const novaTransacao = new Transaction({
            usuarioId: usuario._id,
            tipo: 'ganho_tarefa',
            valor: ganhoPorTarefa,
            status: 'aprovado' // Ganhos de tarefa entram direto na conta (aprovados)
        });
        await novaTransacao.save();

        res.json({ 
            mensagem: 'Tarefa concluída com sucesso!',
            ganho: ganhoPorTarefa,
            novoSaldo: usuario.saldo,
            tarefasFeitas: usuario.tarefasFeitasHoje,
            totalTarefasDoPlano: plano.limiteTarefasDia
        });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

module.exports = router;
