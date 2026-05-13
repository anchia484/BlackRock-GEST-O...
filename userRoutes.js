const express = require('express');
const router = express.Router();
const User = require('./User');
const Plan = require('./Plan'); 
const Transaction = require('./Transaction'); 
const Notification = require('./Notification');
const Requirement = require('./Requirement');
const auth = require('./authMiddleware');

// =====================================================================
// ROTA DO DASHBOARD: CARREGA PERFIL, NOTIFICAÇÕES, PLANO E ESTATÍSTICAS
// =====================================================================
router.get('/dashboard', auth, async (req, res) => {
    try {
        const userId = req.usuario.id || req.usuario._id;

        // 1. Busca os dados do utilizador (Isolamento por ID do Token)
        const usuario = await User.findById(userId).select('-senha');
        if (!usuario) return res.status(404).json({ erro: 'Conta não localizada.' });

        // 2. Contagem de Notificações Individuais
        const totalNotificacoes = await Notification.countDocuments({ usuarioId: userId, lida: false });

        // 3. Detalhes do Plano para a Barra de Progresso
        let planoDetails = null;
        if (usuario.planoAtivo && usuario.planoAtivo !== 'Nenhum') {
            planoDetails = await Plan.findOne({ nome: usuario.planoAtivo });
        }

        // 4. MOTOR DE MATEMÁTICA TEMPORAL (Ganhos Isolados)
        const agora = new Date();
        const inicioHoje = new Date(agora).setHours(0, 0, 0, 0);
        const inicioSemana = new Date(agora);
        inicioSemana.setDate(agora.getDate() - agora.getDay());
        inicioSemana.setHours(0, 0, 0, 0);
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).setHours(0, 0, 0, 0);

        // Busca apenas transações aprovadas deste usuário específico
        const transacoesLucro = await Transaction.find({
            usuarioId: userId,
            tipo: { $in: ['ganho_tarefa', 'bonus_rede'] },
            status: { $in: ['aprovado', 'concluido'] }
        });

        let ganhosHoje = 0, ganhosSemana = 0, ganhosMes = 0, ganhosTotal = 0;

        transacoesLucro.forEach(t => {
            const dataT = new Date(t.createdAt).getTime();
            const valor = Number(t.valor) || 0;
            ganhosTotal += valor;
            if (dataT >= inicioMes) ganhosMes += valor;
            if (dataT >= inicioSemana) ganhosSemana += valor;
            if (dataT >= inicioHoje) ganhosHoje += valor;
        });

        // 5. MOTOR DE EQUIPA (Contagem Isolada de Convidados)
        const tamanhoEquipa = await User.countDocuments({ convidadoPor: usuario.meuCodigoConvite });

        // 6. RESPOSTA CONSOLIDADA (A Muralha de Isolamento)
        res.json({ 
            user: usuario, 
            unreadNotifications: totalNotificacoes,
            planoDetails: planoDetails,
            ganhos: {
                hoje: ganhosHoje,
                semana: ganhosSemana,
                mes: ganhosMes,
                total: ganhosTotal
            },
            equipa: {
                totalMembros: tamanhoEquipa
            }
        });

    } catch (erro) { 
        console.error("Erro no motor do Dashboard:", erro);
        res.status(500).json({ erro: 'Falha na sincronização do Terminal.' }); 
    }
});

// =====================================================================
// CHECKLIST DE REQUISITOS (DINÂMICO PELO ADMIN)
// =====================================================================
router.get('/requisitos-bonus', auth, async (req, res) => {
    try {
        const u = await User.findById(req.usuario.id);
        const regrasAdmin = await Requirement.find();
        let requisitosFormados = [];

        if (regrasAdmin.length === 0) {
            const temPlano = (u.planoAtivo && u.planoAtivo !== 'Nenhum');
            requisitosFormados.push({
                status: temPlano ? 'concluido' : 'falha', 
                titulo: 'Plano Ativo', 
                descricao: 'Necessário um NODE ativo para lucros de rede.', 
                detalhe: temPlano ? `Ativo: ${u.planoAtivo}` : 'Inativo' 
            });
        } else {
            for (let regra of regrasAdmin) {
                let status = 'falha';
                let detalhe = 'Pendente';

                if (regra.tipoValidacao === 'plano_ativo') {
                    const temPlano = (u.planoAtivo && u.planoAtivo !== 'Nenhum');
                    status = temPlano ? 'concluido' : 'falha';
                    detalhe = temPlano ? `Ativo: ${u.planoAtivo}` : 'Ativação necessária';
                } 
                else if (regra.tipoValidacao === 'saldo_minimo') {
                    const valorNecessario = Number(regra.valorNecessario) || 0;
                    status = (u.saldo >= valorNecessario) ? 'concluido' : 'falha';
                    detalhe = `Saldo: ${u.saldo} / Alvo: ${valorNecessario}`;
                }
                requisitosFormados.push({ status, titulo: regra.titulo, descricao: regra.descricao, detalhe });
            }
        }

        const concluidos = requisitosFormados.filter(r => r.status === 'concluido').length;
        const progressoGeral = requisitosFormados.length > 0 ? Math.round((concluidos / requisitosFormados.length) * 100) : 100;

        res.json({ progressoGeral, requisitos: requisitosFormados });
    } catch (e) { 
        res.status(500).json({ erro: 'Erro ao processar as regras.' }); 
    }
});

module.exports = router;
