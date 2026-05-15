const express = require('express');
const User = require('./User');
const Transaction = require('./Transaction'); 
const auth = require('./authMiddleware');
const router = express.Router();

router.get('/equipe', auth, async (req, res) => {
    try {
        let usuario = await User.findById(req.usuario.id);
        
        // =================================================================
        // 1. A GUILHOTINA: REGRA DE EXPIRAÇÃO DE PLANO (PERDA DE EQUIPA)
        // Se o plano expirou, o líder perde TODOS os convidados para sempre.
        // =================================================================
        const agora = new Date();
        const expPlano = usuario.dataExpiracaoPlano ? new Date(usuario.dataExpiracaoPlano) : null;
        
        if (expPlano && expPlano < agora) {
            // Se ainda não estava marcado como "Nenhum", atualiza
            if (usuario.planoAtivo !== 'Nenhum') {
                usuario.planoAtivo = 'Nenhum';
                await usuario.save();
            }
            
            // CORTA A REDE: Todos os que foram convidados por ele perdem o vínculo
            await User.updateMany(
                { convidadoPor: usuario.meuCodigoConvite },
                { $set: { convidadoPor: null } }
            );
        }

        // =================================================================
        // 2. BUSCA DA EQUIPA (Diretos e Indiretos)
        // =================================================================
        const nivel1 = await User.find({ convidadoPor: usuario.meuCodigoConvite }).select('idUnico nome planoAtivo isAgente meuCodigoConvite createdAt');
        
        let nivel2 = [];
        for (let direto of nivel1) {
            const indiretos = await User.find({ convidadoPor: direto.meuCodigoConvite }).select('idUnico nome planoAtivo isAgente createdAt');
            nivel2.push(...indiretos);
        }

        // =================================================================
        // 3. CÁLCULO REAL DAS COMISSÕES GLOBAIS DA REDE
        // Soma as tarefas diárias e os bónus de primeiro depósito
        // =================================================================
        const somatorioComissoes = await Transaction.aggregate([
            { $match: { 
                usuarioId: usuario._id, 
                tipo: { $in: ['bonus_rede', 'comissao', 'bonus_deposito'] }, 
                status: { $in: ['aprovado', 'concluido'] } 
            }},
            { $group: { _id: null, total: { $sum: "$valor" } } }
        ]);
        const comissaoTotalCalculada = somatorioComissoes.length > 0 ? somatorioComissoes[0].total : 0;

        // =================================================================
        // 4. PREPARAÇÃO DA LISTA PARA O FRONTEND
        // =================================================================
        const membrosUnificados = [];
        
        nivel1.forEach(m => {
            membrosUnificados.push({
                idUnico: m.idUnico, nome: m.nome, planoAtivo: m.planoAtivo,
                isAgente: m.isAgente, nivel: 1, 
                status: m.planoAtivo !== 'Nenhum' ? 'ativo' : 'pendente',
                dataRegisto: m.createdAt
            });
        });

        nivel2.forEach(m => {
            membrosUnificados.push({
                idUnico: m.idUnico, nome: m.nome, planoAtivo: m.planoAtivo,
                isAgente: m.isAgente, nivel: 2, 
                status: m.planoAtivo !== 'Nenhum' ? 'ativo' : 'pendente',
                dataRegisto: m.createdAt
            });
        });

        membrosUnificados.sort((a, b) => new Date(b.dataRegisto) - new Date(a.dataRegisto));

        // AS CHAVES AQUI AGORA ESTÃO PERFEITAMENTE ALINHADAS COM O FRONTEND
        res.json({
            codigoConvite: usuario.meuCodigoConvite,
            totalConvidados: nivel1.length + nivel2.length, 
            diretos: nivel1.length,
            indiretos: nivel2.length,
            comissaoTotal: comissaoTotalCalculada, 
            membros: membrosUnificados
        });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao buscar equipe', detalhes: erro.message });
    }
});

router.post('/tornar-agente', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario.id);

        if (usuario.isAgente) return res.status(400).json({ erro: 'Você já é um Agente Oficial.' });
        if (usuario.planoAtivo === 'Nenhum') return res.status(400).json({ erro: 'Você precisa ter um plano ativo para se tornar Agente.' });

        usuario.isAgente = true;
        await usuario.save();
        res.json({ mensagem: 'Parabéns! Você agora é um Agente Oficial.' });

    } catch (erro) { res.status(500).json({ erro: 'Erro no servidor' }); }
});

module.exports = router;