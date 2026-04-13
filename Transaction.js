const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nomeUsuario: { type: String },   // Puxado automaticamente
    idUnicoUsuario: { type: Number },// Puxado automaticamente
    
    tipo: { type: String, enum: ['deposito', 'saque', 'ganho_tarefa', 'bonus_rede'], required: true },
    valor: { type: Number, required: true },
    
    // Campos Financeiros (M-Pesa / E-Mola)
    operadora: { type: String, enum: ['M-Pesa', 'E-Mola', null], default: null },
    
    // Campos exclusivos de SAQUE
    nomeContaDestino: { type: String, default: null },
    numeroContaDestino: { type: String, default: null },
    
    // Campos exclusivos de DEPÓSITO
    numeroTransferencia: { type: String, default: null }, // O número que enviou o dinheiro
    idTransacaoBancaria: { type: String, default: null }, // Ex: PP260411.1352.u67229
    comprovanteBase64: { type: String, default: null },   // A foto em formato de texto (para o Admin ver em tela cheia)
    
    // Status da Transação
    status: { type: String, enum: ['pendente', 'aprovado', 'rejeitado', 'fraude'], default: 'pendente' }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema, 'transacoes_blackrock');
