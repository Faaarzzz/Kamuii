const fs = require('fs')
const chalk = require('chalk')

// Website Api
global.APIs = {
	zenz: 'https://zenzapis.xyz',
}

// Apikey Website Api
global.APIKeys = {
	'https://zenzapis.xyz': 'sanzychan01',
}

// Other
global.owner = ['6285692949920','6285931594131','', "" , "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]
global.premium = ['6285692949920']
global.packname = 'Λsuna Bot'
global.author = '@faaaarr__'
global.sessionName = 'farz'
global.prefa = ['','!','.','🐦','🐤','🗿']
global.sp = '⭔'
global.mess = {
    success: '[ √ ] 𝚂𝚞𝚌𝚌𝚎𝚜𝚜...~',
admin: 'This command can only be used by Admin',
botAdmin: 'Maaf! Command ini khusus untuk Bot ketika jadi admin!!',
owner: 'This command can only be used by Owner',
group: 'Maaf! Command ini khusus untuk di dalam Group saja',
private: '_Fitur Digunakan Hanya Untuk Private Chat!_',
bot: '_Fitur Khusus Pengguna Nomor Bot_',
wait: '_⏰ Wait A Minute..._',
error: '_Fitur Sedang Error!_',
endLimit: '_Limit Harian Anda Telah Habis, Limit Akan Direset Setiap Jam 12_',
}
global.limitawal = {
    premium: "Infinity",
    free: 100
}
global.thumb = fs.readFileSync('./lib/hisoka.jpg')
global.visoka = { url: 'https://a.uguu.se/rdCQlYnt.mp4' }

let file = require.resolve(__filename)
fs.watchFile(file, () => {
	fs.unwatchFile(file)
	console.log(chalk.redBright(`Update'${__filename}'`))
	delete require.cache[file]
	require(file)
})
