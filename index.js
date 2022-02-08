// Getting data from data base at the beginning of code execution
const fs = require("fs");
var roulette = require("./roulette")
var players = require("./players")
var banlist = require("./banlist")
var stats = require("./stats")
var econ = require("./econ")

// Setting telegram bot
const TelegramApi = require("node-telegram-bot-api")
const token = require("./token");
const bot = new TelegramApi(token, { polling: true })

// Setting up commands
bot.setMyCommands([
    { command: "/play", description: "/play {mode} {bet}" },
    { command: "/about", description: "Player info" },
    { command: "/buy", description: "Buy factory|car|house|painting" },
    { command: "/sell", description: "Sell factory|car|house|painting" },
    { command: "/forbes", description: "Forbes" },
    { command: "/give", description: "Give someone money" },
    { command: "/readme", description: "Gameplay & Updates news" }
])

// Creating these variables to operate easier
const commands = {
    play: "/play",
    buy: "/buy",
    sell: "/sell",
    about: "/about",
    forbes: "/forbes",
    give: "/give",
    readme: "/readme@casino121bot",

    stats: "/stats",
    ban: "/ban@casino121bot"
}
const allCommands = ["/play", "/play@casino121bot", "/buy", "/buy@casino121bot", "/sell", "/sell@casino121bot", "/about", "/about@casino121bot", "/forbes", "/forbes@casino121bot", "/give", "/give@casino121bot", "/readme@casino121bot"]
const devCommands = ["/stats", "/ban@venscoinbot"]





bot.on("message", msg => {
    let text = msg.text
    text = text.toLowerCase()
    let user = msg.from
    let chatId = msg.chat.id
    let msgId = msg.message_id
    let player = null

    // Developer commands
    if (devCommands.includes(text) && user.id == 599100557) {

        if (text.includes(commands.stats)) {
            sendMessage(chatId, `stats: ${stats}`)

        } else if (text.includes(commands.ban)) {

            // Checking if there is replied message
            if (msg.reply_to_message) {

                let userToBan = msg.reply_to_message.from

                // If this user is already banned, then unban him. Otherwise - ban
                if (banlist.includes(userToBan.id)) {
                    banlist.splice(banlist.indexOf(userToBan.id), 1)
                    sendMessage(chatId, `Player <a href="tg://user?id=${msg.reply_to_message.from.id}">${getName(msg.reply_to_message.from)}</a> is free to give money`)
                } else {
                    banlist.push(msg.reply_to_message.from.id)
                    sendMessage(chatId, `Player <a href="tg://user?id=${msg.reply_to_message.from.id}">${getName(msg.reply_to_message.from)}</a> is forbidden to give money`)
                }

                saveData()

            } else {
                sendMessage(chatId, `<a href="tg://user?id=${user.id}">${getName(user)}</a>, please reply that user message, who you wish to ban`)
            }

        }

        deleteMessages(chatId, msgId, true)
        return;
    }

    // Creating a player, otherwise initializing it
    if (allCommands.includes(text) || text.includes(commands.buy) || text.includes(commands.give) || text.includes(commands.play) || text.includes(commands.sell)) {

        // Checking if user or user of replied message is a bot
        if (user.is_bot || (msg.reply_to_message && msg.reply_to_message.from.is_bot)) {
            deleteMessages(chatId, msgId, false)
            return;
        }

        // If everything is okay, then initialize the player
        createPlayer(user)
        player = getPlayer(user.id)

    } else {
        return;
    }

    // Main bot commands
    if (text.includes(commands.buy)) {
        sendMessage(chatId, buy(text, player))

    } else if (text.includes(commands.sell)) {
        sendMessage(chatId, sell(text, player))

    } else if (text.includes(commands.play)) {
        sendMessage(chatId, play(text, player))

    } else if (text.includes(commands.about)) {
        sendMessage(chatId, getUserInfo(msg, player))

    } else if (text.includes(commands.forbes)) {
        sendMessage(chatId, getForbes())

    } else if (text.includes(commands.give)) {

        // It is forbidden to make transaction from twink
        if (banlist.includes(user.id)) {
            sendMessage(chatId, `<a href="tg://user?id=${user.id}">${getName(user)}</a>, you are not allowed to give someone money`)
            deleteMessages(chatId, msgId, true)
            return;
        }

        // If everything is okay, then execute the command
        sendMessage(chatId, give(msg, player))

    } else if (text.includes(commands.readme)) {
        sendMessage(chatId, getReadme())
    }

    // Deleting messages
    if (text.includes(commands.forbes) || text.includes(commands.readme)) {
        deleteMessages(chatId, msgId, true, 60)

    } else if (text.includes(commands.give)) {
        deleteMessages(chatId, msgId, false)

    } else {
        deleteMessages(chatId, msgId, true)
    }

    // Saving data
    stats++
    saveData()
})






