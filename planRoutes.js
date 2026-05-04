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
        
        const precoDoPlano = plano.valor || plano.valorEntrada || 0;
        const diasDeDuracao = plano.duracao || plano.validade || plano.duracaoDias || 0;

        if (usuario.saldo < precoDoPlano) {
            return res.status(400).json({ erro: 'Saldo insuficiente.' });
        }

        // 1. DESCONTA O SALDO E ATIVA O PLANO
        usuario.saldo -= precoDoPlano;
        usuario.planoAtivo = plano.nome;
        
        const dataExpiracao = new Date();
        dataExpiracao.setDate(dataExpiracao.getDate() + diasDeDuracao);
        usuario.dataExpiracaoPlano = dataExpiracao;
        usuario.tarefasFeitasHoje = 0; 

        // ====================================================================
        // 2. MÁGICA DO BÔNUS DE 1º DEPÓSITO (SÓ PAGA 1 VEZ)
        // ====================================================================
        if (!usuario.primeiroPlanoComprado) { 
            // Se ele tem um patrocinador
            if (usuario.convidadoPor) {
                const patrocinador = await User.findOne({ meuCodigoConvite: usuario.convidadoPor });
                
                if (patrocinador) {
                    const expPatrocinador = patrocinador.dataExpiracaoPlano ? new Date(patrocinador.dataExpiracaoPlano) : new Date(0);
                    
                    // Verifica se o patrocinador tem o plano ATIVO
                    if (expPatrocinador > new Date()) {
                        // Temporário: 10% (Depois será puxado do Admin)
                        const percentualBonus = 0.10; 
                        const valorBonus = precoDoPlano * percentualBonus;

                        // Paga ao Patrocinador
                        await User.findByIdAndUpdate(patrocinador._id, {
                            $inc: { saldo: valorBonus, saldoBonus: valorBonus }
                        });

                        // Imprime o Recibo para o Patrocinador
                        await new Transaction({
                            usuarioId: patrocinador._id,
                            tipo: 'bonus_rede',
                            valor: valorBonus,
                            status: 'concluido',
                            data: new Date()
                        }).save();
                    } else {
                        // PENALIDADE: O plano do patrocinador expirou! Corta o laço.
                        usuario.convidadoPor = null; 
                    }
                }
            }
            // Marca que o usuário já comprou o 1º plano para nunca mais pagar este bônus
            usuario.primeiroPlanoComprado = true; 
        }

        // ... (código do bônus de rede que já lá estava) ...
        
        await usuario.save();

        // ====================================================================
        // 4. POST AUTOMÁTICO NO FEED (AGORA DENTRO DO LUGAR CERTO)
        // ====================================================================
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

        // A RESPOSTA FINAL DE SUCESSO FICA AQUI, ANTES DE FECHAR O 'TRY'
        res.json({ mensagem: `Sucesso! Node ${plano.nome} ativo por ${diasDeDuracao} dias.`, user: usuario });

    } catch (erro) { 
        // ESTE É O CATCH GERAL QUE FECHA A ROTA INTEIRA
        console.error("Erro no processamento da compra:", erro);
        res.status(500).json({ erro: 'Erro interno na compra.' }); 
    }
}); // FIM DA ROTA DE COMPRA

module.exports = router;