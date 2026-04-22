const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nomeUsuario: { type: String },   // Puxado automaticamente
    idUnicoUsuario: { type: Number },// Puxado automaticamente
    
    tipo: { type: String, enum: ['deposito', 'saque', 'ganho_tarefa', 'bonus_rede'], required: true },
    valor: { type: Number, required: true },
    
    // Campos Financeiros
    operadora: { type: String, enum: ['M-Pesa', 'E-Mola', 'M-PESA', 'E-MOLA', null], default: null },
    
    // Campos exclusivos de SAQUE
    nomeContaDestino: { type: String, default: null },
    numeroContaDestino: { type: String, default: null },
    
    // Campos exclusivos de DEPÓSITO
    numeroTransferencia: { type: String, default: null }, // O número que enviou o dinheiro
    idTransacaoBancaria: { type: String, default: null }, // Ex: PP260411.1352.u67229
    comprovanteBase64: { type: String, default: null },   // A foto em formato de texto
    
    // Status da Transação
    status: { type: String, enum: ['pendente', 'aprovado', 'rejeitado', 'fraude', 'concluido', 'falhou'], default: 'pendente' }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema, 'historico_transacoes');