// Calculating income every 15 seconds
setInterval(function () {

    for (player of players) {
        player.finance += player.income
    }

}, 15 * 1000)





// This function is simplified form of bot.sendMessage()
function sendMessage(chatId, text) {
    bot.sendMessage(chatId, text, { parse_mode: "HTML" })
}
// This function deletes two messages : the one, which contains command request and the second, which contains its result
// The delay of deleting result message is 30 by default, so if you wish to make some messages disappear a bit later, you can specify this in the end of bot.on("message")
function deleteMessages(chatId, msgId, deleteReply, delay = 30) {
    setTimeout(function () {
        bot.deleteMessage(chatId, msgId)
    }, 1000)
    if (deleteReply) {
        setTimeout(function () {
            bot.deleteMessage(chatId, ++msgId)
        }, delay * 1000)
    }
}
// Function to save data to data bases
function saveData() {
    fs.writeFile("players.json", JSON.stringify(players), err => {
        if (err) throw err;
    });
    fs.writeFile("stats.json", JSON.stringify(stats), err => {
        if (err) throw err;
    });
    fs.writeFile("banlist.json", JSON.stringify(banlist), err => {
        if (err) throw err;
    });
}






function play(text, player) {

    let modes = ["black", "red", "odd", "even", "zero"]

    // Working with text. Checking if the request is correct
    let items = text.split(" ")
    let mode = items[1]
    let bet = items[2]

    // || !parseInt(bet) || !/\d(k|к)/.test(bet) || !/\d{1,3}%/.test(bet) || bet != "all"
    if (items.length != 3 || !modes.includes(mode)) {
        return `<a href="tg://user?id=${player.id}">${player.name}</a>, incorrect request. Correct request example:\n<code>${commands.play} red 1000</code>`
    }

    // Initializing bet, converting it to an integer
    if (bet === "all") {
        bet = player.finance
    } else if (/\d+(k|к)/.test(bet)) {
        bet = parseInt(/\d+/.exec(bet)[0]) * 1000
    } else if (/\d{1,3}%/.test(bet)) {
        bet = (parseInt(/\d+/.exec(bet)[0]) / 100) * player.finance
    } else if (/\d+/.test(bet)) {
        bet = parseInt(/\d+/.exec(bet)[0])
    } else {
        return `<a href="tg://user?id=${player.id}">${player.name}</a>, incorrect request. Correct request example:\n<code>${commands.play} red 1000</code>`
    }

    // Checking if player has these money
    if (player.finance < bet && player.finance >= 1) {
        return `<a href="tg://user?id=${player.id}">${player.name}</a>, you don't have ${priceLayout(bet)}\n>Finance: ${priceLayout(player.finance)}`
    } else if (player.finance < 1) {
        return `<a href="tg://user?id=${player.id}">${player.name}</a>, you don't have any money to bet`
    }

    // Checking sum of the initial bet
    if (bet < econ.initialBet) {
        return `<a href="tg://user?id=${player.id}">${player.name}</a>, initial bet is ${priceLayout(econ.initialBet)}`
    }

    // Spinning the roulette and calculating the result
    let spinResult = roulette[random(0, roulette.length)]
    let result = false

    if (["black", "red"].includes(mode) && mode === spinResult.color) {
        result = true
    } else if (mode === "odd" && isOdd(spinResult.value)) {
        result = true
    } else if (mode === "even" && isEven(spinResult.value)) {
        result = true
    } else if (mode === "zero" && spinResult.color === "green") {
        result = true
    }

    let color = null

    if (spinResult.color === "red") {
        color = "🔴"
    } else if (spinResult.color === "black") {
        color = "⚫️"
    } else if (spinResult.color === "green") {
        color = "🟢"
    }

    // Win or loose message

    // Economics of the casino is such, that creator earns with players looses and pays their wins
    let creator = getPlayer(econ.creatorId)

    if (result) {
        let win = spinResult.value === 0 ? bet * 35 : bet
        player.finance += win
        creator.finance -= bet
        return `${color} ${spinResult.value} - <a href="tg://user?id=${player.id}">${player.name}</a>\n>You have won ${priceLayout(win)}\n>Finance: ${priceLayout(player.finance)}`
    } else {
        player.finance -= bet
        creator.finance += bet
        return `${color} ${spinResult.value} - <a href="tg://user?id=${player.id}">${player.name}</a>\n>You have lost ${priceLayout(bet)}\n>Finance: ${priceLayout(player.finance)}`
    }
}





