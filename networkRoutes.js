const express = require('express');
const User = require('./User');
const auth = require('./authMiddleware');
const router = express.Router();

// ==========================================
// 1. ÁREA "EQUIPE" (Sincronizada com o Frontend)
// ==========================================
router.get('/equipe', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario.id);
        
        // Puxamos a data de criação (createdAt) para podermos ordenar
        const nivel1 = await User.find({ convidadoPor: usuario.meuCodigoConvite }).select('idUnico nome planoAtivo isAgente meuCodigoConvite createdAt');
        
        let nivel2 = [];
        for (let direto of nivel1) {
            const indiretos = await User.find({ convidadoPor: direto.meuCodigoConvite }).select('idUnico nome planoAtivo isAgente createdAt');
            nivel2.push(...indiretos);
        }

        // ====================================================================
        // 🚀 CORREÇÃO: UNIFICAÇÃO E FORMATAÇÃO (O Motor do Frontend)
        // O frontend espera uma lista única chamada 'membros' para gerar a UI
        // ====================================================================
        const membrosUnificados = [];
        
        nivel1.forEach(m => {
            membrosUnificados.push({
                idUnico: m.idUnico,
                nome: m.nome,
                planoAtivo: m.planoAtivo,
                isAgente: m.isAgente,
                nivel: 1, // Identificador de geração (Direto)
                status: m.planoAtivo !== 'Nenhum' ? 'ativo' : 'pendente',
                dataRegisto: m.createdAt
            });
        });

        nivel2.forEach(m => {
            membrosUnificados.push({
                idUnico: m.idUnico,
                nome: m.nome,
                planoAtivo: m.planoAtivo,
                isAgente: m.isAgente,
                nivel: 2, // Identificador de geração (Indireto)
                status: m.planoAtivo !== 'Nenhum' ? 'ativo' : 'pendente',
                dataRegisto: m.createdAt
            });
        });

        // Ordenar do mais recente para o mais antigo
        membrosUnificados.sort((a, b) => new Date(b.dataRegisto) - new Date(a.dataRegisto));

        res.json({
            codigoConvite: usuario.meuCodigoConvite,
            totalEquipe: nivel1.length + nivel2.length,
            diretos: nivel1.length,
            indiretos: nivel2.length,
            membros: membrosUnificados, // <-- A MATRIZ PERFEITA PARA O FRONTEND
            membrosNivel1: nivel1,      // Mantido por segurança/retrocompatibilidade
            membrosNivel2: nivel2       // Mantido por segurança/retrocompatibilidade
        });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao buscar equipe', detalhes: erro.message });
    }
});

// ==========================================
// 2. BOTÃO: TORNAR-SE AGENTE
// ==========================================
router.post('/tornar-agente', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario.id);

        if (usuario.isAgente) {
            return res.status(400).json({ erro: 'Você já é um Agente Oficial.' });
        }

        // Regra de segurança: Exige um plano ativo para virar agente
        if (usuario.planoAtivo === 'Nenhum') {
            return res.status(400).json({ erro: 'Área bloqueada. Você precisa ter um plano ativo (NODE) para se tornar Agente.' });
        }

        usuario.isAgente = true;
        await usuario.save();

        res.json({ mensagem: 'Parabéns! Você agora é um Agente Oficial e desbloqueou a Área de Rede e os Bônus de Depósito!' });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

// ==========================================
// 3. ÁREA "REDE" (Bloqueada: Só Agentes entram)
// ==========================================
router.get('/painel-rede', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario.id);

        if (!usuario.isAgente) {
            return res.status(403).json({ erro: 'ACESSO NEGADO: Esta área é exclusiva para Agentes.' });
        }

        res.json({
            mensagem: 'Bem-vindo ao Painel de Rede Exclusivo!',
            statusAgente: 'ATIVO',
            linkOficial: `https://blackrock.com/registro?ref=${usuario.meuCodigoConvite}`,
            beneficios: ['Comissão de Tarefas (Desbloqueado)', 'Bônus de 1º Depósito da Equipe (Desbloqueado)']
        });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
    }
});

module.exports = router;