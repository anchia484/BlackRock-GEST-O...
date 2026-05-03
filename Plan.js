const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    nome: { type: String, required: true, unique: true }, 
    
    // NOMES ANTIGOS (Para o utilizador conseguir Comprar)
    estrato: { type: String }, 
    valorEntrada: { type: Number },
    ganhoDiario: { type: Number },
    duracaoDias: { type: Number },
    retornoTotal: { type: Number },
    limiteTarefasDia: { type: Number },
    
    // NOMES NOVOS (Para o Painel do Admin e Front-end)
    nivel: { type: String },
    valor: { type: Number },
    percentagem: { type: Number },
    duracao: { type: Number },
    ganhoTotal: { type: Number },
    tarefas: { type: Number },
    ativo: { type: Boolean, default: true }
});

module.exports = mongoose.model('Plan', planSchema);