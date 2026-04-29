const mongoose = require('mongoose');

const systemSchema = new mongoose.Schema({
    // Financeiro
    saqueAbre: String, saqueFecha: String, saqueLimite: Number, saqueAtivo: Boolean, saqueTaxa: Number,
    // Operadoras
    mpesaNum: String, mpesaNome: String, emolaNum: String, emolaNome: String, depositoMsg: String,
    // Suporte
    whatsappLink: String, telegramLink: String, avisoGlobal: String, modoManutencao: Boolean,
    // Textos Institucionais
    sobreNos: String, regrasPlataforma: String, faq: String, termosCondicoes: String,
    // Tarefas
    tarefasStd: Number, tarefasPre: Number, tarefasVip: Number, tempoTarefa: Number
}, { timestamps: true });

module.exports = mongoose.model('System', systemSchema, 'sistema_blackrock');