// Function to buy factory|car...
function buy(text, player) {

    // Setting up default price and what is avaiable to buy
    let purchases = ["car", "factory", "house", "painting"]

    // Working with text. Checking if the request is correct
    let items = text.split(" ")
    let param = items[1]

    if (!purchases.includes(param) || items.length != 2) {
        return `<a href="tg://user?id=${player.id}">${player.name}</a>, incorrect request. Correct request example:\n<code>${commands.buy} car</code> || <code>${commands.buy} factory</code> || <code>${commands.buy} house</code> || <code>${commands.buy} painting</code>`
    }

    // Some exclusions: if user doen't have much money or any money at all
    if (econ.price > player.finance && player.finance >= 1) {
        return `<a href="tg://user?id=${player.id}">${player.name}</a>, you don't have ${priceLayout(econ.price)} to buy a ${param}\n>Finance: ${priceLayout(player.finance)}`
    } else if (player.finance < 1) {
        return `<a href="tg://user?id=${player.id}">${player.name}</a>, you don't have any money to buy a ${param}`
    }

    // Operating purchase
    player.finance -= econ.price

    switch (param) {
        case "car":
            player.car++
            param += "🚘"
            break
        case "factory":
            player.factory++
            player.income += econ.incomeGrowth
            param += "🏭\n>Income has been increased"
            break
        case "house":
            player.house++
            param += "🏡"
            break
        case "painting":
            player.painting++
            param += "🖼"
            break
    }

    return `<a href="tg://user?id=${player.id}">${player.name}</a> buys a ${param}\n>Finance: ${priceLayout(player.finance)}\n${player.factory}🏭 ${player.house}🏡 ${player.painting}🖼 ${player.car}🚘`
}




// Function to sell factory|car...
function sell(text, player) {

    // Setting up default price and what is avaiable to buy
    let sale = ["car", "factory", "house", "painting"]

    // Working with text. Checking if the request is correct
    let items = text.split(" ")
    let param = items[1]

    if (!sale.includes(param) || items.length != 2) {
        return `<a href="tg://user?id=${player.id}">${player.name}</a>, incorrect request. Correct request example:\n<code>${commands.sell} car</code> || <code>${commands.sell} factory</code> || <code>${commands.sell} house</code> || <code>${commands.sell} painting</code>`
    }

    // Some exclusions: if user doen't have much money or any money at all
    if (!doesPlayerHas(param, player)) {
        return `<a href="tg://user?id=${player.id}">${player.name}</a>, you don't have any ${param}\n${player.factory}🏭 ${player.house}🏡 ${player.painting}🖼 ${player.car}🚘`
    }

    // Operating purchase
    player.finance += econ.price

    switch (param) {
        case "car":
            player.car--
            param += "🚘"
            break
        case "factory":
            player.factory--
            param += "🏭\n>Income has been decreased"
            player.income -= econ.incomeGrowth
            break
        case "house":
            player.house--
            param += "🏡"
            break
        case "painting":
            player.painting--
            param += "🖼"
            break
    }

    return `<a href="tg://user?id=${player.id}">${player.name}</a> sells a ${param}\n>Finance: ${priceLayout(player.finance)}\n${player.factory}🏭 ${player.house}🏡 ${player.painting}🖼 ${player.car}🚘`
}
// Function to check if user has factory|car...
function doesPlayerHas(param, player) {

    switch (param) {
        case "car":
            if (player.car >= 1) {
                return true
            }
            break
        case "factory":
            if (player.factory >= 1) {
                return true
            }
            break
        case "house":
            if (player.house >= 1) {
                return true
            }
            break
        case "painting":
            if (player.painting >= 1) {
                return true
            }
            break
    }

    return false
}






