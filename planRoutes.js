const express = require('express');
const Plan = require('./Plan');
const User = require('./User');
const Feed = require('./Feed');
const Transaction = require('./Transaction');
const System = require('./System');
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
        const planoAlvo = await Plan.findById(planoId);

        if (!planoAlvo) return res.status(404).json({ erro: 'Plano não encontrado.' });
        
        const precoDoPlano = Number(Number(planoAlvo.valor || planoAlvo.valorEntrada || 0).toFixed(2));
        const diasDeDuracao = Number(planoAlvo.duracao || planoAlvo.validade || planoAlvo.duracaoDias || 0);

        const usuario = await User.findById(req.usuario.id);
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        const agora = new Date();
        const expirou = usuario.dataExpiracaoPlano ? new Date(usuario.dataExpiracaoPlano) < agora : true;
        
        let diasRestantes = 0;
        if (!expirou && usuario.dataExpiracaoPlano) {
            diasRestantes = (new Date(usuario.dataExpiracaoPlano).getTime() - agora.getTime()) / (1000 * 60 * 60 * 24);
        }

        let custoFinal = precoDoPlano;

        // 🛡️ MOTOR INTELIGENTE DE HIERARQUIA E RENOVAÇÃO
        const todosPlanos = await Plan.find().sort({ valor: 1 }); // Ordena do mais barato para o mais caro

        if (usuario.planoAtivo && usuario.planoAtivo !== 'Nenhum' && !expirou) {
            const indexAtual = todosPlanos.findIndex(p => p.nome === usuario.planoAtivo);
            const planoAtual = indexAtual >= 0 ? todosPlanos[indexAtual] : null;
            const valorPlanoAtual = planoAtual ? Number(Number(planoAtual.valor || planoAtual.valorEntrada || 0).toFixed(2)) : 0;

            // Descobre o valor do plano imediatamente inferior (Para a matemática de renovação)
            let valorPlanoAnterior = 0;
            if (indexAtual > 0) {
                const planoAnterior = todosPlanos[indexAtual - 1];
                valorPlanoAnterior = Number(Number(planoAnterior.valor || planoAnterior.valorEntrada || 0).toFixed(2));
            }

            if (precoDoPlano > valorPlanoAtual) {
                // É UM UPGRADE (Sempre permitido, paga a diferença do atual)
                custoFinal = Number((precoDoPlano - valorPlanoAtual).toFixed(2));
            } 
            else if (precoDoPlano === valorPlanoAtual) {
                // É UMA RENOVAÇÃO DO MESMO PLANO
                if (diasRestantes <= 5) {
                    // Paga a diferença entre o atual e o anterior (Regra da Diretoria)
                    custoFinal = Number((valorPlanoAtual - valorPlanoAnterior).toFixed(2));
                } else {
                    return res.status(400).json({ erro: 'O seu contrato ainda possui mais de 5 dias. Aguarde a janela de renovação para estender o plano.' });
                }
            } 
            else {
                return res.status(400).json({ erro: 'Ação rejeitada: Não é permitido fazer downgrade para um plano inferior.' });
            }
        }

        const dataExpiracao = new Date();
        dataExpiracao.setDate(dataExpiracao.getDate() + diasDeDuracao);

        // 1. DESCONTO ATÓMICO COM OPTIMISTIC LOCKING
        const usuarioAtualizado = await User.findOneAndUpdate(
            { 
                _id: usuario._id, 
                saldo: { $gte: custoFinal },
                planoAtivo: usuario.planoAtivo // Bloqueio contra Race Condition
            },
            { 
                $inc: { saldo: -custoFinal },
                $set: { 
                    planoAtivo: planoAlvo.nome,
                    dataExpiracaoPlano: dataExpiracao,
                    tarefasFeitasHoje: 0
                }
            },
            { new: true }
        );

        if (!usuarioAtualizado) {
            return res.status(400).json({ erro: 'Saldo insuficiente para a transação ou bloqueio de segurança ativado.' });
        }

        // 2. BÓNUS DE 1º DEPÓSITO/ATIVAÇÃO (PAGO APENAS 1 VEZ)
        if (!usuarioAtualizado.primeiroPlanoComprado && usuarioAtualizado.convidadoPor) { 
            const patrocinador = await User.findOne({ meuCodigoConvite: usuarioAtualizado.convidadoPor });
            
            if (patrocinador) {
                const expPatrocinador = patrocinador.dataExpiracaoPlano ? new Date(patrocinador.dataExpiracaoPlano) : new Date(0);
                
                if (expPatrocinador > agora && patrocinador.planoAtivo !== 'Nenhum') {
                    
                    const config = await System.findOne() || {};
                    let percentualBonus = (config.bonusPrimeiroDep || config.bonusRede || 10) / 100; 
                    
                    const valorBonus = Number((precoDoPlano * percentualBonus).toFixed(2));

                    if(valorBonus > 0) {
                        await User.findByIdAndUpdate(patrocinador._id, {
                            $inc: { saldo: valorBonus, saldoBonus: valorBonus }
                        });

                        await new Transaction({
                            usuarioId: patrocinador._id,
                            tipo: 'bonus_rede',
                            valor: valorBonus,
                            status: 'concluido',
                            data: new Date()
                        }).save();
                    }
                } else {
                    usuarioAtualizado.convidadoPor = null; 
                }
            }
            usuarioAtualizado.primeiroPlanoComprado = true; 
            await usuarioAtualizado.save();
        }

        // 3. POST NO FEED
        try {
            await new Feed({
                titulo: 'Novo Investimento!',
                mensagem: `O investidor ID ${usuarioAtualizado.idUnico || 'Anônimo'} ativou um novo ciclo no node ${planoAlvo.nome}. 🚀`,
                tipo: 'automatico',
                autor: 'Sistema BlackRock'
            }).save();
        } catch (e) {}

        res.json({ mensagem: `Sucesso! Node ${planoAlvo.nome} ativo por mais ${diasDeDuracao} dias.`, user: usuarioAtualizado });

    } catch (erro) { 
        console.error("Erro plano:", erro);
        res.status(500).json({ erro: 'Erro interno na transação do plano.' }); 
    }
});

module.exports = router;