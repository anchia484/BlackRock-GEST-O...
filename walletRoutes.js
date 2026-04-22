const express = require('express');
const router = express.Router();
const auth = require('./authMiddleware'); 
const User = require('./User'); 
const Transaction = require('./Transaction');

// MÁGICA DE SEGURANÇA: Entende senhas criptografadas e textos normais
async function verificarSenhaSegura(senhaDigitada, senhaGuardada) {
    if (!senhaDigitada || !senhaGuardada) return false;
    const digitada = senhaDigitada.trim();
    if (digitada === senhaGuardada) return true; 
    try {
        const bcrypt = require('bcryptjs');
        return await bcrypt.compare(digitada, senhaGuardada);
    } catch(e) {
        try {
            const bcrypt = require('bcrypt');
            return await bcrypt.compare(digitada, senhaGuardada);
        } catch(e2) {
            return false;
        }
    }
}

// FUNÇÃO SEGURA PARA PEGAR O ID
function getUserId(req) {
    if (typeof req.usuario === 'string') return req.usuario;
    return req.usuario.id || req.usuario._id || req.usuario.userId;
}

// ==========================================
// 1. ROTA DE DEPÓSITO
// ==========================================
router.post('/deposito', auth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const { canal, numeroOrigem, valor, idTransacaoBancaria, comprovanteBase64, senhaConfirmacao } = req.body;

        // .select('+senha') OBRIGA o banco a ler a senha, mesmo que esteja oculta
        const usuario = await User.findById(userId).select('+senha');
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        const senhaCorreta = await verificarSenhaSegura(senhaConfirmacao, usuario.senha);
        if (!senhaCorreta) return res.status(400).json({ erro: 'A senha de segurança está incorreta.' });

        let operadoraFormatada = null;
        if (canal === 'M-PESA' || canal === 'M-Pesa') operadoraFormatada = 'M-Pesa';
        if (canal === 'E-MOLA' || canal === 'E-Mola') operadoraFormatada = 'E-Mola';

        const novaTransacao = new Transaction({
            usuarioId: usuario._id,
            nomeUsuario: usuario.nome || 'Usuário',         
            idUnicoUsuario: usuario.idUnico || 0,   
            tipo: 'deposito',
            valor: Number(valor),
            status: 'pendente',
            operadora: operadoraFormatada,       
            numeroTransferencia: numeroOrigem,   
            idTransacaoBancaria: idTransacaoBancaria,
            comprovanteBase64: comprovanteBase64
        });

        await novaTransacao.save();
        res.json({ mensagem: 'Depósito registado com sucesso!' });

    } catch (erro) {
        console.error("Erro interno no Depósito:", erro);
        res.status(500).json({ erro: 'Erro interno ao salvar no banco de dados.' });
    }
});

// ==========================================
// 2. ROTA DE SAQUE (LEVANTAMENTO) CORRIGIDA
// ==========================================
router.post('/saque', auth, async (req, res) => {
    try {
        const userId = getUserId(req);
        
        // CORREÇÃO AQUI: Os nomes agora batem certo com o saque.html
        const { numeroContaDestino, nomeContaDestino, valor, senhaConfirmacao } = req.body;

        const usuario = await User.findById(userId).select('+senha');
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        const senhaCorreta = await verificarSenhaSegura(senhaConfirmacao, usuario.senha);
        if (!senhaCorreta) return res.status(400).json({ erro: 'A senha de segurança está incorreta.' });

        if (usuario.saldo !== undefined) {
            if (usuario.saldo < Number(valor)) {
                return res.status(400).json({ erro: 'Saldo insuficiente para este levantamento.' });
            }
            usuario.saldo -= Number(valor);
            await usuario.save();
        }

        const novaTransacao = new Transaction({
            usuarioId: usuario._id,
            nomeUsuario: usuario.nome || 'Usuário',         
            idUnicoUsuario: usuario.idUnico || 0,   
            tipo: 'saque',
            valor: Number(valor),
            status: 'pendente',
            numeroContaDestino: numeroContaDestino, // AGORA GRAVA CORRETAMENTE
            nomeContaDestino: nomeContaDestino      // AGORA GRAVA CORRETAMENTE
        });

        await novaTransacao.save();
        res.json({ mensagem: 'Levantamento registado com sucesso!' });

    } catch (erro) {
        console.error("Erro interno no Saque:", erro);
        res.status(500).json({ erro: 'Erro interno ao processar levantamento.' });
    }
});

// ==========================================
// 3. ROTA PARA LER HISTÓRICO REAL
// ==========================================
router.get('/historico', auth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const historico = await Transaction.find({ usuarioId: userId }).sort({ createdAt: -1 });
        res.json(historico);
    } catch (erro) {
        console.error("Erro ao puxar histórico:", erro);
        res.status(500).json({ erro: 'Erro ao carregar o histórico.' });
    }
});

module.exports = router;