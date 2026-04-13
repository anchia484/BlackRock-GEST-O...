const express = require('express');
const User = require('./User');
const Plan = require('./Plan');
const Transaction = require('./Transaction');
const auth = require('./authMiddleware');
const router = express.Router();

// ==========================================
// BANCO DE 60 MENSAGENS PROFISSIONAIS (MERCADO FINANCEIRO)
// ==========================================
const mensagensSucesso = [
    "Liquidação de ativos em lote concluída com sucesso.",
    "Arbitragem de alta frequência executada com margem positiva.",
    "Rebalanceamento de portfólio sincronizado no servidor principal.",
    "Validação de bloco financeiro confirmada na rede.",
    "Ajuste de liquidez em pool de ativos finalizado.",
    "Auditoria de contrato inteligente concluída sem falhas.",
    "Processamento de dividendos fracionados executado.",
    "Sincronização de nós (nodes) globais estabelecida.",
    "Análise de volatilidade concluída. Operação fechada no verde.",
    "Hedge cambial processado e garantido contra oscilações.",
    "Cálculo de rendimento diário (Yield) validado.",
    "Ordem de compra em mercado de balcão (OTC) aprovada.",
    "Verificação de conformidade KYC/AML na blockchain concluída.",
    "Swap de tokens de alta liquidez executado com sucesso.",
    "Compilação de dados do mercado de futuros finalizada.",
    "Alocação dinâmica de capital processada.",
    "Desfragmentação de ordens no livro de ofertas concluída.",
    "Backtesting do algoritmo financeiro diário validado.",
    "Fechamento de spread em pares de moedas realizado.",
    "Execução de ordem Iceberg fragmentada com sucesso.",
    "Distribuição de lucros de mineração em nuvem confirmada.",
    "Assinatura digital de transação interbancária validada.",
    "Roteamento inteligente de ordens (SOR) finalizado.",
    "Resgate de liquidez em protocolo DeFi processado.",
    "Análise de sentimento do mercado compilada e salva.",
    "Cruzamento de dados de inflação global verificado.",
    "Ordem Stop-Loss / Take-Profit ajustada no servidor.",
    "Mineração de liquidez diária computada com sucesso.",
    "Otimização de rotas de transação de criptoativos concluída.",
    "Arbitragem triangular em exchanges globais finalizada.",
    "Consolidação de micro-transações diárias aprovada.",
    "Leitura de oráculos de preços (Price Oracles) atualizada.",
    "Injeção de capital em fundos de índice (ETFs) computada.",
    "Validação de Prova de Participação (PoS) bem-sucedida.",
    "Análise técnica de suporte e resistência concluída.",
    "Operação de scalping finalizada com lucro computado.",
    "Atualização do hash de segurança da carteira executada.",
    "Liquidação de derivativos financeiros processada.",
    "Compensação de opções de venda/compra finalizada.",
    "Varredura de segurança contra vulnerabilidades no nó concluída.",
    "Sincronização de API com a Bolsa de Valores estabelecida.",
    "Aprovação de margem de garantia para operações alavancadas.",
    "Validação cruzada de dados financeiros executada.",
    "Atualização do livro-razão (Ledger) distribuído aprovada.",
    "Desbloqueio de liquidez em protocolo de staking confirmado.",
    "Mapeamento de liquidez oculta (Dark Pools) finalizado.",
    "Criptografia ponta a ponta da transação validada.",
    "Ajuste de taxa de juros composta processado.",
    "Compilação do relatório de rendimento de ativos finalizada.",
    "Redução de latência na execução de ordens confirmada.",
    "Integração de dados de fundos imobiliários concluída.",
    "Testes de estresse (Stress Test) do servidor financeiro aprovados.",
    "Arbitragem estatística de pares executada com precisão.",
    "Fechamento de posições overnight computado no sistema.",
    "Conversão cambial algorítmica finalizada com sucesso.",
    "Distribuição de tokens de governança validada.",
    "Mapeamento de fluxo de caixa institucional computado.",
    "Atualização de contratos futuros de commodities aprovada.",
    "Análise de métricas On-Chain finalizada com sucesso.",
    "Ciclo de operação do NODE concluído. Ativos garantidos."
];

// ==========================================
// ROTA DE EXECUÇÃO DA TAREFA (SIMULAÇÃO HFT)
// ==========================================
router.post('/executar', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario.id);
        if (usuario.planoAtivo === 'Nenhum') return res.status(400).json({ erro: 'Você precisa comprar um plano NODE ativo.' });

        const plano = await Plan.findOne({ nome: usuario.planoAtivo });
        if (!plano) return res.status(404).json({ erro: 'Plano não encontrado no banco de dados.' });
        
        // Reset Diário de Tarefas
        const hoje = new Date().toDateString();
        const ultimaTarefa = usuario.dataUltimaTarefa ? usuario.dataUltimaTarefa.toDateString() : '';
        if (hoje !== ultimaTarefa) usuario.tarefasFeitasHoje = 0;

        // Verifica o Limite (Que pode ser editado pelo Admin futuramente)
        if (usuario.tarefasFeitasHoje >= plano.limiteTarefasDia) {
            return res.status(400).json({ erro: 'Operações diárias concluídas. O mercado fechou para você hoje. Volte amanhã!' });
        }

        const ganhoPorTarefa = plano.ganhoDiario / plano.limiteTarefasDia;

        // Sorteia a justificativa profissional
        const justificativa = mensagensSucesso[Math.floor(Math.random() * mensagensSucesso.length)];

        // Atualiza conta do usuário
        usuario.saldo += ganhoPorTarefa;
        usuario.tarefasFeitasHoje += 1;
        usuario.dataUltimaTarefa = new Date();
        await usuario.save();

        await new Transaction({ usuarioId: usuario._id, tipo: 'ganho_tarefa', valor: ganhoPorTarefa, status: 'aprovado' }).save();

        // COMISSÃO DE REDE (Nível 1 e Nível 2)
        if (usuario.convidadoPor) {
            const patrocinador = await User.findOne({ meuCodigoConvite: usuario.convidadoPor });
            if (patrocinador) {
                const comissaoNivel1 = ganhoPorTarefa * 0.05; 
                patrocinador.saldo += comissaoNivel1;
                await patrocinador.save();
                await new Transaction({ usuarioId: patrocinador._id, tipo: 'bonus_rede', valor: comissaoNivel1, status: 'aprovado' }).save();

                if (patrocinador.convidadoPor) {
                    const patrocinadorNivel2 = await User.findOne({ meuCodigoConvite: patrocinador.convidadoPor });
                    if (patrocinadorNivel2) {
                        const comissaoNivel2 = ganhoPorTarefa * 0.02;
                        patrocinadorNivel2.saldo += comissaoNivel2;
                        await patrocinadorNivel2.save();
                        await new Transaction({ usuarioId: patrocinadorNivel2._id, tipo: 'bonus_rede', valor: comissaoNivel2, status: 'aprovado' }).save();
                    }
                }
            }
        }

        res.json({ 
            mensagem: justificativa,
            ganho: ganhoPorTarefa,
            novoSaldo: usuario.saldo,
            tarefasFeitasHoje: usuario.tarefasFeitasHoje,
            totalTarefasPlano: plano.limiteTarefasDia
        });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

module.exports = router;
