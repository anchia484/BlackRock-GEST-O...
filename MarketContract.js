const mongoose = require('mongoose');

const MarketContractSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nomeUsuario: { type: String },
    idUnicoUsuario: { type: Number },
    produtoId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketProduct', required: true },
    nomeProduto: { type: String, required: true },
    valorAplicado: { type: Number, required: true },
    valorRetorno: { type: Number, required: true }, // O valor total que ele vai receber no fim
    dataInicio: { type: Date, default: Date.now },
    dataFim: { type: Date, required: true }, // A data/hora exata em que a validação preguiçosa é ativada
    status: { type: String, enum: ['ativo', 'concluido'], default: 'ativo' }
}, { timestamps: true });

module.exports = mongoose.model('MarketContract', MarketContractSchema);