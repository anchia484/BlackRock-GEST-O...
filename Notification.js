const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    titulo: { type: String, required: true },
    mensagem: { type: String, required: true },
    tipo: { type: String, enum: ['chat', 'financeiro', 'feed', 'sistema'], default: 'sistema' },
    link: { type: String, default: '#' },
    lida: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
