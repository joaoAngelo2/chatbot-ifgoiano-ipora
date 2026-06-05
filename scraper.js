import * as cheerio from 'cheerio';
import {gerarEmbedding} from './src/ai/Ai.js';
import {inserir, selecionarNoticia} from './src/database/Database.js';
import {notificaTodos} from './src/bot/Bot.js';
import Noticia from './src/models/Noticia.js';

//alimenta o banco de dados com as notícias das últimas 10 páginas do IFGoiano Campus Iporá (100 notícias)

function parseDataBR(dataStr) {

    const meses = {
        Janeiro: 0,
        Fevereiro: 1,
        Março: 2,
        Abril: 3,
        Mai: 4,
        Junho: 5,
        Julho: 6,
        Agosto: 7,
        Setembro: 8,
        Outubro: 9,
        Novembro: 10,
        Dezembro: 11
    };

    const partes = dataStr.split(' de ');

    const dia = Number(partes[0]);
    const mes = meses[partes[1]];
    const ano = Number(partes[2]);

    
    return new Date(ano, mes, dia).toISOString().slice(0, 10).replace('T', ' ');
}


export async function atualizarNoticiaDiaria(){
    const url = `https://www.ifgoiano.edu.br/home/index.php/ultimas-noticias-ipora.html`;
    let pages = await cheerio.fromURL(url);
    const h2s = pages('h2.tileHeadline');
    const a = h2s.find('a');
    const links = [];
    const re = /\d{1,2} de [\p{L}]+ de \d{4}/u;

    for (let i = 0; i < a.length; i++) {   
        links.push(a[i].attribs.href);
    }
    for(const link of links){
        let page = await cheerio.fromURL(`https://www.ifgoiano.edu.br`+link);
        const div = page('div.item-page');
        const title = div.find('h1.documentFirstHeading').text();
        let data_noticia = div.find('span').text();
        data_noticia = data_noticia.match(re)[0];
        const data = parseDataBR(data_noticia);
        const noticia = div.find('p').text();
        if(await selecionarNoticia(title) === null){
            const embedding = await gerarEmbedding(noticia);
            const novaNoticia = new Noticia(title, link, noticia, data, embedding);
            const usuarios = selecionarUsuarios();
            notificaTodos(usuarios, `*${title}\n${noticia}\n\nDisponível em: www.ifgoiano.com${link}`)
            await inserir(novaNoticia);

        }        
    }
}





