const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');
const pino = require('pino');

console.log('🚀 INICIANDO BOT WHATSAPP IA CON BAILEYS...');

async function startBot() {
    try {
        // Configurar autenticación
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        
        // Crear socket de WhatsApp
        const sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            browser: ['WhatsApp Bot IA', 'Chrome', '1.0.0']
        });

        // Guardar credenciales cuando cambien
        sock.ev.on('creds.update', saveCreds);

        // Generar QR
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('📱 ESCANEA ESTE QR CON WHATSAPP:');
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === 'open') {
                console.log('✅ WHATSAPP CONECTADO! BOT LISTO...');
                console.log('🤖 ENVIA "ayuda" A TU WHATSAPP PARA PROBAR');
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                console.log('🔌 Conexión cerrada, reconectando...', lastDisconnect?.error);
                if (shouldReconnect) {
                    startBot();
                }
            }
        });

        // Procesar mensajes
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            
            if (!msg.message || msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') {
                return;
            }
            
            try {
                const from = msg.key.remoteJid;
                const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                
                console.log(`💬 MENSAJE DE ${from}: ${messageText}`);
                
                const userMessage = messageText.toLowerCase().trim();
                
                // COMANDO AYUDA
                if (userMessage === 'ayuda' || userMessage === 'help' || userMessage === '?') {
                    await sock.sendMessage(from, {
                        text: `🤖 *BOT IA WHATSAPP* 🤖

💬 _COMANDOS DISPONIBLES:_
• ✍️ Escribe normal - Chat con IA
• 🎨 "imagen [descripción]" - Generar imagen
• ❓ "ayuda" - Ver esta ayuda

✨ _EJEMPLOS:_
• "Hola, ¿cómo estás?"
• "imagen de un gato astronauta" 
• "quien ganó el mundial 2022"`
                    });
                    return;
                }
                
                // MODO IMAGEN
                if (userMessage.includes('imagen') || userMessage.startsWith('dibuja') || userMessage.startsWith('genera')) {
                    let prompt = messageText.replace(/imagen|genera|dibuja|crea/gi, '').trim();
                    
                    if (!prompt || prompt.length < 3) {
                        await sock.sendMessage(from, {
                            text: '❓ ¿QUÉ IMAGEN QUIERES GENERAR? EJEMPLO: "imagen de un bosque encantado"'
                        });
                        return;
                    }
                    
                    await sock.sendMessage(from, {
                        text: `⏳ GENERANDO: "${prompt}"...`
                    });
                    
                    // GENERAR IMAGEN CON POLLINATIONS
                    const encodedPrompt = prompt.replace(/ /g, '_');
                    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;
                    
                    console.log(`🎨 GENERANDO IMAGEN: ${imageUrl}`);
                    
                    // ENVIAR IMAGEN
                    await sock.sendMessage(from, {
                        image: { url: imageUrl },
                        caption: `✨ ${prompt}`
                    });
                    return;
                }
                
                // MODO TEXTO NORMAL
                const encodedMessage = encodeURIComponent(messageText);
                const apiUrl = `https://text.pollinations.ai/${encodedMessage}`;
                
                console.log(`🔗 CONSULTANDO IA: ${apiUrl}`);
                
                const response = await fetch(apiUrl);
                
                if (response.ok) {
                    const aiText = await response.text();
                    console.log(`✅ RESPUESTA IA: ${aiText.substring(0, 100)}...`);
                    await sock.sendMessage(from, { text: aiText });
                } else {
                    await sock.sendMessage(from, {
                        text: '🤖 ¡HOLA! SOY TU ASISTENTE DE IA. PUEDO RESPONDER PREGUNTAS O GENERAR IMÁGENES. ESCRIBE "ayuda" PARA VER OPCIONES.'
                    });
                }
                
            } catch (error) {
                console.error('❌ ERROR:', error);
                await sock.sendMessage(from, {
                    text: '⚠️ ERROR TEMPORAL, INTENTA DE NUEVO EN UN MOMENTO.'
                });
            }
        });

    } catch (error) {
        console.error('❌ ERROR INICIAL:', error);
        setTimeout(startBot, 5000); // Reintentar en 5 segundos
    }
}

// Iniciar el bot
startBot();

console.log('🔄 INICIALIZANDO BOT BAILEYS...');
console.log('⏳ ESPERANDO CÓDIGO QR...');
