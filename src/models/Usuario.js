export default class Usuario
{

    constructor(whatsapp, notificacoes)
    {
        this.whatsapp = whatsapp
        this.notificacoes = notificacoes
    }

    get getNotificacoes()
    {
        return this.notificacoes
    }

    get getWhatsapp()
    {
        return this.whatsapp
    }


}