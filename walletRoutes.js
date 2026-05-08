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
// DEPÓSITO (VERSÃO BLINDADA)
// ===============================
router.post('/deposito', auth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const { canal, numeroOrigem, valor, idTransacaoBancaria, comprovanteBase64, senhaConfirmacao } = req.body;

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
            telefoneUsuario: usuario.telefone, // GRAVA TELEFONE PARA O ADMIN
            tipo: 'deposito',
            valor: Number(valor),
            status: 'pendente',
            operadora: operadoraFormatada,
            numeroTransferencia: numeroOrigem,
            idTransacaoBancaria,
            comprovanteBase64
        });

        await novaTransacao.save();

        // 🚀 NOTIFICAÇÃO DE DEPÓSITO CORRETA AQUI!
        try {
            const novaNotif = new Notification({
                usuarioId: usuario._id,
                titulo: 'Depósito em Análise ⏳',
                mensagem: `O seu pedido de depósito no valor de ${Number(valor).toLocaleString('pt-MZ')} MZN foi recebido e está aguardando auditoria.`,
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
// SAQUE (TAXA DINÂMICA E REAL)
// ===============================
router.post('/saque', auth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const { numeroContaDestino, nomeContaDestino, valor, senhaConfirmacao, operadora } = req.body;

        const usuario = await User.findById(userId).select('+senha');
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        const senhaCorreta = await verificarSenhaSegura(senhaConfirmacao, usuario.senha);
        if (!senhaCorreta) return res.status(400).json({ erro: 'Senha incorreta.' });

        const config = await System.findOne();
        if (!config) return res.status(500).json({ erro: 'Sistema offline.' });

        if (config.saqueAtivo === false) {
            return res.status(403).json({ erro: 'Saques desativados temporariamente.' });
        }

        const valorSaqueBruto = Number(valor);
        const limiteMinimo = config.saqueLimite || 200;

        if (valorSaqueBruto < limiteMinimo) {
            return res.status(400).json({ erro: `Mínimo para saque: ${limiteMinimo} MZN` });
        }

        if (usuario.saldo < valorSaqueBruto) {
            return res.status(400).json({ erro: 'Saldo insuficiente.' });
        }

        // DESCONTA SALDO IMEDIATAMENTE
        usuario.saldo -= valorSaqueBruto;
        await usuario.save();

        // PUXA A TAXA REAL DO SISTEMA (CONGELAMENTO)
        const taxaAtual = config.saqueTaxa ?? 10;
        const valorTaxa = (valorSaqueBruto * taxaAtual) / 100;
        const valorLiquido = valorSaqueBruto - valorTaxa;

        const novaTransacao = new Transaction({
            usuarioId: usuario._id,
            nomeUsuario: usuario.nome,
            idUnicoUsuario: usuario.idUnico,
            telefoneUsuario: usuario.telefone, // GRAVA TELEFONE PARA O ADMIN
            tipo: 'saque',
            valor: valorSaqueBruto, // Valor Bruto
            taxaAplicada: taxaAtual, // Congela a taxa atual do sistema
            valorTaxa: valorTaxa, // Valor descontado
            valorLiquido: valorLiquido, // O que será recebido
            operadora: operadora || 'M-Pesa', 
            numeroContaDestino,
            nomeContaDestino,
            status: 'pendente'
        });

        await novaTransacao.save();

        // 🚀 NOTIFICAÇÃO DE SAQUE CORRETA AQUI!
        try {
            const novaNotif = new Notification({
                usuarioId: usuario._id,
                titulo: 'Levantamento Solicitado ⏳',
                mensagem: `O seu pedido de levantamento de ${valorSaqueBruto.toLocaleString('pt-MZ')} MZN foi enviado. Em breve o valor líquido será creditado na sua conta.`,
                tipo: 'financeiro',
                lida: false
            });
            await novaNotif.save();
        } catch(errNotif) { console.error("Erro ao gerar notif saque:", errNotif); }

        res.json({ mensagem: 'Pedido de levantamento enviado com sucesso!' });

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
        // Filtra apenas as transações do usuário logado
        const historico = await Transaction.find({ usuarioId: userId }).sort({ createdAt: -1 });
        res.json(historico);
    } catch (erro) {
        console.error("Erro histórico:", erro);
        res.status(500).json({ erro: 'Erro ao carregar o seu histórico individual.' });
    }
});

module.exports = router;
