const mongoose = require('mongoose');

const MarketProductSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    valorMinimo: { type: Number, required: true },
    valorMaximo: { type: Number }, // Se for vazio/null, não tem limite máximo
    duracaoDias: { type: Number, required: true },
    retornoPercentual: { type: Number, required: true }, // Ex: 60 para 60% de lucro
    limiteParticipantes: { type: Number, default: 0 }, // 0 = vagas ilimitadas
    participantesAtuais: { type: Number, default: 0 },
    status: { type: String, enum: ['ativo', 'oculto', 'encerrado'], default: 'oculto' }
}, { timestamps: true });

module.exports = mongoose.model('MarketProduct', MarketProductSchema);