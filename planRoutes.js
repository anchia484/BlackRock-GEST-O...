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
        const plano = await Plan.findById(planoId);

        if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });
        
        const precoDoPlano = plano.valor || plano.valorEntrada || 0;
        const diasDeDuracao = plano.duracao || plano.validade || plano.duracaoDias || 0;

        const dataExpiracao = new Date();
        dataExpiracao.setDate(dataExpiracao.getDate() + diasDeDuracao);

        // ====================================================================
        // 1. DESCONTO E ATIVAÇÃO ATÔMICA (Bloqueia concorrência/Duplo gasto)
        // ====================================================================
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
            return res.status(400).json({ erro: 'Saldo insuficiente ou requisição simultânea bloqueada por segurança.' });
        }

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
                        
                        // MÁGICA: Vai buscar o bónus à Diretoria!
                        const System = require('./System');
                        const config = await System.findOne();
                        
                        let percentualBonus = 0.10; // Valor de segurança (10%)
                        if (config && config.bonusRede !== undefined) {
                            percentualBonus = config.bonusRede / 100;
                        }
                        const valorBonus = precoDoPlano * percentualBonus;

                        // Paga ao Patrocinador
                        await User.findByIdAndUpdate(patrocinador._id, {
                            $inc: { saldo: valorBonus, saldoBonus: valorBonus }
                        });

                        // Imprime o Recibo para o Patrocinador
                        const Transaction = require('./Transaction');
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

        // Salva as alterações da penalidade ou da marcação de primeiro plano
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
