const mongoose = require('mongoose');

const feedSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    mensagem: { type: String, required: true },
    midiaBase64: { type: String, default: null }, // Suporta Foto ou Vídeo
    formatoMidia: { type: String, enum: ['imagem', 'video', 'nenhum'], default: 'nenhum' },
    autor: { type: String, default: 'Diretoria BlackRock' },
    tipo: { type: String, enum: ['comunicado', 'prova_pagamento', 'voto', 'promocao', 'automatico'], default: 'comunicado' },
    isFixado: { type: Boolean, default: false }, // Para posts no topo
    reacoes: { type: Number, default: 0 }, // ❤️ Likes
    dadosExtras: { // Para posts automáticos (ex: "Usuário ID 123")
        idUsuario: String,
        valor: Number,
        plano: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Feed', feedSchema, 'feed_blackrock');
