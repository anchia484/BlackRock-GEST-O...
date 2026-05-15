const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ erro: 'Acesso negado. Faça login primeiro.' });

    try {
        const tokenLimpo = token.replace('Bearer ', '');
        const verificado = jwt.verify(tokenLimpo, process.env.JWT_SECRET);
        req.usuario = verificado; 
        next(); 
    } catch (erro) {
        if (erro.name === 'TokenExpiredError') {
            return res.status(401).json({ erro: 'SESSAO_EXPIRADA', mensagem: 'Sessão expirada por segurança.' });
        }
        return res.status(401).json({ erro: 'TOKEN_INVALIDO', mensagem: 'Token inválido ou corrompido.' });
    }
};
