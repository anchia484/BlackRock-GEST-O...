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
        const plano = await Plan.findById(planoId);

        if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });
        
        const precoDoPlano = plano.valor || plano.valorEntrada || 0;
        const diasDeDuracao = plano.duracao || plano.validade || plano.duracaoDias || 0;

        const dataExpiracao = new Date();
        dataExpiracao.setDate(dataExpiracao.getDate() + diasDeDuracao);

        // 1. DESCONTO ATÔMICO DO USUÁRIO
        const usuario = await User.findOneAndUpdate(
            { _id: req.usuario.id, saldo: { $gte: precoDoPlano } },
            { 
                $inc: { saldo: -precoDoPlano },
                $set: { 
                    planoAtivo: plano.nome,
                    dataExpiracaoPlano: dataExpiracao,
                    tarefasFeitasHoje: 0
                }
            },
            { new: true }
        );

        if (!usuario) {
            return res.status(400).json({ erro: 'Saldo insuficiente ou requisição simultânea.' });
        }

        // 2. BÓNUS DE 1º DEPÓSITO/ATIVAÇÃO (PAGO APENAS 1 VEZ AQUI)
        if (!usuario.primeiroPlanoComprado && usuario.convidadoPor) { 
            const patrocinador = await User.findOne({ meuCodigoConvite: usuario.convidadoPor });
            
            if (patrocinador) {
                const expPatrocinador = patrocinador.dataExpiracaoPlano ? new Date(patrocinador.dataExpiracaoPlano) : new Date(0);
                
                // Patrocinador Elegível?
                if (expPatrocinador > new Date() && patrocinador.planoAtivo !== 'Nenhum') {
                    
                    // Busca a taxa do ADMIN
                    const config = await System.findOne() || {};
                    let percentualBonus = (config.bonusPrimeiroDep || config.bonusRede || 10) / 100; 
                    
                    const valorBonus = precoDoPlano * percentualBonus;

                    if(valorBonus > 0) {
                        // Atualiza Saldo Global e Saldo de Bônus Atômicamente
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
                    usuario.convidadoPor = null; // Penalidade por estar inativo
                }
            }
            usuario.primeiroPlanoComprado = true; 
            await usuario.save();
        }

        // 3. POST NO FEED
        try {
            await new Feed({
                titulo: 'Novo Investidor!',
                mensagem: `O investidor ID ${usuario.idUnico || 'Anônimo'} acaba de ativar o node ${plano.nome}. 🚀`,
                tipo: 'automatico',
                autor: 'Sistema BlackRock'
            }).save();
        } catch (e) {}

        res.json({ mensagem: `Sucesso! Node ${plano.nome} ativo por ${diasDeDuracao} dias.`, user: usuario });

    } catch (erro) { 
        res.status(500).json({ erro: 'Erro interno na compra.' }); 
    }
});

module.exports = router;
