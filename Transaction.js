const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    // ISOLAMENTO DE USUÁRIO (Garante que cada um só vê o seu)
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nomeUsuario: { type: String },   
    idUnicoUsuario: { type: Number },
    telefoneUsuario: { type: String }, // NOVO: Para o Admin saber quem é
    
    tipo: { type: String, enum: ['deposito', 'saque', 'ganho_tarefa', 'bonus_rede'], required: true },
    valor: { type: Number, required: true }, // Valor bruto
    
    // NOVOS CAMPOS OBRIGATÓRIOS PARA A TAXA REAL
    taxaAplicada: { type: Number, default: 0 },
    valorTaxa: { type: Number, default: 0 },
    valorLiquido: { type: Number, default: 0 },
    
    operadora: { type: String, enum: ['M-Pesa', 'E-Mola', 'M-PESA', 'E-MOLA', null], default: null },
    
    nomeContaDestino: { type: String, default: null },
    numeroContaDestino: { type: String, default: null },
    
    numeroOrigem: { type: String, default: null }, // Para depósitos
    idTransacaoBancaria: { type: String, default: null }, // O TXID
    comprovanteBase64: { type: String, default: null },   
    
    status: { type: String, enum: ['pendente', 'aprovado', 'rejeitado', 'fraude', 'concluido', 'falhou'], default: 'pendente' }
}, { timestamps: true });

// A MÁGICA ANTI-BUG
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema, 'historico_transacoes');

module.exports = Transaction;