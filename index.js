import dotenv from 'dotenv'
import mongoose from 'mongoose';
import pkg from '@slack/bolt';
import { getUsers, transformEmodji, transformDataFromDB, monthes, transformDatesToBlocks, getReactionsCount, kudos, description, filterUsers } from './utils.js';
import { userSchema } from './schemas/User.js';
dotenv.config();

const { App } = pkg;

const app = new App({
    token: process.env.BOT_TOKEN,
    signingSecret: process.env.SIGNING_SECRET,
    appToken: process.env.APP_TOKEN
});

const reactionsLimit = 3;
const years = [];
let shortcut_channel = '';
let user_for_nomination = '';
let notification = {};

for (let i = 2022; i <= new Date().getFullYear(); i++) {
    years.push(i)
}

(async () => {
    await app.start({ port: '8080' });
    console.log('Slack app started!')
})();

(async function main() {
    try {
        await mongoose.connect(`mongodb://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_HOST}/${process.env.MONGODB_DB}`);
        console.log('connected to mongodb');
    } catch (err) {
        console.error(err)
    }
})();

app.event('app_home_opened', async ({ client, event, body }) => {
    try {
        const date = new Date();
        const year = date.getFullYear();
        const month = monthes[date.getMonth()];
        
        const emodji = transformEmodji(kudos);

        const User = mongoose.model('User', userSchema);
        const userInDB = await User.findOne({ id: event.user });
        const count = getReactionsCount(userInDB, reactionsLimit);

        const newYears = transformDatesToBlocks(years);
        const newMonthes = transformDatesToBlocks(monthes);

        await client.views.publish({
            user_id: event.user,
            view: {
                "type": "home",
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": "Flawless Team bot :tada:",
                            "emoji": true
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "plain_text",
                            "text": `Количество оставшихся Kudas, которые ты можешь отправить сегодня: ${count}`,
                            "emoji": true
                        }
                    },
                    ...description,
                    {
                        type: "divider"
                    },
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Рейтинг по всем Kudas",
                                    "emoji": true
                                },
                                "value": event.user,
                                "action_id": "generate_report"
                            }
                        ]
                    },
                    {
                        "type": "divider"
                    },
                    {
                        "block_id": "select_action",
                        "type": "actions",
                        "elements": [
                            {
                                "type": "static_select",
                                "placeholder": {
                                    "type": "plain_text",
                                    "text": "Выберите kudas",
                                    "emoji": true
                                },
                                "options": emodji,
                                "action_id": "compliment_actionId-0"
                            },
                            {
                                "type": "static_select",
                                "placeholder": {
                                    "type": "plain_text",
                                    "text": "Выберите год",
                                    "emoji": true
                                },
                                "options": newYears,
                                "action_id": "compliment_year_select",
                                "initial_option": {
                                    "value": String(year),
                                    "text": {
                                        "type": "plain_text",
                                        "text": String(year)
                                    }
                                }
                            },
                            {
                                "type": "static_select",
                                "placeholder": {
                                    "type": "plain_text",
                                    "text": "Выберите месяц",
                                    "emoji": true
                                },
                                "options": newMonthes,
                                "action_id": "compliment_month_select",
                                "initial_option": {
                                    "value": String(month),
                                    "text": {
                                        "type": "plain_text",
                                        "text": String(month)
                                    }
                                }
                            },
                        ]
                    },
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Посмотреть рейтинг",
                                    "emoji": true
                                },
                                "value": event.user,
                                "action_id": "actionId-0"
                            }
                        ]
                    }
                ]
            }
        })
    } catch (e) {
        console.error(e);
    }
});

