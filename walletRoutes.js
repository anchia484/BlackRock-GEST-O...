const express = require('express');
const router = express.Router();
const auth = require('./authMiddleware'); 
const User = require('./User'); 
const Transaction = require('./Transaction');
const System = require('./System');
const Notification = require('./Notification');

// ===============================
// SEGURANÇA DE SENHA
// ===============================
async function verificarSenhaSegura(senhaDigitada, senhaGuardada) {
    if (!senhaDigitada || !senhaGuardada) return false;
    const digitada = senhaDigitada.trim();

    if (digitada === senhaGuardada) return true; 

    try {
        const bcrypt = require('bcryptjs');
        return await bcrypt.compare(digitada, senhaGuardada);
    } catch {
        try {
            const bcrypt = require('bcrypt');
            return await bcrypt.compare(digitada, senhaGuardada);
        } catch {
            return false;
        }
    }
}

// ===============================
// PEGAR ID (GARANTE ISOLAMENTO)
// ===============================
function getUserId(req) {
    if (typeof req.usuario === 'string') return req.usuario;
    return req.usuario.id || req.usuario._id || req.usuario.userId;
}

// ===============================
// DEPÓSITO (VERSÃO BLINDADA E CORRIGIDA)
// ===============================
router.post('/deposito', auth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const { canal, numeroOrigem, valor, idTransacaoBancaria, comprovanteBase64, senhaConfirmacao } = req.body;

        const valorNumerico = Number(Number(valor).toFixed(2));
        
        if (isNaN(valorNumerico) || valorNumerico <= 0) {
            return res.status(400).json({ erro: 'Valor de depósito inválido. O montante deve ser maior que zero.' });
        }

        const usuario = await User.findById(userId).select('+senha');
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        const senhaCorreta = await verificarSenhaSegura(senhaConfirmacao, usuario.senha);
        if (!senhaCorreta) return res.status(400).json({ erro: 'Senha incorreta.' });

        let operadoraFormatada = null;
        if (canal === 'M-PESA' || canal === 'M-Pesa') operadoraFormatada = 'M-Pesa';
        if (canal === 'E-MOLA' || canal === 'E-Mola') operadoraFormatada = 'E-Mola';

        const novaTransacao = new Transaction({
            usuarioId: usuario._id,
            nomeUsuario: usuario.nome,
            idUnicoUsuario: usuario.idUnico,
            telefoneUsuario: usuario.telefone,
            tipo: 'deposito',
            valor: valorNumerico, 
            status: 'pendente',
            operadora: operadoraFormatada,
            numeroOrigem: numeroOrigem, 
            idTransacaoBancaria,
            comprovanteBase64
        });

        await novaTransacao.save();

        try {
            const novaNotif = new Notification({
                usuarioId: usuario._id,
                titulo: 'Depósito em Análise ⏳',
                mensagem: `O seu pedido de depósito no valor de ${valorNumerico.toLocaleString('pt-MZ')} MZN foi recebido e está aguardando auditoria.`,
                tipo: 'financeiro',
                lida: false
            });
            await novaNotif.save();
        } catch(errNotif) { console.error("Erro ao gerar notif depósito:", errNotif); }

        res.json({ mensagem: 'Depósito enviado para análise com sucesso!' });

    } catch (erro) {
        console.error("Erro depósito:", erro);
        res.status(500).json({ erro: 'Erro interno.' });
    }
});

