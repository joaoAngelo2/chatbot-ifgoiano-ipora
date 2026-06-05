export default class Noticia {
  constructor(titulo, link, texto, data, embedding) {
    this.titulo = titulo
    this.link = link
    this.texto = texto
    this.data = data
    this.embedding = embedding
  }

  getTexto() {
    return this.texto
  }

  getData() {
    return this.data
  }

  getLink() {
    return this.link
  }
}