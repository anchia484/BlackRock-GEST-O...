const express = require('express');
const router = express.Router();
const auth = require('./authMiddleware'); 
const User = require('./User'); 
const Transaction = require('./Transaction');
const System = require('./System');

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
// PEGAR ID
// ===============================
function getUserId(req) {
    if (typeof req.usuario === 'string') return req.usuario;
    return req.usuario.id || req.usuario._id || req.usuario.userId;
}

// ===============================
// DEPÓSITO
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
            tipo: 'deposito',
            valor: Number(valor),
            status: 'pendente',
            operadora: operadoraFormatada,
            numeroTransferencia: numeroOrigem,
            idTransacaoBancaria,
            comprovanteBase64
        });

        await novaTransacao.save();
        res.json({ mensagem: 'Depósito registado com sucesso!' });

    } catch (erro) {
        console.error("Erro depósito:", erro);
        res.status(500).json({ erro: 'Erro interno.' });
    }
});

// ===============================
// SAQUE
// ===============================
router.post('/saque', auth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const { numeroContaDestino, nomeContaDestino, valor, senhaConfirmacao } = req.body;

        const usuario = await User.findById(userId).select('+senha');
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        const senhaCorreta = await verificarSenhaSegura(senhaConfirmacao, usuario.senha);
        if (!senhaCorreta) return res.status(400).json({ erro: 'Senha incorreta.' });

        const config = await System.findOne();
        if (!config) return res.status(500).json({ erro: 'Sistema offline.' });

        if (config.saqueAtivo === false) {
            return res.status(403).json({ erro: 'Saques desativados.' });
        }

        const valorSaqueBruto = Number(valor);
        const limiteMinimo = config.saqueLimite || 200;

        if (valorSaqueBruto < limiteMinimo) {
            return res.status(400).json({ erro: `Mínimo: ${limiteMinimo} MZN` });
        }

        if (usuario.saldo < valorSaqueBruto) {
            return res.status(400).json({ erro: 'Saldo insuficiente.' });
        }

        // Desconta saldo
        usuario.saldo -= valorSaqueBruto;
        await usuario.save();

        const taxaAtual = config.saqueTaxa ?? 10;
        const valorTaxa = (valorSaqueBruto * taxaAtual) / 100;
        const valorLiquido = valorSaqueBruto - valorTaxa;

        const novaTransacao = new Transaction({
            usuarioId: usuario._id,
            nomeUsuario: usuario.nome,
            idUnicoUsuario: usuario.idUnico,
            tipo: 'saque',
            valor: valorSaqueBruto,
            taxaAplicada: taxaAtual,
            valorTaxa,
            valorLiquido,
            metodoSaque: 'M-Pesa/E-Mola',
            numeroContaDestino,
            nomeContaDestino,
            status: 'pendente'
        });

        await novaTransacao.save();

        res.json({ mensagem: 'Pedido de saque enviado com sucesso!' });

    } catch (erro) {
        console.error("Erro saque:", erro);
        res.status(500).json({ erro: 'Erro interno.' });
    }
});

// ===============================
// HISTÓRICO
// ===============================
router.get('/historico', auth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const historico = await Transaction.find({ usuarioId: userId }).sort({ createdAt: -1 });
        res.json(historico);
    } catch (erro) {
        console.error("Erro histórico:", erro);
        res.status(500).json({ erro: 'Erro ao carregar histórico.' });
    }
});

module.exports = router;