const express = require('express');
const router = express.Router();
const User = require('./User');
const Plan = require('./Plan'); 
const Transaction = require('./Transaction'); 
const Notification = require('./Notification');
const Requirement = require('./Requirement');
const MarketContract = require('./MarketContract');
const MarketConfig = require('./MarketConfig');
const auth = require('./authMiddleware');

router.get('/dashboard', auth, async (req, res) => {
    try {
        const userId = req.usuario.id || req.usuario._id;
        const usuario = await User.findById(userId).select('-senha');
        
        if (!usuario) return res.status(404).json({ erro: 'Conta não localizada.' });

        // LAZY VALIDATION DO MERCADO (Liberta o lucro automaticamente)
        const agora = new Date();
        const contratosConcluidos = await MarketContract.find({
            usuarioId: userId,
            status: 'ativo',
            dataFim: { $lte: agora }
        });

        if (contratosConcluidos.length > 0) {
            for (let contrato of contratosConcluidos) {
                usuario.saldo += contrato.valorRetorno;
                contrato.status = 'concluido';
                await contrato.save();

                await new Transaction({
                    usuarioId: usuario._id,
                    nomeUsuario: usuario.nome,
                    idUnicoUsuario: usuario.idUnico,
                    telefoneUsuario: usuario.telefone,
                    tipo: 'retorno_mercado',
                    valor: contrato.valorRetorno,
                    status: 'concluido',
                    operadora: 'BlackRock Premium',
                    idTransacaoBancaria: 'MKT-RET-' + Date.now()
                }).save();
            }
            await usuario.save();
        }

        const totalNotificacoes = await Notification.countDocuments({ usuarioId: userId, lida: false });

        let planoDetails = null;
        if (usuario.planoAtivo && usuario.planoAtivo !== 'Nenhum') {
            planoDetails = await Plan.findOne({ nome: usuario.planoAtivo });
        }

        const inicioHoje = new Date(agora).setHours(0, 0, 0, 0);
        const inicioSemana = new Date(agora);
        inicioSemana.setDate(agora.getDate() - agora.getDay());
        inicioSemana.setHours(0, 0, 0, 0);
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).setHours(0, 0, 0, 0);

        const transacoesLucro = await Transaction.find({
            usuarioId: userId,
            tipo: { $in: ['ganho_tarefa', 'bonus_rede', 'comissao', 'bonus_deposito', 'retorno_mercado'] },
            status: { $in: ['aprovado', 'concluido'] }
        });

        let ganhosHoje = 0, ganhosSemana = 0, ganhosMes = 0, ganhosTotal = 0;
        let historicoBonusTotal = 0; 

        transacoesLucro.forEach(t => {
            const dataT = new Date(t.createdAt).getTime();
            const valor = Number(t.valor) || 0;
            
            ganhosTotal += valor;
            if (dataT >= inicioMes) ganhosMes += valor;
            if (dataT >= inicioSemana) ganhosSemana += valor;
            if (dataT >= inicioHoje) ganhosHoje += valor;

            if (t.tipo === 'bonus_rede' || t.tipo === 'comissao' || t.tipo === 'bonus_deposito') {
                historicoBonusTotal += valor;
            }
        });

        const tamanhoEquipa = await User.countDocuments({ convidadoPor: usuario.meuCodigoConvite });

        const configMercado = await MarketConfig.findOne();
        const mercadoAtivo = configMercado ? configMercado.isMercadoAberto : false;
        const dataFechoMercado = configMercado ? configMercado.dataFechamento : null;

        // 🚀 AQUI ESTÁ A CORREÇÃO QUE FALTAVA NO SEU CÓDIGO (PASSE LIVRE)
        const contratosEmAndamento = await MarketContract.countDocuments({ usuarioId: userId, status: 'ativo' });
        const temContratoMercadoAtivo = contratosEmAndamento > 0;

        // 🚀 O 'return' AQUI IMPEDE O SERVIDOR DE CRASHAR
        return res.json({ 
            user: usuario, 
            unreadNotifications: totalNotificacoes,
            planoDetails: planoDetails,
            isMercadoAberto: mercadoAtivo,
            dataFechamentoMercado: dataFechoMercado,
            temContratoMercadoAtivo: temContratoMercadoAtivo, // Avisa o Dashboard para não apagar o botão
            ganhos: {
                hoje: ganhosHoje,
                semana: ganhosSemana,
                mes: ganhosMes,
                total: ganhosTotal,
                bonus: historicoBonusTotal 
            },
            equipa: {
                totalMembros: tamanhoEquipa
            }
        });

    } catch (erro) { 
        console.error("Erro no motor do Dashboard:", erro);
        return res.status(500).json({ erro: 'Falha na sincronização do Terminal.' }); 
    }
});

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

        return res.json({ progressoGeral, requisitos: requisitosFormados });
    } catch (e) { 
        return res.status(500).json({ erro: 'Erro ao processar as regras.' }); 
    }
});

module.exports = router;