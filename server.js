require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Importação do Modelo de Usuário para o Varredor de Fundo
const User = require('./User'); 

const app = express();
app.use(cors());

// ====================================================================
// 🚀 PROTEÇÃO DE MEMÓRIA (OOM) E LIMITE DO MONGODB (Max 16MB por Doc)
// Limite reduzido de '70mb' para '10mb'. Isso evita que uploads gigantes
// derrubem o servidor Node.js ou quebrem o banco de dados.
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
// 🧹 MOTOR SILENCIOSO: VARREDOR DE PLANOS FANTASMAS (A CADA 24 HORAS À MEIA-NOITE)
// ====================================================================
async function executarLimpezaDePlanos() {
    try {
        const agora = new Date();
        // Procura utilizadores que têm um plano ativo, mas a data de expiração já passou
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
    
    // Calcula o tempo exato até à próxima meia-noite
    const proximaMeiaNoite = new Date(agora);
    proximaMeiaNoite.setHours(24, 0, 0, 0); 
    
    const tempoAteMeiaNoite = proximaMeiaNoite.getTime() - agora.getTime();

    console.log(`[SISTEMA] Varredor armado. Primeira execução em ${Math.round(tempoAteMeiaNoite / 1000 / 60)} minutos.`);

    // Aguarda até à meia-noite para dar o primeiro disparo
    setTimeout(() => {
        executarLimpezaDePlanos();
        
        // A partir desse momento, entra num loop exato a cada 24 horas (1 dia)
        const umDiaEmMs = 24 * 60 * 60 * 1000;
        setInterval(executarLimpezaDePlanos, umDiaEmMs);
        
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
        
        // Ativa o motor silencioso logo após o servidor iniciar com sucesso
        iniciarMotorDeVarredura();
    });
})
.catch((err) => console.log('Erro ao conectar no MongoDB:', err));