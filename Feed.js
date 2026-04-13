const mongoose = require('mongoose');

const feedSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    mensagem: { type: String, required: true },
    imagemBase64: { type: String, default: null }, // Para postar provas de pagamento em foto
    autor: { type: String, default: 'Diretoria BlackRock' },
    tipo: { type: String, enum: ['aviso', 'prova_pagamento', 'promocao', 'evento'], default: 'aviso' }
}, { timestamps: true });

module.exports = mongoose.model('Feed', feedSchema, 'feed_blackrock');
