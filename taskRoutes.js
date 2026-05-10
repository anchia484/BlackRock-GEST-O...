const express = require('express');
const User = require('./User');
const Plan = require('./Plan');
const Transaction = require('./Transaction');
const System = require('./System');           // Necessário para ler as taxas do Admin
const Notification = require('./Notification'); // Necessário para os alertas de ganhos
const auth = require('./authMiddleware');
const router = express.Router();

// ==============================================================
// MOTOR DE COMISSÕES (ATIVAÇÃO E TAREFAS N1 / N2)
// ==============================================================
async function distribuirComissoesDeRede(usuarioQueFezTarefa, ganhoNaTarefa) {
    try {
        // 1. Busca as percentagens reais configuradas pelo Admin no Painel
        const config = await System.findOne() || {};
        const taxaPrimDep = config.bonusPrimeiroDep || 10; // Ex: 10%
        const taxaN1 = config.percN1 || 5;                 // Ex: 5%
        const taxaN2 = config.percN2 || 2;                 // Ex: 2%

        // 2. NÍVEL 1 (Quem convidou diretamente?)
        if (!usuarioQueFezTarefa.convidadoPor) return;
        
        const patN1 = await User.findOne({ meuCodigoConvite: usuarioQueFezTarefa.convidadoPor });
        if (!patN1) return;

        const agora = new Date();
        const expN1 = patN1.dataExpiracaoPlano ? new Date(patN1.dataExpiracaoPlano) : new Date(0);

        // A REGRA DA RESPIRAÇÃO: O líder tem plano ativo E não expirou?
        const n1Elegivel = (patN1.planoAtivo !== 'Nenhum') && (expN1 > agora);

        if (n1Elegivel) {
            
            // A) BÓNUS DE 1º DEPÓSITO / ATIVAÇÃO 
            // Verifica se é a primeiríssima vez que este usuário faz uma tarefa
            const totalTarefas = await Transaction.countDocuments({ usuarioId: usuarioQueFezTarefa._id, tipo: 'ganho_tarefa' });
            
            // NOTA: Como a transação atómica ocorreu logo antes desta função, o histórico de tarefas será 1 na 1ª execução.
            if (totalTarefas === 1) { // Gatilho: É a 1ª tarefa de sempre!
                const planoDoUsuario = await Plan.findOne({ nome: usuarioQueFezTarefa.planoAtivo });
                const valorGastoNoPlano = planoDoUsuario ? (planoDoUsuario.valor || planoDoUsuario.valorEntrada || 0) : 0;
                
                if (valorGastoNoPlano > 0) {
                    const bonusAtivacao = (valorGastoNoPlano * taxaPrimDep) / 100;
                    patN1.saldo += bonusAtivacao;
                    
                    await Transaction.create({
                        usuarioId: patN1._id, nomeUsuario: patN1.nome,
                        tipo: 'bonus_rede', valor: bonusAtivacao, status: 'concluido'
                    });
                    
                    await Notification.create({
                        usuarioId: patN1._id, titulo: '🔥 Bónus de Ativação',
                        mensagem: `O seu convidado ${usuarioQueFezTarefa.nome} ativou um NODE! Ganhou ${bonusAtivacao.toFixed(2)} MZN.`,
                        tipo: 'financeiro', lida: false
                    });
                }
            }

            // B) BÓNUS DE TAREFA N1 (Sempre que faz tarefa diária)
            const bonusN1 = (ganhoNaTarefa * taxaN1) / 100;
            if (bonusN1 > 0) {
                patN1.saldo += bonusN1;
                await Transaction.create({
                    usuarioId: patN1._id, nomeUsuario: patN1.nome,
                    tipo: 'bonus_rede', valor: bonusN1, status: 'concluido'
                });
            }
            await patN1.save();

            // 3. NÍVEL 2 (Quem convidou o Patrocinador N1?)
            if (patN1.convidadoPor) {
                const patN2 = await User.findOne({ meuCodigoConvite: patN1.convidadoPor });
                
                if (patN2) {
                    const expN2 = patN2.dataExpiracaoPlano ? new Date(patN2.dataExpiracaoPlano) : new Date(0);
                    // Regra da respiração para o Nível 2
                    const n2Elegivel = (patN2.planoAtivo !== 'Nenhum') && (expN2 > agora);

                    if (n2Elegivel) {
                        const bonusN2 = (ganhoNaTarefa * taxaN2) / 100;
                        if (bonusN2 > 0) {
                            patN2.saldo += bonusN2;
                            await patN2.save();
                            
                            await Transaction.create({
                                usuarioId: patN2._id, nomeUsuario: patN2.nome,
                                tipo: 'bonus_rede', valor: bonusN2, status: 'concluido'
                            });
                        }
                    }
                }
            }
        }
    } catch (e) { console.error("Falha no Motor de Bónus:", e); }
}