// ===============================
// SAQUE (TAXA DINÂMICA E SEGURANÇA ATÓMICA)
// ===============================
router.post('/saque', auth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const { numeroContaDestino, nomeContaDestino, valor, senhaConfirmacao, operadora } = req.body;

        const valorSaqueBruto = Number(Number(valor).toFixed(2));
        
        if (isNaN(valorSaqueBruto) || valorSaqueBruto <= 0) {
            return res.status(400).json({ erro: 'Valor de saque inválido.' });
        }

        const usuario = await User.findById(userId).select('+senha');
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        const senhaCorreta = await verificarSenhaSegura(senhaConfirmacao, usuario.senha);
        if (!senhaCorreta) return res.status(400).json({ erro: 'Senha incorreta.' });

        const config = await System.findOne();
        if (!config) return res.status(500).json({ erro: 'Sistema offline.' });

        if (config.saqueAtivo === false) {
            return res.status(403).json({ erro: 'Saques desativados temporariamente pela Diretoria.' });
        }

        if (config.saqueAbre && config.saqueFecha) {
            // 🚀 CORREÇÃO CIRÚRGICA: Forçar fuso horário de Moçambique (Africa/Maputo)
            // Extraímos a data e hora locais do fuso de Maputo como string e convertemos novamente para data.
            const dataStrMaputo = new Date().toLocaleString("en-US", { timeZone: "Africa/Maputo" });
            const agoraMaputo = new Date(dataStrMaputo);
            
            const horaAtual = agoraMaputo.getHours() + (agoraMaputo.getMinutes() / 60);
            
            const [hAbre, mAbre] = config.saqueAbre.split(':').map(Number);
            const [hFecha, mFecha] = config.saqueFecha.split(':').map(Number);
            
            const tempoAbre = hAbre + ((mAbre || 0) / 60);
            const tempoFecha = hFecha + ((mFecha || 0) / 60);
            const diaSemana = agoraMaputo.getDay(); 

            if (diaSemana === 0 || diaSemana === 6 || horaAtual < tempoAbre || horaAtual > tempoFecha) {
                return res.status(403).json({ erro: 'Operação rejeitada: Levantamentos disponíveis apenas em dias úteis, dentro do horário de funcionamento.' });
            }
        }

        const limiteMinimo = config.saqueLimite || 200;

        if (valorSaqueBruto < limiteMinimo) {
            return res.status(400).json({ erro: `Mínimo para saque: ${limiteMinimo} MZN` });
        }

        const usuarioAtualizado = await User.findOneAndUpdate(
            { _id: usuario._id, saldo: { $gte: valorSaqueBruto } },
            { $inc: { saldo: -valorSaqueBruto } },
            { new: true } 
        );

        if (!usuarioAtualizado) {
            return res.status(400).json({ erro: 'Saldo insuficiente ou transação simultânea bloqueada.' });
        }

        const taxaAtual = config.saqueTaxa ?? 10;
        const valorTaxa = Number(((valorSaqueBruto * taxaAtual) / 100).toFixed(2));
        const valorLiquido = Number((valorSaqueBruto - valorTaxa).toFixed(2));

        const novaTransacao = new Transaction({
            usuarioId: usuarioAtualizado._id,
            nomeUsuario: usuarioAtualizado.nome,
            idUnicoUsuario: usuarioAtualizado.idUnico,
            telefoneUsuario: usuarioAtualizado.telefone,
            tipo: 'saque',
            valor: valorSaqueBruto,
            taxaAplicada: taxaAtual, 
            valorTaxa: valorTaxa, 
            valorLiquido: valorLiquido, 
            operadora: operadora || 'M-Pesa', 
            numeroContaDestino,
            nomeContaDestino,
            status: 'pendente'
        });

        await novaTransacao.save();

        try {
            const novaNotif = new Notification({
                usuarioId: usuarioAtualizado._id,
                titulo: 'Levantamento Solicitado ⏳',
                mensagem: `O seu pedido de levantamento de ${valorSaqueBruto.toLocaleString('pt-MZ')} MZN foi enviado. Em breve o valor líquido será creditado na sua conta.`,
                tipo: 'financeiro',
                lida: false
            });
            await novaNotif.save();
        } catch(errNotif) { console.error("Erro ao gerar notif saque:", errNotif); }

        res.json({ 
            mensagem: 'Pedido de levantamento enviado com sucesso!',
            novoSaldo: usuarioAtualizado.saldo 
        });

    } catch (erro) {
        console.error("Erro saque:", erro);
        res.status(500).json({ erro: 'Erro interno no processamento do saque.' });
    }
});

// ===============================
// HISTÓRICO (ISOLAMENTO TOTAL)
// ===============================
router.get('/historico', auth, async (req, res) => {
    try {
        const userId = getUserId(req);
        // Coleta tudo ordenando por data decrescente
        const historico = await Transaction.find({ usuarioId: userId }).sort({ createdAt: -1 });
        res.json(historico);
    } catch (erro) {
        console.error("Erro histórico:", erro);
        res.status(500).json({ erro: 'Erro ao carregar o seu histórico individual.' });
    }
});

module.exports = router;
