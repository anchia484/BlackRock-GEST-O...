require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Configurações básicas
app.use(cors()); // Permite que o frontend converse com o backend
app.use(express.json()); // Permite que o servidor entenda dados no formato JSON

// Rota de teste
app.get('/', (req, res) => {
    res.send('API BlackRock GESTÃO DE ATIVOS funcionando!');
});

// Conexão com o Banco de Dados (MongoDB)
mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log('✅ Banco de dados MongoDB conectado com sucesso!');
    
    // Só liga o servidor se o banco conectar
    app.listen(process.env.PORT, () => {
        console.log(`🚀 Servidor BlackRock rodando na porta ${process.env.PORT}`);
    });
})
.catch((erro) => {
    console.log('❌ Erro crítico ao conectar no MongoDB:', erro.message);
});