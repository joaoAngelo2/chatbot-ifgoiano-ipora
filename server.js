import { startBot } from './src/bot/Bot.js'
import { atualizarNoticiaDiaria } from './scraper.js'

const hora = 3600000

atualizarNoticiaDiaria()
setInterval(atualizarNoticiaDiaria, hora)
startBot()