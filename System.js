const mongoose = require('mongoose');

const systemSchema = new mongoose.Schema({
    chave: { type: String, required: true, unique: true }, // Ex: 'termos_condicoes'
    conteudo: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('System', systemSchema, 'sistema_blackrock');
