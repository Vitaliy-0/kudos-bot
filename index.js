import dotenv from 'dotenv'
import mongoose from 'mongoose';
import pkg from '@slack/bolt';
import {
    getUsers,
    transformEmodji,
    transformDataFromDB2,
    monthes,
    transformDatesToBlocks,
    getReactionsCount,
    kudos,
    description,
    filterUsers,
    getDataHead,
    getKudosCount,
    getAdminBlock,
    getInfoAboutUser,
    getSum,
    getSendKudosData
} from './utils.js';
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
let notification = {};

for (let i = 2022; i <= new Date().getFullYear(); i++) {
    years.push(i)
}

(async () => {
    await app.start({ port: process.env.PORT || '8080' });
    console.log('Slack app started!');
})();

(async function main() {
    try {
        await mongoose.connect(`mongodb://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_HOST}/${process.env.MONGODB_DB}`);
        console.log('connected to mongodb');
    } catch (err) {
        console.error(err)
    }
})();

app.event('app_home_opened', async ({ client, event }) => {
    try {
        const date = new Date();
        const year = date.getFullYear();
        const month = monthes[date.getMonth()];
        const emodji = transformEmodji(kudos);

        const isAdmin = await client.users.info({ user: event.user });

        const User = mongoose.model('User', userSchema);
        const userInDB = await User.findOne({ id: event.user });
        const count = getReactionsCount(userInDB, reactionsLimit);

        const newYears = transformDatesToBlocks(years);
        const newMonthes = transformDatesToBlocks(monthes);
        const adminBlocks = getAdminBlock(isAdmin.user.is_admin)

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
                            "text": `Количество оставшихся Kudos, которые ты можешь отправить сегодня: ${count}`,
                            "emoji": true
                        }
                    },
                    ...description(),
                    {
                        type: "divider"
                    },
                    {
                        "type": "actions",
                        "elements": isAdmin.user.is_admin ? [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Рейтинг по всем Kudos",
                                    "emoji": true
                                },
                                "value": event.user,
                                "action_id": "generate_report"
                            },
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Отправленные kudos",
                                    "emoji": true
                                },
                                "action_id": "sended_kudos"
                            }
                        ] : [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Рейтинг по всем Kudos",
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
                                    "text": "Выберите kudos",
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
                    },
                    ...adminBlocks
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

        const reactionName = selected && selected.text.text.split(' ')[0].split(':')[1];
        const usersList = await client.users.list();
        const user = usersList.members.find(man => man.id === action.value);
        const adminBlocks = getAdminBlock(user.is_admin)

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
                                "text": `Количество оставшихся Kudos, которые ты можешь отправить сегодня: ${count}`,
                                "emoji": true
                            }
                        },
                        ...description(),
                        {
                            type: "divider"
                        },
                        {
                            "type": "actions",
                            "elements": user.is_admin ? [
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "text": "Рейтинг по всем Kudos",
                                        "emoji": true
                                    },
                                    "value": action.value,
                                    "action_id": "generate_report"
                                },
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "text": "Отправленные kudos",
                                        "emoji": true
                                    },
                                    "action_id": "sended_kudos"
                                }
                            ] : [
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "text": "Рейтинг по всем Kudos",
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
                                        "text": "Выберите kudos",
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
                        },
                        ...adminBlocks
                    ]
                }
            });
            return
        };

        const blocks = transformDataFromDB2(usersInDB, reactionName, year?.value || year, month?.value || month, false, user.is_admin);
        const userData = transformDataFromDB2([userInDB], reactionName, year?.value || year, month?.value || month, usersInDB, user.is_admin)

        const shownInfo = blocks[0]?.fields?.length > 1 ? [
            ...blocks,
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
            ...(userData?.length && !userData[0]?.fields || (userData?.length && userData[0]?.fields?.length) ? userData : [{
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Похоже, Вам не присылали Kudos в этом месяце. Однако, никогда не поздно это исправить! ;)",
                    "emoji": true
                }
            }])
        ] : [
            {
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Рейтинг еще не сформирован. Отправьте первый Kudos, чтобы начать!)",
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
                            "text": `Количество оставшихся Kudos, которые ты можешь отправить сегодня: ${count}`,
                            "emoji": true
                        }
                    },
                    ...description(),
                    {
                        type: "divider"
                    },
                    {
                        "type": "actions",
                        "elements": user.is_admin ? [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Рейтинг по всем Kudos",
                                    "emoji": true
                                },
                                "value": action.value,
                                "action_id": "generate_report"
                            },
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Отправленные kudos",
                                    "emoji": true
                                },
                                "action_id": "sended_kudos"
                            }
                        ] : [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Рейтинг по всем Kudos",
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
                                    "text": "Выберите kudos",
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
                    ...adminBlocks,
                    {
                        "type": "divider"
                    },
                    getDataHead(user.is_admin),
                    ...shownInfo,
                    getKudosCount(user.is_admin, usersInDB, year?.value || year, month?.value || month, reactionName)
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

        const user = await client.users.info({ user: action.value });
        const users = await client.users.list();

        const User = mongoose.model('User', userSchema);
        const usersInDB = await User.find();
        const userInDB = await User.findOne({ id: action.value });
        const count = getReactionsCount(userInDB, reactionsLimit);

        const blocks = transformDataFromDB2(usersInDB, false, year, month, false, user.user.is_admin, users.members);
        const userData = transformDataFromDB2([userInDB], false, year, month, usersInDB, false);
        const adminBlocks = getAdminBlock(user.user.is_admin)

        const shownInfo = blocks[0]?.fields?.length > 1 ? [
            ...blocks,
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
            ...(userData?.length && !userData[0]?.fields || (userData?.length && userData[0]?.fields?.length) ? userData : [{
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Похоже, Вам не присылали Kudos в этом месяце. Однако, никогда не поздно это исправить! ;)",
                    "emoji": true
                }
            }])
        ] : [
            {
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Рейтинг еще не сформирован. Отправьте первый Kudos, чтобы начать!)",
                    "emoji": true
                }
            }]

        const kudosCount = getKudosCount(user.user.is_admin, usersInDB, year, month)

        const dataHead = getDataHead(user.user.is_admin);

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
                            "text": `Количество оставшихся Kudos, которые ты можешь отправить сегодня: ${count}`,
                            "emoji": true
                        }
                    },
                    ...description(),
                    {
                        type: "divider"
                    },
                    {
                        "type": "actions",
                        "elements": user.user.is_admin ? [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Рейтинг по всем Kudos",
                                    "emoji": true
                                },
                                "value": action.value,
                                "action_id": "generate_report"
                            },
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Отправленные kudos",
                                    "emoji": true
                                },
                                "action_id": "sended_kudos"
                            }
                        ] : [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Рейтинг по всем Kudos",
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
                                    "text": "Выберите kudos",
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
                    ...adminBlocks,
                    {
                        "type": "divider"
                    },
                    dataHead,
                    ...shownInfo,
                    kudosCount
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

app.action('user_info_year', async ({ ack }) => {
    try {
        await ack();
    } catch (e) {
        console.error(e);
    }
});

app.action('user_select_action', async ({ ack }) => {
    try {
        await ack();
    } catch (e) {
        console.error(e);
    }
});

app.action('user_info_month', async ({ ack }) => {
    try {
        await ack();
    } catch (e) {
        console.error(e);
    }
});

app.action('get_user_info', async ({ ack, body, client }) => {
    try {
        await ack();

        const selectedUser = body.view.state.values['user_emoji_info']['user_select_action']['selected_user'];
        const selectedYear = body.view.state.values['select_action']['compliment_year_select']['selected_option'] || new Date().getFullYear();
        const selectedMonth = body.view.state.values['select_action']['compliment_month_select']['selected_option'] || monthes[new Date().getMonth()];
        const emoji = transformEmodji(kudos);

        const newYears = transformDatesToBlocks(years);
        const newMonthes = transformDatesToBlocks(monthes);

        const usersList = await client.users.list();
        const admin = usersList.members.find(mem => mem.id === body.user.id)

        if (!selectedUser || !selectedYear || !selectedMonth) {
            return;
        }

        const User = mongoose.model('User', userSchema);
        const userInDB = await User.findOne({ id: selectedUser });

        const adminBlocks = getAdminBlock(admin.is_admin);
        const count = getReactionsCount(userInDB, reactionsLimit);

        const data = getInfoAboutUser(userInDB, usersList.members, selectedYear?.value || selectedYear, selectedMonth?.value || selectedMonth, admin.is_admin)
        const kudosCount = () => {
            if (userInDB && userInDB?.reactions && userInDB.reactions[selectedYear?.value || selectedYear] && userInDB.reactions[selectedYear?.value || selectedYear][selectedMonth?.value || selectedMonth]) {
                return Object.keys(userInDB.reactions[selectedYear?.value || selectedYear][selectedMonth?.value || selectedMonth])
                    .reduce((acc, key) => {
                        if (key === 'U03N4J0P12S') return acc;
                        acc += getSum(userInDB.reactions[selectedYear?.value || selectedYear][selectedMonth?.value || selectedMonth][key]);
                        return acc;
                    }, 0)
            }
            return 0;
        }

        await client.views.publish({
            user_id: body.user.id,
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
                            "text": `Количество оставшихся Kudos, которые ты можешь отправить сегодня: ${count}`,
                            "emoji": true
                        }
                    },
                    ...description(),
                    {
                        type: "divider"
                    },
                    {
                        "type": "actions",
                        "elements": admin.is_admin ? [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Рейтинг по всем Kudos",
                                    "emoji": true
                                },
                                "value": body.user.id,
                                "action_id": "generate_report"
                            },
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Отправленные kudos",
                                    "emoji": true
                                },
                                "action_id": "sended_kudos"
                            }
                        ] : [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Рейтинг по всем Kudos",
                                    "emoji": true
                                },
                                "value": body.user.id,
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
                                    "text": "Выберите kudos",
                                    "emoji": true
                                },
                                "options": emoji,
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
                                "initial_option": selectedYear.value ? selectedYear : {
                                    "value": String(selectedYear),
                                    "text": {
                                        "type": "plain_text",
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
                                "initial_option": selectedMonth.value ? selectedMonth : {
                                    "value": String(selectedMonth),
                                    "text": {
                                        "type": "plain_text",
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
                                "value": body.user.id,
                                "action_id": "actionId-0"
                            }
                        ]
                    },
                    ...adminBlocks,
                    ...(!data[0]?.fields?.length ? {
                        type: 'section',
                        text: {
                            type: 'plain_text',
                            text: 'Информации об полученных Kudos к сожалению не найдено'
                        }
                    } : data),
                    admin.is_admin && data[0]?.fields?.length ? {
                        type: 'section',
                        text: {
                            type: 'plain_text',
                            text: `Всего kudos: ${kudosCount()}`
                        }
                    } : {
                        type: 'divider'
                    }
                ]
            }
        })

    } catch (e) {
        console.error(e);
    }
});

