const express = require('express');
const User = require('./User');
const Transaction = require('./Transaction'); // Necessário para calcular as comissões
const auth = require('./authMiddleware');
const router = express.Router();

router.get('/equipe', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario.id);
        
        const nivel1 = await User.find({ convidadoPor: usuario.meuCodigoConvite }).select('idUnico nome planoAtivo isAgente meuCodigoConvite createdAt');
        
        let nivel2 = [];
        for (let direto of nivel1) {
            const indiretos = await User.find({ convidadoPor: direto.meuCodigoConvite }).select('idUnico nome planoAtivo isAgente createdAt');
            nivel2.push(...indiretos);
        }

        // CÁLCULO REAL DAS COMISSÕES (DESCONGELANDO O FRONTEND)
        const somatorioComissoes = await Transaction.aggregate([
            { $match: { usuarioId: usuario._id, tipo: 'bonus_rede', status: 'concluido' } },
            { $group: { _id: null, total: { $sum: "$valor" } } }
        ]);
        const comissaoTotalCalculada = somatorioComissoes.length > 0 ? somatorioComissoes[0].total : 0;

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

        res.json({
            codigoConvite: usuario.meuCodigoConvite,
            totalEquipe: nivel1.length + nivel2.length,
            diretos: nivel1.length,
            indiretos: nivel2.length,
            comissaoRecebida: comissaoTotalCalculada, // VARIÁVEL VITAL INSERIDA AQUI!
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
