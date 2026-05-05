const mongoose = require('mongoose');

const systemSchema = new mongoose.Schema({
    saqueAbre: String, saqueFecha: String, saqueLimite: Number, saqueAtivo: Boolean, saqueTaxa: Number,
    bonusRede: Number, // <-- ESTA É A MÁGICA NOVA QUE ADICIONAMOS
    mpesaNum: String, mpesaNome: String, emolaNum: String, emolaNome: String, depositoMsg: String,
    whatsappLink: String, telegramLink: String, avisoGlobal: String, modoManutencao: Boolean,
    sobreNos: String, regrasPlataforma: String, faq: String, termosCondicoes: String,
    tarefasStd: Number, tarefasPre: Number, tarefasVip: Number, tempoTarefa: Number
}, { timestamps: true });

module.exports = mongoose.model('System', systemSchema, 'sistema_blackrock');