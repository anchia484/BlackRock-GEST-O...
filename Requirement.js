const mongoose = require('mongoose');

const requirementSchema = new mongoose.Schema({
    chave: { type: String, required: true, unique: true }, // ex: 'min_convites'
    titulo: { type: String, required: true },
    descricao: { type: String },
    valorNecessario: { type: Number, default: 0 },
    tipoValidacao: { type: String, enum: ['plano', 'convites', 'seguranca', 'tarefa'], required: true },
    isAtivo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Requirement', requirementSchema, 'config_requisitos');