const fs = require("fs");
const tmi = require("tmi.js");
const dotenv = require("dotenv");
const Discord = require("discord.js");
const { prefix, rewardId } = require("./config.json");

// Set up Twitch Bot
const twitchClient = new tmi.Client({
  connection: {
    secure: true,
    reconnect: true,
  },
  channels: ["zzzphauxe"],
});

// Connect to Twitch
twitchClient.connect();

// Monitor for game request messages
twitchClient.on("message", (channel, tags, message, self) => {
  if (tags["custom-reward-id"] === rewardId) {
    console.log(`${message} - ${tags["display-name"]}`);
  }
});

// Set up dotenv
dotenv.config();

// Set up discord.js
const discordClient = new Discord.Client();

// Set up events
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if(event.once) {
        discordClient.once(event.name, (...args) => event.execute(...args, discordClient));
    } else {
        discordClient.on(event.name, (...args) => event.execute(...args, discordClient));
    }
}

// Set up commands
discordClient.commands = new Discord.Collection();
const commandFolders = fs.readdirSync("./commands");
for (const folder of commandFolders) {
  const commandFiles = fs
    .readdirSync(`./commands/${folder}`)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const command = require(`./commands/${folder}/${file}`);
    // set a new item in the collection with the key as the command name and the value as the exported module
    discordClient.commands.set(command.name, command);
  }
}

// Cooldowns
discordClient.cooldowns = new Discord.Collection();
const { cooldowns } = discordClient;

// Do things on message
discordClient.on("message", (message) => {

  // check for prefix
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  // truncates command to string
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  // gets relevant command
  const command = discordClient.commands.get(commandName) || discordClient.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

  // if command doesn't exist, quit out
  if (!command) return;

  // check if cd exists
  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Discord.Collection());
  }

  // get current timestamp and set cd
  const now = Date.now();
  const timestamps = cooldowns.get(command.name);
  const cooldownAmount = (command.cooldown || 3) * 1000;

  // if cd is remaining, send message telling remaining cd
  if (timestamps.has(message.author.id)) {
    const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return message.reply(
        `please wait ${timeLeft.toFixed(
          1
        )} more second(s) before reusing the \`${command.name}\` command.`
      );
    }
  }

  // delete cd messages
  timestamps.set(message.author.id, now);
  setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

  // check if command is server only
  if (command.guildOnly && message.channel.type === "dm") {
    return message.reply("I can't execute that command inside DMs!");
  }

  // check for proper permissions
  if (command.permissions) {
      const authorPerms = message.channel.permissionsFor(message.author);
      if (!authorPerms || !authorPerms.has(command.permissions)) {
          return message.reply('You can not do this!');
      }
  }

  // check for arguments if required
  if (command.args && !args.length) {
    let reply = `You didn't provide any arguments, ${message.author}!`;

    if (command.usage) {
      reply += `\nThe proper usage would be: \`${prefix}${command.name} ${command.usage}\``;
    }

    return message.channel.send(reply);
  }

  // attempt to execute the command
  try {
    command.execute(message, args);
  } catch (error) {
    console.error(error);
    message.reply("there was an error trying to execute that command!");
  }
});

// Lets light this candle
discordClient.login(process.env.TOKEN);