app.action('sended_kudos', async ({ ack, client, body }) => {
    try {
        await ack();
        const date = new Date();
        const year = date.getFullYear();
        const month = monthes[date.getMonth()];
        const isAdmin = await client.users.info({ user: body.user.id });
        const users = await client.users.list();

        const User = mongoose.model('User', userSchema);
        const userInDB = await User.findOne({ id: body.user.id });
        const usersInDB = await User.find();
        const emodji = transformEmodji(kudos);
        const count = getReactionsCount(userInDB, reactionsLimit);
        const adminBlocks = getAdminBlock(isAdmin.user.is_admin);
        const newYears = transformDatesToBlocks(years);
        const newMonthes = transformDatesToBlocks(monthes);
        const data = getSendKudosData(usersInDB, year, month, users.members);

        await client.views.publish({
            user_id: body.user.id,
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
                            "text": `Количество оставшихся Kudos, которые ты можешь отправить сегодня: ${count}`,
                            "emoji": true
                        }
                    },
                    ...description(),
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
                                    "text": "Рейтинг по всем Kudos",
                                    "emoji": true
                                },
                                "value": body.user.id,
                                "action_id": "generate_report"
                            },
                            isAdmin.user.is_admin ? {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Отправленные kudos",
                                    "emoji": true
                                },
                                "action_id": "sended_kudos"
                            } : {}
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
                                    "text": "Выберите kudos",
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
                                "value": body.user.id,
                                "action_id": "actionId-0"
                            }
                        ]
                    },
                    ...adminBlocks,
                    ...(!data[0].fields.length ? [{
                        type: 'section',
                        text: {
                            type: 'plain_text',
                            text: 'Информации об отправленных kudos за этот месяц не найдено'
                        }
                    }] : data)
                ]
            }
        })
    } catch (e) {
        console.error(e);
    }
});

