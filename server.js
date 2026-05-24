require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // 🚀 Injetado para validação de privilégios em tempo real

// Importação do Modelo de Usuário para o Varredor de Fundo
const User = require('./User'); 
const System = require('./System'); // 🚀 Injetado para leitura do interruptor de manutenção

const app = express();
app.use(cors());

// ====================================================================
// 🚀 PROTEÇÃO DE MEMÓRIA (OOM) E LIMITE DO MONGODB (Max 16MB por Doc)
// Limite reduzido de '70mb' para '10mb'. Isso evita que uploads gigantes
// derrubem o servidor Node.js ou quebrem o banco de dados.
// ====================================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ====================================================================
// 🔒 ESCUDO GLOBAL DE MANUTENÇÃO (COM VIP PASS PARA DIRETORIA)
// ====================================================================
app.use(async (req, res, next) => {
    try {
        // 1. CORREDORES LIVRES: Rotas que nunca podem ser bloqueadas, 
        // pois o frontend precisa delas para funcionar ou não envia token nelas.
        const rotasLivres = [
            '/api/admin', 
            '/login', 
            '/auth', 
            '/api/sistema' // <- AQUI ESTÁ A CHAVE! O perfil carrega configs públicas daqui.
        ];

        if (rotasLivres.some(rota => req.path.includes(rota))) {
            return next();
        }

        // 2. Permite requisições prévias do navegador (CORS Preflight) que não trazem Token
        if (req.method === 'OPTIONS') {
            return next();
        }

        // 3. Consulta o estado atual do sistema na Base de Dados
        const config = await System.findOne();
        
        // 4. Se a manutenção estiver ativa, inicia a triagem de segurança
        if (config && config.modoManutencao === true) {
            const authHeader = req.headers['authorization'];
            
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    
                    // Hipótese A: O utilizador está a usar o Token exclusivo do Painel Admin
                    if (decoded && decoded.isAdmin === true) {
                        return next();
                    }

                    // Hipótese B: O Diretor está a usar a App normal dos clientes para testar
                    const userId = decoded.id || decoded._id || decoded.userId;
                    if (userId) {
                        const utilizador = await User.findById(userId);
                        if (utilizador && utilizador.isAdmin === true) {
                            return next(); // 👑 VIP PASS: Autoriza o Diretor a navegar livremente!
                        }
                    }
                } catch (errToken) {
                    // Token inválido, segue para bloqueio
                }
            }

            // 🚫 Bloqueia o acesso de clientes comuns
            return res.status(503).json({ 
                erro: 'A plataforma encontra-se em manutenção global para o lançamento oficial.' 
            });
        }

        // Se a manutenção estiver desligada, tudo funciona normalmente
        next();
    } catch (error) {
        console.error("Falha no escudo de manutenção do servidor:", error);
        next(); 
    }
});

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
        
        iniciarMotorDeVarredura();
    });
})
.catch((err) => console.log('Erro ao conectar no MongoDB:', err));
