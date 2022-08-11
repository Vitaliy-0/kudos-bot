import mongoose from 'mongoose';
import { userSchema } from './schemas/User.js';

export const monthes = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const kudos = {
    'all': 'По всем Kudos',
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

export const filterUsers = (users) => {
    return users.filter(user => {
        if (user.is_bot || user.id === 'USLACKBOT' || user.deleted) {
            return false;
        } else {
            return true;
        }
    })
}

const prepareData = (data, year, month, notSliced, usersList, adding) => {
    const workedData = [...data];
    filterUsers(usersList.members)
        .forEach(async user => {
            const exist = data.some(el => el?.id === user.id);

            if (!exist && adding) {
                const User = mongoose.model('User', userSchema);
                const newUser = new User({
                    id: user.id,
                    name: user.real_name,
                    username: user.name,
                    reactions: {},
                    reactions_added: {}
                });
                await newUser.save();
                workedData.push(user)
            }
        })

    return workedData.sort((user1, user2) => {
        const check1 = user1 && user1.reactions && user1.reactions[year] && user1.reactions[year][month];
        const sum1 = check1 && Object.keys(check1).reduce((acc, userId) => {
            acc += getSum(check1[userId]) 
            return acc;
        }, 0) || 0;
        const check2 = user2 && user2.reactions && user2.reactions[year] && user2.reactions[year][month];
        const sum2 = check2 && Object.keys(check2).reduce((acc, userId) => {
            acc += getSum(check2[userId]);
            return acc;
        }, 0) || 0;

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

export const transformDataFromDB2 = (data, usersList, reaction, year, month, notSlice = false) => {
    const currentMonth = monthes[new Date().getMonth()];

    if (!reaction) {
        const arr = [{
            type: 'section',
            fields: []
        }];
        let count = 0;

        const preparedData = prepareData(data, year, month, notSlice, usersList, true)
        if (!data.some(user => user && user.reactions && user.reactions[year] && user.reactions[year][month]) && month !== currentMonth) {
            return arr
        }
        preparedData.map((user, idx) => {
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

            if (arr[count]?.fields?.length === 10) {
                arr.push({
                    type: 'section',
                    fields: []
                });
                count++;
            }
            arr[count].fields.push({
                type: 'plain_text',
                text: `${idx + 1}. ${user.name || ''} (<@${user.username}>)`
            });
            arr[count].fields.push({
                type: 'plain_text',
                text: `Всего - ${sum}        ${Object.keys(userReactions).map(reaction => `:${reaction}: - ${userReactions[reaction]}`).join('  ')}`,
                emoji: true
            });
        });

        return arr
    } else {
        const arr = [{
            type: "section",
            fields: []
        }];
        let count = 0;
        prepareDataWithReaction(data, reaction, year, month, notSlice)
            .map((user, idx) => {

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
                    "text": `${idx + 1}. ${user.name} (<@${user.username}>)`,
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

export const transformUserData = async (userInDB, usersInDB, usersList, year, month, isAdmin, reactionName) => {
    if (!userInDB) {
        return;
    }

    if (!reactionName) {
        const index = (prepareData(usersInDB, year, month, true, usersList, false).findIndex(user => user.id === userInDB.id) || 0) + 1;
        const reactions = {};
        const sum = userInDB?.reactions && userInDB?.reactions[year] && userInDB?.reactions[year][month]
            && Object.keys(userInDB?.reactions[year][month]).reduce((acc, id) => {
                acc += Object.keys(userInDB?.reactions[year][month][id]).reduce((accum, reaction) => {
                    const count = userInDB?.reactions[year][month][id][reaction]
                    accum += count;
                    if (!reactions[reaction]) {
                        reactions[reaction] = count
                    } else {
                        reactions[reaction] = reactions[reaction] + count
                    }
                    return accum;
                }, 0);
                return acc;
            }, 0) || 0;
        if (sum <= 0) {
            return;
        }
        return [{
            type: 'section',
            fields: [
                {
                    type: 'plain_text',
                    text: `${typeof index === 'number' ? index : ''}. ${userInDB.name} (<@${userInDB.username}>)`
                },
                {
                    type: 'plain_text',
                    text: `Всего - ${sum}        ${Object.keys(reactions).map(key => `:${key}: - ${reactions[key]}`).join(' ')}`
                }
            ]
        }]
    } else {
        const preparedData = prepareDataWithReaction(usersInDB, reactionName, year, month, true);
        const sum = userInDB?.reactions && userInDB?.reactions[year] && userInDB?.reactions[year][month]
            && Object.keys(userInDB?.reactions[year][month]).reduce((acc, id) => {
                acc += userInDB?.reactions[year][month][id][reactionName] || 0;
                return acc;
            }, 0)
        const index = preparedData.findIndex(el => el.id === userInDB.id) + 1;
        if (index === 0) {
            return
        }
        return [{
            type: 'section',
            fields: [
                {
                    type: 'plain_text',
                    text: `${index}. ${userInDB.name || ''} (<@${userInDB.username}>)`
                },
                {
                    type: 'plain_text',
                    text: `:${reactionName}: ${kudos[reactionName]} - ${sum}`
                }
            ]
        }]
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

export const getMainElements = (isAdmin, newYears, newMonthes, year, month, emoji) => {
    if (isAdmin) {
        return [
            {
                "type": "static_select",
                "placeholder": {
                    "type": "plain_text",
                    "text": "Выберите kudos",
                    "emoji": true
                },
                "options": emoji,
                "action_id": "kudos_select"
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
            {
                "type": "users_select",
                "placeholder": {
                    "type": "plain_text",
                    "text": "Выберите пользователя",
                    "emoji": true
                },
                "action_id": "user_select_action"
            }
        ]
    } else {
        return [
            {
                "type": "static_select",
                "placeholder": {
                    "type": "plain_text",
                    "text": "Выберите kudos",
                    "emoji": true
                },
                "options": emoji,
                "action_id": "kudos_select"
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
            }
        ]
    }
}

export const getInfoAboutUser = (user, usersList, year, month, reaction) => {
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

        if (!reaction || reaction === ':all:') {
            Object.keys(user.reactions[year][month])
                .sort((a, b) => {
                    const sumA = getSum(user.reactions[year][month][a]);
                    const sumB = getSum(user.reactions[year][month][b]);
                    return sumB - sumA
                })
                .forEach(key => {
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
            const normalize = reaction.split(':')[1]
            Object.keys(user.reactions[year][month])
                .filter(userId => user.reactions[year][month][userId][normalize])
                .sort((a, b) => {
                    const sumA = getSum(user.reactions[year][month][a][normalize] || {});
                    const sumB = getSum(user.reactions[year][month][b][normalize] || {});
                    return sumB - sumA
                })
                .forEach(key => {
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
                        text: `:${normalize}: ${kudos[normalize]} - ${user.reactions[year][month][key][normalize]}`,
                        emoji: true
                    })
                });
            return arr
        }

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

export const getSendKudosData = (users, year, month, selectedUser) => {
    const fields = [{
        type: 'section',
        fields: []
    }];
    let count = 0;

    if (!selectedUser) {
        if (!users.some(us => us && us.reactions_added && us.reactions_added[year] && us.reactions_added[year][month])) {
            return fields;
        }
        users
            .sort((a, b) => {
                let sumA = 0;
                let sumB = 0;
                const check1 = a && a.reactions_added && a.reactions_added[year] && a.reactions_added[year][month];
                check1 && Object.keys(check1)
                    .forEach(day => {
                        Object.keys(check1[day])
                            .forEach(userId => {
                                sumA += getSum(check1[day][userId])
                            })
                    });
                const check2 = b && b.reactions_added && b.reactions_added[year] && b.reactions_added[year][month];
                check2 && Object.keys(check2)
                    .forEach(day => {
                        Object.keys(check2[day])
                            .forEach(userId => {
                                sumB += getSum(check2[day][userId])
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
    } else {
        const user = users.find(item => item.id === selectedUser);
        if (!user || !(user?.reactions_added && user?.reactions_added[year] && user?.reactions_added[year][month])) return fields;
        const reactions = {};
        Object.values(user.reactions_added[year][month]).forEach(day => {
            Object.keys(day).forEach(userId => {
                if (reactions[userId]) {
                    Object.keys(day[userId]).forEach(reaction => {
                        reactions[userId] = {
                            ...reactions[userId],
                            [reaction]: reactions[userId][reaction] ? reactions[userId][reaction] + day[userId][reaction] : day[userId][reaction]
                        }
                    })
                } else {
                    reactions[userId] = day[userId]
                }
            })
        })
        Object.keys(reactions)
            .sort((a, b) => {
                const sum1 = getSum(reactions[a]);
                const sum2 = getSum(reactions[b]);
                return sum2 - sum1;
            })
            .forEach((userId, i) => {
                const user = users.find(u => u.id === userId);
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
                    text: `Всего - ${getSum(reactions[userId])}  ${Object.keys(reactions[userId]).map(emoji => `:${emoji}: - ${reactions[userId][emoji]}`).join(' ')}`,
                    emoji: true
                });
            })
    }
    return fields
}