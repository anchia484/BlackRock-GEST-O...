const mongoose = require('mongoose');

const systemSchema = new mongoose.Schema({
    // Finanças e Caixa
    mpesaNum: String, mpesaNome: String, emolaNum: String, emolaNome: String, depositoMsg: String,
    saqueAbre: String, saqueFecha: String, saqueTaxa: Number, limiteGlobalDia: Number, 
    saqueAtivo: Boolean, saqueInformacoes: String,
    
    // Redes e Tarefas (Vazamentos Corrigidos)
    bonusPrimeiroDep: Number, bonusRede: Number,
    percN1: Number, percN2: Number,
    limiteUsuarioDia: Number,
    tarefasStd: Number, tarefasPre: Number, tarefasVip: Number, 
    tempoTarefaSeg: Number, // Correção de nomenclatura
    msgsTerminal: String,
    permitirUpgrade: Boolean,

    // Comunicação, Sistema e Textos
    whatsappLink: String, telegramLink: String, avisoGlobal: String, modoManutencao: Boolean,
    sobreNos: String, regrasPlataforma: String, faq: String, termosCondicoes: String
}, { timestamps: true });

// A mágica anti-bug para não duplicar esquemas no Mongoose
module.exports = mongoose.models.System || mongoose.model('System', systemSchema, 'sistema_blackrock');