const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    telefone: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    idUnico: { type: Number, unique: true },
    meuCodigoConvite: { type: String, unique: true },
    convidadoPor: { type: String, default: null },
    
    saldo: { type: Number, default: 0 },
    tarefasFeitasHoje: { type: Number, default: 0 },
    dataUltimaTarefa: { type: Date, default: null },
    
    planoAtivo: { type: String, default: 'Nenhum' },
    dataExpiracaoPlano: { type: Date, default: null },
    
    isAdmin: { type: Boolean, default: false },
    isAgente: { type: Boolean, default: false },

    // Dados para Recebimento de Saques (Novos)
    carteiraPreferencial: { type: String, enum: ['M-Pesa', 'E-Mola', 'Nenhuma'], default: 'Nenhuma' },
    numeroRecebimento: { type: String, default: '' },
    nomeTitularConta: { type: String, default: '' }
    
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema, 'usuarios_blackrock');
