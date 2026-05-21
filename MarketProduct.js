const mongoose = require('mongoose');

const MarketProductSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    valorMinimo: { type: Number, required: true },
    valorMaximo: { type: Number }, 
    duracaoDias: { type: Number, default: 0 }, // Ajustado para aceitar 0
    duracaoHoras: { type: Number, default: 0 }, // 🚀 A PEÇA QUE FALTAVA! Agora o BD guarda as horas.
    retornoPercentual: { type: Number, required: true }, 
    limiteParticipantes: { type: Number, default: 0 }, 
    participantesAtuais: { type: Number, default: 0 },
    status: { type: String, enum: ['ativo', 'oculto', 'encerrado'], default: 'oculto' }
}, { timestamps: true });

module.exports = mongoose.model('MarketProduct', MarketProductSchema);
