const express = require('express');
const User = require('./User');
const auth = require('./authMiddleware');
const router = express.Router();
const Notification = require('./Notification');

router.get('/dashboard', auth, async (req, res) => {

        const usuario = await User.findById(req.usuario.id).select('-senha');
        
        // 🚀 ADICIONE ESTA LINHA AQUI:
        const totalNotificacoes = await Notification.countDocuments({ usuarioId: req.usuario.id, lida: false });

        // 🚀 ATUALIZE O JSON PARA ENVIAR O VALOR:
        res.json({ 
            user: usuario, 
            unreadNotifications: totalNotificacoes 
        });

    } catch (erro) { res.status(500).json({ erro: 'Erro no Dashboard' }); }
});

// NOVA ROTA: Checklist de Requisitos Automático do MongoDB
router.get('/requisitos-bonus', auth, async (req, res) => {
    try {
        const u = await User.findById(req.usuario.id);
        const convidados = await User.countDocuments({ convidadoPor: u.meuCodigoConvite, planoAtivo: { $ne: 'Nenhum' } });
        
        // Lógica de validação automática
        const requisitos = [
            { status: 'concluido', titulo: 'Segurança da Conta', descricao: 'Validado pelo sistema KYC.', detalhe: 'CONTA ATIVA' },
            { status: u.planoAtivo !== 'Nenhum' ? 'concluido' : 'falha', titulo: 'Plano Ativo', descricao: 'Possuir um NODE ativo.', detalhe: u.planoAtivo },
            { status: convidados >= 5 ? 'concluido' : 'progresso', titulo: 'Rede de Convites', descricao: 'Mínimo 5 convidados ativos.', detalhe: `${convidados} de 5 concluídos` }
        ];

        const concluidos = requisitos.filter(r => r.status === 'concluido').length;
        const progressoGeral = Math.round((concluidos / requisitos.length) * 100);

        res.json({ progressoGeral, isSobAnalise: false, requisitos });
    } catch (e) { res.status(500).json({ erro: 'Erro na validação.' }); }
});
// APLICAÇÃO:
router.patch('/atualizar-foto', auth, async (req, res) => {
    try {
        const { fotoBase64 } = req.body;
        if (!fotoBase64) return res.status(400).json({ erro: 'Nenhuma imagem enviada.' });

        const usuario = await User.findByIdAndUpdate(
            req.usuario.id, 
            { fotoPerfil: fotoBase64 }, 
            { new: true }
        );

        res.json({ mensagem: 'Foto de perfil atualizada!', foto: usuario.fotoPerfil });
    } catch (e) { res.status(500).json({ erro: 'Erro ao salvar foto.' }); }
});

module.exports = router;