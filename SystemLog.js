const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
    usuarioId: { type: String, required: true },
    usuario: { type: String, required: true },
    acao: { type: String, required: true },
    tipo: { type: String, required: true }, // ex: 'SISTEMA', 'SEGURANCA', 'FINANCEIRO'
    ip: { type: String, default: 'Desconhecido' },
    status: { type: String, enum: ['sucesso', 'falha', 'alerta'], default: 'sucesso' },
    detalhes: { type: Object, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('SystemLog', systemLogSchema, 'auditoria_blackrock');
