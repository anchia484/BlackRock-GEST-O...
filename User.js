const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    telefone: { type: String, required: true, unique: true }, // Ex: +258840000000
    senha: { type: String, required: true },
    idUnico: { type: Number, required: true, unique: true }, // ID de 5 dígitos
    meuCodigoConvite: { type: String, required: true, unique: true }, // Código de 6 caracteres
    convidadoPor: { type: String, default: null }, // Código de quem convidou (se houver)
    saldo: { type: Number, default: 0.00 },
    isAgente: { type: Boolean, default: false }, // Se virou agente ou não
    planoAtivo: { type: String, default: 'Nenhum' }
}, { timestamps: true }); // Salva a data de criação automaticamente

module.exports = mongoose.model('User', userSchema);
