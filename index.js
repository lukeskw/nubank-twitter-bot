//module imports
require('dotenv').config();

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twit = require('twit');
const moment = require('moment');

admin.initializeApp();

//db connection -> tweet has tweet_id and profile_id
const dbRef = admin.firestore().doc('tweets/tweet');

//bot instance
const Bot = new twit({
    consumer_key: process.env.API_KEY,
    consumer_secret: process.env.API_SECRET_KEY,
    access_token: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,

    timeout_ms: 60 * 2000,
});

//array of bot phrases
const randomArray = ['Não.', 'Ainda não.', 'Não!', 'Negativo.', 'Aparentemente não.', 'Ao que tudo indica, não!', 'Nada confirmado.'];

//this function runs every 12h displaying a random phrase on the logged account timeline.
exports.scheduledFunction = functions.pubsub.schedule('0 */12 * * *').timeZone('America/Sao_Paulo').onRun(() => {
    //exports.tweet = functions.https.onRequest((request, resp) => { //for testing purposes only

    Bot.get('statuses/user_timeline', {}, (err, data, response) => {
        if (err) {
            functions.logger.log('O bot não conseguiu tweetar', err);
        } else {
            t = [];
            //twitter api does not allow 2 tweets with the same message; getting last 2 tweets
            for (let i = 0; i < 2; i++) {
                functions.logger.log(i)
                t.push(data[i].text)
            }
            //removing the last 2 phrases from the phrase array
            randomArray = randomArray.filter(val => !t.includes(val));
            const random = randomArray[Math.floor(Math.random() * randomArray.length)];

            Bot.post('statuses/update', { status: random }, (err, data, response) => {
                if (err) {
                    functions.logger.log('O bot não conseguiu tweetar', err);
                } else {
                    functions.logger.log(response);
                }
            })
        }
    })
    return null;
});

//this function runs every 2h, if last post date is greater than 3 days or if it's saved on the db, do nothing, else reply with a random phrase;
exports.scheduledFunction2 = functions.pubsub.schedule('0 */3 * * *').timeZone('America/Sao_Paulo').onRun(async() => {
    //('0 */2 * * *') every 2h
    // exports.comment = functions.https.onRequest(async(request, resp) => { //for testing purposes only

    //query to search the user id

    // Bot.get('users/search', { q: 'Nubank' }, async(err, data, response) => {
    //     if (err) {
    //         functions.logger.log('O bot não conseguiu encontrar o perfil', err);
    //     } else {
    //         const profile_id = data[0].id_str;
    //         // resp.send(data)
    //         await dbRef.set({ profile_id: profile_id, tweet_id: 0 });
    //         //1517373074236137473
    //         Bot.get('statuses/user_timeline', { user_id: profile_id, include_rts: true, exclude_replies: false }, async(err, data, response) => {
    //             if (err) {
    //                 functions.logger.log('O bot não conseguiu encontrar a timeline deste user', err);
    //             } else {
    //                 if (data.length === 0) {
    //                     resp.send(data)
    //                 }
    //                 resp.send(data);
    //             }
    //         })
    //     }
    // });

    //fetching data from db
    const dbSnapshot = await dbRef.get();

    const profile_id = dbSnapshot.data().profile_id;

    const dbtweet_id = dbSnapshot.data().tweet_id;

    //search for the last tweet from the stored user and stores on the firestore db
    Bot.get('statuses/user_timeline', { user_id: profile_id, include_rts: false, exclude_replies: true }, async(err, data) => {
        if (err) {
            functions.logger.log('O bot não conseguiu encontrar a timeline deste user', err);
            return null;
        }

        if (data.length === 0) {
            functions.logger.log('A timeline deste user só possui retweets ou replies', data);
            return null;
            //resp.send('1')
        } else {

            const createdAt = moment(data[0].created_at);

            const start = moment().subtract(3, 'days');
            const end = new Date();
            const betweenDate = moment(createdAt).isBetween(start, end);

            //if tweet date >= 3 days
            if (!betweenDate) {
                functions.logger.log('Ultimo tweet tem mais de 3 dias!');
                return null; //resp.send('2');
            }

            const lastTweetId = data[0].id_str

            const username = data[0].user.screen_name

            //if last tweet is already saved
            if (lastTweetId === dbtweet_id) {
                functions.logger.log('Ultimo tweet já está salvo no banco!');
                return null; //resp.send('1');
            } else {
                //getting the last tweet
                Bot.get(`statuses/show/${lastTweetId}`, { user_id: profile_id, includeinclude_rts: false, exclude_replies: true }, async(err, data) => {
                    if (err) {
                        functions.logger.log('O bot não conseguiu encontrar este tweet', err);
                    } else {
                        //randomizing phrase
                        const random = randomArray[Math.floor(Math.random() * randomArray.length)];

                        //posting the reply
                        Bot.post('statuses/update', { status: `@${username} ${random}`, in_reply_to_status_id: lastTweetId, auto_populate_reply_metadata: true }, async(err, data) => {
                            if (err) {
                                functions.logger.log('O bot não conseguiu tweetar', err);
                            } else {
                                await dbRef.set({ profile_id: profile_id, tweet_id: lastTweetId });
                                functions.logger.log(data);
                                //resp.send(data);
                            }
                        })
                    }
                });
            }
        }
    })
    return null;
});