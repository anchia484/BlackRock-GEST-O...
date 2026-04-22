const express = require('express');
const router = express.Router();
const auth = require('./authMiddleware'); 
const User = require('./User'); 
const Transaction = require('./Transaction');

// MÁGICA DE SEGURANÇA: Esta função entende senhas criptografadas e normais
async function verificarSenhaSegura(senhaDigitada, senhaGuardada) {
    if (senhaDigitada === senhaGuardada) return true; // Se for texto normal, passa
    try {
        const bcrypt = require('bcryptjs'); // Tenta decifrar
        return await bcrypt.compare(senhaDigitada, senhaGuardada);
    } catch(e) {
        try {
            const bcrypt = require('bcrypt'); // Tenta o outro decifrador
            return await bcrypt.compare(senhaDigitada, senhaGuardada);
        } catch(e2) {
            return false; // Se falhar tudo, a senha está errada
        }
    }
}

// 1. RECEBER E GUARDAR O DEPÓSITO DEFINITIVAMENTE
router.post('/deposito', auth, async (req, res) => {
    try {
        console.log("-> Servidor recebeu o pedido de depósito...");
        
        const { canal, numeroOrigem, valor, idTransacaoBancaria, comprovanteBase64, senhaConfirmacao } = req.body;

        const usuario = await User.findById(req.usuario.id);
        if (!usuario) {
            console.log("ERRO: Usuário não existe na base de dados.");
            return res.status(404).json({ erro: 'Usuário não encontrado.' });
        }

        // Validação da Senha usando a função inteligente
        const senhaCorreta = await verificarSenhaSegura(senhaConfirmacao, usuario.senha);
        if (!senhaCorreta) {
            console.log("ERRO: A senha de confirmação não bate certo.");
            return res.status(400).json({ erro: 'A senha de segurança está incorreta.' });
        }

        let operadoraFormatada = null;
        if (canal === 'M-PESA' || canal === 'M-Pesa') operadoraFormatada = 'M-Pesa';
        if (canal === 'E-MOLA' || canal === 'E-Mola') operadoraFormatada = 'E-Mola';

        const novaTransacao = new Transaction({
            usuarioId: req.usuario.id,
            nomeUsuario: usuario.nome,         
            idUnicoUsuario: usuario.idUnico,   
            tipo: 'deposito',
            valor: valor,
            status: 'pendente',
            operadora: operadoraFormatada,       
            numeroTransferencia: numeroOrigem,   
            idTransacaoBancaria: idTransacaoBancaria,
            comprovanteBase64: comprovanteBase64
        });

        await novaTransacao.save();
        console.log("-> SUCESSO! Depósito gravado no MongoDB e pronto para ir para o Histórico.");

        res.json({ mensagem: 'Depósito registado com sucesso!' });

    } catch (erro) {
        console.error("-> ERRO GRAVE NO DEPÓSITO:", erro);
        res.status(500).json({ erro: 'Erro interno ao salvar no banco de dados.' });
    }
});

// 2. LER HISTÓRICO REAL
router.get('/historico', auth, async (req, res) => {
    try {
        const historico = await Transaction.find({ usuarioId: req.usuario.id }).sort({ createdAt: -1 });
        res.json(historico);
    } catch (erro) {
        console.error("-> ERRO AO PUXAR HISTÓRICO:", erro);
        res.status(500).json({ erro: 'Erro ao carregar o histórico.' });
    }
});

module.exports = router;
