const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    remetente: { type: String, enum: ['usuario', 'admin'], required: true },
    texto: { type: String, required: true },
    lida: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema, 'mensagens_suporte');