app.action('actionId-0', async ({ ack, client, body, action }) => {
    try {
        await ack();

        const date = new Date();
        const newYears = transformDatesToBlocks(years);
        const newMonthes = transformDatesToBlocks(monthes);
        const emodji = transformEmodji(kudos);
        const selected = body.view.state.values['select_action']['compliment_actionId-0']['selected_option'];
        const year = body.view.state.values['select_action']['compliment_year_select']['selected_option'] || String(date.getFullYear());
        const month = body.view.state.values['select_action']['compliment_month_select']['selected_option'] || String(monthes[date.getMonth()]);

        const User = mongoose.model('User', userSchema);
        const usersInDB = await User.find();
        const userInDB = await User.findOne({ id: action.value });
        const count = getReactionsCount(userInDB, reactionsLimit);

        const reactionName = selected && selected.text.text.split(' ')[0].split(':')[1]

        if (!selected || !year || !month) {
            await client.views.publish({
                user_id: action.value,
                view: {
                    "type": "home",
                    "blocks": [
                        {
                            "type": "header",
                            "text": {
                                "type": "plain_text",
                                "text": "Flawless Team bot :tada:",
                                "emoji": true
                            }
                        },

                        {
                            "type": "section",
                            "text": {
                                "type": "plain_text",
                                "text": `Количество оставшихся Kudas, которые ты можешь отправить сегодня: ${count}`,
                                "emoji": true
                            }
                        },
                        ...description,
                        {
                            type: "divider"
                        },
                        {
                            "type": "actions",
                            "elements": [
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "text": "Рейтинг по всем Kudas",
                                        "emoji": true
                                    },
                                    "value": action.value,
                                    "action_id": "generate_report"
                                }
                            ]
                        },
                        {
                            "type": "divider"
                        },
                        {
                            "block_id": "select_action",
                            "type": "actions",
                            "elements": [
                                {
                                    "type": "static_select",
                                    "placeholder": {
                                        "type": "plain_text",
                                        "text": "Выберите kudas",
                                        "emoji": true
                                    },
                                    "options": emodji,
                                    "action_id": "compliment_actionId-0"
                                },
                                {
                                    "type": "static_select",
                                    "placeholder": {
                                        "type": "plain_text",
                                        "text": "Выберите год",
                                        "emoji": true
                                    },
                                    "options": newYears,
                                    "action_id": "compliment_year_select",
                                    "initial_option": year.value ? year : {
                                        "value": String(year),
                                        "text": {
                                            "type": "plain_text",
                                            "text": String(year)
                                        }
                                    }
                                },
                                {
                                    "type": "static_select",
                                    "placeholder": {
                                        "type": "plain_text",
                                        "text": "Выберите месяц",
                                        "emoji": true
                                    },
                                    "options": newMonthes,
                                    "action_id": "compliment_month_select",
                                    "initial_option": month?.value ? month : {
                                        "value": String(month),
                                        "text": {
                                            "type": "plain_text",
                                            "text": String(month)
                                        }
                                    }
                                },
                            ]
                        },
                        {
                            "type": "actions",
                            "elements": [
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "text": "Посмотреть рейтинг",
                                        "emoji": true
                                    },
                                    "value": action.value,
                                    "action_id": "actionId-0"
                                }
                            ]
                        },
                        {
                            "type": "context",
                            "elements": [
                                {
                                    "type": "mrkdwn",
                                    "text": ":face_with_head_bandage: Сначала выберите все параметры"
                                }
                            ]
                        }
                    ]
                }
            });
            return
        };

        const blocks = transformDataFromDB(usersInDB, reactionName, year?.value || year, month?.value || month);
        const userData = transformDataFromDB([userInDB], reactionName, year?.value || year, month?.value || month, usersInDB)

        const shownInfo = blocks.fields.length ? [
            blocks,
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Ваше место в рейтинге"
                }
            },
            userData.fields.length ? userData : {
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Похоже, Вам не присылали Kudos в этом месяце. Однако, никогда не поздно это исправить! ;)",
                    "emoji": true
                }
            }
        ] : [
            {
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Рейтинг еще не сформирован. Отправьте первый Kudas, чтобы начать!)",
                    "emoji": true
                }
            }];

        await client.views.publish({
            user_id: action.value,
            view: {
                "type": "home",
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": "Flawless Team bot :tada:",
                            "emoji": true
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "plain_text",
                            "text": `Количество оставшихся Kudas, которые ты можешь отправить сегодня: ${count}`,
                            "emoji": true
                        }
                    },
                    ...description,
                    {
                        type: "divider"
                    },
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Рейтинг по всем Kudas",
                                    "emoji": true
                                },
                                "value": action.value,
                                "action_id": "generate_report"
                            }
                        ]
                    },
                    {
                        "type": "divider"
                    },
                    {
                        "block_id": "select_action",
                        "type": "actions",
                        "elements": [
                            {
                                "type": "static_select",
                                "placeholder": {
                                    "type": "plain_text",
                                    "text": "Выберите kudas",
                                    "emoji": true
                                },
                                "options": emodji,
                                "action_id": "compliment_actionId-0"
                            },
                            {
                                "type": "static_select",
                                "placeholder": {
                                    "type": "plain_text",
                                    "text": "Выберите год",
                                    "emoji": true
                                },
                                "options": newYears,
                                "action_id": "compliment_year_select",
                                "initial_option": year.value ? year : {
                                    "value": String(year),
                                    "text": {
                                        "type": "plain_text",
                                        "text": String(year)
                                    }
                                }
                            },
                            {
                                "type": "static_select",
                                "placeholder": {
                                    "type": "plain_text",
                                    "text": "Выберите месяц",
                                    "emoji": true
                                },
                                "options": newMonthes,
                                "action_id": "compliment_month_select",
                                "initial_option": month?.value ? month : {
                                    "value": String(month),
                                    "text": {
                                        "type": "plain_text",
                                        "text": String(month)
                                    }
                                }
                            },
                        ]
                    },
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Посмотреть рейтинг",
                                    "emoji": true
                                },
                                "value": action.value,
                                "action_id": "actionId-0"
                            }
                        ]
                    },
                    {
                        "type": "divider"
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "plain_text",
                            "text": "ТОП 5"
                        }
                    },
                    ...shownInfo
                ]
            }
        })
    } catch (e) {
        console.error(e);
    }
});