// Function to give some player your finance
function give(msg, giver) {

    // text, repliedMsg, giver
    let text = msg.text
    let repliedMsg = msg.reply_to_message

    // Exclusions if there is no replied message or someone is a bot
    if (!repliedMsg) {
        return `<a href="tg://user?id=${giver.id}">${giver.name}</a>, please reply that user message, who you wish to give some money`

    } else if (msg.reply_to_message.from.is_bot || msg.from.is_bot) {
        return `<a href="tg://user?id=${giver.id}">${giver.name}</a>, transaction is declined`
    }

    // If replied message is sent by user, which is not a player yet, then create a new player before giving him money
    createPlayer(repliedMsg.from)
    let recipient = getPlayer(repliedMsg.from.id)


    let param = null

    // Working with text and checking if the request is correct
    if (/\/give(@casino121bot)? +\d{0,3}%/.test(text)) {
        param = (parseInt(/\d+/.exec(text)[0]) / 100) * giver.finance
    } else if (/\/give(@casino121bot)? +\d+k|к/.test(text) && !text.includes("%")) {
        param = parseInt(/\d+/.exec(text)[0]) * 1000
    } else if (/\/give(@casino121bot)? +\d+/.test(text)) {
        param = parseInt(/\d+/.exec(text)[0])
    } else if (text === "/give all" || text === "/give@casino121bot all") {
        param = giver.finance
    } else {
        return `<a href="tg://user?id=${giver.id}">${giver.name}</a>, incorrect request. Correct request example:\n<code>${commands.give} 1000</code> || <code>${commands.give} 10k</code> || <code>${commands.give} 10%</code> || <code>${commands.give} all</code>`
    }

    // Some exclusions 
    if (param > giver.finance && giver.finance >= 1) {
        return `<a href="tg://user?id=${giver.id}">${giver.name}</a>, wow, you are so generous! The problem is you don't have ${priceLayout(param)}. Your finances are ${priceLayout(giver.finance)} only`

    } else if (giver.finance < 1) {
        return `<a href="tg://user?id=${giver.id}">${giver.name}</a>, well, this is good deed, buy you don't have any money`
    }

    // If everything is okay, then calculate transaction, but first calculate comission
    giver.finance -= param
    recipient.finance += param

    return `<a href="tg://user?id=${giver.id}">${giver.name}</a>, you've supported <a href="tg://user?id=${recipient.id}">${recipient.name}</a> with ${priceLayout(param)}`
}





