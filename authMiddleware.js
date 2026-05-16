const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        // 1. Verifica se o token foi enviado
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            // 🚀 O 'return' é VITAL aqui para parar o código!
            return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });
        }

        const token = authHeader.replace('Bearer ', '').trim();
        if (!token) {
            return res.status(401).json({ erro: 'Acesso negado. Formato de token inválido.' });
        }

        // 2. Verifica se o token é autêntico e se não expirou
        // NOTA: Se você usa uma palavra-passe secreta diferente, mude o texto abaixo
        const segredo = process.env.JWT_SECRET || 'sua_chave_secreta_aqui'; 
        const decodificado = jwt.verify(token, segredo);
        
        req.usuario = decodificado;
        
        // 3. Tudo certo! Pode entrar no Dashboard
        next();
        
    } catch (err) {
        // 🚀 AQUI ESTAVA O GRANDE ERRO! 
        // Se o token expirou, este 'return' impede que o servidor crashe.
        return res.status(401).json({ erro: 'Sessão expirada ou token inválido.' });
    }
};

module.exports = authMiddleware;