// ==============================================================
// ROTA 1: BUSCAR STATUS (COM CONTAGEM REGRESSIVA E RESET 00H)
// ==============================================================
router.get('/status', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario.id);
        const plano = await Plan.findOne({ nome: usuario.planoAtivo });

        if (!plano) {
            return res.json({ tarefasTotais: 0, tarefasConcluidas: 0, ganhoDiario: 0, diasRestantes: 0 });
        }

        // 🚀 MÁGICA DO RESET PREGUIÇOSO DAS 00h00
        const dataAtual = new Date();
        const dataUltima = usuario.dataUltimaTarefa ? new Date(usuario.dataUltimaTarefa) : new Date(0);

        const isMesmoDia = dataAtual.getDate() === dataUltima.getDate() &&
                           dataAtual.getMonth() === dataUltima.getMonth() &&
                           dataAtual.getFullYear() === dataUltima.getFullYear();

        if (!isMesmoDia && usuario.tarefasFeitasHoje > 0) {
            usuario.tarefasFeitasHoje = 0;
            await User.findByIdAndUpdate(usuario._id, { tarefasFeitasHoje: 0 });
        }

        let diasRestantes = plano.duracao || plano.validade || 0; 
        if (usuario.dataExpiracaoPlano) {
            const dataExp = new Date(usuario.dataExpiracaoPlano);
            const diferencaTempo = dataExp.getTime() - dataAtual.getTime();
            const diferencaDias = Math.ceil(diferencaTempo / (1000 * 3600 * 24));
            diasRestantes = diferencaDias >= 0 ? diferencaDias : 0;
        }

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
        const frasesEmbaralhadas = bancoFrases.sort(() => 0.5 - Math.random());

        res.json({
            tarefasTotais: plano.tarefas || plano.limiteTarefasDia,
            tarefasConcluidas: usuario.tarefasFeitasHoje,
            ganhoDiario: plano.ganhoDiario,
            diasRestantes: diasRestantes,
            frases: frasesEmbaralhadas.slice(0, 20)
        });

    } catch (e) { res.status(500).json({ erro: 'Erro ao buscar status de trabalho.' }); }
});

// ==============================================================
// ROTA 2: EXECUTAR TAREFA E GUARDAR LUCRO (MÉTODO BLINDADO)
// ==============================================================
router.post('/executar', auth, async (req, res) => {
    try {
        let usuario = await User.findById(req.usuario.id);
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        const plano = await Plan.findOne({ nome: usuario.planoAtivo });
        if (!plano) return res.status(400).json({ erro: 'Nenhum plano ativo encontrado.' });

        // 🚀 LÓGICA DE RESET PREGUIÇOSO DAS 00H00 ANTES DA ATUALIZAÇÃO ATÔMICA
        const dataAtual = new Date();
        const dataUltima = usuario.dataUltimaTarefa ? new Date(usuario.dataUltimaTarefa) : new Date(0);
        const isMesmoDia = dataAtual.getDate() === dataUltima.getDate() &&
                           dataAtual.getMonth() === dataUltima.getMonth() &&
                           dataAtual.getFullYear() === dataUltima.getFullYear();

        if (!isMesmoDia && usuario.tarefasFeitasHoje > 0) {
            usuario = await User.findByIdAndUpdate(usuario._id, { tarefasFeitasHoje: 0 }, { new: true });
        }

        const limite = plano.tarefas || plano.limiteTarefasDia || 5;
        const ganhoPorTarefa = plano.ganhoDiario / limite;

        // ====================================================================
        // TRANSAÇÃO ATÓMICA DE TAREFAS: PREVINE DOUBLE SPEND (MÚLTIPLOS CLIQUES)
        // ====================================================================
        const usuarioAtualizado = await User.findOneAndUpdate(
            { _id: req.usuario.id, tarefasFeitasHoje: { $lt: limite } },
            {
                $inc: { saldo: ganhoPorTarefa, saldoPrincipal: ganhoPorTarefa, tarefasFeitasHoje: 1 },
                $set: { dataUltimaTarefa: new Date() } 
            },
            { new: true }
        );

        // Se falhar, é porque o limite já foi atingido ou houve clique duplo.
        if (!usuarioAtualizado) {
            return res.status(400).json({ erro: 'Limite diário de operações atingido ou submissão simultânea bloqueada.' });
        }

        // Recibo do usuário
        try {
            await new Transaction({
                usuarioId: usuarioAtualizado._id,
                tipo: 'ganho_tarefa',
                valor: ganhoPorTarefa,
                status: 'concluido',
                data: new Date()
            }).save();
        } catch (err) {}

        // 🚀 O NOVO MOTOR DE BÓNUS É CHAMADO AQUI (Agora de forma segura, após a transação atômica!)
        await distribuirComissoesDeRede(usuarioAtualizado, ganhoPorTarefa);

        res.json({ sucesso: true, ganho: ganhoPorTarefa });

    } catch (e) {
        console.error("Erro no processamento:", e);
        res.status(500).json({ erro: 'Erro interno ao processar lucros.' });
    }
});

module.exports = router;
