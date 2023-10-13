require('./config')
const {
    default: WADefault,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    makeInMemoryStore,
    jidDecode,
    proto,
    makeCacheableSignalKeyStore, PHONENUMBER_MCC
} = require("@adiwajshing/baileys")
const pino = require('pino')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const NodeCache = require("node-cache")
const yargs = require('yargs/yargs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const _ = require('lodash')
const axios = require('axios')
const readline = require("readline")
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetchJson, await, sleep } = require('./lib/myfunc')
const moment = require('moment-timezone')
const pairingCode = true
const useMobile = false
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))

var low
try {
  low = require('lowdb')
} catch (e) {
  low = require('./lib/lowdb')
}

const { Low, JSONFile } = low
const mongoDB = require('./lib/mongoDB')

global.api = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({ ...query, ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}) })) : '')

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
global.db = new Low(
  /https?:\/\//.test(opts['db'] || '') ?
  new cloudDBAdapter(opts['db']) : /mongodb/.test(opts['db']) ?
  new mongoDB(opts['db']) :
  new JSONFile(`src/database.json`)
  )
global.DATABASE = global.db // Backwards Compatibility
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) return new Promise((resolve) => setInterval(function () { (!global.db.READ ? (clearInterval(this), resolve(global.db.data == null ? global.loadDatabase() : global.db.data)) : null) }, 1 * 1000))
      if (global.db.data !== null) return
          global.db.READ = true
      await global.db.read()
      global.db.READ = false
      global.db.data = {
        users: {},
        chats: {},
        database: {},
        game: {},
        settings: {},
        others: {},
        sticker: {},
        anonymous: {},
        ...(global.db.data || {})
    }
    global.db.chain = _.chain(global.db.data)
}
loadDatabase()

// save database every 30seconds
if (global.db) setInterval(async () => {
    if (global.db.data) await global.db.write()
}, 30 * 1000)

    
async function startHisoka() {
    const {
        state,
        saveCreds
    } = await useMultiFileAuthState(`./${sessionName}`)
    const { version, isLatest } = await fetchLatestBaileysVersion();
    const msgRetryCounterCache = new NodeCache()
    const hisoka = WADefault({
        version,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        printQRInTerminal: !pairingCode,
        mobile: useMobile, 
        browser: ['Chrome (Linux)', '', ''],
        auth: {
         creds: state.creds,
         keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
      },
	    generateHighQualityLinkPreview: true, // make high preview link
      getMessage: async (key) => {
         let jid = jidNormalizedUser(key.remoteJid)
         let msg = await store.loadMessage(jid, key.id)

         return msg?.message || ""
      },
      msgRetryCounterCache, // Resolve waiting messages
      defaultQueryTimeoutMs: undefined,

    })
    
    store.bind(hisoka.ev)
    
    // anticall auto block
     hisoka.ws.on('CB:call', async (json) => {
        const callerId = json.content[0].attrs['call-creator']
        if (json.content[0].tag == 'offer') {
            hisoka.sendMessage(callerId, { text: `Sistem otomatis block!\nJangan menelpon bot!\nSilahkan Hubungi Owner Untuk Dibuka !`})
            await sleep(8000)
            await hisoka.updateBlockStatus(callerId, "block")
        }
    })

     hisoka.ev.on('messages.upsert', async chatUpdate => {
        //console.log(JSON.stringify(chatUpdate, undefined, 2))
        try {
            mek = chatUpdate.messages[0]
            if (!mek.message) return
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key && mek.key.remoteJid === 'status@broadcast') return
                if (!hisoka.public && !mek.key.fromMe && chatUpdate.type === 'notify') return
                    if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return
                     if (mek.key.id.startsWith('FatihArridho_')) return
                        m = smsg(hisoka, mek, store)
                    require("./farz")(hisoka, m, chatUpdate, store)
                } catch (err) {
                    console.log(err)
                }
            })
            
