import dotenv from 'dotenv'
import { GoogleGenAI } from '@google/genai'

dotenv.config()
const hoje = new Date();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_LLM_MODEL = 'openai/gpt-oss-120b'



export async function responderPergunta(contexto, historico, link, dataPublicacao) {
  const systemPrompt = `Voce e um assistente virtual do IFGoiano Campus Ipora no WhatsApp.
Seu objetivo e ajudar estudantes a entenderem noticias e comunicados do campus de forma simples, sem precisarem navegar pelo site oficial.
Com base na noticia abaixo, responda a pergunta do estudante de forma clara e amigavel, como se estivesse explicando para um amigo.

Regras:
- Lembre-se que a data da publicacao e ${dataPublicacao} e a data de hoje e ${hoje.toLocaleDateString('pt-BR')}
- Verifique os prazos da mensagem e da data de publicacao
- Escreva como mensagem de WhatsApp: sem tabelas, sem negrito, sem markdown
- Seja direto, no maximo 3 paragrafos curtos
- Se a pergunta tiver relacao com a noticia mas voce nao conseguir responde-la, instrua-o a abrir o link https://www.ifgoiano.edu.br${link}
- Se a pergunta nao tiver relacao com a noticia, responda: "Não encontrei essa informacao nas noticias que tenho agora. Tente verificar direto no site do IFGoiano ou com a secretaria do campus"
- Leve em conta o historico da conversa para dar respostas coerentes e contextualizadas

Noticia disponivel: ${contexto}`

  const mensagens = [
    {
      role: 'user',
      content: systemPrompt
    },
    {
      role: 'assistant',
      content: 'Entendido! Estou pronto para responder as perguntas dos estudantes com base nessa noticia.'
    },
    ...historico
  ]

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_LLM_MODEL,
      messages: mensagens,
      max_tokens: 400
    })
  })

  const data = await response.json()

  if (!data.choices?.[0]) {
    console.error('Erro Groq:', JSON.stringify(data, null, 2))
    return 'Desculpe, nao consegui processar sua mensagem.'
  }

  return data.choices[0].message.content.trim()
}

export async function gerarEmbedding(texto) {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: texto
  })

  return response.embeddings[0].values
}

export function calcularSimilaridade(embedding1, embedding2) {
  const e1 = Array.isArray(embedding1) ? embedding1 : JSON.parse(embedding1)
  const e2 = Array.isArray(embedding2) ? embedding2 : JSON.parse(embedding2)

  const dotProduct = e1.reduce((sum, val, i) => sum + val * e2[i], 0)
  const magnitude1 = Math.sqrt(e1.reduce((sum, val) => sum + val * val, 0))
  const magnitude2 = Math.sqrt(e2.reduce((sum, val) => sum + val * val, 0))

  if (magnitude1 === 0 || magnitude2 === 0) return 0

  return dotProduct / (magnitude1 * magnitude2)
}