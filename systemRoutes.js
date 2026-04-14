const express = require('express');
const System = require('./System');
const User = require('./User');
const auth = require('./authMiddleware');
const router = express.Router();

// Middleware de Admin
const adminAuth = async (req, res, next) => {
    try {
        const usuario = await User.findById(req.usuario.id);
        if (!usuario || !usuario.isAdmin) return res.status(403).json({ erro: 'ACESSO NEGADO' });
        next();
    } catch (erro) { res.status(500).json({ erro: 'Erro de segurança.' }); }
};

// ==========================================
// 1. LER OS TERMOS (Público - Para a tela inicial)
// ==========================================
router.get('/termos', async (req, res) => {
    try {
        let termos = await System.findOne({ chave: 'termos_condicoes' });
        // Se ainda não existir no banco, retorna um texto padrão
        if (!termos) {
            termos = { conteudo: 'Bem-vindo à BlackRock Gestão de Ativos. Estes são os termos provisórios. A Diretoria irá atualizá-los em breve.' };
        }
        res.json({ termos: termos.conteudo });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao carregar os termos.' });
    }
});

// ==========================================
// 2. ATUALIZAR OS TERMOS (Apenas Admin)
// ==========================================
router.post('/atualizar-termos', auth, adminAuth, async (req, res) => {
    try {
        const { conteudo } = req.body;
        if (!conteudo) return res.status(400).json({ erro: 'O conteúdo não pode estar vazio.' });

        const termos = await System.findOneAndUpdate(
            { chave: 'termos_condicoes' },
            { conteudo: conteudo },
            { upsert: true, new: true } // Se não existir, ele cria
        );

        res.json({ mensagem: '✅ Termos e Condições atualizados com sucesso!', termos });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao atualizar termos.' });
    }
});

module.exports = router;