app.shortcut('compliment_added', async ({ ack, shortcut, client, body }) => {
    try {
        await ack();
        const random = Math.floor(Math.random() * 10000);

        const emoji = transformEmodji(kudos).filter(el => el.value !== ':all:');

        await client.views.open({
            trigger_id: body.trigger_id,
            view: {
                "external_id": `${shortcut.message.user} ${shortcut.channel.id} ${random}`,
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
                                "text": "Выберите kudos",
                                "emoji": true
                            },
                            "options": emoji,
                            "action_id": "static_select-action"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Kudos",
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
    } catch (e) {
        console.error(e)
    }
});

app.view('shortcut_compliment_callback', async ({ ack, client, payload, body }) => {
    try {
        await ack();

        const user_for_nomination = payload.external_id && payload.external_id?.split(' ')[0];
        const shortcut_channel = payload.external_id && payload.external_id?.split(' ')[1];

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
            await client.chat[reactionChannel ? 'postEphemeral' : 'postMessage']({
                user: body.user.id,
                channel: reactionChannel ? shortcut_channel : body.user.id,
                text: "Нельзя отправить Kudos самому себе 🙃"
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
                            [day]: {
                                [user.id]: {
                                    [emojiFormatted]: 1
                                }
                            }
                        }
                    }
                }
            });
            await newUser.save();
        } else {
            // если комплименты есть сегодня и их количество 3 тогда запрещать и уведомлять
            if (eventUser?.reactions_added && eventUser?.reactions_added[year] && eventUser?.reactions_added[year][month] && eventUser?.reactions_added[year][month][day] && Object.keys(eventUser?.reactions_added[year][month][day]).reduce((acc, key) => { acc += getSum(eventUser?.reactions_added[year][month][day][key]); return acc }, 0) >= reactionsLimit) {
                await client.chat[reactionChannel ? 'postEphemeral' : 'postMessage']({
                    user: body.user.id,
                    channel: reactionChannel ? shortcut_channel : body.user.id,
                    text: 'Похоже, вы уже отправили 3 Kudos за сегодня. Следующие Kudos можно будет отправить только завтра :wink:'
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
                            [day]: {
                                ...(eventUser.reactions_added && eventUser.reactions_added[year] && eventUser.reactions_added[year][month] && eventUser.reactions_added[year][month][day] && eventUser.reactions_added[year][month][day] || {}),
                                [user.id]: {
                                    ...(eventUser.reactions_added && eventUser.reactions_added[year] && eventUser.reactions_added[year][month] && eventUser.reactions_added[year][month][day] && eventUser.reactions_added[year][month][day][user.id] || {}),
                                    [emojiFormatted]: eventUser.reactions_added && eventUser.reactions_added[year] && eventUser.reactions_added[year][month] && eventUser.reactions_added[year][month][day] && eventUser.reactions_added[year][month][day][user.id] && eventUser.reactions_added[year][month][day][user.id][emojiFormatted] ? eventUser.reactions_added[year][month][day][user.id][emojiFormatted] + 1 : 1
                                }
                            }
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
                            [body.user.id]: {
                                [emojiFormatted]: 1
                            }
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
                            [body.user.id]: {
                                ...(userInDB.reactions && userInDB.reactions[year] && userInDB.reactions[year][month] && userInDB.reactions[year][month][body.user.id] || {}),
                                [emojiFormatted]: userInDB.reactions && userInDB.reactions[year] && userInDB.reactions[year][month] && userInDB.reactions[year][month][body.user.id] && userInDB.reactions[year][month][body.user.id][emojiFormatted] + 1 || 1
                            }
                        }
                    }
                }
            }
            await userInDB.updateOne(update)
        }

        const count = eventUser?.reactions_added && eventUser?.reactions_added[year] && eventUser?.reactions_added[year][month] && eventUser?.reactions_added[year][month][day] && Object.keys(eventUser?.reactions_added[year][month][day])
            .reduce((acc, key) => {
                acc += getSum(eventUser?.reactions_added[year][month][day][key])
                return acc;
            }, 0);

        const num = count ? reactionsLimit - count - 1 : 2
        await client.chat[reactionChannel ? 'postEphemeral' : 'postMessage']({
            user: body.user.id,
            channel: reactionChannel ? shortcut_channel : body.user.id,
            text: num > 0 ? `:raised_hands: Kudos успешно отправлен пользователю <@${user_for_nomination}>, спасибо за поддержку! Кол-во оставшихся Kudos на сегодня - ${num}` : `:raised_hands: Kudos успешно отправлен пользователю <@${user_for_nomination}>, спасибо за поддержку! Сегодня вы разослали все имеющиеся Kudos, отличная работа! :white_check_mark:`
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
    const dayNumber = date.getDay();

    if (hours === 13 && notification?.today !== day && dayNumber !== 6 && dayNumber !== 0) {
        notification = {
            today: day
        }

        try {
            const users = await app.client.users.list();
            const filteredUsers = filterUsers(users.members);

            const User = mongoose.model('User', userSchema);
            const usersInDB = await User.find();

            filteredUsers.map(async (item) => {
                const user = usersInDB.find(el => el.id === item.id);
                if (user) {
                    const reactionAddedCount = user.reactions_added && user.reactions_added[year] && user.reactions_added[year][month] && user.reactions_added[year][month][day] && Object.keys(user.reactions_added[year][month][day]).reduce((acc, id) => { acc += getSum(user.reactions_added[year][month][day][id]); return acc}, 0);
                    if (reactionAddedCount === 3) return;
                    await app.client.chat.postMessage({
                        channel: user.id,
                        user: user.id,
                        text: `У тебя осталось ${reactionAddedCount ? reactionsLimit - reactionAddedCount : 3} не отправленных Kudas за сегодня! Успей порадовать коллег - отправь Kudos прямо сейчас! :tada:`
                    });
                } else {
                    await app.client.chat.postMessage({
                        channel: item.id,
                        user: item.id,
                        text: `У тебя осталось 3 не отправленных Kudos за сегодня! Успей порадовать коллег - отправь Kudos прямо сейчас! :tada:`
                    });
                }
            });
        } catch (e) {
            console.error(e)
        }
    }
}

setInterval(() => {
    trigger();
}, 1000 * 60 * 5)