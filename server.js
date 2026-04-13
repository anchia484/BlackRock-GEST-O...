require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Importando as rotas
const authRoutes = require('./auth');
const walletRoutes = require('./wallet');
const planRoutes = require('./planRoutes');
const taskRoutes = require('./taskRoutes');
const networkRoutes = require('./networkRoutes');
const adminRoutes = require('./adminRoutes'); // NOVO: Rota do Admin

// Configurando as URLs da API
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/planos', planRoutes);
app.use('/api/tarefas', taskRoutes);
app.use('/api/rede', networkRoutes);
app.use('/api/admin', adminRoutes); // NOVO: Ligando o Admin

app.get('/', (req, res) => {
    res.send('API BlackRock GESTÃO DE ATIVOS funcionando!');
});

mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log('✅ Banco de dados MongoDB conectado com sucesso!');
    app.listen(process.env.PORT, () => {
        console.log(`🚀 Servidor BlackRock rodando na porta ${process.env.PORT}`);
    });
})
.catch((erro) => {
    console.log('❌ Erro crítico ao conectar no MongoDB:', erro.message);
});