if (pairingCode && !hisoka.authState.creds.registered) {
      if (useMobile) throw new Error('Cannot use pairing code with mobile api')

      let phoneNumber
      if (!!pairingNumber) {
         phoneNumber = pairingNumber.replace(/[^0-9]/g, '')

         if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
            console.log("Start with your country's WhatsApp code, Example : 62xxx")
            process.exit(0)
         }
      } else {
         phoneNumber = await question(`Please type your WhatsApp number : `)
         phoneNumber = phoneNumber.replace(/[^0-9]/g, '')

         // Ask again when entering the wrong number
         if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
            console.log("Start with your country's WhatsApp code, Example : 62xxx")

            phoneNumber = await question(`Please type your WhatsApp number : `)
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '')
            rl.close()
         }
      }

      setTimeout(async () => {
         let code = await hisoka.requestPairingCode(phoneNumber)
         code = code?.match(/.{1,4}/g)?.join("-") || code
         console.log(`Your Pairing Code : `, code)
      }, 3000)
    }
    
    
    // Group Update
     hisoka.ev.on('groups.update', async pea => {
       //console.log(pea)
    // Get Profile Picture Group
       try {
         ppgc = await hisoka.profilePictureUrl(pea[0].id, 'image')
     } catch {
       ppgc = 'https://telegra.ph/file/c9bbcbec22c0cb81b86ad.jpg'
   }
   let wm_fatih = { url : ppgc }
   if (pea[0].announce == true) {
//        hisoka.send5ButImg(pea[0].id, `「 Group Settings Change 」\n\nGroup telah ditutup oleh admin, Sekarang hanya admin yang dapat mengirim pesan !`, `Group Settings Change Message`, wm_fatih, [])
       hisoka.sendMessage(pea[0].id, { image: { url: ppgc }, caption: `「 Group Settings Change 」\n\nGroup telah ditutup oleh admin, Sekarang hanya admin yang dapat mengirim pesan !\n\nGroup Settings Change Message` })
   } else if(pea[0].announce == false) {
//        hisoka.send5ButImg(pea[0].id, `「 Group Settings Change 」\n\nGroup telah dibuka oleh admin, Sekarang peserta dapat mengirim pesan !`, `Group Settings Change Message`, wm_fatih, [])
    hisoka.sendMessage(pea[0].id, { image: { url: ppgc }, caption: `「 Group Settings Change 」\n\nGroup telah dibuka oleh admin, Sekarang peserta dapat mengirim pesan !\n\nGroup Settings Change Message` })
} else if (pea[0].restrict == true) {
//        hisoka.send5ButImg(pea[0].id, `「 Group Settings Change 」\n\nInfo group telah dibatasi, Sekarang hanya admin yang dapat mengedit info group !`, `Group Settings Change Message`, wm_fatih, [])
    hisoka.sendMessage(pea[0].id, { image: { url: ppgc }, caption: `「 Group Settings Change 」\n\nInfo group telah dibatasi, Sekarang hanya admin yang dapat mengedit info group !\n\nGroup Settings Change Message` })
} else if (pea[0].restrict == false) {
//        hisoka.send5ButImg(pea[0].id, `「 Group Settings Change 」\n\nInfo group telah dibuka, Sekarang peserta dapat mengedit info group !`, `Group Settings Change Message`, wm_fatih, [])
    hisoka.sendMessage(pea[0].id, { image: { url: ppgc }, caption: `「 Group Settings Change 」\n\nInfo group telah dibuka, Sekarang peserta dapat mengedit info group !\n\nGroup Settings Change Message` })
} else {
//        hisoka.send5ButImg(pea[0].id, `「 Group Settings Change 」\n\nGroup Subject telah diganti menjadi *${pea[0].subject}*`, `Group Settings Change Message`, wm_fatih, [])
    hisoka.sendMessage(pea[0].id, { image: { url: ppgc }, caption: `「 Group Settings Change 」\n\nGroup Subject telah diganti menjadi *${pea[0].subject}*\n\nGroup Settings Change Message` })
}
})



     hisoka.ev.on('group-participants.update', async (anu) => {
        console.log(anu)
        try {
            let metadata = await hisoka.groupMetadata(anu.id)
            let participants = anu.participants
            for (let num of participants) {
                // Get Profile Picture User
                try {
                    ppuser = await hisoka.profilePictureUrl(num, 'image')
                } catch {
                    ppuser = 'https://telegra.ph/file/e7ac551bf15f17eb4494c.png'
                }

                // Get Profile Picture Group
                try {
                    ppgroup = await hisoka.profilePictureUrl(anu.id, 'image')
                } catch {
                    ppgroup = 'https://tinyurl.com/yx93l6da'
                }
                const pap = await getBuffer(ppgroup)
                const fkon = {
key: { 
fromMe: false,
participant: `0@s.whatsapp.net`, ...(anu.id ? 
{ remoteJid: "6289643739077-1613049930@g.us" } : {}) 
},
message: { 
"extendedTextMessage": {
 "text":`${metadata.subject}`,
"title": `Hmm`,
 'jpegThumbnail': await hisoka.reSize(pap, 200, 200)
}
} 
}
if (anu.action == 'add') {
          teks = `_*Hallo*_ @${num.split('@')[0]}\n_Welcome to the group_ _*${metadata.subject}*_\n`  
	            buff = await getBuffer(ppuser)
	let d = new Date
       let locale = 'id'
       let gmt = new Date(0).getTime() - new Date('1 January 1970').getTime()
     let weton = ['Pahing', 'Pon','Wage','Kliwon','Legi'][Math.floor(((d * 1) + gmt) / 84600000) % 5]
        let week = d.toLocaleDateString(locale, { weekday: 'long' })
			let date = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
			let waktu = d.toLocaleDateString(locale, { hour: 'numeric', minute: 'numeric', second: 'numeric' })
			const time2 = moment().tz('Asia/Jakarta').format('HH:mm:ss')
	hisoka.sendMessage(metadata.id,{ text: teks, contextInfo: { mentionedJid: [num],externalAdReply:{title: `Today's Date :`,body: `${week}, ${date} || ${time2} WIB`,renderLargerThumbnail: true,showAdAttribution: true, "thumbnailUrl": ppuser, "thumbnail": pap,mediaType:1,mediaUrl: ``, sourceUrl: `http://wa.me/6281239340920?text=.menu`}}})                          
	            } else if (anu.action == 'remove') {
                out = `_User_ @${num.split('@')[0]}\n_*Leave*_ _from group_ _*${metadata.subject}*_\n`
                buff = await getBuffer(ppuser)
                let d = new Date
       let locale = 'id'
       let gmt = new Date(0).getTime() - new Date('1 January 1970').getTime()
     let weton = ['Pahing', 'Pon','Wage','Kliwon','Legi'][Math.floor(((d * 1) + gmt) / 84600000) % 5]
        let week = d.toLocaleDateString(locale, { weekday: 'long' })
			let date = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
			let waktu = d.toLocaleDateString(locale, { hour: 'numeric', minute: 'numeric', second: 'numeric' })
			const time2 = moment().tz('Asia/Jakarta').format('HH:mm:ss')
                hisoka.sendMessage(metadata.id,{ text: out, contextInfo: { mentionedJid: [num],externalAdReply:{title: `Today's Date :`,body: `${week}, ${date} || ${time2} WIB`,renderLargerThumbnail: true, showAdAttribution: true,"thumbnailUrl": ppuser, "thumbnail":pap,mediaType:1,mediaUrl: ``, sourceUrl: `http://wa.me/6281239340920?text=.menu`}}})                          
                } else if (anu.action == 'promote') {
                time_wel = moment.tz('Asia/Jakarta').format("HH:mm")
                fah = `*PROMOTE - DETECTED*\n\n*Name* : @${num.split('@')[0]}\n*Time* : ${moment.tz('Asia/Jakarta').format('DD/MM HH:mm:ss')} WIB\n*Group* : ${metadata.subject}\n\n*Ciee Jadi Atmiin :v*`
                buff = await getBuffer(ppuser)
                hisoka.sendMessage(anu.id,{ text: fah, contextInfo: { mentionedJid: [num],externalAdReply:{title: `Promote Message`,body: ``,renderLargerThumbnail: true, showAdAttribution: true,"thumbnailUrl": ppuser, "thumbnail":pap,mediaType:1,mediaUrl: ``, sourceUrl: `http://wa.me/6281239340920?text=.menu`}}})                                          
                } else if (anu.action == 'demote') {
                time_wel = moment.tz('Asia/Jakarta').format("HH:mm")
                hah = `*DEMOTE - DETECTED*\n\n*Name* : @${num.split('@')[0]}\n*Time* : ${moment.tz('Asia/Jakarta').format('DD/MM HH:mm:ss')}WIB\n*Group* : ${metadata.subject}\n\n*Awokwok Ter Demote :v*`
                buff = await getBuffer(ppuser)
                hisoka.sendMessage(anu.id,{ text: hah, contextInfo: { mentionedJid: [num],externalAdReply:{title: `Demote Message`,body: ``,renderLargerThumbnail: true, showAdAttribution: true,"thumbnailUrl": ppuser, "thumbnail":pap,mediaType:1,mediaUrl: ``, sourceUrl: `http://wa.me/6281239340920?text=.menu`}}})                                          
                
              }
            }
            
        } catch (err) {
            console.log(err)
        }
    })
	
    // Setting
