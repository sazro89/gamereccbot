module.exports = {
    name: 'role',
    args: true,
    usage: '<user> <role>',
    execute(message, args) {
        message.channel.send(`You want to give ${args[0]} the ${args[1]} role.`)
    },
};