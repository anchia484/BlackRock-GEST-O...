require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());

// Aumentando o limite para permitir o envio de fotos (Comprovantes)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Importando as rotas
const authRoutes = require('./auth');
const walletRoutes = require('./wallet');
const planRoutes = require('./planRoutes');
const taskRoutes = require('./taskRoutes');
const networkRoutes = require('./networkRoutes');
const adminRoutes = require('./adminRoutes');
const feedRoutes = require('./feedRoutes');
const supportRoutes = require('./supportRoutes'); // NOVO: Banco do Chat/Suporte adicionado

// Configurando as URLs da API
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/planos', planRoutes);
app.use('/api/tarefas', taskRoutes);
app.use('/api/rede', networkRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feed', feedRoutes); 
app.use('/api/suporte', supportRoutes); // NOVO: URL do Chat/Suporte ligada no motor

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
