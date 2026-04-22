const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nomeUsuario: { type: String },   
    idUnicoUsuario: { type: Number },
    
    tipo: { type: String, enum: ['deposito', 'saque', 'ganho_tarefa', 'bonus_rede'], required: true },
    valor: { type: Number, required: true },
    
    operadora: { type: String, enum: ['M-Pesa', 'E-Mola', 'M-PESA', 'E-MOLA', null], default: null },
    
    nomeContaDestino: { type: String, default: null },
    numeroContaDestino: { type: String, default: null },
    
    numeroTransferencia: { type: String, default: null }, 
    idTransacaoBancaria: { type: String, default: null }, 
    comprovanteBase64: { type: String, default: null },   
    
    status: { type: String, enum: ['pendente', 'aprovado', 'rejeitado', 'fraude', 'concluido', 'falhou'], default: 'pendente' }
}, { timestamps: true });

// A MÁGICA ANTI-BUG DO HOPWEB ESTÁ AQUI NESTA LINHA:
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema, 'historico_transacoes');

module.exports = Transaction;