// Function which returns string object of top-10 players by capital
function getForbes() {

    // Copying players to calculate their capital
    let playersCopy = []

    for (player of players) {
        let playerCopy = {
            name: player.name,
            capital: player.finance + (player.factory + player.car + player.house + player.painting) * econ.price
        }
        playersCopy.push(playerCopy)
    }

    // Sorting players by capital
    playersCopy.sort(function (a, b) {
        if (a.capital < b.capital) {
            return 1;
        }
        if (a.capital > b.capital) {
            return -1;
        }
        return 0;
    });

    // Writing output 
    let reply = "<code>"
    for (let i = 0; i < 10; i++) {
        if (playersCopy[i]) {
            reply += `${priceLayout(playersCopy[i].capital)} - ${playersCopy[i].name}\n`
        }
    }
    reply += "</code>"

    return reply
}
// Function to get player position in Forbes
function getForbesPosition(playerId) {

    let playersCopy = []

    for (player of players) {
        let playerCopy = {
            id: player.id,
            name: player.name,
            capital: player.finance + (player.factory + player.car + player.house + player.painting) * econ.price
        }
        playersCopy.push(playerCopy)
    }

    // Sorting players by capital
    playersCopy.sort(function (a, b) {
        if (a.capital < b.capital) {
            return 1;
        }
        if (a.capital > b.capital) {
            return -1;
        }
        return 0;
    });

    // Determing position
    for (let i = 0; i < playersCopy.length; i++) {
        if (playersCopy[i].id === playerId) {
            return i + 1
        }
    }
}






// Function to get readme text
function getReadme() {
    return `<a href="https://telegra.ph/casino121-01-25">Gameplay & Update news</a>`
}






// Function to create player
function createPlayer(user) {

    // Checking if this player already exists. If true, then the new player is not created
    if (isUserPlayer(user.id)) {
        return;
    }

    // Creating new player object
    let newPlayer = {
        id: user.id,
        name: getName(user),
        finance: 50000,
        income: 50,
        factory: 0,
        car: 0,
        house: 0,
        painting: 0
    }

    // Pushing new player to array of players
    players.push(newPlayer)
}
// Function which finds player by userId and returns it
function getPlayer(userId) {
    for (player of players) {
        if (player.id == userId) {
            return player;
        }
    }
}
// Function to check whether user with this id is already a player
function isUserPlayer(userId) {
    for (player of players) {
        if (player.id == userId) {
            return true;
        }
    }
    return false;
}
// Function which returns player info in string format for output
function getUserInfo(msg, player) {

    // If you wish to see info about other user, then reply his message and call /about command
    if (msg.reply_to_message) {
        createPlayer(msg.reply_to_message.from)
        player = getPlayer(msg.reply_to_message.from.id)
    }

    return `<a href="tg://user?id=${player.id}">${player.name}</a>\nFinance: ${priceLayout(player.finance)}\nIncome: ${priceLayout(player.income)}\nForbes: ${getForbesPosition(player.id)} of ${players.length}\n${player.factory}🏭 ${player.house}🏡 ${player.painting}🖼 ${player.car}🚘`;
}





// Function to layout price output, so 1000 will output as $1,000
function priceLayout(price) {

    // Some operations with price to make it array by string symbols
    price = Math.floor(price)
    price = price.toString()
    price = price.split("")

    // The layouted price first will be written as symbols array and secondly as string to output
    let newPriceArray = []
    let newPriceString = ""

    // Creating layouted price with comas as symbols array
    for (let i = 0; i < price.length; i++) {
        if (i % 3 == 0 && i != 0) {
            newPriceArray.unshift(",")
        }
        newPriceArray.unshift(price[price.length - 1 - i])
    }

    // Converting symbol array of layouted price to simple string
    for (symbol of newPriceArray) {
        newPriceString += symbol
    }

    // Returning price with dollar sign
    return `$${newPriceString}`
}
// Function to get user name. It is used it createPlayer() function
function getName(user) {

    // Checking if first_name and last_name are set by user
    // If user has no name, then his player name is initialized as "Player"
    if (user.first_name && user.last_name) {
        return `${user.first_name} ${user.last_name}`

    } else if (user.first_name) {
        return `${user.first_name}`

    } else if (user.last_name) {
        return `${user.last_name}`

    } else {
        return `Player`;
    }
}
// Function to make Math.floor() simplier
function int(param) {
    return Math.floor(param)
}
// Function to make random() simplier
function random(min, range) {
    return int(Math.random() * range + min)
}
// Functions to check if a number is odd or even
function isOdd(param) {
    return param % 2 === 1
}
function isEven(param) {
    return param % 2 === 0
}