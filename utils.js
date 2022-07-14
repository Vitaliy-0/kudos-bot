export const monthes = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const kudos = {
    'star-struck': 'Качественный продукт',
    'hugging_face': 'Клиентоориентированность',
    'bulb': 'Генератор идей',
    'gem': 'Инициативность',
    'rocket': 'Скорость',
    'handshake': 'Взаимопомощь'
}

const prepareData = (data, year, month, notSliced) => {
    return data.filter(user => user && user.reactions && user.reactions[year] && user.reactions[year][month])
        .sort((user1, user2) => {
            const sum1 = user1 && Object.keys(user1.reactions[year][month]).reduce((acc, item) => { acc += user1.reactions[year][month][item]; return acc }, 0)
            const sum2 = user2 && Object.keys(user2.reactions[year][month]).reduce((acc, item) => { acc += user2.reactions[year][month][item]; return acc }, 0)
            return sum2 - sum1;
        }).slice(0, notSliced ? 1000 : 5)
}

const prepareDataWithReaction = (data, reaction, year, month, notSliced) => {
    return data.filter(user => user && user.reactions && user.reactions[year] && user.reactions[year][month] && user.reactions[year][month][reaction])
    .sort((a, b) => b.reactions[year][month][reaction] - a.reactions[year][month][reaction])
    .slice(0, notSliced ? 1000 : 5)
}

const getReactionsSum = (user, year, month) => Object.keys(user.reactions[year][month]).reduce((acc, item) => { acc += user.reactions[year][month][item]; return acc }, 0)

export const getUsers = async (app) => {
    const users = await app.client.users.list()
    return users.members.filter(user => !user.is_bot);
}

export const transformEmodji = (data) => {
    if (!data) return [];
    return Object.keys(data).map(key => ({
        "text": {
            "type": "plain_text",
            "text": `:${key}: ${data[key]}`,
            "emoji": true
        },
        "value": `:${key}:`
    }))
}

export const transformDataFromDB = (data, reaction, year, month, usersInDB) => {
    if (!reaction) {
        let userIndex = 0;
        const arr = []
        const obj = {
            type: "section",
            fields: arr
        }
            prepareData(data, year, month)
            .map((user, idx) => {
                const sum = getReactionsSum(user, year, month);

                if (usersInDB) {
                    userIndex = prepareData(usersInDB, year, month, true).findIndex(user => user.id === data[0]?.id) + 1
                }
                arr.push({
                    "type": "plain_text",
                    "text": `${usersInDB ? userIndex : idx + 1}. ${user.name} (<@${user.username}>)`,
                    "emoji": true
                });
                arr.push({
                    "type": "plain_text",
                    "text": `Всего - ${sum}        ${Object.keys(user.reactions[year][month]).map(reaction => `:${reaction}: - ${user.reactions[year][month][reaction]}`).join('  ')}`,
                    "emoji": true
                });
            });

        return obj;
    } else {
        let index = 0;
        const arr = []
        const obj = {
            type: "section",
            fields: arr
        }
            prepareDataWithReaction(data, reaction, year, month)
            .map((user, idx) => {

                if (usersInDB) {
                    index = prepareDataWithReaction(usersInDB, reaction, year, month, true)
                        .findIndex(user => user.id === data[0]?.id) + 1
                }

                arr.push({
                    "type": "plain_text",
                    "text": `${usersInDB ? index : idx + 1}. ${user.name} (<@${user.username}>)`,
                    emoji: true
                });
                arr.push({
                    "type": "plain_text",
                    "text": `:${reaction}: ${kudos[reaction]} - ${user.reactions[year][month][reaction]}`,
                    emoji: true
                });

            });
        return obj
    }
}

export const transformDatesToBlocks = (data) => data.map(item => ({
    "text": {
        "type": "plain_text",
        "text": String(item),
        "emoji": true
    },
    "value": String(item)
}));

export const getReactionsCount = (userInDB, reactionsLimit) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = monthes[date.getMonth()];
    const day = date.getDate();

    if (userInDB && userInDB.reactions_added && userInDB.reactions_added[year] && userInDB.reactions_added[year][month] && userInDB.reactions_added[year][month][day]) {
        return reactionsLimit - userInDB.reactions_added[year][month][day]
    } else {
        return 3;
    }
}

export const description = [
    {
        "type": "section",
        "text": {
            "type": "plain_text",
            "text": `Каждый день мы работаем над запуском новых проектов, улучшаем существующие и закрываем десятки задач!
Однако, в потоке рабочей рутины очень важно не упускать позитив и поддерживать друг друга :wink:`,
            "emoji": true
        }
    },
    {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": `Kudos в переводе с английского - *слава, почет, респект*.
Этот бот нужен для того, чтобы делиться *Kudos* со своими коллегами и не забывать отмечать успехи друг друга. Простое "Молодец" или "Отличная работа" может зарядить энергией на весь день! Так давайте делиться этой энергией друг с другом!)`
        }
    },
    {
        type: "section",
        text: {
            type: 'mrkdwn',
            text: `Есть 6 ключевых ценностей компании, по которым можно отправить *Kudos*:
:star-struck:  Качественный продукт
:hugging_face:  Клиентоориентированность
:bulb:  Генератор идей
:gem:  Инициативность
:rocket:  Скорость
:handshake:  Взаимопомощь`
        }
    },
    {
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: `Чтобы отправить Kudos коллеге - просто нажми на кнопку рядом с любым его/ее сообщением: "Другие действия(три точки) > Отправить Kudos".
Помни, что в день можно отправить *не больше 3 Kudos*. Кстати, самому себе Kudos тоже отправить нельзя :upside_down_face:`
        }
    },
    {
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: `Общий рейтинг по всем набранным Kudos можно посмотреть в статистике ниже. Сотрудники, набравшие наибольшее количество Kudos по каждой из шести категорий, по итогам месяца вознаграждаются приятными ценными подарками в виде футболок, сумок, рюкзаков и других плюшек с айдентикой Flawless Group!)
<https://www.figma.com/proto/uPoJQeA9MZXfsgniYsRkfN/flawless_brandbook-(Копия)?node-id=114%3A548&scaling=scale-down-width&page-id=67%3A563|Взгляни здесь>, как может выглядеть наш корпоративный мерч :relaxed:`
        }
    },
    {
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: ':trophy: Желаем каждому побывать на первом месте!)'
        }
    }
];

export const filterUsers = (users) => {
    return users.filter(user => !user.is_bot && user.name !== 'slackbot')
}