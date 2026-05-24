const jwt = require('jsonwebtoken');
const System = require('./System'); 

const authMiddleware = async (req, res, next) => {
    try {
        // 1. Lê a autorização da requisição
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });
        }

        const token = authHeader.replace('Bearer ', '').trim();
        if (!token) {
            return res.status(401).json({ erro: 'Acesso negado. Formato de token inválido.' });
        }

        // 2. Abre o Token para ver quem é
        const segredo = process.env.JWT_SECRET || 'sua_chave_secreta_aqui'; 
        const decodificado = jwt.verify(token, segredo);
        req.usuario = decodificado;
        
        // ==========================================================
        // 🛡️ ESCUDO DE MANUTENÇÃO INTELIGENTE
        // ==========================================================
        // Se a pessoa NÃO FOR DIRETOR, o escudo verifica se a manutenção está ativa
        if (decodificado.isAdmin !== true) {
            const config = await System.findOne().select('modoManutencao');
            
            // Se o botão vermelho estiver ativado, bloqueia apenas os clientes
            if (config && config.modoManutencao === true) {
                return res.status(503).json({ 
                    erro: 'Plataforma em Manutenção Programada', 
                    isManutencao: true 
                });
            }
        }
        
        // 3. Se for Diretor, ou se não houver manutenção, avança livremente!
        next();
        
    } catch (err) {
        return res.status(401).json({ erro: 'Sessão expirada ou token inválido.' });
    }
};

module.exports = authMiddleware;
