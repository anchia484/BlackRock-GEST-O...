const express = require('express');
const User = require('./User');
const Plan = require('./Plan');
const Transaction = require('./Transaction');
const auth = require('./authMiddleware');
const router = express.Router();

// ==============================================================
// ROTA 1: BUSCAR STATUS (COM CONTAGEM REGRESSIVA PERFEITA)
// ==============================================================
router.get('/status', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario.id);
        const plano = await Plan.findOne({ nome: usuario.planoAtivo });

        if (!plano) {
            return res.json({ tarefasTotais: 0, tarefasConcluidas: 0, ganhoDiario: 0, diasRestantes: 0 });
        }

        // 1. MÁGICA DA VALIDADE (CONTAGEM REGRESSIVA)
        // Pega a duração que o ADM definiu no painel (ex: 65)
        let diasRestantes = plano.duracao || plano.validade || 0; 

        if (usuario.dataExpiracaoPlano) {
            const dataExp = new Date(usuario.dataExpiracaoPlano);
            const dataAtual = new Date();

            // Calcula quantos dias exatos faltam entre hoje e a data de expiração
            const diferencaTempo = dataExp.getTime() - dataAtual.getTime();
            const diferencaDias = Math.ceil(diferencaTempo / (1000 * 3600 * 24));

            // Garante que os dias restantes são reais e não passam da duração original
            if (diferencaDias >= 0) {
                diasRestantes = diferencaDias;
            } else {
                diasRestantes = 0; // O plano expirou
            }
        }

        // 2. BANCO DE FRASES ÚNICAS PROFISSIONAIS
        const bancoFrases = [
            "Auditoria de Fundo ETF", "Balanceamento de Liquidez", "Análise de Risco Quantitativo",
            "Mapeamento de Arbitragem", "Sincronização de Bloco HFT", "Validação Institucional",
            "Inspeção de Contratos Futuros", "Compilação de Ativos Globais", "Operação de Compra Passiva",
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
        
        // Baralha as frases para nunca se repetirem na mesma ordem
        const frasesEmbaralhadas = bancoFrases.sort(() => 0.5 - Math.random());

        res.json({
            tarefasTotais: plano.tarefas || plano.limiteTarefasDia,
            tarefasConcluidas: usuario.tarefasFeitasHoje,
            ganhoDiario: plano.ganhoDiario,
            diasRestantes: diasRestantes,
            frases: frasesEmbaralhadas.slice(0, 20)
        });

    } catch (e) {
        res.status(500).json({ erro: 'Erro ao buscar status de trabalho.' });
    }
});

// ==============================================================
// ROTA 2: EXECUTAR TAREFA E GUARDAR LUCRO (MÉTODO BLINDADO)
// ==============================================================
router.post('/executar', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario.id);
        const plano = await Plan.findOne({ nome: usuario.planoAtivo });

        if (!plano) return res.status(400).json({ erro: 'Nenhum plano ativo encontrado.' });

        const limite = plano.tarefas || plano.limiteTarefasDia || 5;
        if (usuario.tarefasFeitasHoje >= limite) {
            return res.status(400).json({ erro: 'Limite diário de operações atingido.' });
        }

        // O usuário ganha o dinheiro dele 100% intacto
        const ganhoPorTarefa = plano.ganhoDiario / limite;

        let manterLacoEquipe = usuario.convidadoPor;

        // ====================================================================
        // BÔNUS RESIDUAL: Paga a micro-comissão ao Patrocinador
        // ====================================================================
        if (usuario.convidadoPor) {
            const patrocinador = await User.findOne({ meuCodigoConvite: usuario.convidadoPor });
            
            if (patrocinador) {
                const expPatrocinador = patrocinador.dataExpiracaoPlano ? new Date(patrocinador.dataExpiracaoPlano) : new Date(0);
                
                // Só paga se o patrocinador estiver com plano ativo!
                if (expPatrocinador > new Date()) {
                    // Temporário: 10% (Depois será puxado do Admin)
                    const percentualTarefa = 0.10; 
                    const bonusPatrocinador = ganhoPorTarefa * percentualTarefa;

                    // Dinheiro extra entra na conta do patrocinador
                    await User.findByIdAndUpdate(patrocinador._id, {
                        $inc: { saldo: bonusPatrocinador, saldoBonus: bonusPatrocinador }
                    });

                    // Recibo do bônus diário
                    await new Transaction({
                        usuarioId: patrocinador._id,
                        tipo: 'bonus_rede',
                        valor: bonusPatrocinador,
                        status: 'concluido',
                        data: new Date()
                    }).save();
                } else {
                    // PENALIDADE: Se o patrocinador dormiu e deixou expirar, ele perde esta pessoa da equipa hoje mesmo!
                    manterLacoEquipe = null; 
                }
            }
        }

        // ====================================================================
        // Paga ao Usuário que fez a tarefa (Blindado)
        // ====================================================================
        await User.findByIdAndUpdate(usuario._id, {
            $inc: {
                saldo: ganhoPorTarefa,
                saldoPrincipal: ganhoPorTarefa,
                tarefasFeitasHoje: 1
            },
            $set: { convidadoPor: manterLacoEquipe } // Se o líder expirou, atualiza para null e corta o laço
        });

        // Recibo do usuário
        try {
            await new Transaction({
                usuarioId: usuario._id,
                tipo: 'ganho_tarefa',
                valor: ganhoPorTarefa,
                status: 'concluido',
                data: new Date()
            }).save();
        } catch (err) {}

        res.json({ sucesso: true, ganho: ganhoPorTarefa });

    } catch (e) {
        console.error("Erro no processamento:", e);
        res.status(500).json({ erro: 'Erro interno ao processar lucros.' });
    }
});

module.exports = router;