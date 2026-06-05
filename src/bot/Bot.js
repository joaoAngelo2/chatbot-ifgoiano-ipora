import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from '@whiskeysockets/baileys'
import P from 'pino'
import qrcode from 'qrcode'
import http from 'http'
import { responderPergunta } from '../ai/Ai.js'
import { selecionarNoticias, selecionarUsuario, inserirUsuario } from '../database/Database.js'
import Usuario from '../models/Usuario.js'

let currentQR = null
let sock = null
const mensagensProcessadas = new Set()
const aguardandoConfirmacao = new Set()

const server = http.createServer(async (req, res) => {
  try {
    if (currentQR) {
      const qrImage = await qrcode.toDataURL(currentQR)
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <html>
          <head>
            <title>WhatsApp QR</title>
            <meta http-equiv="refresh" content="5">
            <style>
              body {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 100vh;
                font-family: Arial, sans-serif;
              }
              img {
                width: 300px;
                height: 300px;
              }
            </style>
          </head>
          <body>
            <h2>Escaneie o QR Code</h2>
            <img src="${qrImage}" />
            <p>A pagina atualiza automaticamente.</p>
          </body>
        </html>
      `)
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <html>
          <head>
            <meta http-equiv="refresh" content="3">
          </head>
          <body>
            <h2>Aguardando QR Code...</h2>
          </body>
        </html>
      `)
    }
  } catch (error) {
    console.error(error)
    res.writeHead(500)
    res.end('Erro ao gerar QR Code.')
  }
})

server.listen(3000, () => {
  console.log('Abra: http://localhost:3000')
})

function extrairTexto(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    null
  )
}

function deveIgnorar(msg) {
  if (!msg?.message) return true
  if (msg.key.fromMe) return true
  const sender = msg.key.remoteJid
  if (!sender) return true
  if (sender.endsWith('@g.us')) return true
  if (sender.endsWith('@newsletter')) return true
  return false
}

async function handleConfirmacao(sender, text) {
  const resposta = text.trim()

  if (resposta === '1') {
    const numero = sender.split('@')[0]
    const novoUsuario = new Usuario(numero, true)
    await inserirUsuario(novoUsuario)
    aguardandoConfirmacao.delete(sender)
    await sock.sendMessage(sender, {
      text: 'Cadastro realizado com sucesso.\n\nAgora voce recebera notificacoes do IF Goiano.'
    })
    return
  }

  if (resposta === '2') {
    aguardandoConfirmacao.delete(sender)
    return
  }

  await sock.sendMessage(sender, {
    text: 'Por favor, responda apenas:\n\n1 - Sim\n2 - Nao'
  })
}

async function handleMensagem(msg) {
  if (deveIgnorar(msg)) return

  const sender = msg.key.remoteJid
  const msgId = msg.key.id

  if (!msgId) return
  if (mensagensProcessadas.has(msgId)) return

  mensagensProcessadas.add(msgId)
  setTimeout(() => mensagensProcessadas.delete(msgId), 60000)

  const text = extrairTexto(msg)
  if (!text) return

  const numero = sender.split('@')[0]

  if (aguardandoConfirmacao.has(sender)) {
    await handleConfirmacao(sender, text)
    return
  }

  const usuario = await selecionarUsuario(numero)

  if (!usuario) {
    aguardandoConfirmacao.add(sender)
    await sock.sendMessage(sender, {
      text: '*Deseja receber notificacoes sobre novas noticias do IF Goiano?*\n\n1 - Sim\n2 - Nao'
    })
    return
  }

  const noticias = await selecionarNoticias(text)
  const noticiaRelevante = noticias.length > 0 ? noticias[0] : null
  const contexto = noticiaRelevante ? `${noticiaRelevante.titulo}\n${noticiaRelevante.getTexto()}` : ''
  const link = noticiaRelevante ? noticiaRelevante.getLink() : ''
  const data = noticiaRelevante ? noticiaRelevante.getData() : ''
  const resposta = await responderPergunta(contexto, text, link, data)

  await sock.sendMessage(sender, { text: resposta })
}

export async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const { version } = await fetchLatestBaileysVersion()

    sock = makeWASocket({
      version,
      auth: state,
      logger: P({ level: 'silent' })
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) currentQR = qr
      if (connection === 'open') currentQR = null
      if (connection === 'close') {
        currentQR = null
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
        if (shouldReconnect) setTimeout(startBot, 5000)
      }
    })

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      try {
        if (type !== 'notify') return
        await handleMensagem(messages[0])
      } catch (error) {
        console.error('Erro ao processar mensagem:', error)
      }
    })
  } catch (error) {
    console.error('Erro ao iniciar bot:', error)
    setTimeout(startBot, 5000)
  }
}

export async function notificaTodos(usuarios, mensagem) {
  if (!sock) {
    console.error('notificaTodos: socket nao disponivel')
    return
  }

  await Promise.all(
    usuarios.map(usuario =>
      sock.sendMessage(`${usuario.whatsapp}@s.whatsapp.net`, { text: mensagem })
    )
  )
}