app.action('generate_report', async ({ ack, client, body, action }) => {
    try {
        await ack();
        const date = new Date();
        const year = date.getFullYear();
        const month = monthes[date.getMonth()];

        const newYears = transformDatesToBlocks(years);
        const newMonthes = transformDatesToBlocks(monthes);
        const emodji = transformEmodji(kudos);

        const selectedYear = body.view.state.values['select_action']['compliment_year_select']['selected_option'] || year;
        const selectedMonth = body.view.state.values['select_action']['compliment_month_select']['selected_option'] || month;

        const User = mongoose.model('User', userSchema);
        const usersInDB = await User.find();
        const userInDB = await User.findOne({ id: action.value });
        const count = getReactionsCount(userInDB, reactionsLimit);

        const blocks = transformDataFromDB(usersInDB, false, year, month);
        const userData = transformDataFromDB([userInDB], false, year, month, usersInDB);

        const shownInfo = blocks.fields.length ? [
            blocks,
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Ваше место в рейтинге"
                }
            },
            userData.fields.length ? userData : {
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Похоже, Вам не присылали Kudos в этом месяце. Однако, никогда не поздно это исправить! ;)",
                    "emoji": true
                }
            }
        ] : [
            {
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Рейтинг еще не сформирован. Отправьте первый Kudas, чтобы начать!)",
                    "emoji": true
                }
            }];

        await client.views.publish({
            user_id: action.value,
            view: {
                "type": "home",
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": "Flawless Team bot :tada:",
                            "emoji": true
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "plain_text",
                            "text": `Количество оставшихся Kudas, которые ты можешь отправить сегодня: ${count}`,
                            "emoji": true
                        }
                    },
                    ...description,
                    {
                        type: "divider"
                    }, 
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Рейтинг по всем Kudas",
                                    "emoji": true
                                },
                                "value": action.value,
                                "action_id": "generate_report"
                            }
                        ]
                    },
                    {
                        "type": "divider"
                    },
                    {
                        "block_id": "select_action",
                        "type": "actions",
                        "elements": [
                            {
                                "type": "static_select",
                                "placeholder": {
                                    "type": "plain_text",
                                    "text": "Выберите kudas",
                                    "emoji": true
                                },
                                "options": emodji,
                                "action_id": "compliment_actionId-0"
                            },
                            {
                                "type": "static_select",
                                "placeholder": {
                                    "type": "plain_text",
                                    "text": "Выберите год",
                                    "emoji": true
                                },
                                "options": newYears,
                                "action_id": "compliment_year_select",
                                "initial_option": selectedYear?.value ? selectedYear : {
                                    "value": String(selectedYear),
                                    "text": {
                                        "type": "text_plain",
                                        "text": String(selectedYear)
                                    }
                                }
                            },
                            {
                                "type": "static_select",
                                "placeholder": {
                                    "type": "plain_text",
                                    "text": "Выберите месяц",
                                    "emoji": true
                                },
                                "options": newMonthes,
                                "action_id": "compliment_month_select",
                                "initial_option": selectedMonth?.value ? selectedMonth : {
                                    "value": String(selectedMonth),
                                    "text": {
                                        "type": "text_plain",
                                        "text": String(selectedMonth)
                                    }
                                }
                            },
                        ]
                    },
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Посмотреть рейтинг",
                                    "emoji": true
                                },
                                "value": action.value,
                                "action_id": "actionId-0"
                            }
                        ]
                    },
                    {
                        "type": "divider"
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "plain_text",
                            "text": "ТОП 5",
                            emoji: true
                        }
                    },
                    ...shownInfo
                ]
            }
        })
    } catch (e) {
        console.error(e)
    }
});

