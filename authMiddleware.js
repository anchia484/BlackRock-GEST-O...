const jwt = require('jsonwebtoken');
const System = require('./System'); // Importação crucial para o Modo Manutenção

// 🚀 Transformado em Async para consultar a Base de Dados em tempo real
const authMiddleware = async (req, res, next) => {
    try {
        // 1. Verifica se o token foi enviado
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });
        }

        const token = authHeader.replace('Bearer ', '').trim();
        if (!token) {
            return res.status(401).json({ erro: 'Acesso negado. Formato de token inválido.' });
        }

        // 2. Verifica se o token é autêntico e se não expirou
        const segredo = process.env.JWT_SECRET || 'sua_chave_secreta_aqui'; 
        const decodificado = jwt.verify(token, segredo);
        
        req.usuario = decodificado;
        
        // ==========================================================
        // 🛡️ O ESCUDO IMPENETRÁVEL DE MANUTENÇÃO GLOBAL
        // ==========================================================
        // Se a pessoa NÃO for administrador, vamos verificar a trava!
        if (!decodificado.isAdmin) {
            // Consulta extremamente leve (puxa apenas a flag modoManutencao)
            const config = await System.findOne().select('modoManutencao');
            
            // Se o botão vermelho foi ativado no painel da Diretoria...
            if (config && config.modoManutencao === true) {
                // Aborta a requisição Imediatamente com código 503 (Serviço Indisponível)
                return res.status(503).json({ 
                    erro: 'Plataforma em Manutenção Programada', 
                    isManutencao: true 
                });
            }
        }
        
        // 3. Tudo certo! Passou no escudo. Pode entrar na Rota.
        next();
        
    } catch (err) {
        return res.status(401).json({ erro: 'Sessão expirada ou token inválido.' });
    }
};

module.exports = authMiddleware;