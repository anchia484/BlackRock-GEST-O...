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

        // =================================================================
        // 🚀 GATILHO DE LIQUIDAÇÃO DE COCKPIT (STATUS: 'concluido')
        // =================================================================
        const agora = new Date();
        const contratosConcluidos = await MarketContract.find({
            usuarioId: userId,
            status: 'ativo',
            dataFim: { $lte: agora }
        });

        if (contratosConcluidos.length > 0) {
            for (let contrato of contratosConcluidos) {
                const contratoSelado = await MarketContract.findOneAndUpdate(
                    { _id: contrato._id, status: 'ativo' }, 
                    { $set: { status: 'concluido' } },
                    { new: true }
                );

                if (contratoSelado) {
                    const lucroLiquido = Number((contratoSelado.valorRetorno - contratoSelado.valorAplicado).toFixed(2));

                    // 💰 Incrementa o Saldo Principal
                    await User.findByIdAndUpdate(userId, {
                        $inc: { saldo: contratoSelado.valorRetorno, saldoPrincipal: contratoSelado.valorRetorno }
                    });

                    // 🧾 Recibo Real para o Histórico (tipo 'deposito' lido pelo frontend)
                    await new Transaction({
                        usuarioId: usuario._id,
                        nomeUsuario: usuario.nome,
                        idUnicoUsuario: usuario.idUnico,
                        telefoneUsuario: usuario.telefone,
                        tipo: 'deposito', 
                        valor: contratoSelado.valorRetorno,
                        status: 'concluido',
                        operadora: 'Mercado Premium',
                        numeroContaDestino: contratoSelado.nomeProduto,
                        idTransacaoBancaria: 'MKT-RET-' + Date.now()
                    }).save();

                    // 🔔 Dispara o Alerta no Sino de Notificações
                    await Notification.create({
                        usuarioId: userId,
                        titulo: 'Contrato Finalizado 📈',
                        mensagem: `A operação ${contratoSelado.nomeProduto} encerrou com sucesso! O seu capital e o lucro de +${lucroLiquido} MZN foram creditados na sua conta.`,
                        tipo: 'financeiro',
                        lida: false
                    });

                    usuario.saldo += contratoSelado.valorRetorno; 
                }
            }
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

        // =================================================================
        // 🧮 TAREFAS E BÓNUS NORMAIS
        // =================================================================
        const transacoesLucro = await Transaction.find({
            usuarioId: userId,
            tipo: { $in: ['ganho_tarefa', 'bonus_rede', 'comissao', 'bonus_deposito'] },
            status: { $in: ['aprovado', 'concluido'] }
        });

        let ganhosHoje = 0, ganhosSemana = 0, ganhosMes = 0, ganhosTotal = 0, historicoBonusTotal = 0; 

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

        // =================================================================
        // 🚀 CÁLCULO EXCLUSIVO DO MERCADO PREMIUM (APENAS O LUCRO LÍQUIDO!)
        // =================================================================
        const contratosMercado = await MarketContract.find({
            usuarioId: userId,
            status: { $in: ['concluido', 'finalizado'] }
        });

        contratosMercado.forEach(c => {
            const dataT = new Date(c.updatedAt || c.createdAt).getTime();
            const lucroPuro = Number(c.valorRetorno) - Number(c.valorAplicado);
            
            if (lucroPuro > 0) {
                ganhosTotal += lucroPuro;
                if (dataT >= inicioMes) ganhosMes += lucroPuro;
                if (dataT >= inicioSemana) ganhosSemana += lucroPuro;
                if (dataT >= inicioHoje) ganhosHoje += lucroPuro;
            }
        });

        const tamanhoEquipa = await User.countDocuments({ convidadoPor: usuario.meuCodigoConvite });

        return res.json({ 
            user: usuario, 
            unreadNotifications: totalNotificacoes,
            planoDetails: planoDetails,
            ganhos: { hoje: ganhosHoje, semana: ganhosSemana, mes: ganhosMes, total: ganhosTotal, bonus: historicoBonusTotal },
            equipa: { totalMembros: tamanhoEquipa }
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