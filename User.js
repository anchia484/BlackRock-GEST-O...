const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    telefone: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    idUnico: { type: Number, required: true, unique: true },
    meuCodigoConvite: { type: String, required: true, unique: true },
    convidadoPor: { type: String, default: null },
    saldo: { type: Number, default: 0.00 },
    isAgente: { type: Boolean, default: false },
    planoAtivo: { type: String, default: 'Nenhum' },
    dataExpiracaoPlano: { type: Date, default: null } // NOVO: Para o controle de dias
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
