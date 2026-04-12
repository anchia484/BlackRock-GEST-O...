const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // Pega o token de acesso enviado pelo aplicativo/site
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ erro: 'Acesso negado. Faça login primeiro.' });

    try {
        // Limpa o token e verifica se ele é autêntico com a nossa chave secreta
        const tokenLimpo = token.replace('Bearer ', '');
        const verificado = jwt.verify(tokenLimpo, process.env.JWT_SECRET);
        
        // Salva os dados do usuário para sabermos de quem é a carteira
        req.usuario = verificado; 
        next(); // Tudo certo, pode continuar para a rota da carteira!
    } catch (erro) {
        res.status(400).json({ erro: 'Token inválido ou expirado.' });
    }
};
