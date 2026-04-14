const mongoose = require('mongoose');

const recoverySchema = new mongoose.Schema({
    telefone: { type: String, required: true },
    nome: { type: String, default: '' },
    idUnico: { type: String, default: '' },
    descricao: { type: String, required: true },
    status: { type: String, enum: ['pendente', 'resolvido'], default: 'pendente' }
}, { timestamps: true });

module.exports = mongoose.model('Recovery', recoverySchema, 'recuperacoes_conta');
