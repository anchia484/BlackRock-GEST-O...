require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const User = require('./User'); 
const System = require('./System'); 

const app = express();
app.use(cors());

// ====================================================================
// 🚀 PROTEÇÃO DE MEMÓRIA (OOM) E LIMITE DO MONGODB (Max 10MB por Doc)
// ====================================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Importando as rotas
const authRoutes = require('./auth');
const walletRoutes = require('./walletRoutes');
const planRoutes = require('./planRoutes');
const taskRoutes = require('./taskRoutes');
const networkRoutes = require('./networkRoutes');
const adminRoutes = require('./adminRoutes');
const feedRoutes = require('./feedRoutes');
const supportRoutes = require('./supportRoutes');
const systemRoutes = require('./systemRoutes');
const userRoutes = require('./userRoutes'); 
const notificationRoutes = require('./notificationRoutes'); 

// Configurando as URLs da API
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/planos', planRoutes);
app.use('/api/tarefas', taskRoutes);
app.use('/api/rede', networkRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin-mercado', require('./adminMercadoRoutes'));
app.use('/api/mercado', require('./mercadoRoutes'));
app.use('/api/feed', feedRoutes); 
app.use('/api/suporte', supportRoutes);
app.use('/api/sistema', systemRoutes);
app.use('/api/usuario', userRoutes); 
app.use('/api/notificacoes', notificationRoutes);

app.get('/', (req, res) => {
    res.send('API BlackRock GESTÃO DE ATIVOS funcionando!');
});

// ====================================================================
// 🧹 MOTOR SILENCIOSO: VARREDOR DE PLANOS FANTASMAS (24 HORAS)
// ====================================================================
async function executarLimpezaDePlanos() {
    try {
        const agora = new Date();
        const resultado = await User.updateMany(
            { planoAtivo: { $ne: 'Nenhum' }, dataExpiracaoPlano: { $lt: agora } },
            { $set: { planoAtivo: 'Nenhum' } }
        );
        console.log(`[AUDITORIA BLACKROCK] Varredura Concluída: ${resultado.modifiedCount} planos expirados foram desativados.`);
    } catch (error) {
        console.error('[ERRO SISTEMA] Falha ao executar varredura de planos:', error);
    }
}

function iniciarMotorDeVarredura() {
    const agora = new Date();
    const proximaMeiaNoite = new Date(agora);
    proximaMeiaNoite.setHours(24, 0, 0, 0); 
    
    const tempoAteMeiaNoite = proximaMeiaNoite.getTime() - agora.getTime();
    console.log(`[SISTEMA] Varredor armado. Primeira execução em ${Math.round(tempoAteMeiaNoite / 1000 / 60)} minutes.`);

    setTimeout(() => {
        executarLimpezaDePlanos();
        setInterval(executarLimpezaDePlanos, 24 * 60 * 60 * 1000);
    }, tempoAteMeiaNoite);
}

// ====================================================================
// INICIALIZAÇÃO DO SERVIDOR E BANCO DE DADOS
// ====================================================================
mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log('✅ Banco de dados MongoDB conectado!');
    app.listen(process.env.PORT || 3000, () => {
        console.log(`🚀 Servidor rodando na porta ${process.env.PORT || 3000}`);
        iniciarMotorDeVarredura();
    });
})
.catch((err) => console.log('Erro ao conectar no MongoDB:', err));
