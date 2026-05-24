const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
    try {
        // 1. Verifica se o cabeçalho de autorização foi enviado
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });
        }

        // 2. Extrai e limpa o Token
        const token = authHeader.replace('Bearer ', '').trim();
        if (!token) {
            return res.status(401).json({ erro: 'Acesso negado. Formato de token inválido.' });
        }

        // 3. Verifica se o token é autêntico e se não expirou
        const segredo = process.env.JWT_SECRET || 'sua_chave_secreta_aqui'; 
        const decodificado = jwt.verify(token, segredo);
        
        // 4. Injeta os dados do utilizador na requisição
        req.usuario = decodificado;
        
        // 🚀 O Escudo de Manutenção foi removido daqui! 
        // Como o server.js já possui o Escudo Global com Passe VIP para a Diretoria, 
        // removemos este código antigo para evitar conflitos e deixar o sistema mais rápido.
        
        // 5. Tudo certo! Passou na segurança da conta. Pode entrar na Rota.
        next();
        
    } catch (err) {
        return res.status(401).json({ erro: 'Sessão expirada ou token inválido.' });
    }
};

module.exports = authMiddleware;