app.action('compliment_actionId-0', async ({ ack }) => {
    try {
        await ack();
    } catch (e) {
        console.error(e)
    }
});

app.action('compliment_year_select', async ({ ack }) => {
    try {
        await ack();
    } catch (e) {
        console.error(e)
    }
});

app.action('compliment_month_select', async ({ ack }) => {
    try {
        await ack();
    } catch (e) {
        console.error(e)
    }
});

app.shortcut('compliment_added', async ({ ack, shortcut, client, body }) => {
    try {
        await ack();

        const emoji = transformEmodji(kudos);

        await client.views.open({
            trigger_id: body.trigger_id,
            view: {
                "callback_id": "shortcut_compliment_callback",
                "type": "modal",
                "title": {
                    "type": "plain_text",
                    "text": "Flawless Team",
                    "emoji": true
                },
                "submit": {
                    "type": "plain_text",
                    "text": "Поставить",
                    "emoji": true
                },
                "close": {
                    "type": "plain_text",
                    "text": "Отмена",
                    "emoji": true
                },
                "blocks": [
                    {
                        "block_id": "compliments_select_in_modal",
                        "type": "input",
                        "element": {
                            "type": "static_select",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Выберите kudas",
                                "emoji": true
                            },
                            "options": emoji,
                            "action_id": "static_select-action"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Kudas",
                            "emoji": true
                        }
                    },
                    {
                        "block_id": "user_comment",
                        "type": "input",
                        "optional": true,
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "user_comment_action",
                            "multiline": true,
                            "max_length": 100,
                            "min_length": 0
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Комментарий",
                            "emoji": true
                        }
                    }
                ]
            }
        });

        shortcut_channel = shortcut.channel.id;
        user_for_nomination = shortcut.message.user;
    } catch (e) {
        console.error(e)
    }
});

