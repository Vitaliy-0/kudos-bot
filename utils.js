export const monthes = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const kudos = {
    'all': 'Все',
    'star-struck': 'Качественный продукт',
    'hugging_face': 'Клиентоориентированность',
    'bulb': 'Генератор идей',
    'gem': 'Инициативность',
    'rocket': 'Скорость',
    'handshake': 'Взаимопомощь'
}

export const getSum = (item) => {
    return Object.keys(item).reduce((sum, key) => {
        sum += item[key]
        return sum
    }, 0);
}

const prepareData = (data, year, month, notSliced) => {

    return data.filter(user => user && user?.reactions && user?.reactions[year] && user?.reactions[year][month])
        .sort((user1, user2) => {
        const sum1 = user1 && Object.keys(user1.reactions[year][month]).reduce((acc, userId) => {
            acc += getSum(user1.reactions[year][month][userId]) 
            return acc;
        }, 0);
        const sum2 = user2 && Object.keys(user2.reactions[year][month]).reduce((acc, userId) => {
            acc += getSum(user2.reactions[year][month][userId]);
            return acc;
        }, 0);
        return sum2 - sum1;
    }).slice(0, notSliced ? 1000 : 5)
}

const prepareDataWithReaction = (data, reaction, year, month, notSliced) => {
    return data.filter(user => {
        if (user?.reactions && user?.reactions[year] && user?.reactions[year][month]) {
            const isReaction = Object.keys(user?.reactions[year][month])
                .some(key => Object.keys(user?.reactions[year][month][key]).includes(reaction))
            if (isReaction) {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    })
    .sort((user1, user2) => {
        const sum1 = user1 && Object.keys(user1.reactions[year][month]).reduce((acc, userId) => {
            acc += user1.reactions[year][month][userId][reaction] || 0
            return acc;
        }, 0)
        const sum2 = user2 && Object.keys(user2.reactions[year][month]).reduce((acc, userId) => {
            acc += user2.reactions[year][month][userId][reaction] || 0
            return acc;
        }, 0)
        return sum2 - sum1;
    }).slice(0, notSliced ? 1000 : 5)
}

const getReactionsSum = (user, year, month) => {
    if (!user || !user.reactions || !user?.reactions[year] || !user?.reactions[year][month]) {
        return 0;
    }
    return Object.keys(user.reactions[year][month]).reduce((acc, key) => {
        acc += getSum(user.reactions[year][month][key]);
        return acc;
    }, 0)
}

export const getUsers = async (app) => {
    const users = await app.client.users.list()
    return users.members.filter(user => !user.is_bot);
}

export const transformEmodji = (data) => {
    if (!data) return [];
    return Object.keys(data).map(key => ({
        "text": {
            "type": "plain_text",
            "text": key === 'all' ? data[key] : `:${key}: ${data[key]}`,
            "emoji": true
        },
        "value": `:${key}:`
    }))
}

export const transformDataFromDB2 = (data, reaction, year, month, usersInDB, notSlice = false) => {
    if (!reaction) {
        let userIndex = 0;
        const arr = [{
            type: 'section',
            fields: []
        }];
        let count = 0;

        prepareData(data, year, month, notSlice)
            .map((user, idx) => {
                const sum = getReactionsSum(user, year, month);
                const temp = user && user?.reactions && user?.reactions[year] && user?.reactions[year][month];
                const userReactions = {};

                if (sum) {
                    Object.keys(temp).forEach(id => {
                        Object.keys(temp[id]).forEach((emojiName) => {
                            userReactions[emojiName] = userReactions[emojiName] ? userReactions[emojiName] + temp[id][emojiName] : temp[id][emojiName]
                        })
                    });
                }

                if (usersInDB) {
                    userIndex = prepareData(usersInDB, year, month, true).findIndex(user => user.id === data[0]?.id) + 1
                }

                if (arr[count]?.fields?.length === 10) {
                    arr.push({
                        type: 'section',
                        fields: []
                    });
                    count++;
                }
                arr[count].fields.push({
                    type: 'plain_text',
                    text: `${usersInDB ? userIndex : idx + 1}. ${user.name} (<@${user.username}>)`
                });
                arr[count].fields.push({
                    type: 'plain_text',
                    text: `Всего - ${sum}        ${Object.keys(userReactions).map(reaction => `:${reaction}: - ${userReactions[reaction]}`).join('  ')}`,
                    emoji: true
                });
            });

        return arr
    } else {
        let index = 0;
        const arr = [{
            type: "section",
            fields: []
        }];
        let count = 0;
        prepareDataWithReaction(data, reaction, year, month, notSlice)
            .map((user, idx) => {

                if (usersInDB) {
                    index = prepareDataWithReaction(usersInDB, reaction, year, month, true)
                        .findIndex(user => user.id === data[0]?.id) + 1
                }

                const reactionsCount = Object.keys(user.reactions[year][month]).reduce((acc, key) => {
                    if (user.reactions[year][month][key][reaction]) {
                        acc += user.reactions[year][month][key][reaction]
                    }
                    return acc;
                }, 0);

                if (arr[count]?.fields?.length === 10) {
                    arr.push({
                        type: 'section',
                        fields: []
                    });
                    count++;
                }

                arr[count].fields.push({
                    type: "plain_text",
                    "text": `${usersInDB ? index : idx + 1}. ${user.name} (<@${user.username}>)`,
                    emoji: true
                });
                arr[count].fields.push({
                    "type": "plain_text",
                    "text": `:${reaction}: ${kudos[reaction]} - ${reactionsCount}`,
                    emoji: true
                });
            });

        return arr;
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
        return reactionsLimit - Object.keys(userInDB.reactions_added[year][month][day]).reduce((acc, key) => { acc += getSum(userInDB.reactions_added[year][month][day][key]); return acc }, 0)
    } else {
        return 3;
    }
}

export const description = () => {
    const data = [
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
                text: `Общий рейтинг по всем набранным Kudos можно посмотреть в статистике ниже. Сотрудники, набравшие наибольшее количество Kudos по каждой из шести категорий, по итогам месяца вознаграждаются приятным подарком с айдентикой Flawless Group!)
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
    ]

    return data;
}

export const filterUsers = (users) => {
    return users.filter(user => {
        if (user.is_bot) {
            return false;
        } else {
            return true;
        }
    })
}

export const getDataHead = (admin) => {
    return {
        "type": "section",
        "text": {
            "type": "plain_text",
            "text": admin ? "Рейтинг" : "ТОП 5"
        }
    }
}

export const getKudosCount = (admin, usersInDB, year, month, reaction) => {
    if (admin) {
        let sum = 0;
        if (reaction) {
            usersInDB.forEach(user => {
                if (user.reactions && user.reactions[year] && user.reactions[year][month]) {
                    Object.keys(user.reactions[year][month]).forEach(key => {
                        if (user.reactions[year][month][key][reaction]) {
                            sum += user.reactions[year][month][key][reaction]
                        }
                    })
                }
            })
        } else {
            sum = usersInDB.filter(user => user.reactions && user.reactions[year] && user.reactions[year][month])
                .reduce((acc, user) => {
                    acc += Object.keys(user.reactions[year][month]).reduce((sum, key) => {
                        sum += getSum(user.reactions[year][month][key])

                        return sum;
                    }, 0)

                    return acc;
                }, 0)
        }

        return {
            type: 'section',
            text: {
                type: 'plain_text',
                text: `Всего kudos: ${sum}`
            }
        }
    }
    return {
        type: 'divider'
    }
}

export const getAdminBlock = (admin) => {
    if (admin) {
        return [
            {
                type: 'divider'
            },
            {
                type: 'section',
                text: {
                    type: 'plain_text',
                    text: 'Информация о полученных kudos'
                }
            },
            {
                "block_id": "user_emoji_info",
                "type": "actions",
                "elements": [
                    {
                        "type": "users_select",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Выберите пользователя",
                            "emoji": true
                        },
                        "action_id": "user_select_action"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Получить информацию",
                            "emoji": true
                        },
                        "value": "click_me_123",
                        "action_id": "get_user_info"
                    }
                ]
            }
        ]
    }
    return []
}

export const getInfoAboutUser = (user, usersList, year, month, admin) => {
    if (!admin) {
        return [{}]
    };

    if (!user) {
        return [{
            type: 'section',
            text: {
                type: 'plain_text',
                text: 'Нету данным по Kudos за этот период'
            }
        }]
    }

    if (user.reactions && user?.reactions[year] && user?.reactions[year][month]) {
        const arr = [{
            type: 'section',
            fields: []
        }];

        let count = 0;
        let i = 0;

        Object.keys(user.reactions[year][month])
            .sort((a, b) => {
                const sumA = getSum(user.reactions[year][month][a]);
                const sumB = getSum(user.reactions[year][month][b]);
                return sumB - sumA
            })
            .forEach((key) => {
                count++;
                const userByKey = usersList.find(item => String(item?.id) === String(key));
                if (!userByKey) {
                    count --;
                    return;
                }
                if (userByKey?.id === 'U03N4J0P12S') {
                    count--;
                    return;
                }

                if (arr[i].fields.length === 10) {
                    arr.push({
                        type: 'section',
                        fields: []
                    });
                    i++;
                }
                arr[i].fields.push({
                    type: 'plain_text',
                    text: `${count}. ${userByKey.real_name} (<@${userByKey.name}>)`
                });

                arr[i].fields.push({
                    type: 'plain_text',
                    text: `Всего: ${getSum(user.reactions[year][month][key])}  ${Object.keys(user.reactions[year][month][key]).map(emoji => `:${emoji}: - ${user.reactions[year][month][key][emoji]}`).join(' ')}`,
                    emoji: true
                })
        });
        return arr
    } else {
        return [{
            type: 'section',
            text: {
                type: 'plain_text',
                text: 'Нету данным по Kudos за этот период'
            }
        }]
    }
}

export const getSendKudosData = (users, year, month) => {
    const fields = [{
        type: 'section',
        fields: []
    }];
    let count = 0;

    users
    .filter(user => user && user?.reactions_added && user?.reactions_added[year] && user?.reactions_added[year][month])
    .sort((a, b) => {
        let sumA = 0;
        let sumB = 0;
        Object.keys(a.reactions_added[year][month])
            .forEach(day => {
                Object.keys(a.reactions_added[year][month][day])
                    .forEach(userId => {
                        sumA += getSum(a.reactions_added[year][month][day][userId])
                    })
            });
        Object.keys(b.reactions_added[year][month])
            .forEach(day => {
                Object.keys(b.reactions_added[year][month][day])
                    .forEach(userId => {
                        sumB += getSum(b.reactions_added[year][month][day][userId])
                    })
            });
        return sumB - sumA;
    })
    .forEach((user, i) => {
        const summaryKudos = {};
        if (user && user?.reactions_added && user?.reactions_added[year] && user?.reactions_added[year][month]) {
            Object.keys(user.reactions_added[year][month]).forEach(day => {
                Object.keys(user.reactions_added[year][month][day]).forEach(userId => {
                    Object.keys(user.reactions_added[year][month][day][userId]).forEach(emoji => {
                        summaryKudos[emoji] = summaryKudos[emoji] ? summaryKudos[emoji] + user.reactions_added[year][month][day][userId][emoji] : user.reactions_added[year][month][day][userId][emoji];
                    })
                })
            });
        }
        if (fields[0].fields.length === 10) {
            fields.push({
                type: 'section',
                fields: []
            });
            count++;
        }
        fields[count].fields.push({
            type: 'plain_text',
            text: `${i + 1}. ${user.name} (<@${user.username}>)`
        });
        fields[count].fields.push({
            type: 'plain_text',
            text: `Всего - ${getSum(summaryKudos)}  ${Object.keys(summaryKudos).map(emoji => `:${emoji}: - ${summaryKudos[emoji]}`).join(' ')}`,
            emoji: true
        });
    });
    return fields
}