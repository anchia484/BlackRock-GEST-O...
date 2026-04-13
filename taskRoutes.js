const express = require('express');
const User = require('./User');
const Plan = require('./Plan');
const Transaction = require('./Transaction');
const auth = require('./authMiddleware');
const router = express.Router();

router.post('/executar', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario.id);

        if (usuario.planoAtivo === 'Nenhum') return res.status(400).json({ erro: 'Você precisa comprar um plano para fazer tarefas.' });

        const plano = await Plan.findOne({ nome: usuario.planoAtivo });
        if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });

        const hoje = new Date().toDateString();
        const ultimaTarefa = usuario.dataUltimaTarefa ? usuario.dataUltimaTarefa.toDateString() : '';

        if (hoje !== ultimaTarefa) usuario.tarefasFeitasHoje = 0;

        if (usuario.tarefasFeitasHoje >= plano.limiteTarefasDia) {
            return res.status(400).json({ erro: 'Você já completou todas as tarefas de hoje. Volte amanhã!' });
        }

        const ganhoPorTarefa = plano.ganhoDiario / plano.limiteTarefasDia;

        // Atualiza o usuário que fez a tarefa
        usuario.saldo += ganhoPorTarefa;
        usuario.tarefasFeitasHoje += 1;
        usuario.dataUltimaTarefa = new Date();
        await usuario.save();

        // Salva transação da tarefa
        await new Transaction({ usuarioId: usuario._id, tipo: 'ganho_tarefa', valor: ganhoPorTarefa, status: 'aprovado' }).save();

        // ==========================================
        // NOVO: SISTEMA DE COMISSÃO DE REDE (EQUIPE)
        // ==========================================
        if (usuario.convidadoPor) {
            // Acha o patrocinador (Nível 1)
            const patrocinador = await User.findOne({ meuCodigoConvite: usuario.convidadoPor });
            if (patrocinador) {
                // Exemplo: Patrocinador ganha 5% do valor da tarefa do convidado
                const comissaoNivel1 = ganhoPorTarefa * 0.05; 
                patrocinador.saldo += comissaoNivel1;
                await patrocinador.save();
                await new Transaction({ usuarioId: patrocinador._id, tipo: 'bonus_rede', valor: comissaoNivel1, status: 'aprovado' }).save();

                // Procura o Nível 2 (Quem convidou o patrocinador)
                if (patrocinador.convidadoPor) {
                    const patrocinadorNivel2 = await User.findOne({ meuCodigoConvite: patrocinador.convidadoPor });
                    if (patrocinadorNivel2) {
                        // Exemplo: Nível 2 ganha 2% do valor
                        const comissaoNivel2 = ganhoPorTarefa * 0.02;
                        patrocinadorNivel2.saldo += comissaoNivel2;
                        await patrocinadorNivel2.save();
                        await new Transaction({ usuarioId: patrocinadorNivel2._id, tipo: 'bonus_rede', valor: comissaoNivel2, status: 'aprovado' }).save();
                    }
                }
            }
        }

        res.json({ 
            mensagem: 'Tarefa concluída com sucesso! Comissões de equipe distribuídas.',
            ganho: ganhoPorTarefa,
            novoSaldo: usuario.saldo,
            tarefasFeitas: usuario.tarefasFeitasHoje
        });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

module.exports = router;