hisoka.decodeJid = (jid) => {
    if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    hisoka.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = hisoka.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
})

    hisoka.getName = (jid, withoutContact  = false) => {
        id = hisoka.decodeJid(jid)
        withoutContact = hisoka.withoutContact || withoutContact 
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = hisoka.groupMetadata(id) || {}
                resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
            else v = id === '0@s.whatsapp.net' ? {
                id,
                name: 'WhatsApp'
            } : id === hisoka.decodeJid(hisoka.user.id) ?
            hisoka.user :
            (store.contacts[id] || {})
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
        }

        hisoka.sendContact = async (jid, kon, quoted = '', opts = {}) => {
	let list = []
	for (let i of kon) {
	    list.push({
	    	displayName: await hisoka.getName(i + '@s.whatsapp.net'),
	    	"vcard": `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:maybe farzོོ🍃\nitem1.TEL;waid=6285931594131:6285931594131\nitem1.X-ABLabel: Creator Bot\nitem2.EMAIL;type=INTERNET:💌 faarz77@gmail.com\nitem2.X-ABLabel:Email\nitem3.URL:🍟 https://instagram.com/faaaarr__\nitem3.X-ABLabel:Instagram\nitem4.ADR:;;🌏 Indonesia;;;;\nitem4.X-ABLabel:Region\nEND:VCARD`
          },
{
            "displayName": 'farz',
            "vcard": `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:maybe farzོོ🍃\nitem1.TEL;waid=62856:\nitem2.EMAIL;type=INTERNET:💌 faarz77@gmail.com\nitem2.X-ABLabel:Email\nitem3.URL:🍟 https://instagram.com/faaaarr__\nitem3.X-ABLabel:Instagram\nitem4.ADR:;;🌏 Indonesia;;;;\nitem4.X-ABLabel:Region\nEND:VCARD`
          },
          
{
            "displayName": 'farz',
            "vcard": `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:http://@ꭙࣼ.farzོོ🍃\nitem1.TEL;waid=445:65\nitem2.EMAIL;type=INTERNET:💌 faarz77@gmail.com\nitem2.X-ABLabel:Email\nitem3.URL:🍟 https://instagram.com/faaaarr__\nitem3.X-ABLabel:Instagram\nitem4.ADR:;;🌏 Indonesia;;;;\nitem4.X-ABLabel:Region\nEND:VCARD`
          },
{
            "displayName": 'mark',
            "vcard": `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:WhatsApp\nitem1.TEL;waid=0:0\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
          })
	}
	hehe = await hisoka.sendMessage(jid, { contacts: { displayName: `${list.length} Kontak`, contacts: list }, ...opts }, { quoted })
	hisoka.sendMessage(jid,{ text : `Nih Kak Contact Owner Ku🐣 `}, {quoted: hehe})
    }
    
     hisoka.setStatus = (status) => {
        hisoka.query({
            tag: 'iq',
            attrs: {
                to: '@s.whatsapp.net',
                type: 'set',
                xmlns: 'status',
            },
            content: [{
                tag: 'status',
                attrs: {},
                content: Buffer.from(status, 'utf-8')
            }]
        })
        return status
    }

    hisoka.public = true

    hisoka.serializeM = (m) => smsg(hisoka, m, store)

    hisoka.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update	    
        if (connection === 'close') {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode
            if (reason === DisconnectReason.badSession) { console.log(`Bad Session File, Please Delete Session and Scan Again`); hisoka.logout(); }
            else if (reason === DisconnectReason.connectionClosed) { console.log("Connection closed, reconnecting...."); startHisoka(); }
            else if (reason === DisconnectReason.connectionLost) { console.log("Connection Lost from Server, reconnecting..."); startHisoka(); }
            else if (reason === DisconnectReason.connectionReplaced) { console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First"); hisoka.logout(); }
            else if (reason === DisconnectReason.loggedOut) { console.log(`Device Logged Out, Please Scan Again And Run.`); hisoka.logout(); }
            else if (reason === DisconnectReason.restartRequired) { console.log("Restart Required, Restarting..."); startHisoka(); }
            else if (reason === DisconnectReason.timedOut) { console.log("Connection TimedOut, Reconnecting..."); startHisoka(); }
            else if (reason === DisconnectReason.Multidevicemismatch) { console.log("Multi device mismatch, please scan again"); hisoka.logout(); }
            else hisoka.end(`Unknown DisconnectReason: ${reason}|${connection}`)
        }
//         else if (connection === 'open') {
//             let lpor = `6289692509996@s.whatsapp.net`
//             hisoka.sendMessage(lpor, { text: `BOT ON`})
//         }
        console.log('Connected...', update)
    })

    await hisoka.ev.on('creds.update', saveCreds)

    // Add Other

    /**
    * 
    * @param {*} jid 
    * @param {*} text 
    * @param {*} salam 
    * @param {*} pushname 
    * @param {*} ownername
    * @param {*} thumbnail 
    * @param {*} myweb 
    * @param {*} quoted 
    * @returns 
    */
    hisoka.sendFakeLink = (jid, text, salam, pushname, ownername, thumbnail, myweb, quoted) => hisoka.sendMessage(jid, {
      text: text,
      contextInfo: {
         "externalAdReply": {
            "title": `${salam} ${pushname}`,
            "body": `© ${ownername}`,
            "previewType": "PHOTO",
            "showAdAttribution": true, 
            "thumbnailUrl": ``,
            "thumbnail": thumbnail,
            "sourceUrl": `${myweb}`
        }
    }
}, {
  quoted
})

      /**
      *
      * @param {*} jid
      * @param {*} url
      * @param {*} caption
      * @param {*} quoted
      * @param {*} options
      */
    hisoka.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
      let mime = '';
      let res = await axios.head(url)
      mime = res.headers['content-type']
      if (mime.split("/")[1] === "gif") {
       return hisoka.sendMessage(jid, { video: await getBuffer(url), caption: caption, gifPlayback: true, ...options}, { quoted: quoted, ...options})
   }
   let type = mime.split("/")[0]+"Message"
   if(mime === "application/pdf"){
       return hisoka.sendMessage(jid, { document: await getBuffer(url), mimetype: 'application/pdf', caption: caption, ...options}, { quoted: quoted, ...options })
   }
   if(mime.split("/")[0] === "image"){
       return hisoka.sendMessage(jid, { image: await getBuffer(url), caption: caption, ...options}, { quoted: quoted, ...options})
   }
   if(mime.split("/")[0] === "video"){
       return hisoka.sendMessage(jid, { video: await getBuffer(url), caption: caption, mimetype: 'video/mp4', ...options}, { quoted: quoted, ...options })
   }
   if(mime.split("/")[0] === "audio"){
       return hisoka.sendMessage(jid, { audio: await getBuffer(url), caption: caption, mimetype: 'audio/mpeg', ...options}, { quoted: quoted, ...options })
   }
}


       // Add Other

      /** Resize Image
      *
      * @param {Buffer} Buffer (Only Image)
      * @param {Numeric} Width
      * @param {Numeric} Height
      */
hisoka.reSize = async (image, width, height) => {
   let jimp = require('jimp')
   var oyy = await jimp.read(image);
   var kiyomasa = await oyy.resize(width, height).getBufferAsync(jimp.MIME_JPEG)
   return kiyomasa
}
      // Siapa yang cita-citanya pakai resize buat keliatan thumbnailnya



    /** Send List Messaage
      *
      *@param {*} jid
      *@param {*} text
      *@param {*} footer
      *@param {*} title
      *@param {*} butText
      *@param [*] sections
      *@param {*} quoted
      */
hisoka.sendListMsg = (jid, text = '', footer = '', title = '' , butText = '', sects = [], quoted) => {
    let sections = sects
    var listMes = {
        text: text,
        footer: footer,
        title: title,
        buttonText: butText,
        sections
    }
    hisoka.sendMessage(jid, listMes, { quoted: quoted })
}

    /** Send Button 5 Message
     * 
     * @param {*} jid
     * @param {*} text
     * @param {*} footer
     * @param {*} button
     * @returns 
     */
hisoka.send5ButMsg = (jid, text = '' , footer = '', but = []) =>{
    let templateButtons = but
    var templateMessage = {
        text: text,
        footer: footer,
        templateButtons: templateButtons
    }
    hisoka.sendMessage(jid, templateMessage)
}

    /** Send Button 5 Image
     *
     * @param {*} jid
     * @param {*} text
     * @param {*} footer
     * @param {*} image
     * @param [*] button
     * @param {*} options
     * @returns
     */
hisoka.send5ButImg = async (jid , text = '' , footer = '', img, but = [], buff, options = {}) =>{
    hisoka.sendMessage(jid, { image: img, caption: text, footer: footer, templateButtons: but, ...options })
}

     /** Send Button 5 Location
       *
       * @param {*} jid
       * @param {*} text
       * @param {*} footer
       * @param {*} location
       * @param [*] button
       * @param {*} options
       */
hisoka.send5ButLoc = async (jid , text = '' , footer = '', lok, but = [], options = {}) =>{
  let bb = await hisoka.reSize(lok, 300, 150)
  hisoka.sendMessage(jid, { location: { jpegThumbnail: bb }, caption: text, footer: footer, templateButtons: but, ...options })
}

    /** Send Button 5 Video
     *
     * @param {*} jid
     * @param {*} text
     * @param {*} footer
     * @param {*} Video
     * @param [*] button
     * @param {*} options
     * @returns
     */
hisoka.send5ButVid = async (jid , text = '' , footer = '', vid, but = [], buff, options = {}) =>{
    let lol = await hisoka.reSize(vid, 300, 150)
    hisoka.sendMessage(jid, { video: vid, jpegThumbnail: lol, caption: text, footer: footer, templateButtons: but, ...options })
}

    /** Send Button 5 Gif
     *
     * @param {*} jid
     * @param {*} text
     * @param {*} footer
     * @param {*} Gif
     * @param [*] button
     * @param {*} options
     * @returns
     */
hisoka.send5ButGif = async (jid , text = '' , footer = '', gif, but = [], buff, options = {}) =>{
    let ahh = await hisoka.reSize(gif, 300, 150)
    let a = [1,2]
    let b = a[Math.floor(Math.random() * a.length)]
    hisoka.sendMessage(jid, { video: gif, gifPlayback: true, gifAttribution: b, caption: text, footer: footer, jpegThumbnail: ahh, templateButtons: but, ...options })
}

    /**
     * 
     * @param {*} jid 
     * @param {*} buttons 
     * @param {*} caption 
     * @param {*} footer 
     * @param {*} quoted 
     * @param {*} options 
     */
hisoka.sendButtonText = (jid, buttons = [], text, footer, quoted = '', options = {}) => {
    let buttonMessage = {
        text,
        footer,
        buttons,
        headerType: 2,
        ...options
    }
    hisoka.sendMessage(jid, buttonMessage, { quoted, ...options })
}

    /**
     * 
     * @param {*} jid 
     * @param {*} text 
     * @param {*} quoted 
     * @param {*} options 
     * @returns 
     */
hisoka.sendText = (jid, text, quoted = '', options) => hisoka.sendMessage(jid, { text: text, ...options }, { quoted, ...options })

    /**
     * 
     * @param {*} jid 
     * @param {*} path 
     * @param {*} caption 
     * @param {*} quoted 
     * @param {*} options 
     * @returns 
     */
hisoka.sendImage = async (jid, path, caption = '', quoted = '', options) => {
	let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
    return await hisoka.sendMessage(jid, { image: buffer, caption: caption, ...options }, { quoted })
}

    /**
     * 
     * @param {*} jid 
     * @param {*} path 
     * @param {*} caption 
     * @param {*} quoted 
     * @param {*} options 
     * @returns 
     */
hisoka.sendVideo = async (jid, path, caption = '', quoted = '', gif = false, options) => {
    let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
    return await hisoka.sendMessage(jid, { video: buffer, caption: caption, gifPlayback: gif, ...options }, { quoted })
}

    /**
     * 
     * @param {*} jid 
     * @param {*} path 
     * @param {*} quoted 
     * @param {*} mime 
     * @param {*} options 
     * @returns 
     */
hisoka.sendAudio = async (jid, path, quoted = '', ptt = false, options) => {
    let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
    return await hisoka.sendMessage(jid, { audio: buffer, ptt: ptt, ...options }, { quoted })
}

    /**
     * 
     * @param {*} jid 
     * @param {*} text 
     * @param {*} quoted 
     * @param {*} options 
     * @returns 
     */
hisoka.sendTextWithMentions = async (jid, text, quoted, options = {}) => hisoka.sendMessage(jid, { text: text, mentions: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net'), ...options }, { quoted })

    /**
     * 
     * @param {*} jid 
     * @param {*} path 
     * @param {*} quoted 
     * @param {*} options 
     * @returns 
     */
hisoka.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
    let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
    let buffer
    if (options && (options.packname || options.author)) {
        buffer = await writeExifImg(buff, options)
    } else {
        buffer = await imageToWebp(buff)
    }

    await hisoka.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted })
    return buffer
}

    /**
     * 
     * @param {*} jid 
     * @param {*} path 
     * @param {*} quoted 
     * @param {*} options 
     * @returns 
     */
hisoka.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
    let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
    let buffer
    if (options && (options.packname || options.author)) {
        buffer = await writeExifVid(buff, options)
    } else {
        buffer = await videoToWebp(buff)
    }

    await hisoka.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted })
    return buffer
}

    /**
     * 
     * @param {*} message 
     * @param {*} filename 
     * @param {*} attachExtension 
     * @returns 
     */
hisoka.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
    let quoted = message.msg ? message.msg : message
    let mime = (message.msg || message).mimetype || ''
    let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
    const stream = await downloadContentFromMessage(quoted, messageType)
    let buffer = Buffer.from([])
    for await(const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
    }
    let type = await FileType.fromBuffer(buffer)
    trueFileName = attachExtension ? (filename + '.' + type.ext) : filename
        // save to file
    await fs.writeFileSync(trueFileName, buffer)
    return trueFileName
}

hisoka.downloadMediaMessage = async (message) => {
    let mime = (message.msg || message).mimetype || ''
    let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
    const stream = await downloadContentFromMessage(message, messageType)
    let buffer = Buffer.from([])
    for await(const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
    }

    return buffer
} 

    /**
     * 
     * @param {*} jid 
     * @param {*} path 
     * @param {*} filename
     * @param {*} caption
     * @param {*} quoted 
     * @param {*} options 
     * @returns 
     */
hisoka.sendMedia = async (jid, path, fileName = '', caption = '', quoted = '', options = {}) => {
    let types = await hisoka.getFile(path, true)
    let { mime, ext, res, data, filename } = types
    if (res && res.status !== 200 || file.length <= 65536) {
       try { throw { json: JSON.parse(file.toString()) } }
       catch (e) { if (e.json) throw e.json }
   }
   let type = '', mimetype = mime, pathFile = filename
   if (options.asDocument) type = 'document'
       if (options.asSticker || /webp/.test(mime)) {
        let { writeExif } = require('./lib/exif')
        let media = { mimetype: mime, data }
        pathFile = await writeExif(media, { packname: options.packname ? options.packname : global.packname, author: options.author ? options.author : global.author, categories: options.categories ? options.categories : [] })
        await fs.promises.unlink(filename)
        type = 'sticker'
        mimetype = 'image/webp'
    }
    else if (/image/.test(mime)) type = 'image'
       else if (/video/.test(mime)) type = 'video'
           else if (/audio/.test(mime)) type = 'audio'
               else type = 'document'
           await hisoka.sendMessage(jid, { [type]: { url: pathFile }, caption, mimetype, fileName, ...options }, { quoted, ...options })
           return fs.promises.unlink(pathFile)
       }

    /**
     * 
     * @param {*} jid 
     * @param {*} message 
     * @param {*} forceForward 
     * @param {*} options 
     * @returns 
     */
       hisoka.copyNForward = async (jid, message, forceForward = false, options = {}) => {
        let vtype
        if (options.readViewOnce) {
           message.message = message.message && message.message.ephemeralMessage && message.message.ephemeralMessage.message ? message.message.ephemeralMessage.message : (message.message || undefined)
           vtype = Object.keys(message.message.viewOnceMessage.message)[0]
           delete(message.message && message.message.ignore ? message.message.ignore : (message.message || undefined))
           delete message.message.viewOnceMessage.message[vtype].viewOnce
           message.message = {
            ...message.message.viewOnceMessage.message
        }
    }

    let mtype = Object.keys(message.message)[0]
    let content = await generateForwardMessageContent(message, forceForward)
    let ctype = Object.keys(content)[0]
    let context = {}
    if (mtype != "conversation") context = message.message[mtype].contextInfo
        content[ctype].contextInfo = {
            ...context,
            ...content[ctype].contextInfo
        }
        const waMessage = await generateWAMessageFromContent(jid, content, options ? {
            ...content[ctype],
            ...options,
            ...(options.contextInfo ? {
                contextInfo: {
                    ...content[ctype].contextInfo,
                    ...options.contextInfo
                }
            } : {})
        } : {})
        await hisoka.relayMessage(jid, waMessage.message, { messageId:  waMessage.key.id })
        return waMessage
    }

    hisoka.cMod = (jid, copy, text = '', sender = hisoka.user.id, options = {}) => {
        //let copy = message.toJSON()
      let mtype = Object.keys(copy.message)[0]
      let isEphemeral = mtype === 'ephemeralMessage'
      if (isEphemeral) {
        mtype = Object.keys(copy.message.ephemeralMessage.message)[0]
    }
    let msg = isEphemeral ? copy.message.ephemeralMessage.message : copy.message
    let content = msg[mtype]
    if (typeof content === 'string') msg[mtype] = text || content
      else if (content.caption) content.caption = text || content.caption
          else if (content.text) content.text = text || content.text
              if (typeof content !== 'string') msg[mtype] = {
               ...content,
               ...options
           }
           if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
              else if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
                  if (copy.key.remoteJid.includes('@s.whatsapp.net')) sender = sender || copy.key.remoteJid
                      else if (copy.key.remoteJid.includes('@broadcast')) sender = sender || copy.key.remoteJid
                          copy.key.remoteJid = jid
                      copy.key.fromMe = sender === hisoka.user.id

                      return proto.WebMessageInfo.fromObject(copy)
                  }


    /**
     * 
     * @param {*} path 
     * @returns 
     */
                  hisoka.getFile = async (PATH, save) => {
                    let res
                    let data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH)) : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0)
        //if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer')
                    let type = await FileType.fromBuffer(data) || {
                        mime: 'application/octet-stream',
                        ext: '.bin'
                    }
                    filename = path.join(__filename, '../src/' + new Date * 1 + '.' + type.ext)
                    if (data && save) fs.promises.writeFile(filename, data)
                        return {
                            res,
                            filename,
                            size: await getSizeMedia(data),
                            ...type,
                            data
                        }

                    }

                    return hisoka
                }

                startHisoka()


                let file = require.resolve(__filename)
                fs.watchFile(file, () => {
                 fs.unwatchFile(file)
                 console.log(chalk.redBright(`Update ${__filename}`))
                 delete require.cache[file]
                 require(file)
             })
