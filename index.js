const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twit = require('twit');
require('dotenv').config();
admin.initializeApp();

const Bot = new twit({
    consumer_key: process.env.API_KEY,
    consumer_secret: process.env.API_SECRET_KEY,
    access_token: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,

    timeout_ms: 60 * 2000,
});

exports.scheduledFunction = functions.pubsub.schedule('0 */12 * * *').timeZone('America/Sao_Paulo').onRun(() => {

    randomArray = ['Não.', 'Ainda não.', 'Não!', 'Negativo.', 'Aparentemente não.', 'Ao que tudo indica, não!', 'Nada confirmado.'];

    const random = randomArray[Math.floor(Math.random() * randomArray.length)];

    Bot.post('statuses/update', { status: random }, (err, data, response) => {
        if (err) {
            functions.logger.log('O bot não conseguiu tweetar', err);
        } else {
            functions.logger.log(response);
        }
    })
    return null;
});