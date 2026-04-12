const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tipo: { type: String, enum: ['deposito', 'levantamento', 'ganho_tarefa', 'bonus_rede'], required: true },
    valor: { type: Number, required: true },
    status: { type: String, enum: ['pendente', 'aprovado', 'rejeitado'], default: 'pendente' },
    metodo: { type: String }, // Ex: M-Pesa, e-Mola
    numeroTelefone: { type: String } // Número usado para fazer o pagamento
}, { timestamps: true }); // Salva a data e hora automaticamente

module.exports = mongoose.model('Transaction', transactionSchema);
