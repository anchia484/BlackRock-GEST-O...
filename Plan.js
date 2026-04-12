const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    nome: { type: String, required: true, unique: true }, // Ex: "NODE 1", "NODE 4"
    estrato: { type: String, required: true }, // "Standard", "Premium Plus" ou "VIP Gold"
    valorEntrada: { type: Number, required: true },
    ganhoDiario: { type: Number, required: true },
    duracaoDias: { type: Number, required: true },
    retornoTotal: { type: Number, required: true },
    limiteTarefasDia: { type: Number, required: true } // 5, 10 ou 15
});

module.exports = mongoose.model('Plan', planSchema);
