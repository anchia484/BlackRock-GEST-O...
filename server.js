require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());

// Limite para envio de fotos/comprovantes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Importando as rotas
const authRoutes = require('./auth');
const walletRoutes = require('./walletRoutes');
const planRoutes = require('./planos');
const taskRoutes = require('./taskRoutes');
const networkRoutes = require('./networkRoutes');
const adminRoutes = require('./adminRoutes');
const feedRoutes = require('./feedRoutes');
const supportRoutes = require('./supportRoutes');
const systemRoutes = require('./systemRoutes');
const userRoutes = require('./userRoutes'); // <-- ADICIONADO: Rota de Usuário

// Configurando as URLs da API
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/planos', planRoutes);
app.use('/api/tarefas', taskRoutes);
app.use('/api/rede', networkRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feed', feedRoutes); 
app.use('/api/suporte', supportRoutes);
app.use('/api/sistema', systemRoutes);
app.use('/api/usuario', userRoutes); // <-- ADICIONADO: Conexão com o frontend

app.get('/', (req, res) => {
    res.send('API BlackRock GESTÃO DE ATIVOS funcionando!');
});

mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log('✅ Banco de dados MongoDB conectado!');
    app.listen(process.env.PORT || 3000, () => {
        console.log(`🚀 Servidor rodando na porta ${process.env.PORT || 3000}`);
    });
})
.catch((err) => console.log('Erro ao conectar no MongoDB:', err));