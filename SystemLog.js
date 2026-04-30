const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
    usuarioId: { type: String, default: 'Sistema' },
    usuario: { type: String, required: true }, // Ex: 'Diretoria (ADMIN)'
    acao: { type: String, required: true },    // O que a pessoa fez
    tipo: { type: String, enum: ['SISTEMA', 'SEGURANCA', 'FINANCEIRO', 'ADMIN', 'OUTRO'], default: 'OUTRO' },
    ip: { type: String, default: 'Desconhecido' },
    status: { type: String, enum: ['sucesso', 'falha', 'aviso'], default: 'sucesso' },
    detalhes: { type: Object, default: {} }    // Guarda os dados extras
}, { timestamps: true });

// A mesma mágica anti-bug para garantir que não duplica
module.exports = mongoose.models.SystemLog || mongoose.model('SystemLog', systemLogSchema, 'logs_sistema');
