import mysql from 'mysql2/promise'
import { calcularSimilaridade, gerarEmbedding } from '../ai/Ai.js'
import Noticia from '../models/Noticia.js'
import Usuario from '../models/Usuario.js'

const pool = mysql.createPool({
  host: process.env.DB_HOST ,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

function parseEmbedding(valor) {
  if (Array.isArray(valor)) return valor
  const str = String(valor).trim()
  if (str.startsWith('[')) return JSON.parse(str)
  return str.split(',').map(Number)
}

export async function inserir(noticia) {
  await pool.query(
    `INSERT INTO noticias (titulo, link, data_noticia, noticia, embedding) VALUES (?, ?, ?, ?, ?)`,
    [noticia.titulo, noticia.link, noticia.data, noticia.texto, JSON.stringify(noticia.embedding)]
  )
}

export async function selecionarNoticia(titulo) {
  const [rows] = await pool.query(
    `SELECT titulo, link, data_noticia, noticia, embedding FROM noticias WHERE titulo = ?`,
    [titulo]
  )

  if (rows.length === 0) return null

  const row = rows[0]
  return new Noticia(row.titulo, row.link, row.noticia, row.data_noticia, row.embedding)
}

export async function inserirUsuario(usuario) {
  await pool.query(
    `INSERT INTO usuario (whatsapp, notificacoes) VALUES (?, ?)`,
    [usuario.whatsapp, usuario.notificacoes]
  )
}

export async function selecionarUsuario(numero) {
  const [rows] = await pool.query(
    `SELECT whatsapp, notificacoes FROM usuario WHERE whatsapp = ?`,
    [numero]
  )

  if (rows.length === 0) return null

  return new Usuario(rows[0].whatsapp, rows[0].notificacoes)
}

export async function selecionarUsuarios() {
  const [rows] = await pool.query(
    `SELECT whatsapp, notificacoes FROM usuario WHERE notificacoes = ?`,
    [true]
  )

  return rows.map(row => new Usuario(row.whatsapp, row.notificacoes))
}

export async function selecionarNoticias(pergunta) {
  const embeddingPergunta = await gerarEmbedding(pergunta)
  const [rows] = await pool.query('SELECT titulo, link, noticia, data_noticia, embedding FROM noticias')

  const noticias = rows.map(row => new Noticia(
    row.titulo,
    row.link,
    row.noticia,
    row.data_noticia,
    parseEmbedding(row.embedding)
  ))

  noticias.sort((a, b) => {
    const simA = calcularSimilaridade(embeddingPergunta, a.embedding)
    const simB = calcularSimilaridade(embeddingPergunta, b.embedding)
    return simB - simA
  })

  return noticias
}