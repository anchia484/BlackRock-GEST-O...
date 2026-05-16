const mongoose = require('mongoose');

const MarketConfigSchema = new mongoose.Schema({
    isMercadoAberto: { type: Boolean, default: false },
    dataFechamento: { type: Date } // A data que vai alimentar o contador regressivo global no ecrã dos clientes
}, { timestamps: true });

module.exports = mongoose.model('MarketConfig', MarketConfigSchema);