app.view('shortcut_compliment_callback', async ({ ack, client, payload, body }) => {
    try {
        await ack();
        const users = await getUsers(app);
        const date = new Date();
        const emoji = payload.state.values['compliments_select_in_modal']['static_select-action']['selected_option'];
        const comment = payload.state.values['user_comment']['user_comment_action']['value']
        const channels = await client.conversations.list({ types: 'public_channel, private_channel, im, mpim' })
        const reactionChannel = channels.channels.find(channel => channel.id === shortcut_channel);
        const onWhoClick = users.find(el => el.id === user_for_nomination);

        const emojiFormatted = emoji.value.split(':')[1]

        // если реакция не из собственных, тогда ничего не делать
        if (!onWhoClick) {
            return;
        }

        if (user_for_nomination === body.user.id) {
            await client.chat.postEphemeral({
                user: body.user.id,
                channel: reactionChannel ? shortcut_channel : body.user.id,
                text: "Нельзя отправить Kudos самому себе🙃"
            })
            return;
        }

        const year = date.getFullYear();
        const month = monthes[date.getMonth()];
        const day = date.getDate();

        const User = mongoose.model('User', userSchema);
        const userInDB = await User.findOne({ id: user_for_nomination });
        const user = users.find(item => item.id === user_for_nomination);

        const eventUser = await User.findOne({ id: body.user.id });
        const eventUserInfo = users.find(item => item.id === body.user.id);

        if (!eventUser) {
            const newUser = new User({
                id: eventUserInfo.id,
                name: eventUserInfo.real_name,
                username: eventUserInfo.name,
                reactions: {},
                reactions_added: {
                    [year]: {
                        [month]: {
                            [day]: 1
                        }
                    }
                }
            });
            await newUser.save();
        } else {
            // если комплименты есть сегодня и их количество 3 тогда запрещать и уведомлять
            if (eventUser?.reactions_added && eventUser?.reactions_added[year] && eventUser?.reactions_added[year][month] && eventUser?.reactions_added[year][month][day] >= reactionsLimit) {
                await client.chat.postEphemeral({
                    user: body.user.id,
                    channel: reactionChannel ? shortcut_channel : body.user.id,
                    text: 'Похоже, вы уже отправили 3 Kudas за сегодня. Следующие Kudas можно будет отправить только завтра :wink:'
                })
                return;
            }
            const update = {
                reactions_added: {
                    ...eventUser.reactions_added,
                    [year]: {
                        ...(eventUser.reactions_added && eventUser.reactions_added[year] || {}),
                        [month]: {
                            ...(eventUser.reactions_added && eventUser.reactions_added[year] && eventUser.reactions_added[year][month] || {}),
                            [day]: eventUser.reactions_added && eventUser.reactions_added[year] && eventUser.reactions_added[year][month] && eventUser.reactions_added[year][month][day] ? eventUser.reactions_added[year][month][day] + 1 : 1
                        }
                    }
                }
            }
            await eventUser.updateOne(update)
        }

        if (!userInDB) {
            const newUser = new User({
                id: user.id,
                name: user.real_name,
                username: user.name,
                reactions: {
                    [year]: {
                        [month]: {
                            [emojiFormatted]: 1
                        }
                    }
                },
                reactions_added: {}
            });
            await newUser.save();
        } else {
            const update = {
                reactions: {
                    ...(userInDB.reactions || {}),
                    [year]: {
                        ...(userInDB.reactions && userInDB.reactions[year] || {}),
                        [month]: {
                            ...(userInDB.reactions && userInDB.reactions[year] && userInDB.reactions[year][month] || {}),
                            [emojiFormatted]: userInDB.reactions && userInDB.reactions[year] && userInDB.reactions[year][month] && userInDB.reactions[year][month][emojiFormatted] && userInDB.reactions[year][month][emojiFormatted] + 1 || 1
                        }
                    }
                }
            }
            await userInDB.updateOne(update)
        }

        const count = eventUser?.reactions_added && eventUser?.reactions_added[year] && eventUser?.reactions_added[year][month] && eventUser?.reactions_added[year][month][day];
        const num = count ? reactionsLimit - count - 1 : 2
        await client.chat.postEphemeral({
            user: body.user.id,
            channel: reactionChannel ? shortcut_channel : body.user.id,
            text: num > 0 ? `:raised_hands: Kudas успешно отправлен, спасибо за поддержку! Кол-во оставшихся Kudos на сегодня - ${num}` : `:raised_hands: Kudas успешно отправлен, спасибо за поддержку! Сегодня вы разослали все имеющиеся Kudas, отличная работа! :white_check_mark:`
        });
        await client.chat.postMessage({
            user: user_for_nomination,
            channel: user_for_nomination,
            text: comment ? `:sports_medal: Поздравляем! Вы получили Kudos "${emoji.text.text}" от <@${eventUserInfo.name}>. Комментарий:
_${comment}_` : `:sports_medal: Поздравляем! Вы получили Kudos "${emoji.text.text}" от <@${eventUserInfo.name}>.`
        })
    } catch (e) {
        console.error(e)
    }
});

async function trigger() {
    const date = new Date();

    const hours = date.getHours();
    const year = date.getFullYear();
    const month = monthes[date.getMonth()];
    const day = date.getDate();

    if (hours === 16 && notification?.day !== day) {
        notification = {
            day
        }

        try {
            const users = await app.client.users.list();
            const filteredUsers = filterUsers(users.members);

            const User = mongoose.model('User', userSchema);
            const usersInDB = await User.find();

            filteredUsers.map(async (item) => {
                const user = usersInDB.find(el => el.id === item.id);

                if (user) {
                    if (user.reactions_added && user.reactions_added[year] && user.reactions_added[year][month] && user.reactions_added[year][month][day] < 3) {
                        await app.client.chat.postMessage({
                            channel: user.id,
                            user: user.id,
                            text: `У тебя осталось ${reactionsLimit - user.reactions_added[year][month][day]} не отправленных Kudas за сегодня! Успей порадовать коллег - отправь Kudos прямо сейчас! :tada:`
                        });
                    } else {
                        await app.client.chat.postMessage({
                            channel: user.id,
                            user: user.id,
                            text: `У тебя осталось ${user.reactions_added && user.reactions_added[year] && user.reactions_added[year][month] && user.reactions_added[year][month][day] ? reactionsLimit - user.reactions_added[year][month][day] : 3} не отправленных Kudas за сегодня! Успей порадовать коллег - отправь Kudos прямо сейчас! :tada:`
                        });
                    }
                } else {
                    await app.client.chat.postMessage({
                        channel: item.id,
                        user: item.id,
                        text: `У тебя осталось 3 не отправленных Kudas за сегодня! Успей порадовать коллег - отправь Kudos прямо сейчас! :tada:`
                    });
                }
            });
        } catch (e) {
            console.error(e)
        }
    }
}

setInterval(() => {
    trigger()
}, 1000 * 60 * 60 * 10);