require('dotenv').config()
const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
let csvToJson = require('convert-csv-to-json');
const fs = require("node:fs");
const axios = require('axios');
const Readable = require('stream').Readable;

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.start((ctx) => ctx.reply('Welcome'));

const loadRegistered = () => fs.readFileSync('.envRegistration').toString().split("\n")
    .reduce((bnbT, x) => {
        if (x)
            bnbT[x.split(" ")[0]] ??= x.split(" ")[1]; 
        return bnbT; 
    }, {});

const isAscii = str => /^[\x00-\x7F]+$/.test(str);
const ERROR_ASCII = "Riga contenente caratteri invalidi";

let bnbTable = loadRegistered();

bot.on(message("document"), async (ctx) => {
    const fileUrl = await ctx.telegram.getFileLink(ctx.update.message.document.file_id);
    const response = await axios.get(fileUrl);
    fs.writeFileSync(`assets/source/${bnbTable[ctx.chat.id]}.csv`, response.data);
});

bot.on(message("text"), (ctx) => {
    if (ctx.update.message.text.startsWith("N")) {
        const NdateElement = ctx.update.message.text.split(" ")[1]?.split("/");
        if (NdateElement && NdateElement.length >= 3) {
            const Ndate = `${NdateElement[1]}/${NdateElement[0]}/${NdateElement[2]}`;
            if (!isNaN(Date.parse(Ndate)))
                ctx.sendMessage(`Per questa data hanno compilato ${countGuestsForDate(`${bnbTable[ctx.chat.id]}.csv`, ctx.update.message.text.split(" ")[1])} persone`)
        }
    }
    else if (ctx.update.message.text.startsWith("register ")) {
        fs.appendFileSync('.envRegistration', `\n${ctx.chat.id} ${ctx.update.message.text.replace("register ", "")}`);
        bnbTable = loadRegistered();
    }
    else {
        const dateElement = ctx.update.message.text.split("/");
        if (dateElement.length >= 3) {
            const date = `${dateElement[1]}/${dateElement[0]}/${dateElement[2]}`;
            if (!isNaN(Date.parse(date))) {
                const textToSend = convertToUploadableFile(`${bnbTable[ctx.chat.id]}.csv`, ctx.update.message.text);
                if (textToSend.startsWith(ERROR_ASCII))
                    ctx.sendMessage(`${ERROR_ASCII} Riga ${textToSend.replace(ERROR_ASCII, "")}`);
                else if (textToSend)
                    ctx.replyWithDocument({source: Readable.from(textToSend), filename: `${bnbTable[ctx.chat.id]}-${ctx.update.message.text.replaceAll("/", "-")}.txt`});
                else
                    ctx.sendMessage("Nessuna registrazione per questa data.")
            }
        }
    }
});

bot.launch();

function countGuestsForDate (percorsoFile, dataArrivo) {
    try {
        let datas = csvToJson.utf8Encoding().fieldDelimiter(',').supportQuotedField(true).getJsonFromCsv("assets/source/" + percorsoFile);
        return datas.filter(x => x["Arrivo"] == dataArrivo).length;
    } catch { return 0 }
}

function convertToUploadableFile (percorsoFile, dataArrivo) {
    let datas = [];
    
    try {
        datas = csvToJson.utf8Encoding().fieldDelimiter(',').supportQuotedField(true).getJsonFromCsv("assets/source/" + percorsoFile);
    } catch { return undefined }

    const stati = csvToJson.utf8Encoding().fieldDelimiter(',').supportQuotedField(true).getJsonFromCsv("assets/stati.csv")
    const comuni = csvToJson.utf8Encoding().fieldDelimiter(',').supportQuotedField(true).getJsonFromCsv("assets/comuni.csv")
    const documenti = csvToJson.utf8Encoding().fieldDelimiter(',').supportQuotedField(true).getJsonFromCsv("assets/documenti.csv")
    
    const cutAndTrim = (str) => str.split("/")[1].trim();

    let filtered = datas.filter(x => x["Arrivo"] == dataArrivo);

    let rowToWrite = "";
    
    filtered.forEach((el, i) => {
        if (!isAscii(r["Nome"]) || !isAscii(r["Cognome"]) || !isAscii(r["NumeroDocumento"]))
            return ERROR_ASCII + i;

        rowToWrite += i == 0 ? "" : "\n";
        
        rowToWrite += i == 0 ? "18" : "20";
        
        rowToWrite += el["Arrivo"];
        rowToWrite += el["Cognome"].padEnd(50);
        rowToWrite += el["Nome"].padEnd(30);
        rowToWrite += el["Sesso"].includes("Female") ? 2 : 1;
        rowToWrite += el["DataNascita"];
        rowToWrite += "".padEnd(9);
        rowToWrite += "".padEnd(2);
        //CODICE STATO NASCITA
        rowToWrite += stati.find(x => x["Descrizione"] == cutAndTrim(el["StatoNascita"]))["Codice"];
        // rowToWrite += stati.find(x => x["Descrizione"] == el["Nazionalita"])["Codice"];
    
        //CODICE CITTADINANZA
        rowToWrite += stati.find(x => x["Descrizione"] == cutAndTrim(el["Nazionalita"]))["Codice"];
    
        //CODICE COMUNE RESIDENZA ITALIA
        rowToWrite += el["ComuneResidenza"] ? comuni.find(x => x["Descrizione"] == el["ComuneResidenza"])["Codice"] : "".padEnd(9);
    
        //SIGLA PROVINCIA RESIDENZA ITALIA
        rowToWrite += !el["ProvinciaResidenza"] ? "".padEnd(2) : el["ProvinciaResidenza"];
    
        //CODICE STATO RESIDENZA
        rowToWrite += stati.find(x => x["Descrizione"] == cutAndTrim(el["StatoResidenza"]))["Codice"];
        // rowToWrite += stati.find(x => x["Descrizione"] == el["Nazionalita"])["Codice"];
    
        rowToWrite += "".padEnd(50);
    
        //CODICE TIPO DOCUMENTO IDENTITA
        rowToWrite += i == 0 ? documenti.find(x => x["Descrizione"] == cutAndTrim(el["Documento"]))["Codice"] : "".padEnd(5);
    
        rowToWrite += i == 0 ? el["NumeroDocumento"].padEnd(20) : "".padEnd(20);
    
        //CODICE COMUNE/STATO RILASCIO
        rowToWrite += i == 0 
            ? el["ComuneRilascioDocumento"] ? comuni.find(x => x["Descrizione"] == el["ComuneRilascioDocumento"])["Codice"] : stati.find(x => x["Descrizione"] == cutAndTrim(el["StatoRilascioDocumento"]))["Codice"]
            // ? el["ComuneRilascioDocumento"] ? comuni.find(x => x["Descrizione"] == el["ComuneRilascioDocumento"])["Codice"] : stati.find(x => x["Descrizione"] == el["Nazionalita"])["Codice"]
            : "".padEnd(9);
    
        rowToWrite += el["Partenza"];
        rowToWrite += "".padEnd(30);
        rowToWrite += "".padEnd(30);
        rowToWrite += process.env["NUMERO_STANZE"].padStart(3, "0");
        rowToWrite += process.env["NUMERO_STANZE"].padStart(3, "0");
        rowToWrite += process.env["NUMERO_LETTI"].padStart(4, "0");
        rowToWrite += " ";
        rowToWrite += "".padEnd(10);
        rowToWrite += 1;
    });
    
    return rowToWrite;
}