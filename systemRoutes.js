const express = require('express');
const System = require('./System');
const router = express.Router();

// 1. ROTA DE TERMOS (Usada pela tela inicial index.html na hora de criar conta)
router.get('/termos', async (req, res) => {
    try {
        const config = await System.findOne();
        let textoTermos = config && config.termosCondicoes ? config.termosCondicoes : 'Bem-vindo à BlackRock Gestão de Ativos. A Diretoria irá atualizar os termos em breve.';
        res.json({ termos: textoTermos });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao carregar os termos.' });
    }
});

// 2. ROTA PÚBLICA GERAL (Usada pelo deposito.html, perfil.html, etc)
router.get('/configs-publicas', async (req, res) => {
    try {
        const config = await System.findOne();
        res.json(config || {});
    } catch (e) { 
        res.status(500).json({ erro: 'Falha na sincronização.' }); 
    }
});

module.exports = router;
