const express = require('express');
const User = require('./User');
const auth = require('./authMiddleware');
const router = express.Router();

router.get('/equipe', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario.id);
        
        // Busca Nível 1 (Pessoas que usaram o código deste usuário)
        const nivel1 = await User.find({ convidadoPor: usuario.meuCodigoConvite }).select('idUnico nome planoAtivo isAgente meuCodigoConvite datacreatedAt');
        
        // Busca Nível 2 (Pessoas que usaram o código do Nível 1)
        let nivel2 = [];
        for (let direto of nivel1) {
            const indiretos = await User.find({ convidadoPor: direto.meuCodigoConvite }).select('idUnico nome planoAtivo isAgente');
            nivel2.push(...indiretos);
        }

        res.json({
            codigoConvite: usuario.meuCodigoConvite,
            totalEquipe: nivel1.length + nivel2.length,
            diretos: nivel1.length,
            indiretos: nivel2.length,
            membrosNivel1: nivel1,
            membrosNivel2: nivel2
        });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao buscar equipe', detalhes: erro.message });
    }
});

module.exports = router;
