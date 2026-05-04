const express = require('express');
const User = require('./User');
const Plan = require('./Plan'); // Adicionado para a barra de progresso
const Transaction = require('./Transaction'); // Adicionado para somar os lucros
const Notification = require('./Notification');
const auth = require('./authMiddleware');
const router = express.Router();

// =====================================================================
// ROTA DO DASHBOARD: CARREGA PERFIL, NOTIFICAÇÕES, PLANO E GANHOS
// =====================================================================
router.get('/dashboard', auth, async (req, res) => {
    try {
        // 1. Busca os dados do utilizador
        const usuario = await User.findById(req.usuario.id).select('-senha');
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

        // 2. Mantém a sua contagem de notificações!
        const totalNotificacoes = await Notification.countDocuments({ usuarioId: req.usuario.id, lida: false });

        // 3. Busca os detalhes do Plano Ativo (Para a barra de progresso)
        let planoDetails = null;
        if (usuario.planoAtivo && usuario.planoAtivo !== 'Nenhum') {
            planoDetails = await Plan.findOne({ nome: usuario.planoAtivo });
        }

        // 4. MATEMÁTICA DO TEMPO (Filtros de datas)
        const agora = new Date();
        
        const inicioHoje = new Date(agora);
        inicioHoje.setHours(0, 0, 0, 0);

        const inicioSemana = new Date(agora);
        inicioSemana.setDate(agora.getDate() - agora.getDay());
        inicioSemana.setHours(0, 0, 0, 0);

        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
        inicioMes.setHours(0, 0, 0, 0);

        // 5. MOTOR DE CÁLCULO FINANCEIRO
        const transacoesLucro = await Transaction.find({
            usuarioId: usuario._id,
            tipo: { $in: ['ganho_tarefa', 'bonus_rede'] },
        });

        let ganhosHoje = 0;
        let ganhosSemana = 0;
        let ganhosMes = 0;
        let ganhosTotal = 0;

        transacoesLucro.forEach(t => {
            const dataT = new Date(t.data || t.createdAt);
            const valor = Number(t.valor) || 0;

            ganhosTotal += valor;

            if (dataT >= inicioMes) ganhosMes += valor;
            if (dataT >= inicioSemana) ganhosSemana += valor;
            if (dataT >= inicioHoje) ganhosHoje += valor;
        });

        // 6. ENVIA O PACOTE COMPLETO PARA O FRONTEND
        res.json({ 
            user: usuario, 
            unreadNotifications: totalNotificacoes,
            planoDetails: planoDetails,
            ganhos: {
                hoje: ganhosHoje,
                semana: ganhosSemana,
                mes: ganhosMes,
                total: ganhosTotal
            }
        });

    } catch (erro) { 
        console.error("Erro no motor do Dashboard:", erro);
        res.status(500).json({ erro: 'Erro no Dashboard' }); 
    }
});

// =====================================================================
// ROTAS ANTIGAS INTACTAS (NÃO MEXER)
// =====================================================================

// Checklist de Requisitos Automático do MongoDB
router.get('/requisitos-bonus', auth, async (req, res) => {
    try {
        const u = await User.findById(req.usuario.id);
        const convidados = await User.countDocuments({ convidadoPor: u.meuCodigoConvite, planoAtivo: { $ne: 'Nenhum' } });
        
        // Lógica de validação automática
        const requisitos = [
            { status: 'concluido', titulo: 'Segurança da Conta', descricao: 'Validado pelo sistema KYC.', detalhe: 'CONTA ATIVA' },
            { status: u.planoAtivo !== 'Nenhum' ? 'concluido' : 'falha', titulo: 'Plano Ativo', descricao: 'Possuir um NODE ativo.', detalhe: u.planoAtivo },
            { status: convidados >= 5 ? 'concluido' : 'progresso', titulo: 'Rede de Convites', descricao: 'Mínimo 5 convidados ativos.', detalhe: `${convidados} de 5 concluídos` }
        ];

        const concluidos = requisitos.filter(r => r.status === 'concluido').length;
        const progressoGeral = Math.round((concluidos / requisitos.length) * 100);

        res.json({ progressoGeral, isSobAnalise: false, requisitos });
    } catch (e) { res.status(500).json({ erro: 'Erro na validação.' }); }
});

// Atualizar Foto
router.patch('/atualizar-foto', auth, async (req, res) => {
    try {
        const { fotoBase64 } = req.body;
        if (!fotoBase64) return res.status(400).json({ erro: 'Nenhuma imagem enviada.' });

        const usuario = await User.findByIdAndUpdate(
            req.usuario.id, 
            { fotoPerfil: fotoBase64 }, 
            { new: true }
        );

        res.json({ mensagem: 'Foto de perfil atualizada!', foto: usuario.fotoPerfil });
    } catch (e) { res.status(500).json({ erro: 'Erro ao salvar foto.' }); }
});

module.exports = router;